// ==================================================================================
// DETALLE-PRODUCTS COMPONENT (detalle-products.component.ts) - CORREGIDO
// ==================================================================================
import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
  AfterViewInit,
  PLATFORM_ID,
  Inject
} from '@angular/core';
import { isPlatformBrowser, CommonModule, Location, DatePipe, CurrencyPipe, DecimalPipe, NgFor, NgIf, NgClass, NgSwitch, NgSwitchCase, NgSwitchDefault } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as L from 'leaflet';

import { environment } from '../../../../../../environments/environment'; // Ajusta ruta si es necesario
import { FormsModule } from '@angular/forms';
import { CampiAmigoProductsService, ProductDetail } from '../../../../campiamigo/services/campiAmigoProducts.service';
import { LoginPromptComponent } from '../../../../../shared/components/login-prompt/login-prompt.component';
 
type MediaItem = { type: 'image' | 'video' | 'model'; url: string };

// --- Icono Default (Fallback) ---
// !! ASEGÚRATE DE COPIAR ESTOS ARCHIVOS A src/assets/ !!
const iconDefault = L.icon({
  iconUrl: 'assets/marker-icon.png',
  iconRetinaUrl: 'assets/marker-icon-2x.png',
  shadowUrl: 'assets/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], tooltipAnchor: [16, -28], shadowSize: [41, 41]
});

@Component({
  selector: 'app-detalle-products',
  standalone: true,
  // Asegúrate que todos los módulos necesarios estén aquí
  imports: [
    CommonModule, // Incluye NgIf, NgFor, etc. y Pipes como DatePipe, CurrencyPipe, DecimalPipe
    FormsModule,  // Para [(ngModel)]
    LoginPromptComponent
  ],
 
  templateUrl: './detalle-products.component.html',
  styleUrls: ['./detalle-products.component.css'] // <-- Verifica que esta ruta sea correcta
})
export class DetalleProductsComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('glbCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('videoPlayer') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('mapContainer') private mapContainer!: ElementRef<HTMLElement>;

  loading = true;
  errorMsg: string | null = null;
  product?: ProductDetail;

  media: MediaItem[] = [];
  selectedMediaIndex = -1;

  // --- Vendedor / Campiamigo ---
  sellerName = 'Cargando...';
  sellerAvatarUrl?: string;
  sellerLocationShort = 'Cargando...';
  sellerClimateTag = 'Cargando...'; // Ya la tenías
  sellerLocation = 'Cargando...';
  sellerbiography = 'Información sobre el campiamigo no disponible actualmente.';
  sellerMunicipality: string | undefined;
  sellerDepartment: string | undefined;
  // Coordenadas: Puede ser null inicialmente si no se encuentran
  sellerCoords: L.LatLngTuple | null = null;

  // --- Producto ---
  productName = 'Cargando nombre...';
  productSubtitle: string | undefined = '';
  productDescription = 'Cargando descripción...';
  productPrice = 0;
  productRating = 0;
  productReviews = 0;
  productUnit = 'unidad';
  productStock = 0;
  productMinOrder = 1;
  productDeliveryTime = 'Consultando...';
  productHarvestDate: string | Date | undefined = undefined;
  productCategories: string[] = [];
  isProductAvailable: boolean = false;
  productTags: string[] = [];

  // --- Cantidad ---
  quantityPresets = [1, 5, 10, 25];
  currentQuantity = 1;
  totalPrice = 0;

  // --- Three.js ---
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private animationId!: number;
  private threeInitialized = false;
  private isAnimating = false;
  private currentModelUrl: string | null = null;

  // --- Leaflet ---
  private map!: L.Map;
  private marker?: L.Marker;
  isMapInitialized = false;
  private popupGetDirectionsListener: (() => void) | null = null;
  // --- NUEVA PROPIEDAD ---
  accessMode: 'public' | 'private' = 'public'; // Para almacenar el modo de acceso
  // --- NUEVA PROPIEDAD para controlar el modal ---
  showLoginPrompt: boolean = false;
  loginPromptTitle: string = 'Contactar al CampiAmigo';
  loginPromptMessage: string = 'Para ver la información de contacto del CampiAmigo y enviarle un mensaje directo, por favor inicia sesión o regístrate.';
  // --- FIN NUEVA PROPIEDAD ---
  constructor(
    private route: ActivatedRoute,
    private location: Location,
    private router: Router,
    private service: CampiAmigoProductsService,
    private cdRef: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit(): void {
    // 1. Leer el modo de acceso (como ya lo hacías)
    this.accessMode = this.route.snapshot.data['mode'] || 'public';
    console.log(`DetalleProductsComponent cargado en modo: ${this.accessMode}`);

    // 2. Intentar obtener el ID de la ruta O de los queryParams
    const idFromParams = this.route.snapshot.params['id'];         // Para /inicio/detalleProducto/:id
    const idFromQueryParams = this.route.snapshot.queryParams['id']; // Para /user/detalleProducto?id=...
    const productIdString = idFromParams || idFromQueryParams;

    if (productIdString) {
      const id = Number(productIdString);
      if (!isNaN(id) && id > 0) {
        console.log(`Producto ID encontrado: ${id} (Fuente: ${idFromParams ? 'params' : 'queryParams'})`);
        this.resetState();
        this.fetchProduct(id);
      } else {
        console.error('ID de producto inválido encontrado:', productIdString);
        this.errorMsg = 'El ID del producto proporcionado no es válido.';
        this.loading = false;
        this.cdRef.detectChanges();
      }
    } else {
      console.error('No se encontró ID de producto en la ruta ni en queryParams.');
      this.errorMsg = 'No se especificó un ID de producto para cargar.';
      this.loading = false;
      this.cdRef.detectChanges();
    }
  }
  ngAfterViewInit(): void {
    if (this.media.length > 0 && this.selectedMediaIndex >= 0 && this.media[this.selectedMediaIndex]?.type === 'model') {
      setTimeout(() => this.setupThreeIfNeeded(), 0);
    }
    this.tryInitMap();
  }

  ngOnDestroy(): void {
    this.cleanupThree();
    window.removeEventListener('resize', this.onWindowResize);
    if (this.isBrowser && this.map) {
      this.map.remove();
    }
  }

  private resetState(): void {
    this.loading = true; this.errorMsg = null; this.product = undefined;
    this.media = []; this.selectedMediaIndex = -1;
    this.cleanupThree(); this.threeInitialized = false; this.isAnimating = false; this.currentModelUrl = null;
    this.sellerName = 'Cargando...'; this.sellerAvatarUrl = undefined; this.sellerLocationShort = 'Cargando...';
    this.sellerClimateTag = 'Cargando...'; this.sellerLocation = 'Cargando...'; this.sellerbiography = 'Información no disponible.';
    this.sellerMunicipality = undefined; this.sellerDepartment = undefined; this.sellerCoords = null;
    this.productName = 'Cargando...'; this.productSubtitle = ''; this.productDescription = 'Cargando...';
    this.productPrice = 0; this.productRating = 0; this.productReviews = 0; this.productUnit = 'unidad';
    this.productStock = 0; this.productMinOrder = 1; this.productDeliveryTime = 'Consultando...';
    this.productHarvestDate = undefined; this.productCategories = []; this.isProductAvailable = false;
    this.productTags = [];
    this.currentQuantity = 1; this.totalPrice = 0;
    if (this.isBrowser && this.map) { this.map.remove(); }
    this.isMapInitialized = false;
  }

  private fetchProduct(id: number): void {
    this.loading = true;
    this.errorMsg = null;

    this.service.getProductById(id).subscribe({
      next: ({ product }) => {
        if (!product) {
          this.errorMsg = 'Producto no encontrado.';
          this.loading = false;
          this.cdRef.detectChanges();
          return;
        }
        console.log('API Response Product:', product);
        this.product = product;
        const base = environment.endpoint.endsWith('/') ? environment.endpoint : environment.endpoint + '/';

        // Media
        this.media = [];
        if (product.image) { this.media.push({ type: 'image', url: `${base}uploads/productos/imagenes/${product.image}` }); }
        if (product.video) { this.media.push({ type: 'video', url: `${base}uploads/productos/videos/${product.video}` }); }
        if (product.glbFile) { this.media.push({ type: 'model', url: `${base}uploads/productos/modelos/${product.glbFile}` }); }

        // Vendedor / Campiamigo
        const profile = product.auth?.userProfile;
        this.sellerName = profile ? `${profile.firstName} ${profile.lastName}` : 'Vendedor Anónimo';
        this.sellerAvatarUrl = profile?.profilePicture ? `${base}uploads/client/profile/${profile.profilePicture}` : undefined;
        this.sellerLocation = profile?.direccion || 'Dirección no especificada';
        this.sellerMunicipality = profile?.zone?.name;
        this.sellerDepartment = profile?.zone?.departamentoName;
        this.sellerLocationShort = this.sellerMunicipality && this.sellerDepartment
          ? `${this.sellerMunicipality}, ${this.sellerDepartment}`
          : this.sellerMunicipality || this.sellerDepartment || 'Ubicación no disponible';
        this.sellerClimateTag = profile?.zone?.climate === 'frio' ? 'Frío' :
          profile?.zone?.climate === 'calido' ? 'Cálido' : 'Clima no especificado';
        this.sellerbiography = profile?.biography || 'Biografía no disponible.';
        this.productTags = profile?.tags?.map(t => t.name) || [];
        this.sellerCoords = this._parseCoordsFromString(this.sellerLocation);

        // Producto
        this.productName = product.name;
        this.productSubtitle = product.subtitle;
        this.productDescription = product.description || 'Sin descripción.';
        this.productPrice = product.price || 0;
        this.productRating = product.rating || 0;
        this.productReviews = product.reviewCount || 0;
        this.productStock = product.stock || 0;
        this.productMinOrder = product.minOrder || 1;
        this.productUnit = product.unit || 'unidad';
        this.productDeliveryTime = product.deliveryTime || 'No especificado';
        this.productHarvestDate = product.harvestDate ? new Date(product.harvestDate) : undefined;
        this.productCategories = product.categories || [];
        this.isProductAvailable = this.productStock > 0;
        this.currentQuantity = this.productMinOrder > 0 ? this.productMinOrder : 1;
        this.updateTotalPrice();

        // Media Inicial
        if (this.media.length > 0) {
          let initialIndex = this.media.findIndex(m => m.type === 'image');
          this.selectedMediaIndex = (initialIndex >= 0) ? initialIndex : 0;
          if (this.isBrowser && this.media[this.selectedMediaIndex].type === 'model') {
            setTimeout(() => this.setupThreeIfNeeded(), 0);
          }
        } else { this.selectedMediaIndex = -1; }

        this.loading = false;
        this.cdRef.detectChanges();
        if (this.isBrowser) { this.tryInitMap(); }
      },
      error: err => {
        this.loading = false;
        this.errorMsg = `Error al cargar el producto: ${err?.error?.msg || err?.message || 'Error desconocido'}`;
        console.error("Error fetching product:", err);
        this.cdRef.detectChanges();
      }
    });
  }

  private _parseCoordsFromString(locationString: string): L.LatLngTuple | null {
    if (!locationString) return null;
    const regex = /Lat:\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*Lng:\s*(-?\d{1,3}(?:\.\d+)?)/i;
    const match = locationString.match(regex);
    if (match && match[1] && match[2]) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return [lat, lng];
      } else { console.warn("Coordenadas parseadas fuera de rango:", lat, lng); }
    }
    return null;
  }

  private tryInitMap(): void {
    if (this.isBrowser && this.mapContainer?.nativeElement && !this.isMapInitialized) {
      if (this.sellerCoords) {
        setTimeout(() => this.initMap(this.sellerCoords!), 50);
      } else { console.warn("No se inicializó el mapa por falta de coordenadas."); }
    } else if (this.isMapInitialized && this.sellerCoords) {
      this.updateMapLocation(this.sellerCoords);
    }
  }

  private createAvatarIcon(imageUrl: string): L.DivIcon {
    const iconSize = 50;
    const imgStyle = `width: ${iconSize}px; height: ${iconSize}px; border-radius: 50%; border: 3px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.5); object-fit: cover; background-color: #eee;`;
    return L.divIcon({
      html: `<img style="${imgStyle}" class="leaflet-marker-avatar" src="${imageUrl}" alt="Avatar">`,
      className: 'leaflet-avatar-icon-container',
      iconSize: [iconSize, iconSize], iconAnchor: [iconSize / 2, iconSize], popupAnchor: [0, -iconSize]
    });
  }

  private initMap(initialCoords: L.LatLngTuple): void {
    if (!this.mapContainer?.nativeElement || this.isMapInitialized || !this.isBrowser) { return; }
    console.log("Initializing Leaflet Map with coords:", initialCoords);
    try {
      this.map = L.map(this.mapContainer.nativeElement, { center: initialCoords, zoom: 14, zoomControl: false });
      L.control.zoom({ position: 'topleft' }).addTo(this.map);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd', maxZoom: 20
      }).addTo(this.map);
      const markerIcon = this.sellerAvatarUrl ? this.createAvatarIcon(this.sellerAvatarUrl) : iconDefault;
      this.marker = L.marker(initialCoords, { icon: markerIcon }).addTo(this.map);
      const popupContent = this.createPopupContent();
      let popupOffsetY = 35;
      const iconSizeExpr = markerIcon.options.iconSize;
      if (iconSizeExpr) {
          const iconSizePoint = L.point(iconSizeExpr as L.PointExpression);
          popupOffsetY = (iconSizePoint.y / 2) + 10;
      }
      const finalPopupOffset = L.point(0, -popupOffsetY);
      this.marker.bindPopup(popupContent, { minWidth: 200, maxWidth: 300, closeButton: true, offset: finalPopupOffset, className: 'custom-leaflet-popup' });
      this.addPopupListenersToMarker();
      this.isMapInitialized = true;
      console.log("Map Initialized successfully.");
      this.marker.openPopup();
      setTimeout(() => { if (this.map) { this.map.invalidateSize(); } }, 150);
    } catch (error) {
      console.error("Error initializing Leaflet map:", error);
      this.isMapInitialized = false;
    }
  }

  private updateMapLocation(coords: L.LatLngTuple): void {
    if (!this.map || !this.isMapInitialized) return;
    const markerIcon = this.sellerAvatarUrl ? this.createAvatarIcon(this.sellerAvatarUrl) : iconDefault;
    if (this.marker) { this.marker.setLatLng(coords).setIcon(markerIcon); }
    else {
      this.marker = L.marker(coords, { icon: markerIcon }).addTo(this.map);
      this.addPopupListenersToMarker();
    }
    const popupContent = this.createPopupContent();
    this.marker.bindPopup(popupContent, { minWidth: 200, maxWidth: 300, closeButton: true, offset: L.point(0, -35), className: 'custom-leaflet-popup' });
    if (this.map.hasLayer(this.marker) && this.marker.isPopupOpen()) { this.marker.openPopup(); }
    this.map.setView(coords, this.map.getZoom());
  }

  private createPopupContent(): string {
    const containerStyle = `display: flex; flex-direction: column; gap: 5px; justify-content: center; align-items: center;`;
    const addressLineStyle = `display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: nowrap;`;
    const addressStyle = `font-size: 0.85rem; color: #555; flex-grow: 1;`;
    const noAddressStyle = `font-size: 0.85rem; color: #888; font-style: italic;`;
    const buttonStyle = `display: inline-flex; align-items: center; gap: 10px; padding: 10px; margin: 0; font-size: 0.85rem; font-weight: 500; color: #fff; background: #34A853; border-radius: 8px; border: none; cursor: pointer; text-decoration: none; white-space: nowrap; flex-shrink: 0; transition: color 0.2s ease; justify-content: center;`;
    const iconStyle = `font-size: 0.9em; margin-right: 3px;`;

    let content = `<div class="map-popup-content" style="${containerStyle}">`;
    content += `<div class="popup-seller-name" style="font-weight: 600; color: #333; font-size: 0.95rem;">${this.sellerName || 'Ubicación'}</div>`;
    content += `<div class="popup-address-line" style="${addressLineStyle}">`;
    const addressPart = this.sellerLocation?.replace(/\s*\(Lat:.*?\)/, '').trim();
    if (addressPart && addressPart !== 'Dirección no especificada') { content += `<span class="popup-address" style="${addressStyle}">${addressPart}</span>`; }
    else if (this.sellerLocationShort && this.sellerLocationShort !== 'Ubicación no disponible') { content += `<span class="popup-address" style="${addressStyle}">${this.sellerLocationShort}</span>`; }
    else { content += `<span class="popup-address no-address" style="${noAddressStyle}">Ubicación no detallada</span>`; }
    content += `</div>`;
    if (this.sellerCoords) { content += `<button class="btn-get-directions-popup" data-action="get-directions-popup" title="Obtener direcciones en Google Maps" style="${buttonStyle}"><i class="far fa-paper-plane" style="${iconStyle}"></i> Cómo llegar</button>`; }
    content += `</div>`;
    return content;
  }

  private addPopupListenersToMarker(): void {
    if (!this.marker) return;
    this.marker.off('popupopen').off('popupclose');
    this.marker.on('popupopen', (e) => {
      const button = e.popup.getElement()?.querySelector<HTMLButtonElement>('[data-action="get-directions-popup"]');
      if (button && !this.popupGetDirectionsListener) {
        this.popupGetDirectionsListener = () => this.getDirections();
        button.addEventListener('click', this.popupGetDirectionsListener);
      }
    });
    this.marker.on('popupclose', (e) => {
      const button = e.popup.getElement()?.querySelector<HTMLButtonElement>('[data-action="get-directions-popup"]');
      if (button && this.popupGetDirectionsListener) {
        button.removeEventListener('click', this.popupGetDirectionsListener);
        this.popupGetDirectionsListener = null;
      }
    });
  }

   // =================================================================
  // MÉTODO navigateToScene CORREGIDO PARA INCLUIR campiamigoIds
  // =================================================================
  navigateToScene(): void {
    // 1. Obtener el ID de la zona
    const zoneId = this.product?.auth?.userProfile?.zone?.id;

    // 2. Verificar si tenemos un zoneId válido
    if (!zoneId) {
      console.error('No se pudo encontrar el ID de la zona para este campiamigo.');
      alert('No se pudo determinar la zona 3D para este campiamigo.');
      return;
    }

    // 3. Obtener el ID del perfil del vendedor (el campiamigo de este producto)
    const sellerProfileId = this.product?.auth?.userProfile?.id;

    // 4. Comprobar el modo de acceso
    if (this.accessMode === 'public') {
      // --- MODO PÚBLICO: Mostrar modal ---
      console.log('Usuario público intentando ver escena 3D. Mostrando modal.');
      this.loginPromptTitle = 'Explorar Territorio 3D';
      this.loginPromptMessage = 'Para explorar el modelo 3D interactivo del territorio de este campiamigo, por favor inicia sesión o crea una cuenta.';
      this.showLoginPrompt = true;
      this.cdRef.detectChanges();
      return; // Detener aquí

    } else {
      // --- MODO PRIVADO: Navegar directamente CON queryParams ---

      // 5. Verificar si tenemos el ID del vendedor
      if (!sellerProfileId) {
          console.error('No se pudo encontrar el ID del perfil del vendedor para pasarlo a la escena.');
          // Opcional: Navegar sin el parámetro o mostrar un error.
          // Navegar sin el parámetro podría llevar a una escena sin indicadores.
          // Mostramos alerta por ahora.
          alert('No se pudo identificar al vendedor para mostrarlo en el mapa 3D.');
          return;
      }

      // 6. Construir la ruta privada
      const targetRoute = ['/user/estaciones/scene', zoneId.toString()];

      // 7. Crear el parámetro campiamigoIds (array con UN solo ID, convertido a string JSON)
      const campiamigoIdsParam = JSON.stringify([sellerProfileId]);

      console.log(`Navegando a escena privada: ${targetRoute.join('/')} con campiamigoIds: ${campiamigoIdsParam}`);

      // 8. Navegar incluyendo los queryParams
      this.router.navigate(targetRoute, {
        queryParams: {
          // El nombre 'campiamigoIds' DEBE coincidir con lo que espera SceneComponent
          campiamigoIds: campiamigoIdsParam
          // Opcional: podrías añadir count si SceneComponent lo usara:
          // count: 1
        }
      });
    }
  }
  // =================================================================
  // FIN MÉTODO navigateToScene CORREGIDO
  // =================================================================


  // ==================================================================================
  // MEDIA HANDLING (sin cambios)
  // ==================================================================================
  onSelectMedia(idx: number): void {
    if (idx === this.selectedMediaIndex || idx < 0 || idx >= this.media.length) { return; }
    const previousMedia = this.media[this.selectedMediaIndex];
    this.selectedMediaIndex = idx;
    const currentMedia = this.media[idx];
    if (previousMedia?.type === 'video' && this.videoRef?.nativeElement) { this.videoRef.nativeElement.pause(); }
    if (previousMedia?.type === 'model' && currentMedia.type !== 'model' && this.isAnimating) { this.stopAnimation(); }
    if (currentMedia.type === 'model') { setTimeout(() => this.setupThreeIfNeeded(), 0); }
    else if (currentMedia.type === 'video' && this.videoRef?.nativeElement) { setTimeout(() => { this.videoRef.nativeElement.play().catch(e => console.warn("Autoplay del video bloqueado:", e)); }, 50); }
    this.cdRef.detectChanges();
  }

  // ==================================================================================
  // THREE.JS LOGIC (sin cambios)
  // ==================================================================================
  private setupThreeIfNeeded(): void { if (!this.canvasRef?.nativeElement || this.media[this.selectedMediaIndex]?.type !== 'model') { if (this.isAnimating) this.stopAnimation(); return; } const modelItem = this.media[this.selectedMediaIndex]; if (!this.threeInitialized) { try { this.initThree(); this.threeInitialized = true; window.addEventListener('resize', this.onWindowResize); this.loadGLBModel(modelItem.url); } catch (error: any) { console.error("[Three.js] Error initializing:", error); this.errorMsg = "No se pudo inicializar el visor 3D."; this.threeInitialized = false; this.cdRef.detectChanges(); } } else { if (this.currentModelUrl !== modelItem.url) { this.loadGLBModel(modelItem.url); } else if (!this.isAnimating) { this.startAnimation(); } this.onWindowResize(); } }
  private initThree(): void { if (!this.canvasRef) { throw new Error("[Three.js] Canvas element not found."); } const canvas = this.canvasRef.nativeElement; this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); this.renderer.setPixelRatio(window.devicePixelRatio); this.renderer.setSize(canvas.clientWidth, canvas.clientHeight); this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.scene = new THREE.Scene(); this.scene.background = null; this.camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 1000); this.camera.position.set(0, 1.5, 4); this.controls = new OrbitControls(this.camera, this.renderer.domElement); this.controls.enableDamping = true; this.controls.dampingFactor = 0.05; this.controls.screenSpacePanning = false; this.controls.minDistance = 1; this.controls.maxDistance = 10; this.controls.target.set(0, 0.5, 0); this.controls.update(); const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); this.scene.add(ambientLight); const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5); directionalLight.position.set(5, 10, 7.5); this.scene.add(directionalLight); }
  private loadGLBModel(url: string): void { if (!this.scene || !this.renderer || !this.camera || !this.controls) { return; } this.loading = true; this.cdRef.detectChanges(); this.clearSceneModels(); const loader = new GLTFLoader(); loader.load(url, (gltf) => { const model = gltf.scene; model.userData['isModel'] = true; const box = new THREE.Box3().setFromObject(model); const size = box.getSize(new THREE.Vector3()); const center = box.getCenter(new THREE.Vector3()); const maxDim = Math.max(size.x, size.y, size.z); const desiredSize = 2.0; const scale = (maxDim > 0) ? (desiredSize / maxDim) : 1; model.scale.set(scale, scale, scale); box.setFromObject(model); box.getCenter(center); model.position.sub(center); this.scene.add(model); this.controls.target.set(0, 0, 0); this.controls.update(); this.currentModelUrl = url; this.loading = false; this.cdRef.detectChanges(); if (!this.isAnimating) { this.startAnimation(); } }, undefined, (error) => { console.error('[Three.js] Error loading GLB model:', error); this.errorMsg = 'No se pudo cargar el modelo 3D.'; this.loading = false; this.cdRef.detectChanges(); }); }
  private clearSceneModels(): void { if (!this.scene) return; const objectsToRemove: THREE.Object3D[] = []; this.scene.traverse((object) => { if (object.userData['isModel']) { objectsToRemove.push(object); } }); objectsToRemove.forEach(obj => this.scene.remove(obj)); this.currentModelUrl = null; }
  private animate = (): void => { this.animationId = requestAnimationFrame(this.animate); this.controls?.update(); if (this.renderer && this.scene && this.camera) { this.renderer.render(this.scene, this.camera); } };
  private startAnimation(): void { if (!this.isAnimating && this.threeInitialized) { this.isAnimating = true; this.animate(); } }
  private stopAnimation(): void { if (this.isAnimating) { cancelAnimationFrame(this.animationId); this.isAnimating = false; } }
  private onWindowResize = (): void => { if (!this.camera || !this.renderer || !this.canvasRef?.nativeElement) return; const canvas = this.canvasRef.nativeElement; if (canvas.clientWidth > 0 && canvas.clientHeight > 0) { this.camera.aspect = canvas.clientWidth / canvas.clientHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(canvas.clientWidth, canvas.clientHeight); } else { console.warn("[Three.js] Canvas has zero size during resize."); } };
  private cleanupThree(): void { this.stopAnimation(); this.clearSceneModels(); this.controls?.dispose(); if (this.renderer) { this.renderer.dispose(); this.renderer.forceContextLoss(); (this.renderer as any).domElement = null; } this.threeInitialized = false; this.currentModelUrl = null; }
  public get isBrowser(): boolean { return isPlatformBrowser(this.platformId); }

  // ==================================================================================
  // UI INTERACTION LOGIC (sin cambios)
  // ==================================================================================
  goBack(): void {
    if (this.accessMode === 'private') {
      console.log('Navegando atrás hacia /user/productos');
      this.router.navigate(['/user/productos']);
    } else {
      console.log('Navegando atrás hacia /inicio/productos');
      this.router.navigate(['/inicio/productos']);
    }
  }
  updateTotalPrice(): void { this.totalPrice = this.currentQuantity * this.productPrice; }
  selectQuantityPreset(q: number): void { this.setQuantity(q); }
  incrementQuantity(): void { if (this.currentQuantity < this.productStock) { this.setQuantity(this.currentQuantity + 1); } }
  decrementQuantity(): void { if (this.currentQuantity > this.productMinOrder) { this.setQuantity(this.currentQuantity - 1); } }
  setQuantity(newQuantity: number): void { const quantity = Math.max(this.productMinOrder, Math.min(isNaN(newQuantity) ? this.productMinOrder : newQuantity, this.productStock)); if (this.currentQuantity !== quantity) { this.currentQuantity = quantity; this.updateTotalPrice(); } }
  onQuantityInputChange(event: Event): void { const inputElement = event.target as HTMLInputElement; let value = parseInt(inputElement.value, 10); if (isNaN(value) || value < this.productMinOrder) { value = this.productMinOrder; } else if (value > this.productStock) { value = this.productStock; } inputElement.value = value.toString(); if (this.currentQuantity !== value) { this.setQuantity(value); } }
  getStarClass(index: number): string { const rating = this.productRating || 0; if (rating >= index + 1) { return 'bx bxs-star'; } else if (rating >= index + 0.5) { return 'bx bxs-star-half'; } else { return 'bx bx-star'; } }

  // ==================================================================================
  // ACTION METHODS (sin cambios)
  // ==================================================================================
  handleContactClick(): void {
    if (this.accessMode === 'private') { this.contactWhatsApp(); }
    else {
      this.loginPromptTitle = 'Contactar al CampiAmigo';
      this.loginPromptMessage = 'Para ver la información de contacto del CampiAmigo y enviarle un mensaje directo, por favor inicia sesión o regístrate.';
      this.showLoginPrompt = true; this.cdRef.detectChanges();
    }
  }
  closeLoginPrompt(): void { this.showLoginPrompt = false; this.cdRef.detectChanges(); }
  callSeller(): void { const phone = this.product?.auth?.phoneNumber; if (phone) { window.location.href = `tel:${phone}`; } else { alert('Número de teléfono no disponible.'); } }
  contactWhatsApp(): void {
    if (this.accessMode === 'public') {
       console.warn('Intento de contactar por WhatsApp en modo público bloqueado. Mostrando modal.');
       this.showLoginPrompt = true; this.cdRef.detectChanges(); return;
    }
    const phone = this.product?.auth?.phoneNumber;
    if (phone && this.product) {
      const internationalPhone = phone.replace(/[^0-9]/g, '');
      const whatsappNumber = internationalPhone.startsWith('57') ? internationalPhone : `57${internationalPhone}`;
      const message = encodeURIComponent(`Hola ${this.sellerName}, estoy interesado en tu producto "${this.productName}" (${this.productUnit}) que vi en CampiAmigo.`);
      const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${message}`;
      window.open(whatsappUrl, '_blank');
    } else { alert('Número de WhatsApp no disponible para este campiamigo.'); }
  }
  toggleFavorite(): void { alert('Funcionalidad de favoritos aún no implementada.'); }
  shareProduct(): void { if (navigator.share && this.product) { navigator.share({ title: this.productName, text: `¡Mira este producto en CampiAmigo!: ${this.productName} - ${this.productDescription.substring(0, 80)}...`, url: window.location.href, }).catch((error) => console.log('Error al compartir:', error)); } else if (navigator.clipboard) { navigator.clipboard.writeText(window.location.href).then(() => alert('¡Enlace del producto copiado al portapapeles!')).catch(() => alert('No se pudo compartir ni copiar el enlace.')); } else { alert('La función de compartir no está disponible en este navegador.'); } }
  viewSellerProfile(): void { const sellerId = this.product?.auth?.id; if (sellerId) { this.router.navigate(['/ruta-perfil-vendedor', sellerId]); } else { alert('No se pudo obtener la información necesaria para ver el perfil del vendedor.'); } }
  addToCart(): void { if (!this.product) return; alert(`Simulación: Añadido ${this.currentQuantity} ${this.productUnit} de "${this.productName}" al carrito.`); }
  sendMessageViaChat(): void { alert('Funcionalidad de enviar mensaje por chat no implementada.'); }

  // ==================================================================================
  // UBICACIÓN METHODS (sin cambios)
  // ==================================================================================
  showOnGoogleMaps(): void {
    let mapUrl = 'https://www.google.com/maps';
    if (this.sellerCoords) { mapUrl = `https://www.google.com/maps?q=${this.sellerCoords[0]},${this.sellerCoords[1]}`; }
    else if (this.sellerLocation && this.sellerLocation !== 'Dirección no especificada') { const query = encodeURIComponent(this.sellerLocation); mapUrl = `https://www.google.com/maps/search/?api=1&query=${query}`; }
    else { alert('La ubicación detallada no está disponible para mostrar en el mapa.'); return; }
    console.log("Opening Google Maps URL:", mapUrl);
    window.open(mapUrl, '_blank', 'noopener,noreferrer');
  }
  getDirections(): void {
    console.log("getDirections called via popup button");
    if (this.sellerCoords) {
      const destination = `${this.sellerCoords[0]},${this.sellerCoords[1]}`;
      const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
      console.log("Opening Google Maps Directions URL:", directionsUrl);
      window.open(directionsUrl, '_blank', 'noopener,noreferrer');
    } else { alert('No se pueden obtener direcciones porque las coordenadas exactas no están disponibles.'); console.warn("getDirections called but sellerCoords are null"); }
  }

} // Fin de la clase DetalleProductsComponent