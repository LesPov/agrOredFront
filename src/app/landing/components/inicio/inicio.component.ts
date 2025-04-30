// src/app/pages/inicio/inicio.component.ts // O la ruta correcta: src/app/landing/components/inicio/inicio.component.ts
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Tipos y Servicios existentes
import { ZoneData } from '../../../features/campiamigo/services/campiAmigoZones.service'; // Ajusta si es necesario
import { Product, Zone } from '../../../features/campiamigo/services/campiAmigoProducts.service'; // Ajusta si es necesario
import { environment } from '../../../../environments/environment'; // Ajusta si es necesario
import { ObserversService } from '../../services/observers.service'; // Ajusta ruta si es necesario
import { TerritorySceneService } from '../../services/territory-scene.service'; // Ajusta ruta si es necesario
import { ProductSceneService } from '../../services/product-scene.service'; // Ajusta ruta si es necesario
import { InicioDataService, InitialDataResult } from '../../services/inicio-data.service'; // Ajusta ruta si es necesario
import { TerritoryInteractionService, TerritoryState, TerritoryInteractionEvent } from '../../services/inicio-territory-interaction.service'; // Ajusta ruta si es necesario

import { ToastrService } from 'ngx-toastr';
import { Swiper } from 'swiper';
import { Autoplay, Navigation, Pagination } from 'swiper/modules';
import { CommonModule } from '@angular/common';
import { BotInfoService } from '../../../features/admin/services/botInfo.service';

// --- Interface Definition ---
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

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './inicio.component.html',
  styleUrl: './inicio.component.css',
})
export class InicioComponent implements OnInit, AfterViewInit, OnDestroy {

  // ======================================================================== //
  // == Section 1: Component Properties                                    == //
  // ======================================================================== //

  private _terrainCanvasRef: ElementRef<HTMLCanvasElement> | undefined;
  @ViewChild('terrainCanvas') set terrainCanvas(canvasRef: ElementRef<HTMLCanvasElement> | undefined) {
    // console.log("ViewChild setter: terrainCanvas triggered. Ref provided:", canvasRef);
    if (canvasRef && canvasRef !== this._terrainCanvasRef) {
      // console.log("ViewChild setter: Setting _terrainCanvasRef and initializing services.");
      this._terrainCanvasRef = canvasRef;
      this.territoryInteractionService.initialize(this._terrainCanvasRef);
      this.initializeTerritoryServiceBase();
      this.setupTerritoryObserver();
    } else if (!canvasRef && this._terrainCanvasRef) {
      // console.log("ViewChild setter: terrainCanvas removed.");
      this._terrainCanvasRef = undefined;
      this.territoryObserver?.disconnect();
    }
  }

  @ViewChildren('productCanvas') productCanvases!: QueryList<ElementRef<HTMLCanvasElement>>;
  @ViewChild('productSwiperContainer') productSwiperContainer!: ElementRef<HTMLElement>;

  public allZones: ZoneData[] = [];
  public activeTerritoryZone: ZoneData | null = null;
  public isTerritoryLoading = false;
  public territoryModelsReady = false;
  public territoryLoaded = false;
  public isLoadingZones = false;
  public zonesError: string | null = null;

  public allDisplayProducts: DisplayProductInicio[] = [];
  public selectedTab: 'all' | 'offer' | 'new' | 'popular' | 'cold' | 'hot' = 'all';
  public isLoadingProducts = false;
  public productError: string | null = null;
  public productLoaded: boolean[] = [];
  public activeProductOriginalIndex: number | null = null;
  public currentSlideIndex = 0;

  public Math = Math;
  public showModal = false;

  private readonly defaultProductImage = 'assets/img/default-product.png';
  private readonly defaultTerritoryImage = 'assets/img/default-zone.png';
  private readonly baseAssetUrl = environment.endpoint.endsWith('/') ? environment.endpoint : environment.endpoint + '/';

  private territoryObserver: IntersectionObserver | null = null;
  private productSwiperInstance: Swiper | null = null;
  private productServiceInitialized = false;
  private territoryInitAttemptedByObserver = false;
  private isTerritoryInitializing: boolean = false;
  private previousActiveProductOriginalIndexOnSlide: number | null = null;
  private destroy$ = new Subject<void>();
  private infoInicioList: string[] = [
    "Estás viendo el inicio",
   
  ];
  // ======================================================================== //
  // == Section 2: Angular Lifecycle Hooks                                 == //
  // ======================================================================== //
  constructor(
    private router: Router,
    private toastr: ToastrService,
    private observerService: ObserversService,
    private territoryService: TerritorySceneService,
    private productService3D: ProductSceneService,
    private inicioDataService: InicioDataService,
    private cdRef: ChangeDetectorRef,
    private territoryInteractionService: TerritoryInteractionService,
    private botInfoService: BotInfoService,

  ) { }

  ngOnInit(): void {
    this.loadInitialData();
    this.subscribeToTerritoryState();
    this.subscribeToTerritoryEvents();
    this.botInfoService.setInfoList(this.infoInicioList);

  }

  ngAfterViewInit(): void {
    this.initializeTerritoryServiceBase();
    this.productCanvases.changes.subscribe(() => this.handleProductCanvasChanges());
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  ngOnDestroy(): void {
    this.territoryService.destroy();
    this.productService3D.destroy();
    this.destroySwiper();
    this.territoryObserver?.disconnect();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    // *** NUEVO: Limpiar referencia en el servicio ***
    this.territoryInteractionService.clearCanvasReference();
    // --------------------------------------------

    this.destroy$.next();
    this.destroy$.complete();
  }

  // ======================================================================== //
  // == Section 3: Initial Data Load & Component-Specific Setup            == //
  // ======================================================================== //
  private loadInitialData(): void {
    this.isLoadingZones = true; this.isLoadingProducts = true;
    this.zonesError = null; this.productError = null;
    this.allZones = []; this.allDisplayProducts = [];
    this.activeTerritoryZone = null; this.isTerritoryLoading = false;
    this.territoryModelsReady = false; this.territoryLoaded = false;
    this.productLoaded = []; this.activeProductOriginalIndex = null;
    this.destroySwiper();
    if (this.productServiceInitialized) this.productService3D.stopAnimation();
    this.territoryInteractionService.setActiveZone(null);
    this.cdRef.detectChanges();

    this.inicioDataService.loadInitialData().subscribe({
      next: (result: InitialDataResult) => {
        this.isLoadingZones = false; this.isLoadingProducts = false;
        if (result.success) {
          this.allZones = result.zones;
          this.allDisplayProducts = result.products;
          this.productLoaded = new Array(this.allDisplayProducts.length).fill(false);
          this.zonesError = null; this.productError = null;
          this.activeTerritoryZone = result.defaultZone ?? null;
          this.territoryInteractionService.setActiveZone(this.activeTerritoryZone);
          this.cdRef.detectChanges();
          setTimeout(() => this.initializeOrUpdateSwiper(), 0);
        } else {
          this.zonesError = result.errorMessage ?? 'Error cargando datos.';
          this.productError = result.errorMessage ?? 'Error cargando datos.';
          this.allZones = []; this.allDisplayProducts = [];
          this.activeTerritoryZone = null;
          this.territoryInteractionService.setActiveZone(null);
        }
      },
      error: (err) => {
        console.error("Error en la suscripción a loadInitialData:", err);
        const genericError = 'Ocurrió un error inesperado. Intenta de nuevo.';
        this.zonesError = genericError; this.productError = genericError;
        this.isLoadingZones = false; this.isLoadingProducts = false;
        this.allZones = []; this.allDisplayProducts = [];
        this.activeTerritoryZone = null;
        this.territoryInteractionService.setActiveZone(null);
        this.cdRef.detectChanges();
      }
    });
  }

  private async initializeTerritoryServiceBase(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 0));
    if (this._terrainCanvasRef && this._terrainCanvasRef.nativeElement.isConnected && !this.territoryService.isInitialized()) {
      try {
        await this.ensureCanvasIsReady(this._terrainCanvasRef.nativeElement);
        await this.territoryService.init(this._terrainCanvasRef.nativeElement, this.baseAssetUrl);
      } catch (error) {
        console.error("Error inicializando servicio 3D Territorio (Base):", error);
        this.toastr.error("No se pudo inicializar la vista 3D del territorio.");
      }
    }
  }

  private setupTerritoryObserver(): void {
    if (!this._terrainCanvasRef) { return; }
    if (this.territoryObserver) { this.territoryObserver.disconnect(); }
    const canvasElement = this._terrainCanvasRef.nativeElement;
    this.territoryObserver = this.observerService.createObserver(async () => {
      if (canvasElement.offsetParent !== null && !this.territoryInitAttemptedByObserver && !this.territoryService.isInitialized() && !this.isTerritoryInitializing) {
        this.isTerritoryInitializing = true; this.territoryInitAttemptedByObserver = true;
        try { await this.initializeTerritoryServiceBase(); } catch (error) { console.error("Territory Observer: Base init failed (fallback):", error); } finally {
          this.isTerritoryInitializing = false; if (this.territoryObserver) { this.territoryObserver.unobserve(canvasElement); }
        }
      } else if (this.territoryObserver && (this.territoryService.isInitialized() || this.territoryInitAttemptedByObserver)) { this.territoryObserver.unobserve(canvasElement); }
    });
    this.territoryObserver.observe(canvasElement);
  }

  private subscribeToTerritoryState(): void {
    this.territoryInteractionService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe((state: TerritoryState) => {
        this.isTerritoryLoading = state.isLoading;
        this.territoryModelsReady = state.modelsReady;
        this.territoryLoaded = state.isLoaded;
        this.cdRef.markForCheck();
      });
  }

  private subscribeToTerritoryEvents(): void {
    this.territoryInteractionService.events$
      .pipe(takeUntil(this.destroy$))
      .subscribe((event: TerritoryInteractionEvent) => {
        switch (event.type) {
          case 'requestProductDeactivation': this.deactivateCurrentProduct3D(); break;
          case 'statusUpdate':
            if (event.message) {
              const level = event.details?.level || 'info'; const title = event.details?.title;
              const options = { timeOut: title === 'Preparando' ? 2500 : (level === 'success' ? 3000 : 4000) };
              switch (level) {
                case 'success': this.toastr.success(event.message, title, options); break;
                case 'warning': this.toastr.warning(event.message, title, options); break;
                case 'error': this.toastr.error(event.message, title, options); break;
                default: this.toastr.info(event.message, title, options); break;
              }
            }
            break;
          case 'error':
            if (event.message) { this.toastr.error(event.message, 'Error Territorio 3D'); }
            console.error("Territory Interaction Error:", event.details);
            break;
        }
      });
  }

  // ======================================================================== //
  // == Section 4: Territory Interaction & 3D Management (DELEGADO)        == //
  // ======================================================================== //
  public onMainCanvasClick(): void { this.territoryInteractionService.handleCanvasClick(); }
  public changeActiveZone(zone: ZoneData): void {
    if (this.activeTerritoryZone?.id !== zone.id) {
      this.activeTerritoryZone = zone;
      this.territoryInteractionService.setActiveZone(zone);
    }
  }

  // ======================================================================== //
  // == Section 5: Product Carousel (Swiper) & Filtering Logic           == //
  // ======================================================================== //
  public get filteredDisplayProducts(): DisplayProductInicio[] {
    switch (this.selectedTab) { case 'all': return this.allDisplayProducts; case 'cold': return this.allDisplayProducts.filter(p => p.climateClass === 'cold'); case 'hot': return this.allDisplayProducts.filter(p => p.climateClass === 'hot'); case 'offer': return this.allDisplayProducts.filter(p => p.discountPercentage && p.discountPercentage > 0); case 'new': return this.allDisplayProducts.slice(0, 5); case 'popular': return this.allDisplayProducts.filter(p => (p.rating || 0) >= 4.0); default: return this.allDisplayProducts; }
  }
  public selectTab(tab: 'all' | 'offer' | 'new' | 'popular' | 'cold' | 'hot'): void {
    if (this.selectedTab !== tab) { this.deactivateCurrentProduct3D(); this.territoryInteractionService.deactivateView(); this.destroySwiper(); this.selectedTab = tab; this.cdRef.detectChanges(); setTimeout(() => this.initializeOrUpdateSwiper(), 0); }
  }
  private initializeOrUpdateSwiper(): void {
    const slidesCount = this.filteredDisplayProducts.length; if (!this.productSwiperContainer || slidesCount === 0) { if (this.productSwiperInstance) this.destroySwiper(); return; } const swiperElement = this.productSwiperContainer.nativeElement; setTimeout(() => { if (this.productSwiperInstance) { this.productSwiperInstance.update(); this.productSwiperInstance.slideToLoop(0, 0); this.currentSlideIndex = this.productSwiperInstance.realIndex; this.previousActiveProductOriginalIndexOnSlide = this.getOriginalIndexForSwiperIndex(this.currentSlideIndex); this.cdRef.markForCheck(); return; } this.productSwiperInstance = new Swiper(swiperElement, { modules: [Navigation, Pagination, Autoplay], slidesPerView: 1, centeredSlides: true, spaceBetween: 30, loop: slidesCount > 3, autoplay: { delay: 4000, disableOnInteraction: false, pauseOnMouseEnter: true, }, pagination: { el: '.product-swiper-pagination', clickable: true }, navigation: { nextEl: '.product-swiper-button-next', prevEl: '.product-swiper-button-prev' }, grabCursor: true, observer: true, observeParents: true, }); this.currentSlideIndex = this.productSwiperInstance.realIndex; this.previousActiveProductOriginalIndexOnSlide = this.getOriginalIndexForSwiperIndex(this.currentSlideIndex); this.productSwiperInstance.on('slideChange', () => { if (!this.productSwiperInstance) return; const newSwiperIndex = this.productSwiperInstance.realIndex; const newProductOriginalIndex = this.getOriginalIndexForSwiperIndex(newSwiperIndex); if (this.activeProductOriginalIndex !== null && this.activeProductOriginalIndex === this.previousActiveProductOriginalIndexOnSlide && this.activeProductOriginalIndex !== newProductOriginalIndex) { this.deactivateCurrentProduct3D(); } this.currentSlideIndex = newSwiperIndex; this.previousActiveProductOriginalIndexOnSlide = newProductOriginalIndex; this.cdRef.markForCheck(); }); }, 50);
  }
  private destroySwiper(): void { if (this.productSwiperInstance) { this.productSwiperInstance.destroy(true, true); this.productSwiperInstance = null; this.currentSlideIndex = 0; this.previousActiveProductOriginalIndexOnSlide = null; } }
  public pauseSwiperAutoplay(): void { if (this.productSwiperInstance?.autoplay?.running) { this.productSwiperInstance.autoplay.stop(); } }
  public resumeSwiperAutoplay(): void { if (this.activeProductOriginalIndex === null && !this.territoryLoaded && this.productSwiperInstance && !this.productSwiperInstance.autoplay?.running) { this.productSwiperInstance.autoplay.start(); } }
  public goToSlide(idx: number): void { if (this.productSwiperInstance) { this.productSwiperInstance.slideToLoop(idx); } }

  // ======================================================================== //
  // == Section 6: Product 3D Management                                   == //
  // ======================================================================== //
  public async onProductCanvasClick(originalIndex: number): Promise<void> {
    // console.log(`onProductCanvasClick triggered for index: ${originalIndex}`); // Mantenido para debug inicial
    if (originalIndex < 0 || originalIndex >= this.allDisplayProducts.length) { return; }
    const product = this.allDisplayProducts[originalIndex];
    if (!product) { return; }
    // console.log(`Product: ${product.name}, Has GLB: ${!!product.glbFile}, Currently Loaded: ${this.productLoaded[originalIndex]}`);

    if (this.productLoaded[originalIndex]) {
      // console.log('Product already loaded, deactivating...');
      this.deactivateCurrentProduct3D();
      return;
    }
    if (product.glbFile) {
      // console.log('Product has GLB, attempting activation...');
      await this.activateProduct3D(originalIndex);
    } else {
      // console.log('Product has no GLB.');
      this.toastr.info(`Producto ${product.name} sin modelo 3D.`);
      this.deactivateCurrentProduct3D();
    }
  }

  // -------- ¡CORRECCIÓN PRINCIPAL AQUÍ! --------
  private async activateProduct3D(originalIndex: number): Promise<void> {
    // console.log(`activateProduct3D for index: ${originalIndex}`); // Mantenido para debug inicial
    const targetProduct = this.allDisplayProducts[originalIndex];
    if (!targetProduct || !targetProduct.glbFile) return;

    // 1. Desactivar otras vistas y pausar
    this.territoryInteractionService.deactivateView();
    if (this.activeProductOriginalIndex !== null && this.activeProductOriginalIndex !== originalIndex) {
      this.deactivateCurrentProduct3D();
    }
    this.pauseSwiperAutoplay();

    // 2. Encontrar Canvas
    const targetCanvasRef = this.findCanvasByProductId(targetProduct.id);
    if (!targetCanvasRef) {
      console.error(`Canvas element not found for product ID ${targetProduct.id}.`);
      this.toastr.error("Error interno: No se encontró el canvas 3D del producto.");
      this.resumeSwiperAutoplay();
      return;
    }
    const targetCanvasElement = targetCanvasRef.nativeElement;

    // -------- CAMBIO CLAVE: Hacer visible ANTES de inicializar --------
    // Forzar visibilidad ANTES de ensureCanvasIsReady
    targetCanvasElement.style.display = 'block';
    // Forzar detección de cambio para que el navegador lo aplique
    try {
      this.cdRef.detectChanges(); // Intentar forzar detección
    } catch (e) {
      console.warn("detectChanges during activateProduct3D failed (likely due to ongoing cycle), continuing...", e);
      // Podría fallar si ya está en un ciclo de detección, pero el estilo debería aplicarse igualmente.
    }
    // Dar un respiro mínimo al navegador para aplicar el estilo
    await new Promise(resolve => setTimeout(resolve, 10)); // 10ms, ajustar si es necesario
    // -----------------------------------------------------------------

    // 3. Inicializar/Configurar Servicio y Cargar Modelo
    try {
      // AHORA llamar a ensureCanvasIsReady
      await this.ensureCanvasIsReady(targetCanvasElement); // Ahora debería tener dimensiones
      console.log('Canvas ready for product 3D.'); // Log si ensureCanvasIsReady tiene éxito

      if (!this.productServiceInitialized) {
        // console.log('Initializing ProductSceneService...'); // Log mantenido
        await this.productService3D.init(targetCanvasElement);
        this.productServiceInitialized = true;
        // console.log('ProductSceneService Initialized.'); // Log mantenido
      } else {
        // console.log('Setting rendering target...'); // Log mantenido
        // ensureCanvasIsReady ya se llamó, no es necesario repetirlo
        await this.productService3D.setRenderingTarget(targetCanvasElement);
        // console.log('ProductSceneService Target Set.'); // Log mantenido
      }

      // console.log(`Loading product model: ${targetProduct.glbFile}`); // Log mantenido
      await this.productService3D.loadModelByFilename(targetProduct.glbFile);
      // console.log(`Product model loaded successfully for index: ${originalIndex}`); // Log mantenido

      // 4. Éxito: Actualizar estado y empezar animación
      this.productLoaded[originalIndex] = true; // Mantener estado consistente
      this.activeProductOriginalIndex = originalIndex;
      this.previousActiveProductOriginalIndexOnSlide = originalIndex;
      // El detectChanges aquí podría ser redundante si el anterior funcionó, pero no hace daño
      this.cdRef.detectChanges();

      // Esperar un instante mínimo ANTES de animar
      await new Promise(resolve => setTimeout(resolve, 0));

      if (targetCanvasElement.offsetParent !== null && this.productService3D.isInitialized()) { // Doble check
        // console.log('Starting product animation...'); // Log mantenido
        this.productService3D.startAnimation();
      } else {
        console.warn(`Product canvas (${targetProduct.id}) not visible or service not ready AFTER loading, animation not started.`);
      }

    } catch (error) {
      console.error(`Error during activateProduct3D for index ${originalIndex}:`, error);
      this.toastr.error(`Error al preparar 3D para ${targetProduct.name}.`);
      // 5. Fallo: Resetear estado y ocultar canvas
      this.productLoaded[originalIndex] = false;
      this.activeProductOriginalIndex = null;
      targetCanvasElement.style.display = 'none'; // Ocultar de nuevo si falló
      this.cdRef.detectChanges();
      this.resumeSwiperAutoplay();
    }
  }
  // -------- FIN CORRECCIÓN PRINCIPAL --------

  private deactivateCurrentProduct3D(): void {
    if (this.activeProductOriginalIndex !== null) {
      const oldIndex = this.activeProductOriginalIndex;
      // console.log(`Deactivating product 3D for index ${oldIndex}`);
      if (this.productServiceInitialized) {
        this.productService3D.stopAnimation();
        // Encontrar el canvas correspondiente para ocultarlo explícitamente
        const productToDeactivate = this.allDisplayProducts[oldIndex];
        if (productToDeactivate) {
          const canvasRef = this.findCanvasByProductId(productToDeactivate.id);
          if (canvasRef) {
            canvasRef.nativeElement.style.display = 'none'; // Ocultar al desactivar
          }
        }
      }
      if (oldIndex >= 0 && oldIndex < this.productLoaded.length) {
        this.productLoaded[oldIndex] = false;
      }
      this.activeProductOriginalIndex = null;
      this.cdRef.detectChanges();
      this.resumeSwiperAutoplay();
    }
  }

  private handleProductCanvasChanges(): void {
    // console.log(`handleProductCanvasChanges triggered. Canvas count: ${this.productCanvases?.length}`);
    if (this.activeProductOriginalIndex !== null) {
      const activeProduct = this.allDisplayProducts[this.activeProductOriginalIndex];
      if (!activeProduct) { this.deactivateCurrentProduct3D(); return; }
      const canvasStillExists = this.productCanvases.some(ref => ref.nativeElement.getAttribute('data-product-id') === activeProduct.id.toString());
      if (!canvasStillExists) { this.deactivateCurrentProduct3D(); }
    }
  }

  // ======================================================================== //
  // == Section 7: Footer Interaction Logic                                == //
  // ======================================================================== //
  public subscribeNewsletter(event: Event): void {
    event.preventDefault(); const form = event.target as HTMLFormElement; const emailInput = form.querySelector('input[type="email"]') as HTMLInputElement; if (!emailInput) return; const email = emailInput.value; if (email && emailInput.checkValidity()) { this.toastr.success(`Gracias por suscribirte con ${email}!`, 'Suscripción Exitosa'); emailInput.value = ''; } else if (!email) { this.toastr.warning('Por favor, ingresa tu correo electrónico.', 'Campo Vacío'); } else { this.toastr.error('Por favor, ingresa un correo electrónico válido.', 'Error de Formato'); }
  }
  public scrollToTop(): void { window.scrollTo({ top: 0, behavior: 'smooth' }); }

  // ======================================================================== //
  // == Section 8: Utility & Helper Functions                              == //
  // ======================================================================== //
  public getZoneImageUrl(zone: ZoneData | null): string { if (!zone) return this.defaultTerritoryImage; const fn = zone.cityImage?.trim(); if (fn) { try { return `${this.baseAssetUrl}uploads/zones/images/${encodeURIComponent(fn)}`; } catch (e) { console.error('Error encoding zone image URL', e); return this.defaultTerritoryImage; } } return this.defaultTerritoryImage; }
  public zoneHasModels(zone: ZoneData | null): boolean { if (!zone) return false; return this.territoryInteractionService.zoneHasModels(zone); }
  public getZoneClimateClass(climate?: ZoneData['climate'] | string): string { if (!climate) return 'other'; const cl = climate.toLowerCase(); if (cl === 'frio' || cl === 'frío') return 'cold'; if (cl === 'calido' || cl === 'cálido' || cl === 'templado') return 'hot'; return 'other'; }
  public getZoneClimateText(climate?: ZoneData['climate'] | string): string { if (!climate) return 'N/A'; const cl = climate.toLowerCase(); if (cl === 'frio' || cl === 'frío') return 'Frío'; if (cl === 'calido' || cl === 'cálido') return 'Cálido'; if (cl === 'templado') return 'Templado'; return climate.charAt(0).toUpperCase() + climate.slice(1).toLowerCase(); }
  private getProductClimateInfo(zone?: Zone): { climateClass: 'cold' | 'hot' | 'other'; climateText: string } { if (!zone?.climate) return { climateClass: 'other', climateText: 'Clima N/A' }; const cl = zone.climate.toLowerCase(); switch (cl) { case 'frio': case 'frío': return { climateClass: 'cold', climateText: 'Clima Frío' }; case 'calido': case 'cálido': case 'templado': return { climateClass: 'hot', climateText: 'Clima Templado' }; default: return { climateClass: 'other', climateText: `Clima ${zone.climate}` }; } }
  public getOriginalIndex(productId: number): number { return this.allDisplayProducts.findIndex(p => p.id === productId); }
  private getOriginalIndexForSwiperIndex(swiperIndex: number): number | null { if (!this.filteredDisplayProducts || swiperIndex < 0 || swiperIndex >= this.filteredDisplayProducts.length) return null; const productOnSlide = this.filteredDisplayProducts[swiperIndex]; if (!productOnSlide) return null; const originalIndex = this.getOriginalIndex(productOnSlide.id); return originalIndex !== -1 ? originalIndex : null; }
  private findCanvasByProductId(productId: number): ElementRef<HTMLCanvasElement> | undefined { if (!this.productCanvases) { console.warn("findCanvasByProductId: productCanvases QueryList is not yet available."); return undefined; } const found = this.productCanvases.find(ref => ref.nativeElement.getAttribute('data-product-id') === productId.toString()); return found; }
  public onImgError(event: Event, entityType: 'product' | 'zone'): void { const element = event.target as HTMLImageElement; if (!element) return; const fallbackSrc = entityType === 'zone' ? this.defaultTerritoryImage : this.defaultProductImage; if (element.src !== fallbackSrc) { element.src = fallbackSrc; } else { element.style.display = 'none'; } }
  private handleVisibilityChange = (): void => { if (document.hidden) { if (this.territoryService.isInitialized() && this.territoryService.isAnimating()) this.territoryService.stopAnimation(); if (this.productServiceInitialized && this.productService3D.isAnimating()) this.productService3D.stopAnimation(); this.pauseSwiperAutoplay(); } else { if (this.territoryLoaded && this.territoryService.isInitialized()) this.territoryService.startAnimation(); if (this.activeProductOriginalIndex !== null && this.productLoaded[this.activeProductOriginalIndex] && this.productServiceInitialized) this.productService3D.startAnimation(); this.resumeSwiperAutoplay(); } };
  private async ensureCanvasIsReady(canvasElement: HTMLCanvasElement): Promise<void> { let attempts = 0; const maxAttempts = 10; const delay = 50; while ((!canvasElement.clientWidth || !canvasElement.clientHeight) && attempts < maxAttempts) { await new Promise(resolve => setTimeout(resolve, delay)); attempts++; } if (!canvasElement.clientWidth || !canvasElement.clientHeight) { console.error("Canvas dimensions not valid after waiting.", canvasElement); throw new Error("Canvas no tiene dimensiones válidas después de esperar."); } }
  public closeModal(): void { this.showModal = false; this.cdRef.detectChanges(); }
  public goToAllProducts(): void { this.router.navigate(['/inicio/productos']); }

} // Fin Clase InicioComponent