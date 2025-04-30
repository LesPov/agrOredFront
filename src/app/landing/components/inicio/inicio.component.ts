import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
 import { CampiAmigoProductsService, Product, Zone } from '../../../features/campiamigo/services/campiAmigoProducts.service';
import { CampiAmigoZonesService, ZoneData } from '../../../features/campiamigo/services/campiAmigoZones.service';
import { environment } from '../../../../environments/environment';
import { ObserversService } from '../../services/observers.service';
import { TerritorySceneService } from '../../services/territory-scene.service';
import { ProductSceneService } from '../../services/product-scene.service';
import { ToastrService } from 'ngx-toastr';
import { Swiper } from 'swiper';
import { Autoplay, Navigation, Pagination } from 'swiper/modules';
import { CommonModule } from '@angular/common';


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
  styleUrl: './inicio.component.css'
})
export class InicioComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('terrainCanvas', { static: false }) terrainCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChildren('productCanvas') productCanvases!: QueryList<ElementRef<HTMLCanvasElement>>;
  @ViewChild('productSwiperContainer') productSwiperContainer!: ElementRef<HTMLElement>;

  public isTerritoryLoading = false;
  public territoryModelsReady = false;
  public territoryLoaded = false;
  public Math = Math;
  public selectedTab: 'all' | 'offer' | 'new' | 'popular' | 'cold' | 'hot' = 'all';
  public showModal = false;
  public allZones: ZoneData[] = [];
  public isLoadingZones = false;
  public zonesError: string | null = null;
  public activeTerritoryZone: ZoneData | null = null;
  public allDisplayProducts: DisplayProductInicio[] = [];
  public isLoadingProducts = false;
  public productError: string | null = null;
  public productLoaded: boolean[] = [];
  public activeProductOriginalIndex: number | null = null;
  public currentSlideIndex = 0; // Índice del slide Swiper actualmente visible

  private readonly defaultProductImage = 'assets/img/default-product.png';
  private readonly defaultTerritoryImage = 'assets/img/default-zone.png';
  private territoryObserver: IntersectionObserver | null = null;
  private productServiceInitialized = false;
  private readonly baseAssetUrl = environment.endpoint.endsWith('/') ? environment.endpoint : environment.endpoint + '/';
  private territoryInitAttemptedByObserver = false;
  private isTerritoryInitializing: boolean = false;
  private productSwiperInstance: Swiper | null = null;
  private readonly PASCA_ZONE_ID = 11;
  private isPreloadingInBackground = false;

  // Almacena el índice *original* del producto en el slide que estaba activo ANTES del cambio
  private previousActiveProductOriginalIndexOnSlide: number | null = null;

  constructor(
    private router: Router,
    private toastr: ToastrService,
    private observerService: ObserversService,
    private territoryService: TerritorySceneService,
    private productService3D: ProductSceneService,
    private campiAmigoProductsService: CampiAmigoProductsService,
    private campiAmigoZonesService: CampiAmigoZonesService,
    private cdRef: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadFeaturedProducts();
    this.loadAllZonesAndSetDefault();
  }

  ngAfterViewInit(): void {
    this.setupTerritoryObserver();
    this.initializeTerritoryServiceBase();
    this.productCanvases.changes.subscribe(() => this.handleProductCanvasChanges());
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  ngOnDestroy(): void {
    this.territoryService.destroy();
    this.productService3D.destroy();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.territoryObserver?.disconnect();
    this.destroySwiper();
  }

  private async initializeTerritoryServiceBase(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 0));
    if (this.terrainCanvasRef && this.terrainCanvasRef.nativeElement.isConnected && !this.territoryService.isInitialized()) {
      try {
        await this.ensureCanvasIsReady(this.terrainCanvasRef.nativeElement);
        await this.territoryService.init(this.terrainCanvasRef.nativeElement, this.baseAssetUrl);
      } catch (error) {
        console.error("Error inicializando servicio 3D Territorio:", error);
      }
    }
  }

  private loadAllZonesAndSetDefault(): void {
    this.isLoadingZones = true; this.zonesError = null; this.allZones = [];
    this.activeTerritoryZone = null; this.cdRef.detectChanges();
    this.campiAmigoZonesService.getAllZones().subscribe({
      next: (zones) => {
        this.allZones = zones; this.isLoadingZones = false;
        const defaultZone = this.allZones.find(zone => zone.id === this.PASCA_ZONE_ID) ?? this.allZones[0] ?? null;
        this.activeTerritoryZone = defaultZone;
        this.cdRef.detectChanges();
        if (this.activeTerritoryZone && this.zoneHasModels(this.activeTerritoryZone) && !this.isPreloadingInBackground) {
          setTimeout(() => this.preloadTerritoryModels(this.activeTerritoryZone!), 0);
        } else if (this.activeTerritoryZone && !this.zoneHasModels(this.activeTerritoryZone)) {
          this.territoryModelsReady = true; this.cdRef.detectChanges();
        }
      }, error: (err) => {
        console.error("Error cargando zonas:", err); this.zonesError = 'Error al cargar zonas.';
        this.isLoadingZones = false; this.cdRef.detectChanges();
      }
    });
  }

  private loadFeaturedProducts(): void {
    this.isLoadingProducts = true; this.productError = null; this.destroySwiper();
    this.allDisplayProducts = []; this.productLoaded = []; this.activeProductOriginalIndex = null;
    if (this.productServiceInitialized) this.productService3D.stopAnimation();
    this.cdRef.detectChanges();
    this.campiAmigoProductsService.getAllProductsWithUsers().subscribe({
      next: (resp) => {
        this.allDisplayProducts = resp.products.map(p => {
          const productZone = p.auth?.userProfile?.zone;
          const { climateClass, climateText } = this.getProductClimateInfo(productZone);
          const producerLocation = productZone ? `${productZone.name} · ${productZone.departamentoName}` : p.auth?.userProfile?.direccion || 'N/A';
          const imageUrl = p.image ? `${this.baseAssetUrl}uploads/productos/imagenes/${p.image}` : this.defaultProductImage;
          const discountPercentage = p.id % 3 === 0 ? 15 : undefined;
          const isTopProduct = p.id % 5 === 0;
          const originalPrice = discountPercentage ? p.price / (1 - discountPercentage / 100) : undefined;
          const ratingCount = Math.floor(Math.random() * 200) + 50;
          return { ...p, imageUrl, producerLocation, climateClass, climateText, glbFile: p.glbFile, discountPercentage, isTopProduct, originalPrice, ratingCount };
        });
        this.productLoaded = new Array(this.allDisplayProducts.length).fill(false);
        this.isLoadingProducts = false; this.cdRef.detectChanges();
        setTimeout(() => this.initializeOrUpdateSwiper(), 0);
      }, error: (err) => {
        console.error("Error cargando productos:", err); this.productError = 'Error al cargar productos.';
        this.isLoadingProducts = false; this.cdRef.detectChanges();
      }
    });
  }

  public get filteredDisplayProducts(): DisplayProductInicio[] {
    switch (this.selectedTab) {
      case 'all': return this.allDisplayProducts;
      case 'cold': return this.allDisplayProducts.filter(p => p.climateClass === 'cold');
      case 'hot': return this.allDisplayProducts.filter(p => p.climateClass === 'hot');
      case 'offer': return this.allDisplayProducts.filter(p => p.discountPercentage && p.discountPercentage > 0);
      case 'new': return this.allDisplayProducts.slice(0, 5);
      case 'popular': return this.allDisplayProducts.filter(p => (p.rating || 0) > 4);
      default: return this.allDisplayProducts;
    }
  }

  public selectTab(tab: 'all' | 'offer' | 'new' | 'popular' | 'cold' | 'hot'): void {
    if (this.selectedTab !== tab) {
      this.deactivateCurrentProduct3D(); // Reanuda swiper si estaba pausado
      this.destroySwiper();
      this.selectedTab = tab;
      this.cdRef.detectChanges();
      setTimeout(() => this.initializeOrUpdateSwiper(), 0);
    }
  }

  private initializeOrUpdateSwiper(): void {
    const slidesCount = this.filteredDisplayProducts.length;
    if (!this.productSwiperContainer || slidesCount === 0) {
      if (this.productSwiperInstance) this.destroySwiper();
      return;
    }
    if (this.productSwiperInstance) {
      this.productSwiperInstance.update();
      this.currentSlideIndex = this.productSwiperInstance.realIndex;
      this.cdRef.markForCheck();
      return;
    }
    this.productSwiperInstance = new Swiper(this.productSwiperContainer.nativeElement, {
      modules: [Navigation, Pagination, Autoplay],
      slidesPerView: 1, centeredSlides: true, spaceBetween: 30,
      loop: slidesCount > 1,
      autoplay: { delay: 3500, disableOnInteraction: false, pauseOnMouseEnter: false },
      pagination: { el: '.product-swiper-pagination', clickable: true },
      navigation: { nextEl: '.product-swiper-button-next', prevEl: '.product-swiper-button-prev' },
      grabCursor: true
    });

    this.currentSlideIndex = this.productSwiperInstance.realIndex; // Inicializar índice
    this.previousActiveProductOriginalIndexOnSlide = this.getOriginalIndexForSwiperIndex(this.currentSlideIndex); // Inicializar índice previo

    // Listener principal para cambios de slide
    this.productSwiperInstance.on('slideChange', () => {
      if (!this.productSwiperInstance) return; // Guardia por si se destruye

      const newSwiperIndex = this.productSwiperInstance.realIndex;
      const newProductOriginalIndex = this.getOriginalIndexForSwiperIndex(newSwiperIndex);

      // Si había un producto 3D activo en el slide *anterior* y ya no estamos en ese slide, desactivarlo.
      if (this.activeProductOriginalIndex !== null && this.activeProductOriginalIndex === this.previousActiveProductOriginalIndexOnSlide && this.activeProductOriginalIndex !== newProductOriginalIndex) {
        console.log(`Slide changed away from active 3D product (Index: ${this.activeProductOriginalIndex}). Deactivating.`);
        this.deactivateCurrentProduct3D(); // Esto reanuda el autoplay
      }

      // Actualizar estado para el próximo cambio
      this.currentSlideIndex = newSwiperIndex;
      this.previousActiveProductOriginalIndexOnSlide = newProductOriginalIndex;
      this.cdRef.markForCheck(); // Notificar a Angular
    });

    this.productSwiperInstance.on('autoplayStop', () => { /* Opcional: console.log('Swiper autoplay STOPPED'); */ });
    this.productSwiperInstance.on('autoplayStart', () => { /* Opcional: console.log('Swiper autoplay STARTED'); */ });
  }

  /** Obtiene el índice original (en allDisplayProducts) para un índice de Swiper (en filteredDisplayProducts) */
  private getOriginalIndexForSwiperIndex(swiperIndex: number): number | null {
    if (swiperIndex < 0 || swiperIndex >= this.filteredDisplayProducts.length) {
      return null;
    }
    const productOnSlide = this.filteredDisplayProducts[swiperIndex];
    return this.getOriginalIndex(productOnSlide.id);
  }


  public goToSlide(idx: number): void { if (this.productSwiperInstance) this.productSwiperInstance.slideToLoop(idx); }

  private destroySwiper(): void {
    if (this.productSwiperInstance) {
      this.productSwiperInstance.destroy(true, true);
      this.productSwiperInstance = null;
      this.currentSlideIndex = 0;
      this.previousActiveProductOriginalIndexOnSlide = null;
    }
  }

  public pauseSwiperAutoplay(): void {
    if (this.productSwiperInstance?.autoplay?.running) {
      this.productSwiperInstance.autoplay.stop();
    }
  }

  public resumeSwiperAutoplay(): void {
    if (this.activeProductOriginalIndex === null && this.productSwiperInstance && !this.productSwiperInstance.autoplay?.running) {
      this.productSwiperInstance.autoplay.start();
    }
  }

  private setupTerritoryObserver(): void {
    if (!this.terrainCanvasRef) return;
    if (this.territoryObserver) this.territoryObserver.disconnect();
    this.territoryObserver = this.observerService.createObserver(async () => {
      if (this.terrainCanvasRef.nativeElement.offsetParent !== null &&
        !this.territoryInitAttemptedByObserver &&
        !this.territoryService.isInitialized() &&
        !this.isTerritoryInitializing) {
        this.isTerritoryInitializing = true; this.territoryInitAttemptedByObserver = true;
        try { await this.territoryService.init(this.terrainCanvasRef.nativeElement, this.baseAssetUrl); }
        catch (error) { console.error("Territory Observer: Falló init base:", error); }
        finally {
          this.isTerritoryInitializing = false;
          if (this.territoryObserver && this.terrainCanvasRef) this.territoryObserver.unobserve(this.terrainCanvasRef.nativeElement);
        }
      } else if (this.territoryObserver && this.terrainCanvasRef) {
        this.territoryObserver.unobserve(this.terrainCanvasRef.nativeElement);
      }
    });
    this.territoryObserver.observe(this.terrainCanvasRef.nativeElement);
  }

  async preloadTerritoryModels(zoneToPreload: ZoneData): Promise<void> {
    if (!this.zoneHasModels(zoneToPreload)) {
      if (this.activeTerritoryZone?.id === zoneToPreload.id) { this.territoryModelsReady = true; this.cdRef.detectChanges(); }
      return;
    }
    if ((this.isPreloadingInBackground || this.territoryModelsReady) && this.activeTerritoryZone?.id === zoneToPreload.id) return;

    this.isPreloadingInBackground = true; this.territoryModelsReady = false;
    if (this.activeTerritoryZone?.id === zoneToPreload.id) this.cdRef.detectChanges();

    try {
      if (!this.territoryService.isInitialized()) {
        if (this.terrainCanvasRef && this.terrainCanvasRef.nativeElement.isConnected) {
          await this.ensureCanvasIsReady(this.terrainCanvasRef.nativeElement);
          await this.territoryService.init(this.terrainCanvasRef.nativeElement, this.baseAssetUrl);
        } else throw new Error("Canvas no disponible para inicializar en precarga.");
      } else this.territoryService.clearModels();

      await this.territoryService.loadModels(zoneToPreload.modelPath, zoneToPreload.titleGlb);

      if (this.activeTerritoryZone?.id === zoneToPreload.id) {
        this.territoryModelsReady = true;
        this.cdRef.detectChanges();
      }

    } catch (error) {
      console.error(`Error durante PRECARGA para ${zoneToPreload.name}:`, error);
      if (this.activeTerritoryZone?.id === zoneToPreload.id) { this.territoryModelsReady = false; this.cdRef.detectChanges(); }
    } finally {
      this.isPreloadingInBackground = false;
      if (this.isTerritoryLoading && this.activeTerritoryZone?.id === zoneToPreload.id) { this.isTerritoryLoading = false; this.cdRef.detectChanges(); }
    }
  }

  private showAndAnimateTerritory(): void {
    if (this.activeTerritoryZone && this.zoneHasModels(this.activeTerritoryZone) && this.territoryModelsReady) {
      this.deactivateCurrentProduct3D(); // Reanuda swiper
      if (!this.territoryLoaded) { this.territoryLoaded = true; this.cdRef.detectChanges(); }
      if (!this.territoryService.isAnimating()) { this.territoryService.startAnimation(); }
    }
  }

  private deactivateTerritory3D(): void {
    if (this.territoryLoaded) {
      this.territoryLoaded = false; this.territoryService.stopAnimation(); this.cdRef.detectChanges();
    }
  }

  private async activateProduct3D(originalIndex: number): Promise<void> {
    const targetProduct = this.allDisplayProducts[originalIndex];
    if (!targetProduct || !targetProduct.glbFile) { if (targetProduct) this.toastr.info(`Producto sin modelo 3D.`); return; }

    this.deactivateTerritory3D();
    this.deactivateCurrentProduct3D(); // Desactiva otro y reanuda swiper temporalmente
    this.pauseSwiperAutoplay(); // Pausa explícitamente para este nuevo

    const targetCanvasRef = this.findCanvasByProductId(targetProduct.id);
    if (!targetCanvasRef) { this.toastr.error("Error interno 3D."); this.resumeSwiperAutoplay(); return; }
    const targetCanvasElement = targetCanvasRef.nativeElement;

    try {
      if (!this.productServiceInitialized) { await this.productService3D.init(targetCanvasElement); this.productServiceInitialized = true; }
      else { await this.productService3D.setRenderingTarget(targetCanvasElement); }

      let serviceModelIndex = -1;
      const targetBaseName = this.getBaseGlbName(targetProduct.glbFile);
      if (targetBaseName && this.productService3D.productModels.length > 0) {
        serviceModelIndex = this.productService3D.productModels.findIndex(servicePath => {
          const serviceBaseName = this.getBaseGlbName(servicePath);
          return serviceBaseName && (serviceBaseName === targetBaseName || serviceBaseName.includes(targetBaseName) || targetBaseName.includes(serviceBaseName));
        });
      }

      if (serviceModelIndex !== -1) { await this.productService3D.loadModelByIndex(serviceModelIndex); }
      else { await this.productService3D.loadModelByIndex(0); this.toastr.warning(`Modelo 3D específico no encontrado.`, '', { timeOut: 3500 }); }

      this.productLoaded[originalIndex] = true;
      this.activeProductOriginalIndex = originalIndex;
      // Actualizar el índice previo AHORA que sabemos cuál está activo
      this.previousActiveProductOriginalIndexOnSlide = originalIndex;
      console.log(`Activando 3D para índice ${originalIndex}. Estado productLoaded DESPUÉS:`, this.productLoaded[originalIndex]); // DEBUG
      this.cdRef.detectChanges(); // Notificar a Angular
      // Swiper sigue pausado

    } catch (error) {
      console.error(`Error activando 3D producto ${originalIndex}:`, error);
      this.toastr.error(`Error cargando 3D para ${targetProduct.name}.`);
      this.productLoaded[originalIndex] = false; // Asegurarse de que quede falso si falla
      this.activeProductOriginalIndex = null;

      this.previousActiveProductOriginalIndexOnSlide = null; // Resetear si falla
      if (!this.productService3D.isInitialized()) this.productServiceInitialized = false;
      this.cdRef.detectChanges();
      this.resumeSwiperAutoplay(); // Reanudar si falla
    }
  }

  private deactivateCurrentProduct3D(): void {
    if (this.activeProductOriginalIndex !== null) {
      const oldIndex = this.activeProductOriginalIndex;
      this.productService3D.stopAnimation();
      if (oldIndex >= 0 && oldIndex < this.productLoaded.length) { this.productLoaded[oldIndex] = false; }
      this.activeProductOriginalIndex = null;
      // No resetear previousActiveProductOriginalIndexOnSlide aquí, lo hace el slideChange
      this.cdRef.detectChanges();
      // Reanudar Swiper DESPUÉS de desactivar 3D
      this.resumeSwiperAutoplay();
    }
  }

  private handleProductCanvasChanges(): void {
    if (this.activeProductOriginalIndex !== null) {
      const activeProduct = this.allDisplayProducts[this.activeProductOriginalIndex];
      const canvasStillExists = this.productCanvases.some(ref => ref.nativeElement.getAttribute('data-product-id') === activeProduct?.id.toString());
      if (activeProduct && !canvasStillExists) {
        this.deactivateCurrentProduct3D(); // Esto reanuda Swiper
      }
    }
  }

  onZoneCardClick(zone: ZoneData): void {
    if (this.activeTerritoryZone?.id === zone.id) return;
    this.activeTerritoryZone = zone;
    this.deactivateTerritory3D();
    this.deactivateCurrentProduct3D(); // Reanuda swiper
    this.territoryModelsReady = false; this.isTerritoryLoading = false; this.cdRef.detectChanges();
    if (this.zoneHasModels(zone) && !this.isPreloadingInBackground) { this.preloadTerritoryModels(zone); }
    else if (!this.zoneHasModels(zone)) { this.territoryModelsReady = true; this.cdRef.detectChanges(); }
  }

  onMainCanvasClick(): void {
    if (!this.activeTerritoryZone) { this.toastr.warning("Selecciona una zona."); return; }
    if (!this.zoneHasModels(this.activeTerritoryZone)) { this.toastr.info(`Zona sin modelo 3D.`); this.deactivateTerritory3D(); return; }
    if (this.territoryModelsReady) { this.showAndAnimateTerritory(); }
    else if (this.isTerritoryLoading || this.isPreloadingInBackground) { this.toastr.info(`Modelo 3D aún no está listo...`, "Preparando", { timeOut: 2500 }); }
    else {
      this.deactivateCurrentProduct3D(); // Reanuda swiper ANTES de cargar territorio
      this.isTerritoryLoading = true; this.cdRef.detectChanges();
      this.preloadTerritoryModels(this.activeTerritoryZone).then(() => { if (this.territoryModelsReady) { this.toastr.success(`Modelo 3D preparado. Clic de nuevo para verlo.`, "Listo", { timeOut: 3000 }); } });
    }
  }

  async onProductCanvasClick(originalIndex: number): Promise<void> {
    if (originalIndex < 0 || originalIndex >= this.allDisplayProducts.length) return;
    const product = this.allDisplayProducts[originalIndex];
    if (this.productLoaded[originalIndex]) { return; } // Ya cargado
    if (product.glbFile) {
      await this.activateProduct3D(originalIndex); // Pausa swiper
    } else {
      this.toastr.info(`Producto ${product.name} sin modelo 3D.`);
      this.deactivateCurrentProduct3D(); // Desactiva otro y reanuda swiper
    }
  }

  private handleVisibilityChange = () => {
    if (document.hidden) {
      if (this.territoryService.isInitialized()) this.territoryService.stopAnimation();
      if (this.productServiceInitialized) this.productService3D.stopAnimation();
      this.pauseSwiperAutoplay();
    } else {
      if (this.territoryLoaded && this.territoryService.isInitialized()) this.territoryService.startAnimation();
      if (this.activeProductOriginalIndex !== null && this.productLoaded[this.activeProductOriginalIndex] && this.productServiceInitialized) this.productService3D.startAnimation();
      this.resumeSwiperAutoplay();
    }
  };

  public subscribeNewsletter(event: Event): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const emailInput = form.querySelector('input[type="email"]') as HTMLInputElement;
    const email = emailInput.value;
    if (email) {
      this.toastr.success(`Gracias por suscribirte con ${email}!`, 'Suscripción Exitosa'); 
      emailInput.value = '';
    } else {
      this.toastr.error('Por favor, ingresa un correo electrónico válido.', 'Error');
    }
  }
  public scrollToTop(): void { window.scrollTo({ top: 0, behavior: 'smooth' }); }
  public goToAllProducts(): void { this.router.navigate(['/inicio/productos']); }
  public closeModal(): void { this.showModal = false; this.cdRef.detectChanges(); }
  public onImgError(event: Event, entityType: 'product' | 'zone'): void {
    const element = event.target as HTMLImageElement;
    if (!element) return;
    const fallbackSrc = entityType === 'zone' ? this.defaultTerritoryImage : this.defaultProductImage;
    if (element.src !== fallbackSrc) { element.src = fallbackSrc; }
    else { console.error(`CRITICAL: Fallback ${entityType} image failed: ${fallbackSrc}`); }
  }

  private async ensureCanvasIsReady(canvasElement: HTMLCanvasElement): Promise<void> {
    let attempts = 0; const maxAttempts = 10; const delay = 50;
    while ((!canvasElement.clientWidth || !canvasElement.clientHeight) && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delay)); attempts++;
    }
    if (!canvasElement.clientWidth || !canvasElement.clientHeight) throw new Error("Canvas zero dimensions.");
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
  public getZoneClimateClass(climate?: ZoneData['climate'] | string): string {
    if (!climate) return 'other'; const cl = climate.toLowerCase();
    if (cl === 'frio' || cl === 'frío') return 'cold';
    if (cl === 'calido' || cl === 'cálido' || cl === 'templado') return 'hot'; return 'other';
  }
  public getZoneClimateText(climate?: ZoneData['climate'] | string): string {
    if (!climate) return 'N/A'; const cl = climate.toLowerCase();
    if (cl === 'frio' || cl === 'frío') return 'Frío';
    if (cl === 'calido' || cl === 'cálido') return 'Cálido';
    if (cl === 'templado') return 'Templado';
    return climate.charAt(0).toUpperCase() + climate.slice(1).toLowerCase();
  }
  public getZoneImageUrl(zone: ZoneData | null): string {
    if (!zone) return this.defaultTerritoryImage;
    const fn = zone.cityImage?.trim();
    if (fn) { try { return `${this.baseAssetUrl}uploads/zones/images/${encodeURIComponent(fn)}`; } catch (e) { return this.defaultTerritoryImage; } }
    return this.defaultTerritoryImage;
  }
  public zoneHasModels(zone: ZoneData): boolean { return !!(zone.modelPath || zone.titleGlb); }
  public getOriginalIndex(productId: number): number { return this.allDisplayProducts.findIndex(p => p.id === productId); }
  private getBaseGlbName(filePath?: string): string | undefined {
    if (!filePath) return undefined; const fn = filePath.split('/').pop()?.toLowerCase(); if (!fn) return undefined;
    return fn.replace(/\.glb$/, '').replace(/-\d{10,}$/, '').replace(/-[a-f0-9]{8,}$/, '');
  }
  private findCanvasByProductId(productId: number): ElementRef<HTMLCanvasElement> | undefined {
    return this.productCanvases.find(ref => ref.nativeElement.getAttribute('data-product-id') === productId.toString());
  }

}