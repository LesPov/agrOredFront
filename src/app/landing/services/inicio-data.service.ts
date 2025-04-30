// src/app/shared/services/inicio-data.service.ts
import { Injectable } from '@angular/core';
import { Observable, map, catchError, of, forkJoin, startWith, tap } from 'rxjs';
import { CampiAmigoZonesService, ZoneData } from '../../features/campiamigo/services/campiAmigoZones.service';
import { environment } from '../../../environments/environment';
import { CampiAmigoProductsService, Product, Zone } from '../../features/campiamigo/services/campiAmigoProducts.service';

// --- Interfaces Existentes ---
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

export interface InitialDataResult {
  zones: ZoneData[];
  products: DisplayProductInicio[];
  defaultZone: ZoneData | null;
  success: boolean;
  errorMessage?: string;
}

// --- NUEVA Interfaz para el Estado del Flujo ---
export type InicioState =
  | { status: 'loading' }
  | { status: 'success'; zones: ZoneData[]; products: DisplayProductInicio[]; defaultZone: ZoneData | null }
  | { status: 'error'; errorMessage: string };


@Injectable({
  providedIn: 'root'
})
export class InicioDataService {

  private readonly baseAssetUrl = environment.endpoint.endsWith('/') ? environment.endpoint : environment.endpoint + '/';
  private readonly defaultProductImage = 'assets/img/default-product.png';
  private readonly PASCA_ZONE_ID = 11;

  constructor(
    private campiAmigoZonesService: CampiAmigoZonesService,
    private campiAmigoProductsService: CampiAmigoProductsService
  ) {}

  // ======================================================================== //
  // == NUEVO: Método Principal para obtener el flujo de estado inicial    == //
  // ======================================================================== //

  /**
   * Devuelve un Observable que emite el estado del proceso de carga inicial.
   * Emite 'loading', luego 'success' con los datos, o 'error' con un mensaje.
   */
  getInicioStateStream(): Observable<InicioState> {
    return of(undefined).pipe( // Inicia el flujo
      // 1. Emitir estado 'loading' inmediatamente
      tap(() => console.log('InicioDataService: Emitting loading state...')), // Log opcional
      map(() => ({ status: 'loading' } as InicioState)), // Emite estado loading
      // 2. Llamar a la carga real de datos
      // switchMap(() => this.loadInitialData()), // Usamos switchMap si la llamada dependiera de algo anterior, pero aquí map/concatMap o simplemente anidar es suficiente
      // O MÁS SIMPLE: Usamos el resultado del map para encadenar
      // Necesitamos encadenar la carga DESPUÉS de emitir 'loading'.
      // Podemos usar un operador como concatMap o mergeMap, o simplemente estructurarlo.
      // Vamos a usar una estructura más explícita con startWith y luego el fetch.

      // REESTRUCTURACIÓN: Usar startWith para 'loading' y luego el fetch
      startWith({ status: 'loading' } as InicioState), // Emite 'loading' primero
      // Ahora, la lógica de carga real
      () => this.loadInitialData().pipe(
        map((result: InitialDataResult) => {
          if (result.success) {
            // 3a. Si éxito, emitir estado 'success' con los datos
            return {
              status: 'success',
              zones: result.zones,
              products: result.products,
              defaultZone: result.defaultZone
            } as InicioState;
          } else {
            // 3b. Si fallo controlado (success: false), emitir estado 'error'
            console.warn("InicioDataService: Load completed with success:false.", result.errorMessage);
            return {
              status: 'error',
              errorMessage: result.errorMessage ?? 'Error desconocido al cargar datos iniciales.'
            } as InicioState;
          }
        }),
        catchError(err => {
          // 3c. Si ocurre un error no controlado en el flujo, emitir estado 'error'
          console.error("InicioDataService: Uncaught error during loadInitialData:", err);
          return of({
            status: 'error',
            errorMessage: 'Ocurrió un error inesperado. Intenta de nuevo más tarde.'
          } as InicioState);
        })
      ) // Fin de la llamada a loadInitialData
    // ) // Fin del pipe principal (si usamos switchMap/concatMap)
    ); // Fin del of().pipe() inicial si usamos startWith

    // Corrección: La llamada a la función que devuelve el Observable debe estar dentro de un operador como mergeMap o switchMap si queremos que se ejecute DESPUÉS del tap/map inicial. O usar startWith.
    // Refactorización final usando startWith y switchMap (más canónico):
    return this.loadInitialData().pipe(
        map((result: InitialDataResult) => {
            if (result.success) {
                return { status: 'success', zones: result.zones, products: result.products, defaultZone: result.defaultZone } as InicioState;
            } else {
                 console.warn("InicioDataService: Load completed with success:false.", result.errorMessage);
                 // Lanzamos un error para que lo capture catchError y lo convierta en estado 'error'
                 throw new Error(result.errorMessage ?? 'Error desconocido al cargar datos iniciales.');
                 // O devolvemos directamente el estado de error si preferimos no usar throw
                 // return { status: 'error', errorMessage: result.errorMessage ?? 'Error desconocido...' } as InicioState; // Opción alternativa
            }
        }),
        catchError(err => {
            // Captura errores lanzados (incluyendo el de success:false) o errores de red/HTTP
            console.error("InicioDataService: Error caught during data loading:", err);
            const message = err instanceof Error ? err.message : 'Ocurrió un error inesperado. Intenta de nuevo.';
            return of({ status: 'error', errorMessage: message } as InicioState);
        }),
        startWith({ status: 'loading' } as InicioState) // Emitir 'loading' al principio de la suscripción
    );
  }


  // ======================================================================== //
  // == Método Interno Original de Carga (sin cambios)                     == //
  // ======================================================================== //
  /**
   * Orquesta la carga en paralelo de zonas y productos iniciales.
   * Devuelve un Observable que emite un objeto `InitialDataResult`.
   * (Este método ahora es "privado" en términos de uso externo para el flujo de estado,
   *  aunque sigue siendo público para ser llamado por getInicioStateStream)
   */
  loadInitialData(): Observable<InitialDataResult> {
    return forkJoin({
      zonesData: this.loadZonesAndSelectDefault(),
      productsData: this.loadAndProcessProducts()
    }).pipe(
      map(({ zonesData, productsData }) => {
        const overallSuccess = zonesData.success && productsData.success;
        let errorMessage: string | undefined = undefined;
        if (!overallSuccess) {
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
      // CatchError aquí podría ser redundante si el catchError en getInicioStateStream ya lo maneja
      // catchError(err => { ... }) // Podríamos quitarlo si el de arriba es suficiente
    );
  }

  // --- Métodos internos loadZonesAndSelectDefault, loadAndProcessProducts, mapProductToDisplay, getProductClimateInfo ---
  // --- (Sin cambios respecto a tu versión original) ---
  private loadZonesAndSelectDefault(): Observable<{ zones: ZoneData[], defaultZone: ZoneData | null, success: boolean, errorMessage?: string }> {
    return this.campiAmigoZonesService.getAllZones().pipe(
      map(zones => {
        const defaultZone = zones.find(zone => zone.id === this.PASCA_ZONE_ID) ?? zones[0] ?? null;
        return { zones, defaultZone, success: true };
      }),
      catchError(err => {
        console.error("Error cargando zonas en InicioDataService:", err);
        return of({ zones: [], defaultZone: null, success: false, errorMessage: 'Error al cargar zonas.' });
      })
    );
  }

  private loadAndProcessProducts(): Observable<{ products: DisplayProductInicio[], success: boolean, errorMessage?: string }> {
    return this.campiAmigoProductsService.getAllProductsWithUsers().pipe(
      map(resp => {
        const products = resp.products.map(p => this.mapProductToDisplay(p));
        return { products, success: true };
      }),
      catchError(err => {
        console.error("Error cargando productos en InicioDataService:", err);
        return of({ products: [], success: false, errorMessage: 'Error al cargar productos.' });
      })
    );
  }

  private mapProductToDisplay(p: Product): DisplayProductInicio {
    const productZone = p.auth?.userProfile?.zone;
    const { climateClass, climateText } = this.getProductClimateInfo(productZone);
    const producerLocation = productZone ? `${productZone.name} · ${productZone.departamentoName}` : p.auth?.userProfile?.direccion || 'N/A';
    const imageUrl = p.image ? `${this.baseAssetUrl}uploads/productos/imagenes/${p.image}` : this.defaultProductImage;
    const discountPercentage = p.id % 3 === 0 ? 15 : undefined;
    const isTopProduct = p.id % 5 === 0;
    const originalPrice = discountPercentage ? p.price / (1 - discountPercentage / 100) : undefined;
    const ratingCount = Math.floor(Math.random() * 200) + 50;
    return { ...p, imageUrl, producerLocation, climateClass, climateText, glbFile: p.glbFile, discountPercentage, isTopProduct, originalPrice, ratingCount };
  }

  private getProductClimateInfo(zone?: Zone): { climateClass: 'cold' | 'hot' | 'other'; climateText: string } {
    if (!zone?.climate) return { climateClass: 'other', climateText: 'Clima N/A' };
    const cl = zone.climate.toLowerCase();
    switch (cl) {
      case 'frio': case 'frío': return { climateClass: 'cold', climateText: 'Clima Frío' };
      case 'calido': case 'cálido': case 'templado': return { climateClass: 'hot', climateText: 'Clima Templado' };
      default: return { climateClass: 'other', climateText: `Clima ${zone.climate}` };
    }
  }

}