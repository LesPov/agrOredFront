import { CommonModule, DecimalPipe, UpperCasePipe, TitleCasePipe, Location } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { forkJoin } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CampiAmigoZonesService, ZoneData } from '../../../features/campiamigo/services/campiAmigoZones.service';
import { TerritorySceneService } from '../../services/territory-scene.service';
 import { CampiAmigoProductsService, Product as ProductData  } from '../../../features/campiamigo/services/campiAmigoProducts.service';
import { LoginPromptComponent } from '../../../shared/components/login-prompt/login-prompt.component';
 
interface ExtendedZoneData extends ZoneData {
  productosPrincipales?: string[];
}

interface AggregatedZone {
  zone: ExtendedZoneData;
  count: number;
  campiamigoIds: number[];
}
@Component({
  selector: 'app-zonas-shared',
  imports: [ CommonModule, FormsModule, DecimalPipe, UpperCasePipe, TitleCasePipe, LoginPromptComponent],
  templateUrl: './zonas-shared.component.html',
  styleUrl: './zonas-shared.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ZonasSharedComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('mainZoneCanvas') mainZoneCanvasRef!: ElementRef<HTMLCanvasElement>;

  // --- Estado UI ---
  aggregatedZones: AggregatedZone[] = [];
  allAggregatedZones: AggregatedZone[] = [];
  selectedZone: AggregatedZone | null = null;
  filterModalOpen: boolean = false;
  filterName: string = '';
  filterTipoZona: string = '';

  // --- Estado 3D ---
  zoneModelsReady: { [zoneId: number]: boolean } = {};
  isZoneLoading: { [zoneId: number]: boolean } = {};
  zoneLoaded: { [zoneId: number]: boolean } = {};
  isZonePreloading: { [zoneId: number]: boolean } = {};

  // --- Configuración y Servicios ---
  public environment = environment;
  private territoryServiceInitialized = false;
  private readonly baseAssetUrl = environment.endpoint.endsWith('/') ? environment.endpoint : environment.endpoint + '/';
  private readonly defaultZoneImage = 'assets/img/default-zone.png';
  private preloadQueue: ExtendedZoneData[] = [];
  private isPreloadingActive = false;
  private allProducts: ProductData[] = [];
  public currentMode: 'public' | 'private' = 'private'; // Por defecto privado (más seguro)
  public showLoginModal: boolean = false;

  constructor(
    private campiService: CampiAmigoZonesService,
    private productCampiaMiGoService: CampiAmigoProductsService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private toastr: ToastrService,
    private territoryService: TerritorySceneService,
    private cdRef: ChangeDetectorRef
  ) { }

  // ==================================
  // Ciclo de Vida y Carga Inicial
  // ==================================

  ngOnInit(): void {
    // *** LEER EL MODO DE LA RUTA ***
    const modeFromRoute = this.route.snapshot.data['mode'];
    if (modeFromRoute === 'public') {
      this.currentMode = 'public';
      console.log('ZoneComponent cargado en modo PÚBLICO');
    } else {
      this.currentMode = 'private'; // Asume privado si no es explícitamente público
      console.log('ZoneComponent cargado en modo PRIVADO');
    }

    this.route.queryParams.subscribe(params => {
      this.loadInitialData(params['climate'], params['dept']);
    });
  }

  ngAfterViewInit(): void {
    // La inicialización base se intentará después de cargar datos
    // y si hay una zona seleccionada.
  }

  ngOnDestroy(): void {
    this.isPreloadingActive = false;
    this.preloadQueue = [];
    if (this.territoryServiceInitialized) {
      this.territoryService.destroy();
    }
  }

  private loadInitialData(climate?: string, dept?: string): void {
    this.resetComponentState();

    forkJoin({
      zonesResponse: this.campiService.getZones(climate),
      productsResponse: this.productCampiaMiGoService.getAllProductsWithUsers()
    }).subscribe({
      next: ({ zonesResponse, productsResponse }) => {
        this.allProducts = productsResponse.products || [];
        this.processZonesAndProducts(zonesResponse.zones || [], dept);
      },
      error: (err) => {
        console.error('Error al cargar datos iniciales:', err);
        this.toastr.error('No se pudieron cargar los datos iniciales.', 'Error');
        this.resetComponentState();
        this.cdRef.detectChanges();
      }
    });
  }

  private resetComponentState(): void {
    this.selectedZone = null;
    this.aggregatedZones = [];
    this.allAggregatedZones = [];
    this.allProducts = [];
    this.reset3DState();
  }

  private reset3DState(): void {
    this.isPreloadingActive = false;
    this.preloadQueue = [];
    this.zoneModelsReady = {};
    this.isZoneLoading = {};
    this.zoneLoaded = {};
    this.isZonePreloading = {};
    if (this.territoryServiceInitialized) {
        this.territoryService.clearModels();
        this.territoryService.stopAnimation();
    }
  }

  private processZonesAndProducts(zonesReceived: ZoneData[], deptFilter?: string): void {
    let filteredZones = zonesReceived;
    if (deptFilter) {
      filteredZones = filteredZones.filter(zone => zone.departamentoName === deptFilter);
    }

    const zoneMap = new Map<string, AggregatedZone>();
    const zonesToPreloadCandidates: ExtendedZoneData[] = [];

    filteredZones.forEach(baseZone => {
      const key = `${baseZone.name}_${baseZone.id}`;
      const campIds: number[] = baseZone.userProfiles ? baseZone.userProfiles.map(profile => profile.userId) : [];
      const currentCount = campIds.length;
      const zone: ExtendedZoneData = { ...baseZone, productosPrincipales: [] };

      const productNamesInZone = new Set<string>();
      this.allProducts.forEach(product => {
        const productUserId = product.userId ?? product.auth?.id;
        if (productUserId !== undefined && campIds.includes(productUserId) && product.name) {
          productNamesInZone.add(product.name.trim());
        }
      });
      zone.productosPrincipales = Array.from(productNamesInZone).slice(0, 5);

      if (!(zone.id in this.zoneModelsReady)) {
        this.zoneModelsReady[zone.id] = false;
        this.isZoneLoading[zone.id] = false;
        this.zoneLoaded[zone.id] = false;
        this.isZonePreloading[zone.id] = false;
      }
      if (this.zoneHasModels(zone)) {
        zonesToPreloadCandidates.push(zone);
      }

      if (zoneMap.has(key)) {
        const agg = zoneMap.get(key)!;
        agg.count += currentCount;
        agg.campiamigoIds = [...new Set([...agg.campiamigoIds, ...campIds])];
        const existingProducts = new Set(agg.zone.productosPrincipales);
        zone.productosPrincipales?.forEach(p => existingProducts.add(p));
        agg.zone.productosPrincipales = Array.from(existingProducts).slice(0, 5);
      } else {
        zoneMap.set(key, { zone, count: currentCount, campiamigoIds: campIds });
      }
    });

    this.aggregatedZones = Array.from(zoneMap.values());
    this.allAggregatedZones = [...this.aggregatedZones];

    if (this.aggregatedZones.length > 0) {
      this.selectedZone = this.aggregatedZones[0];
      Object.keys(this.zoneLoaded).forEach(id => this.zoneLoaded[Number(id)] = false);
       // Intentar inicializar base Y comenzar precarga DESPUÉS de seleccionar zona inicial
       setTimeout(async () => {
        await this.initializeTerritoryServiceBase(); // Intenta init base
        this.startPreloadingQueue(zonesToPreloadCandidates); // Inicia precarga
       }, 50); // Pequeño delay
    } else {
      this.selectedZone = null;
    }

    this.cdRef.detectChanges();
  }

  // ==================================
  // Selección de Zona y Lógica 3D
  // ==================================

  selectZone(agg: AggregatedZone): void {
    if (this.selectedZone?.zone.id === agg.zone.id) {
      if (this.zoneHasModels(agg.zone) && this.zoneModelsReady[agg.zone.id] && !this.zoneLoaded[agg.zone.id]) {
         this.onZoneCanvasClick();
      }
      return;
    }
    console.log("Selecting zone:", agg.zone.name);
    if (this.selectedZone && this.zoneLoaded[this.selectedZone.zone.id]) {
        this.zoneLoaded[this.selectedZone.zone.id] = false;
    }
    if (this.territoryServiceInitialized) {
        this.territoryService.stopAnimation();
        // Considerar NO limpiar modelos aquí, dejar que la precarga/clic lo maneje
        // this.territoryService.clearModels();
    }
    this.selectedZone = agg;
    this.zoneLoaded[agg.zone.id] = false;
    this.isZoneLoading[agg.zone.id] = false;
    this.cdRef.detectChanges();

    // Iniciar precarga si es necesario (priorizar esta zona)
    if (this.zoneHasModels(agg.zone) && !this.zoneModelsReady[agg.zone.id] && !this.isZonePreloading[agg.zone.id] && !this.isZoneLoading[agg.zone.id]) {
        console.log(`[Select] Prioritizing preload for: ${agg.zone.name}`);
        // Quitar de la cola si ya estaba para añadirla al principio
        this.preloadQueue = this.preloadQueue.filter(z => z.id !== agg.zone.id);
        this.preloadQueue.unshift(agg.zone); // Poner al principio
        if (!this.isPreloadingActive) {
            this.startPreloadingQueue([]); // Inicia proceso si no está activo
        }
    }
    // Asegurar que la base 3D esté lista
     if (!this.territoryServiceInitialized && this.mainZoneCanvasRef) {
         this.initializeTerritoryServiceBase();
     }
  }

  private async initializeTerritoryServiceBase(): Promise<boolean> {
    const canvasElement = this.mainZoneCanvasRef?.nativeElement;
    if (this.territoryServiceInitialized || !canvasElement || !canvasElement.isConnected) {
        return this.territoryServiceInitialized;
    }
    console.log("Initializing Base 3D Service...");
    try {
        await this.ensureCanvasIsReady(canvasElement);
        await this.territoryService.init(canvasElement, this.baseAssetUrl);
        this.territoryServiceInitialized = true;
        console.log("Base 3D Service Initialized.");
        return true;
    } catch (error) {
        console.error("Error initializing Base 3D Service:", error);
        this.territoryServiceInitialized = false;
        return false;
    }
  }

  private startPreloadingQueue(initialZones: ExtendedZoneData[]): void {
    // Añade solo las que no estén ya en la cola
    initialZones.forEach(zone => {
        if (!this.preloadQueue.some(queuedZone => queuedZone.id === zone.id)) {
            this.preloadQueue.push(zone);
        }
    });

    if (!this.isPreloadingActive && this.preloadQueue.length > 0) {
      this.isPreloadingActive = true;
      console.log(`Starting preload queue with ${this.preloadQueue.length} items.`);
      this.processNextInPreloadQueue();
    }
  }

  private processNextInPreloadQueue(): void {
      if (this.preloadQueue.length === 0 || !this.isPreloadingActive) {
        this.isPreloadingActive = false;
        console.log("Preload queue finished or stopped.");
        return;
      }
      const zoneToPreload = this.preloadQueue.shift()!;
      this.processPreloadQueueItem(zoneToPreload);
  }

  // =========================================
  // Precarga CORREGIDA para imitar Inicio
  // =========================================
  private async processPreloadQueueItem(zoneToPreload: ExtendedZoneData): Promise<void> {
    const zoneId = zoneToPreload.id;

    if (this.zoneModelsReady[zoneId] || this.isZoneLoading[zoneId] || this.isZonePreloading[zoneId]) {
      console.log(`[Preload] Skipping ${zoneToPreload.name} (Already handled)`);
      if (this.isPreloadingActive) setTimeout(() => this.processNextInPreloadQueue(), 50);
      return;
    }
    if (!this.zoneHasModels(zoneToPreload)) {
        this.zoneModelsReady[zoneId] = true; // Listo porque no hay nada que cargar
        console.log(`[Preload] Skipping ${zoneToPreload.name} (No models)`);
        if (this.isPreloadingActive) setTimeout(() => this.processNextInPreloadQueue(), 50);
        return;
    }

    this.isZonePreloading[zoneId] = true;
    console.log(`[Preload] Starting: ${zoneToPreload.name} (ID: ${zoneId})`);
    if (this.selectedZone?.zone.id === zoneId) {
       this.cdRef.detectChanges(); // Ocultar icono si estaba visible
    }

    try {
      const baseReady = await this.initializeTerritoryServiceBase();
      if (!baseReady) throw new Error("Base 3D service not ready for preload.");

      // ***** PUNTO CLAVE: Limpiar ANTES de cargar en la precarga *****
      // Si el servicio maneja solo un modelo, esto es necesario para
      // asegurar que la precarga realmente pone el modelo deseado en el servicio.
      this.territoryService.clearModels();
      console.log(`[Preload] Loading models for ${zoneToPreload.name} into service...`);
      await this.territoryService.loadModels(zoneToPreload.modelPath, zoneToPreload.titleGlb);

      // Éxito: Marcar como listo
      this.zoneModelsReady[zoneId] = true;
      console.log(`[Preload] Success: ${zoneToPreload.name}. Models marked as ready.`);

      // Actualizar UI si sigue siendo la zona seleccionada (Mostrar icono)
      if (this.selectedZone?.zone.id === zoneId) {
          console.log(`[Preload] Updating UI for active zone: ${zoneToPreload.name}`);
          this.cdRef.detectChanges();
      }

    } catch (error) {
      console.error(`[Preload] Failed: ${zoneToPreload.name}:`, error);
      this.zoneModelsReady[zoneId] = false; // Marcar como no listo
      if (this.selectedZone?.zone.id === zoneId) {
         this.cdRef.detectChanges(); // Actualizar UI aunque falle
      }
    } finally {
      this.isZonePreloading[zoneId] = false; // Termina intento de precarga
      // Continuar con la cola
      if (this.isPreloadingActive) {
          setTimeout(() => this.processNextInPreloadQueue(), 100); // Pausa un poco mayor
      }
    }
}


  // ==================================
  // Clic CORREGIDO para imitar Inicio
  // ==================================
  async onZoneCanvasClick(): Promise<void> {
    const currentSelected = this.selectedZone;
    if (!currentSelected) return;

    const clickedZoneId = currentSelected.zone.id;
    const clickedZone = currentSelected.zone;

    console.log(`[Click] Zone: ${clickedZone.name} | Ready: ${this.zoneModelsReady[clickedZoneId]} | Loading: ${this.isZoneLoading[clickedZoneId]} | Preloading: ${this.isZonePreloading[clickedZoneId]} | Loaded(Visible): ${this.zoneLoaded[clickedZoneId]}`);

    // 1. Validaciones
    if (!this.zoneHasModels(clickedZone)) {
       this.toastr.info('Modelo 3D no disponible.', 'Info');
       return;
    }
    if (this.zoneLoaded[clickedZoneId]) {
        if (!this.territoryService.isAnimating()) this.territoryService.startAnimation();
        return;
    }
    if (this.isZoneLoading[clickedZoneId] || this.isZonePreloading[clickedZoneId]) {
       this.toastr.info('Modelo 3D preparándose...', 'Espere', { timeOut: 1500 });
       return;
    }

    // 2. Asegurar Canvas y Base 3D
    const canvasElement = this.mainZoneCanvasRef?.nativeElement;
    if (!canvasElement) { this.toastr.error("Error área 3D.", "Error"); return; }
    const baseReady = await this.initializeTerritoryServiceBase();
    if (!baseReady) { this.toastr.error("Error servicio 3D.", "Error"); return; }

    // 3. Lógica principal CORREGIDA
    if (this.zoneModelsReady[clickedZoneId]) {
      // --- CASO: MODELO LISTO (PRECARGADO) ---
      console.log(`[Click/Ready] Showing preloaded model for ${clickedZone.name}`);
      // Asegurar que no se muestre spinner
      this.isZoneLoading[clickedZoneId] = false;

      // ***** CORRECCIÓN CLAVE: Confiar en la precarga *****
      try {
        // PASO 1: Mostrar canvas INMEDIATAMENTE
        this.zoneLoaded[clickedZoneId] = true;
        this.cdRef.detectChanges(); // <-- Actualiza UI AHORA

        // PASO 2: Asegurar tamaño correcto y animar lo que YA ESTÁ en el servicio
        //         (Asumimos que la precarga dejó el modelo correcto activo)
        this.territoryService.onResize(canvasElement); // Ajustar tamaño
        this.territoryService.startAnimation();      // Animar
        console.log(`[Click/Ready] Animation started instantly for ${clickedZone.name}.`);
         // OPCIONAL: Podríamos verificar si el modelo activo en el servicio *realmente*
         // coincide con clickedZone. Si no, cargaríamos aquí, pero intentemos
         // confiar en la precarga primero para máxima velocidad.

      } catch (error) {
          // Este catch es menos probable ahora, pero por seguridad
          console.error(`[Click/Ready] Error showing/animating model for ${clickedZone.name}:`, error);
          this.toastr.error("Error al mostrar el modelo 3D.", "Error");
          this.zoneLoaded[clickedZoneId] = false; // Revertir
          // No necesariamente marcar como !ready, podría ser un error de animación
          this.cdRef.detectChanges();
      }
      // ***** FIN CORRECCIÓN CLAVE *****

    }
    else {
      // --- CASO: MODELO NO LISTO -> Cargar con Spinner ---
      console.warn(`[Click/Not Ready] Models for ${clickedZone.name} not ready. Starting active load...`);
      await this.loadAndShowWithSpinner(currentSelected, canvasElement);
    }
  }

  // loadAndShowWithSpinner se mantiene igual (muestra spinner, carga, muestra canvas)
  private async loadAndShowWithSpinner(agg: AggregatedZone, canvasElement: HTMLCanvasElement): Promise<void> {
    const zoneId = agg.zone.id;
    const zone = agg.zone;
    this.isZoneLoading[zoneId] = true;
    this.zoneLoaded[zoneId] = false;
    this.cdRef.detectChanges();
    try {
      this.territoryService.clearModels();
      this.territoryService.onResize(canvasElement);
      console.log(`[Load&Show] Actively loading models for ${zone.name}...`);
      await this.territoryService.loadModels(zone.modelPath, zone.titleGlb);
      console.log(`[Load&Show] Models for ${zone.name} loaded actively.`);
      this.zoneModelsReady[zoneId] = true;
      this.isZoneLoading[zoneId] = false;
      this.zoneLoaded[zoneId] = true;
      this.cdRef.detectChanges();
      this.territoryService.startAnimation();
    } catch (error) {
      console.error(`[Load&Show] Error during active load for ${zone.name}:`, error);
      this.toastr.error(`No se pudo cargar el modelo 3D para ${zone.name}.`, 'Error');
      this.isZoneLoading[zoneId] = false;
      this.zoneLoaded[zoneId] = false;
      this.zoneModelsReady[zoneId] = false;
      this.cdRef.detectChanges();
     }
  }

  // ==================================
  // Métodos Utilitarios y de UI (sin cambios necesarios)
  // ==================================
  private async ensureCanvasIsReady(canvasElement: HTMLCanvasElement): Promise<void> {
    let attempts = 0; const maxAttempts = 15; const delay = 50;
    while ((!canvasElement.clientWidth || !canvasElement.clientHeight) && attempts < maxAttempts) {
      console.warn(`Canvas sin dimensiones (Intento ${attempts + 1}/${maxAttempts}), esperando ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      attempts++;
    }
    if (!canvasElement.clientWidth || !canvasElement.clientHeight) {
        console.error("Canvas sigue sin dimensiones después de esperar.");
        throw new Error("Canvas has zero dimensions after timeout.");
    }
     console.log("Canvas ready with dimensions:", canvasElement.clientWidth, "x", canvasElement.clientHeight);
  }

  public zoneHasModels(zone: ZoneData | ExtendedZoneData | null): boolean {
     return !!(zone?.modelPath?.trim() || zone?.titleGlb?.trim());
  }

  public getZoneImageUrl(zone: ZoneData | null): string {
    if (!zone) return this.defaultZoneImage;
    let filename = zone.cityImage?.trim();
    if (filename) {
        try {
            const baseUrl = this.baseAssetUrl.endsWith('/') ? this.baseAssetUrl : this.baseAssetUrl + '/';
            return `${baseUrl}uploads/zones/images/${encodeURIComponent(filename)}`;
        } catch (e) {
            console.error(`Error creando URL para imagen '${filename}':`, e);
            return this.defaultZoneImage;
        }
    }
    return this.defaultZoneImage;
   }

   public getZoneClimateClass(climate?: ZoneData['climate'] | string): string {
        if (!climate) return 'other';
        const cl = climate.toLowerCase().trim();
        if (cl === 'frio' || cl === 'frío') return 'cold';
        if (cl === 'calido' || cl === 'cálido' || cl === 'templado') return 'hot';
        return 'other';
    }

    public getZoneClimateText(climate?: ZoneData['climate'] | string): string {
        if (!climate) return 'N/A';
        const cl = climate.toLowerCase().trim();
        if (cl === 'frio' || cl === 'frío') return 'Frío';
        if (cl === 'calido' || cl === 'cálido') return 'Cálido';
        if (cl === 'templado') return 'Templado';
        return climate.charAt(0).toUpperCase() + climate.slice(1).toLowerCase();
    }

   public onImgError(event: Event): void {
     const element = event.target as HTMLImageElement;
     if (element && element.src !== this.defaultZoneImage) {
       console.warn(`Error cargando imagen: ${element.src}. Usando fallback.`);
       element.src = this.defaultZoneImage;
     }
   }

     // *** MÉTODO ORIGINAL DE NAVEGACIÓN (ahora llamado por handleExploreClick en modo privado) ***
  private navigateToScene(aggregated: AggregatedZone): void {
    // La validación de aggregated.zone.id ya se hizo en handleExploreClick
    this.router.navigate(
      ['/user/estaciones/scene', aggregated.zone.id], // Ruta privada
      { queryParams: { count: aggregated.count, campiamigoIds: JSON.stringify(aggregated.campiamigoIds) } }
    );
  }

  // *** MÉTODOS PARA MANEJAR EL MODAL ***
  public openLoginPromptModal(): void {
    this.showLoginModal = true;
    this.cdRef.detectChanges(); // Importante con OnPush
  }

  public closeLoginPromptModal(): void {
    this.showLoginModal = false;
    this.cdRef.detectChanges(); // Importante con OnPush
  }


   goBack(): void { this.location.back(); }
   openFilterModal(): void { this.filterModalOpen = true; this.cdRef.markForCheck(); }
   closeFilterModal(): void { this.filterModalOpen = false; this.cdRef.markForCheck(); }

   applyFilter(): void {
     const nameQuery = this.filterName.trim().toLowerCase();
     const tipoQuery = this.filterTipoZona;
     this.aggregatedZones = this.allAggregatedZones.filter(agg => {
         const z = agg.zone;
         const nameMatch = nameQuery ? z.name.toLowerCase().includes(nameQuery) : true;
         const typeMatch = tipoQuery ? z.tipoZona === tipoQuery : true;
         return nameMatch && typeMatch;
     });

      const selectedStillVisible = this.selectedZone && this.aggregatedZones.some(agg => agg.zone.id === this.selectedZone?.zone.id);
      if (!selectedStillVisible) {
          const newSelected = this.aggregatedZones.length > 0 ? this.aggregatedZones[0] : null;
           if (this.selectedZone?.zone.id !== newSelected?.zone.id) {
              if (newSelected) { this.selectZone(newSelected); }
              else {
                 if (this.selectedZone && this.zoneLoaded[this.selectedZone.zone.id]) { this.zoneLoaded[this.selectedZone.zone.id] = false; }
                 if (this.territoryServiceInitialized) { this.territoryService.stopAnimation(); }
                 this.selectedZone = null;
              }
           }
      }

     if (this.aggregatedZones.length === 0 && this.allAggregatedZones.length > 0) {
         this.toastr.info('No se encontraron zonas con esos filtros.', 'Sin Resultados');
     }
     this.closeFilterModal();
     this.cdRef.detectChanges();
     this.startPreloadingQueue( this.aggregatedZones.map(agg => agg.zone).filter(z => this.zoneHasModels(z) && !this.zoneModelsReady[z.id]));
   }

   resetFilter(): void {
     this.filterName = ''; this.filterTipoZona = '';
     this.aggregatedZones = [...this.allAggregatedZones];
     if (!this.selectedZone && this.aggregatedZones.length > 0) {
         this.selectZone(this.aggregatedZones[0]);
     } else { this.cdRef.detectChanges(); }
     this.closeFilterModal();
     this.startPreloadingQueue( this.aggregatedZones.map(agg => agg.zone).filter(z => this.zoneHasModels(z) && !this.zoneModelsReady[z.id]));
   }
 // *** MÉTODO INTERMEDIARIO PARA EL BOTÓN "EXPLORAR EN 3D" ***
 public handleExploreClick(): void {
  if (!this.selectedZone) {
    this.toastr.warning('Por favor, selecciona una zona primero.', 'Acción no disponible');
    return;
  }
  if (!this.selectedZone.zone.id) {
      this.toastr.error('La zona seleccionada no tiene un ID válido.');
      return;
  }

  console.log(`handleExploreClick - Modo actual: ${this.currentMode}`);

  if (this.currentMode === 'public') {
    // Modo Público: Mostrar el modal
    console.log('Modo público detectado, abriendo modal...');
    this.openLoginPromptModal();
  } else {
    // Modo Privado: Navegar como antes
    console.log('Modo privado detectado, navegando a la escena...');
    this.navigateToScene(this.selectedZone);
  }
}
}
// FIN DEL CODIGO: zone.component.ts