// src/app/shared/services/inicio-data.service.ts
import { Injectable } from '@angular/core';
import { Observable, map, catchError, of, forkJoin } from 'rxjs';
import { CampiAmigoZonesService, ZoneData } from '../../features/campiamigo/services/campiAmigoZones.service';
import { environment } from '../../../environments/environment';
import { CampiAmigoProductsService, Product, Zone } from '../../features/campiamigo/services/campiAmigoProducts.service';
 
// --- Definición de Interfaces (Importar o redefinir si es necesario) ---
// Asegúrate de que estas interfaces estén accesibles o cópialas aquí
interface DisplayProductInicio extends Product {
  imageUrl: string;
  producerLocation: string;
  climateClass: 'cold' | 'hot' | 'other';
  climateText: string;
  discountPercentage?: number;
  isTopProduct?: boolean;
  originalPrice?: number;
  ratingCount?: number;
}

// Interfaz para agrupar los datos iniciales devueltos por el servicio
export interface InitialDataResult {
  zones: ZoneData[];
  products: DisplayProductInicio[];
  defaultZone: ZoneData | null;
  success: boolean; // Indica si la carga general fue exitosa
  errorMessage?: string; // Mensaje de error si success es false
}


@Injectable({
  providedIn: 'root' // Hace el servicio un singleton disponible globalmente
})
export class InicioDataService {

  // Mover constantes relevantes al servicio
  private readonly baseAssetUrl = environment.endpoint.endsWith('/') ? environment.endpoint : environment.endpoint + '/';
  private readonly defaultProductImage = 'assets/img/default-product.png';
  private readonly PASCA_ZONE_ID = 11;

  constructor(
    private campiAmigoZonesService: CampiAmigoZonesService,
    private campiAmigoProductsService: CampiAmigoProductsService
  ) {}

  // ======================================================================== //
  // == Método Principal de Carga de Datos Iniciales                       == //
  // ======================================================================== //

  /**
   * Orquesta la carga en paralelo de zonas y productos iniciales.
   * Devuelve un Observable que emite un objeto `InitialDataResult` con los
   * datos combinados y un estado de éxito/error general.
   */
  loadInitialData(): Observable<InitialDataResult> {
    return forkJoin({
      zonesData: this.loadZonesAndSelectDefault(), // Llama al método de zonas
      productsData: this.loadAndProcessProducts() // Llama al método de productos
    }).pipe(
      map(({ zonesData, productsData }) => {
        // Combina resultados y determina éxito general
        const overallSuccess = zonesData.success && productsData.success;
        let errorMessage: string | undefined = undefined;
        if (!overallSuccess) {
            // Combina mensajes de error si existen
            errorMessage = [zonesData.errorMessage, productsData.errorMessage].filter(Boolean).join(' ');
            if (!errorMessage) errorMessage = 'Error desconocido al cargar datos iniciales.';
        }

        return {
          zones: zonesData.zones,
          defaultZone: zonesData.defaultZone,
          products: productsData.products,
          success: overallSuccess,
          errorMessage: errorMessage
        };
      }),
      // No es necesario un catchError aquí porque los métodos internos ya lo manejan devolviendo 'success: false'
    );
  }

  // ======================================================================== //
  // == Métodos Internos para Carga Específica                             == //
  // ======================================================================== //

  /**
   * Carga todas las zonas desde el servicio `CampiAmigoZonesService`,
   * selecciona la zona por defecto y maneja errores específicos de esta carga.
   * Devuelve un Observable con el resultado de la carga de zonas.
   */
  private loadZonesAndSelectDefault(): Observable<{ zones: ZoneData[], defaultZone: ZoneData | null, success: boolean, errorMessage?: string }> {
    return this.campiAmigoZonesService.getAllZones().pipe(
      map(zones => {
        // Lógica para seleccionar la zona por defecto
        const defaultZone = zones.find(zone => zone.id === this.PASCA_ZONE_ID) ?? zones[0] ?? null;
        return { zones, defaultZone, success: true }; // Éxito
      }),
      catchError(err => {
        console.error("Error cargando zonas en InicioDataService:", err);
        // Devuelve un estado de error específico para las zonas
        return of({ zones: [], defaultZone: null, success: false, errorMessage: 'Error al cargar zonas.' });
      })
    );
  }

  /**
   * Carga los productos con información de usuario desde `CampiAmigoProductsService`,
   * los procesa (mapea a `DisplayProductInicio`) y maneja errores específicos.
   * Devuelve un Observable con el resultado de la carga de productos.
   */
  private loadAndProcessProducts(): Observable<{ products: DisplayProductInicio[], success: boolean, errorMessage?: string }> {
    return this.campiAmigoProductsService.getAllProductsWithUsers().pipe(
      map(resp => {
        // Mapea cada producto usando el helper
        const products = resp.products.map(p => this.mapProductToDisplay(p));
        return { products, success: true }; // Éxito
      }),
      catchError(err => {
        console.error("Error cargando productos en InicioDataService:", err);
        // Devuelve un estado de error específico para los productos
        return of({ products: [], success: false, errorMessage: 'Error al cargar productos.' });
      })
    );
  }

  // ======================================================================== //
  // == Funciones Auxiliares (Helpers) dentro del Servicio                 == //
  // ======================================================================== //

  /**
   * Mapea un objeto `Product` crudo a la interfaz `DisplayProductInicio`
   * enriqueciéndolo con datos calculados o formateados para la UI.
   */
  private mapProductToDisplay(p: Product): DisplayProductInicio {
    const productZone = p.auth?.userProfile?.zone;
    const { climateClass, climateText } = this.getProductClimateInfo(productZone);
    const producerLocation = productZone ? `${productZone.name} · ${productZone.departamentoName}` : p.auth?.userProfile?.direccion || 'N/A';
    const imageUrl = p.image ? `${this.baseAssetUrl}uploads/productos/imagenes/${p.image}` : this.defaultProductImage;
    // Lógica simulada para badges/descuentos (se mantiene por ahora)
    const discountPercentage = p.id % 3 === 0 ? 15 : undefined;
    const isTopProduct = p.id % 5 === 0;
    const originalPrice = discountPercentage ? p.price / (1 - discountPercentage / 100) : undefined;
    const ratingCount = Math.floor(Math.random() * 200) + 50;
    return { ...p, imageUrl, producerLocation, climateClass, climateText, glbFile: p.glbFile, discountPercentage, isTopProduct, originalPrice, ratingCount };
  }

  /**
   * Determina la clase CSS y el texto descriptivo del clima basado en la
   * información de la zona asociada a un producto. (Helper interno).
   */
  private getProductClimateInfo(zone?: Zone): { climateClass: 'cold' | 'hot' | 'other'; climateText: string } {
    if (!zone?.climate) return { climateClass: 'other', climateText: 'Clima N/A' };
    const cl = zone.climate.toLowerCase();
    switch (cl) {
      case 'frio': case 'frío': return { climateClass: 'cold', climateText: 'Clima Frío' };
      case 'calido': case 'cálido': case 'templado': return { climateClass: 'hot', climateText: 'Clima Templado' };
      default: return { climateClass: 'other', climateText: `Clima ${zone.climate}` };
    }
  }

} // Fin Clase InicioDataService