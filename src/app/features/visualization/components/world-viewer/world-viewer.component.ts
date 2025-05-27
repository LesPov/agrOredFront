// #region -- COMIENZO DE world-viewer.component.ts (COMPLETO Y MODIFICADO) --
import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Subscription, combineLatest, firstValueFrom, take, timer, fromEvent } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { GetIndicatorResponse, IndicatorResponse, IndicatorService } from '../../../campiamigo/services/indicator.service';
import * as THREE from 'three';
import { authService } from '../../../auth/services/auths';
import { CampiAmigoZonesService } from '../../../campiamigo/services/campiAmigoZones.service';
import { SceneService, ZoneConfig } from '../../services/scene-manager.service';
import { FormsModule } from '@angular/forms';
import { UserStatusService } from '../../../admin/services/user-status.service'; // Mantengo tu ruta original

@Component({
  selector: 'app-world-viewer',
  imports: [CommonModule, FormsModule],
  templateUrl: './world-viewer.component.html',
  styleUrl: './world-viewer.component.css'
})
export class WorldViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  environment = environment;
  @ViewChild('rendererContainer', { static: true }) rendererContainer!: ElementRef;
  @ViewChild('loadingVideo', { static: false }) loadingVideo!: ElementRef<HTMLVideoElement>;

  // --- Propiedades para Búsqueda y Filtrado ---
  searchTerm = '';
  activeFilter: 'all' | 'activo' | 'inactivo' = 'all';

  // --- Control UI ---
  isExpanded = false;
  modalVisible = false;
  colorModalVisible = false;
  showOverlay = true;
  modelsLoaded = false;
  zoneActive = true;
  editMode = false;
  isAdmin = false;

  // ELIMINADO: expandedZoneInfoIds ya no es necesario
  // expandedZoneInfoIds: Set<number> = new Set<number>();

  // --- Datos ---
  modalIndicatorData?: GetIndicatorResponse['indicator'];
  activeTab: 'perfil' | 'productos' = 'perfil';
  zoneVideoSource = `${this.environment.endpoint}assets/videos/default.mp4`;
  campiamigoIds: number[] = [];

  indicatorData: IndicatorResponse[] = []; // Lista maestra con todos los datos completos
  filteredCampiamigos: IndicatorResponse[] = []; // Lista para mostrar en la UI, tras filtros y búsqueda

  allCampiamigosCount: number = 0;
  activeCampiamigosCount: number = 0;
  inactiveCampiamigosCount: number = 0;

  mediaModes: { [productId: number]: string } = {};

  // --- Interacción Indicador ---
  selectedIndicatorIndex: number | null = null;
  private lastClickTime = 0;
  private lastClickedIndex: number | null = null;

  // --- Estado Animación Indicador Único ---
  private isSingleIndicatorMode = false;
  private singleIndicatorAnimationTriggered = false;

  private subs = new Subscription();
  private resizeListenerAdded = false;

  private pollingSubscription: Subscription | null = null;
  private windowFocusSubscription: Subscription | null = null;
  private readonly POLLING_INTERVAL_MS = 10000; // Refrescar cada 10 segundos cuando el menú está abierto

  statusBadges: Record<string, { label: string; bg: string; fg: string }> = {
    'Activado': { label: 'Activo', bg: '#dcfce7', fg: '#166534' },
    'Desactivado': { label: 'Inactivo', bg: '#fee2e2', fg: '#991b1b' },
  };

  constructor(
    private sceneService: SceneService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private toastr: ToastrService,
    private authService: authService,
    private indicatorService: IndicatorService,
    private campiService: CampiAmigoZonesService,
    private ngZone: NgZone,
    private router: Router,
    private userStatusService: UserStatusService
  ) { }

  // ==================================
  // Ciclo de Vida
  // ==================================
  ngOnInit(): void {
    console.log("WorldViewerComponent OnInit");
    this.isAdmin = this.authService.isAdmin();
    this.initZoneAndProcessParams();
  }

  ngAfterViewInit(): void {
    console.log("WorldViewerComponent AfterViewInit");
    this.cdr.detectChanges();
    if (typeof window !== 'undefined' && !this.resizeListenerAdded) {
      window.addEventListener('resize', this.onResize);
      this.resizeListenerAdded = true;
      console.log("Resize listener added.");

      this.windowFocusSubscription = fromEvent(window, 'focus').subscribe(() => {
          console.log('Window gained focus, refreshing indicator data for menu...');
          this.refreshAllIndicatorData();
      });
    }
  }

  ngOnDestroy(): void {
    console.log("WorldViewerComponent OnDestroy");
    this.subs.unsubscribe();
    if (typeof window !== 'undefined' && this.resizeListenerAdded) {
      window.removeEventListener('resize', this.onResize);
      this.resizeListenerAdded = false;
    }
    this.stopPolling();
    if (this.windowFocusSubscription) {
      this.windowFocusSubscription.unsubscribe();
      this.windowFocusSubscription = null;
    }
    console.log("WorldViewerComponent: Attempting to save camera state before disposing service...");
    this.sceneService.saveCameraState();
    this.sceneService.dispose();
    console.log("SceneService disposed via WorldViewerComponent.");
  }

  // ==================================
  // Inicialización y Carga
  // ==================================
  private initZoneAndProcessParams(): void {
    this.subs.add(
      combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(([params, qparams = new Map()]) => {
        console.log("Route params changed:", params, qparams);
        this.resetComponentStateBeforeLoad();

        const rawZoneId = params.get('zoneId');
        const zoneId = rawZoneId ? Number(rawZoneId) : null;

        if (!zoneId) {
          this.handleZoneInactive("ID de zona inválido."); return;
        }

        try {
          this.campiamigoIds = JSON.parse(qparams.get('campiamigoIds') || '[]');
          if (!Array.isArray(this.campiamigoIds) || this.campiamigoIds.some(id => typeof id !== 'number')) throw new Error("Invalid IDs");
        } catch (error) { this.campiamigoIds = []; }

        console.log(`Processing Zone ID: ${zoneId} with CampiAmigo IDs:`, this.campiamigoIds);
        this.isSingleIndicatorMode = this.campiamigoIds.length === 1;
        console.log("Single Indicator Mode:", this.isSingleIndicatorMode);

        this.loadZoneData(zoneId);
      })
    );
  }

  private loadZoneData(zoneId: number): void {
    this.subs.add(
      this.campiService.getZoneById(zoneId).subscribe({
        next: (zoneData) => {
          if (!zoneData) {
            this.handleZoneInactive(`Zona con ID ${zoneId} no encontrada.`);
            return;
          }
          console.log("Zone data received:", zoneData);

          const endpoint = environment.endpoint.endsWith('/') ? environment.endpoint : environment.endpoint + '/';
          const config: ZoneConfig = {
            video: zoneData.video ? `${endpoint}uploads/zones/videos/${zoneData.video}` : `${endpoint}assets/videos/default.mp4`,
            modelPath: zoneData.modelPath ? `${endpoint}uploads/zones/models/${zoneData.modelPath}` : '',
            titleModel: zoneData.titleGlb ? `${endpoint}uploads/zones/models/${zoneData.titleGlb}` : ''
          };
          this.zoneVideoSource = config.video;
          this.sceneService.setZoneConfiguration(config);
          console.log("SceneService configured with:", config);

          this.ngZone.runOutsideAngular(() => {
            setTimeout(() => {
              if (this.loadingVideo?.nativeElement) this.loadingVideo.nativeElement.load();
            }, 0);
          });

          this.fetchAndInitScene();
        },
        error: (err) => {
          console.error(`Error fetching zone data for ID ${zoneId}:`, err);
          this.handleZoneInactive("Error al cargar datos de la zona.");
        }
      })
    );
  }

  private async fetchAndInitScene(): Promise<void> {
    this.sceneService.init(
      this.rendererContainer.nativeElement,
      this.campiamigoIds.length,
      true,
      []
    );
    console.log("SceneService initialized.");

    this.mediaModes = {};
    this.setupSceneSubscriptions();
    this.zoneActive = true;
    this.cdr.detectChanges();

    await this.fetchInitialIndicatorData();
    console.log("Initial indicator data fetched.");
  }

  private setupSceneSubscriptions(): void {
    this.subs.add(
      this.sceneService.modelsLoaded$.subscribe((loaded) => {
        if (this.modelsLoaded !== loaded) {
          this.modelsLoaded = loaded;
          console.log("SceneService Zone Models Loaded:", loaded);
          if (loaded) {
            this.updateIndicator3DVisuals();
            this.tryStartSingleIndicatorAnimation();
          }
          this.cdr.detectChanges();
        }
      })
    );

    this.subs.add(
      this.sceneService.dragEnd$.subscribe(({ index, position }) => {
        this.ngZone.run(() => {
          if (index >= 0 && index < this.campiamigoIds.length) {
            this.updateIndicatorPosition(this.campiamigoIds[index], index, position);
          } else {
            console.error("Invalid index from dragEnd$:", index);
          }
        });
      })
    );

    this.subs.add(
      this.sceneService.indicatorClick$.subscribe(index => {
        this.ngZone.run(() => this.handleIndicatorInteraction(index));
      })
    );
  }

  private async fetchInitialIndicatorData(): Promise<void> {
      console.log(`Fetching initial data for ${this.campiamigoIds.length} indicators...`);
      if (this.campiamigoIds.length === 0) {
        this.indicatorData = [];
        this.applyFiltersAndSearch();
        return;
      }

      try {
        const calls = this.campiamigoIds.map(id =>
          firstValueFrom(this.indicatorService.getIndicatorData(id).pipe(take(1)))
            .then(resp => {
              if (!resp?.indicator) {
                console.warn(`No initial indicator data found for userProfileId ${id}. Returning default.`);
                return {
                  id: 0, zoneId: 0, userId: id, color: '#FF0000', x: 0, y: 50, z: 0,
                  userProfile: { id: id, userId: 0, firstName: 'Error', lastName: `ID ${id}`, auth: {} }
                } as IndicatorResponse;
              }
              return resp.indicator;
            })
            .catch(error => {
              console.error(`Failed initial fetch for ID ${id}:`, error);
              return {
                id: 0, zoneId: 0, userId: id, color: '#FF0000', x: 0, y: 50, z: 0,
                userProfile: { id: id, userId: 0, firstName: 'Error', lastName: `ID ${id}`, auth: {} }
              } as IndicatorResponse;
            })
        );
        this.indicatorData = await Promise.all(calls);
        this.applyFiltersAndSearch();
      } catch (error) {
        console.error("Error during fetchInitialIndicatorData:", error);
        this.toastr.error("Error al inicializar indicadores.", "Error");
        this.indicatorData = [];
        this.applyFiltersAndSearch();
      }
  }

  private async refreshAllIndicatorData(): Promise<void> {
    console.log("Refreshing indicator data for menu (list & counts)...");
    if (this.campiamigoIds.length === 0) {
      console.warn("No campiamigoIds available to refresh. Skipping data refresh.");
      this.indicatorData = [];
      this.filteredCampiamigos = [];
      this.updateFilterCounts();
      this.cdr.detectChanges();
      return;
    }

    try {
      const calls = this.campiamigoIds.map(id =>
        firstValueFrom(this.indicatorService.getIndicatorData(id).pipe(take(1)))
          .then(resp => {
            if (!resp?.indicator) {
              console.warn(`No indicator data found for userProfileId ${id} during refresh. Retaining old data or using default.`);
              return this.indicatorData.find(ind => ind.userProfile?.id === id) || {
                id: 0, zoneId: 0, userId: id, color: '#FF0000', x: 0, y: 50, z: 0,
                userProfile: { id: id, userId: 0, firstName: 'Error', lastName: `ID ${id}`, auth: {} }
              } as IndicatorResponse;
            }
            return resp.indicator;
          })
          .catch(error => {
            console.error(`Failed refresh for ID ${id}:`, error);
            return this.indicatorData.find(ind => ind.userProfile?.id === id) || {
              id: 0, zoneId: 0, userId: id, color: '#FF0000', x: 0, y: 50, z: 0,
              userProfile: { id: id, userId: 0, firstName: 'Error', lastName: `ID ${id}`, auth: {} }
            } as IndicatorResponse;
          })
      );
      this.indicatorData = await Promise.all(calls);
      this.applyFiltersAndSearch();
      console.log("Indicator data refreshed for menu successfully and filters applied.");
    } catch (error) {
      console.error("Error refreshing indicator data for menu:", error);
      this.toastr.error("Error al refrescar datos de indicadores.", "Error");
    }
  }

  private updateIndicator3DVisuals(): void {
    if (!this.modelsLoaded || this.indicatorData.length === 0 || this.sceneService.indicators.length === 0) {
      console.warn("Cannot update 3D indicator visuals: models not loaded or no data/indicators.");
      return;
    }
    console.log("Applying 3D indicator positions and colors based on initial indicatorData.");
    this.indicatorData.forEach((data, i) => {
      const indicatorModel = this.sceneService.indicators[i];
      if (indicatorModel) {
        if (data.x !== undefined && data.y !== undefined && data.z !== undefined) {
          indicatorModel.setPosition(data.x, data.y, data.z);
        }
        if (data.color) {
          indicatorModel.setColor(data.color);
        }
      }
    });
    this.sceneService.adjustIndicatorsToTerrain();
  }

  private updateIndicatorPosition(userProfileId: number, index: number, position: THREE.Vector3): void {
    console.log(`Updating position for userProfileId ${userProfileId} to`, position);
    this.indicatorService.updateIndicatorPosition(userProfileId, {
      x: position.x, y: position.y, z: position.z
    }).subscribe({
      next: () => {
        this.toastr.success('Posición guardada');
        if (this.indicatorData[index]) {
          this.indicatorData[index].x = position.x;
          this.indicatorData[index].y = position.y;
          this.indicatorData[index].z = position.z;
        }
      },
      error: (err) => this.toastr.error('Error al guardar posición')
    });
  }

  private handleZoneInactive(reason: string = 'Zona no activa'): void {
    this.zoneActive = false; this.showOverlay = false;
    this.toastr.warning(reason, 'Zona no disponible', { timeOut: 4000 });
    setTimeout(() => this.router.navigate(['/user/estaciones/zone']), 3000);
    this.cdr.detectChanges();
  }

  private resetComponentStateBeforeLoad(): void {
    console.log("Resetting component state...");
    this.modalVisible = false; this.colorModalVisible = false; this.modalIndicatorData = undefined;
    this.showOverlay = true; this.modelsLoaded = false; this.isExpanded = false; this.zoneActive = false;
    this.isSingleIndicatorMode = false; this.singleIndicatorAnimationTriggered = false;
    this.campiamigoIds = [];
    this.indicatorData = [];
    this.filteredCampiamigos = [];
    this.allCampiamigosCount = 0;
    this.activeCampiamigosCount = 0;
    this.inactiveCampiamigosCount = 0;
    this.mediaModes = {};
    this.selectedIndicatorIndex = null; this.lastClickTime = 0; this.lastClickedIndex = null;
    this.searchTerm = '';
    this.activeFilter = 'all';
    this.stopPolling();
    // ELIMINADO: Ya no se usa expandedZoneInfoIds
    // this.expandedZoneInfoIds.clear();
  }

  // ==================================
  // Interacciones UI y 3D
  // ==================================
  private handleIndicatorInteraction(index: number): void {
    if (index < 0 || index >= this.indicatorData.length) {
        console.warn(`Click en indicador con índice inválido: ${index}`);
        return;
    }
    const userProfileId = this.indicatorData[index].userProfile?.id;
    if (!userProfileId) {
        console.error(`userProfileId no encontrado para el indicador en el índice ${index}.`);
        return;
    }

    const now = Date.now();
    if (this.editMode) {
      if (this.lastClickedIndex === index && (now - this.lastClickTime) < 350) {
        this.selectedIndicatorIndex = index; this.openColorModal();
        this.lastClickTime = 0; this.lastClickedIndex = null;
      } else { this.lastClickTime = now; this.lastClickedIndex = index; }
    } else {
      this.fetchAndShowIndicatorModal(userProfileId);
    }
  }

  public fetchAndShowIndicatorModal(userProfileId: number): void {
    console.log(`Fetching full data for indicator ${userProfileId} to show modal.`);
    this.subs.add(
      this.indicatorService.getIndicatorData(userProfileId).subscribe({
        next: (resp) => {
          if (resp?.indicator) {
            this.modalIndicatorData = resp.indicator;
            this.activeTab = 'perfil';
            this.initializeMediaModesForModal();
            this.openModal();
            this.cdr.detectChanges();
          } else { this.toastr.error('Datos incompletos recibidos.'); }
        },
        error: (err) => { console.error(err); this.toastr.error('No se pudo obtener la info del usuario.'); }
      })
    );
  }

  private initializeMediaModesForModal(): void {
    this.mediaModes = {};
    this.modalIndicatorData?.userProfile?.auth?.products?.forEach(prod => {
      if (prod) this.mediaModes[prod.id] = 'image';
    });
  }

  onViewModel(): void {
    console.log("User dismissed loading video.");
    if (this.loadingVideo?.nativeElement) this.loadingVideo.nativeElement.pause();
    this.showOverlay = false;
    this.cdr.detectChanges();
    this.tryStartSingleIndicatorAnimation();
  }

  onVideoEnded(): void {
    if (this.loadingVideo?.nativeElement) {
      this.loadingVideo.nativeElement.currentTime = 0;
      this.loadingVideo.nativeElement.play().catch(err => console.warn("Video autoplay ended/prevented:", err));
    }
  }

  onFutureButtonClick(): void {
    if (!this.isAdmin) return;
    this.editMode = !this.editMode;
    this.sceneService.setEditMode(this.editMode);
  }

  // ==================================
  // Lógica Animación Indicador Único
  // ==================================
  private tryStartSingleIndicatorAnimation(): void {
    if (!this.isSingleIndicatorMode || this.singleIndicatorAnimationTriggered || this.showOverlay || !this.modelsLoaded) {
      return;
    }

    this.singleIndicatorAnimationTriggered = true;
    console.log("Conditions MET! Starting camera animation to single indicator...");

    this.sceneService.animateCameraToIndicator(0, () => {
      this.ngZone.run(() => {
        console.log("Camera animation finished. Opening modal...");
        if (this.campiamigoIds.length > 0) {
          const firstIndicator = this.indicatorData[0];
          if (firstIndicator && firstIndicator.userProfile?.id) {
              this.fetchAndShowIndicatorModal(firstIndicator.userProfile.id);
          } else {
              console.error("Cannot open modal: First indicator or its userProfileId is missing!");
          }
        } else {
          console.error("Cannot open modal: campiamigoIds array is empty!");
        }
      });
    });
  }

  // ==================================
  // Control UI (Modales, Menú, etc.)
  // ==================================
  toggleMenu(): void {
    this.isExpanded = !this.isExpanded;
    if (this.isExpanded) {
        this.refreshAllIndicatorData();
        this.startPolling();
    } else {
        this.stopPolling();
    }
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollingSubscription = timer(0, this.POLLING_INTERVAL_MS).subscribe(() => {
      this.ngZone.run(() => {
          console.log(`Polling for indicator data refresh (every ${this.POLLING_INTERVAL_MS / 1000}s)...`);
          this.refreshAllIndicatorData();
      });
    });
  }

  private stopPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
      console.log("Stopped polling for indicator data.");
    }
  }

  openModal(): void { this.modalVisible = true; this.cdr.detectChanges(); }
  closeModal(): void { this.modalVisible = false; this.modalIndicatorData = undefined; this.cdr.detectChanges(); }
  openColorModal(): void { this.colorModalVisible = true; this.cdr.detectChanges(); }
  closeColorModal(): void { this.colorModalVisible = false; this.selectedIndicatorIndex = null; this.cdr.detectChanges(); }

  goToIndicator(displayIndex: number): void {
    const selectedCampiamigo = this.filteredCampiamigos[displayIndex];
    if (!selectedCampiamigo || !selectedCampiamigo.userProfile?.id) {
      console.warn('Selected campiamigo not found in filtered list or missing userProfile ID.');
      return;
    }

    const originalIndex = this.indicatorData.findIndex(
      ind => ind.userProfile?.id === selectedCampiamigo.userProfile!.id
    );

    if (originalIndex === -1) {
      console.error(`Original indicator not found for userProfileId: ${selectedCampiamigo.userProfile!.id}. Cannot animate camera.`);
      return;
    }

    console.log(`Requesting SMOOTH focus on indicator at original index ${originalIndex} from menu.`);
    this.sceneService.animateCameraToIndicator(originalIndex, () => {
      console.log(`Smooth camera animation to indicator ${originalIndex} completed.`);
      this.ngZone.run(() => {
        this.fetchAndShowIndicatorModal(selectedCampiamigo.userProfile!.id);
      });
    });
    this.isExpanded = false;
  }

  // ELIMINADO: Métodos para controlar la expansión de la información de la zona
  // toggleZoneInfo(indicatorId: number): void { ... }
  // isZoneInfoExpanded(indicatorId: number): boolean { ... }

  switchMediaView(productId: number, view: 'image' | 'video' | '3d', productGlb?: string): void {
    console.log(`Switching media view for product ${productId} to ${view}`);
    this.mediaModes[productId] = view;

    if (view === '3d' && productGlb) {
      this.ngZone.runOutsideAngular(() => {
        setTimeout(() => {
          const canvasElement = document.querySelector(`.modern-product-canvas[data-product-id="${productId}"]`);
          if (canvasElement instanceof HTMLCanvasElement) {
            this.sceneService.loadProductModelForCard(this.getFullProductGlbUrl(productGlb), canvasElement);
          } else { console.warn(`Canvas for product ${productId} not found.`); }
        }, 50);
      });
    } else {
      const canvasElement = document.querySelector(`.modern-product-canvas[data-product-id="${productId}"]`);
      if (canvasElement && (canvasElement as any).__cleanupThree) {
        (canvasElement as any).__cleanupThree();
        delete (canvasElement as any).__cleanupThree;
      }
    }
    this.cdr.detectChanges();
  }

  getMediaMode(productId: number): string { return this.mediaModes[productId] || 'image'; }

  setIndicatorColor(color: string): void {
    if (this.selectedIndicatorIndex === null || !this.isAdmin) return;
    const idx = this.selectedIndicatorIndex;
    if (idx < 0 || idx >= this.campiamigoIds.length || !this.sceneService.indicators[idx]) {
      this.closeColorModal(); return;
    }
    const userProfileId = this.campiamigoIds[idx];
    const indicator = this.sceneService.indicators[idx];
    indicator.setColor(color);

    this.subs.add(
      this.indicatorService.updateIndicatorColor(userProfileId, {
        color, updatedBy: Number(localStorage.getItem('userId'))
      }).subscribe({
        next: () => {
          this.toastr.success('Color guardado');
          if (this.indicatorData[idx]) {
            this.indicatorData[idx].color = color;
          }
          this.applyFiltersAndSearch();
        },
        error: (err) => this.toastr.error('Error al guardar el color')
      })
    );
    this.closeColorModal();
  }

  // ==================================
  // Lógica de Búsqueda y Filtrado
  // ==================================
  onSearchInput(event: Event): void {
    this.searchTerm = (event.target as HTMLInputElement).value;
    this.applyFiltersAndSearch();
  }

  onFilterClick(filter: 'all' | 'activo' | 'inactivo'): void {
    this.activeFilter = filter;
    this.applyFiltersAndSearch();
  }

  applyFiltersAndSearch(): void {
    let tempIndicators = [...this.indicatorData];

    if (this.searchTerm) {
      const lowerSearchTerm = this.searchTerm.toLowerCase();
      tempIndicators = tempIndicators.filter(indicator =>
        (indicator.userProfile?.firstName?.toLowerCase().includes(lowerSearchTerm)) ||
        (indicator.userProfile?.lastName?.toLowerCase().includes(lowerSearchTerm)) ||
        (indicator.userProfile?.biography?.toLowerCase().includes(lowerSearchTerm)) ||
        (indicator.userProfile?.direccion?.toLowerCase().includes(lowerSearchTerm)) ||
        (indicator.zone?.name?.toLowerCase().includes(lowerSearchTerm)) ||
        (indicator.zone?.tipoZona?.toLowerCase().includes(lowerSearchTerm)) ||
        (indicator.zone?.departamentoName?.toLowerCase().includes(lowerSearchTerm)) ||
        (indicator.zone?.climate?.toLowerCase().includes(lowerSearchTerm)) ||
        (indicator.zone?.about?.toLowerCase().includes(lowerSearchTerm)) ||
        (indicator.userProfile?.auth?.products?.some(p => p.name.toLowerCase().includes(lowerSearchTerm))) ||
        (indicator.userProfile?.tags?.some(tag => tag.name.toLowerCase().includes(lowerSearchTerm)))
      );
    }

    if (this.activeFilter === 'activo') {
      tempIndicators = tempIndicators.filter(indicator => indicator.userProfile?.auth?.status === 'Activado');
    } else if (this.activeFilter === 'inactivo') {
      tempIndicators = tempIndicators.filter(indicator => indicator.userProfile?.auth?.status === 'Desactivado');
    } else { // this.activeFilter === 'all'
      tempIndicators = tempIndicators.filter(indicator => indicator.userProfile?.auth?.status === 'Activado');
    }

    this.filteredCampiamigos = tempIndicators;
    this.updateFilterCounts();
    this.cdr.detectChanges();
  }

  updateFilterCounts(): void {
    this.allCampiamigosCount = this.indicatorData.length;
    this.activeCampiamigosCount = this.indicatorData.filter(indicator => indicator.userProfile?.auth?.status === 'Activado').length;
    this.inactiveCampiamigosCount = this.indicatorData.filter(indicator => indicator.userProfile?.auth?.status === 'Desactivado').length;
  }

  // ==================================
  // Helpers y Getters para Plantilla
  // ==================================
  get sunRotating(): boolean { return this.sceneService.isSunRotating(); }
  toggleSunAnimation(): void { this.sceneService.toggleSunAnimation(); }

  getStatusBadge(authStatus?: string): { label: string; bg: string; fg: string } | undefined {
    return authStatus ? this.statusBadges[authStatus] : undefined;
  }

  getContrastColor(hexColor: string): string {
    const c = hexColor.charAt(0) === '#' ? hexColor.substring(1) : hexColor;
    if (c.length !== 6) return '#FFFFFF';
    try {
      const r = parseInt(c.substr(0, 2), 16); const g = parseInt(c.substr(2, 2), 16); const b = parseInt(c.substr(4, 2), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.6 ? '#000000' : '#FFFFFF';
    } catch (e) { return '#FFFFFF'; }
  }

  getFullProfileImageUrl(image?: string): string { return image ? `${this.environment.endpoint}uploads/client/profile/${image}` : 'assets/img/default-user.png'; }
  getFullProductImageUrl(image?: string): string { return image ? `${this.environment.endpoint}uploads/productos/imagenes/${image}` : 'assets/img/default-product.png'; }
  getFullProductVideoUrl(video?: string): string { return video ? `${this.environment.endpoint}uploads/productos/videos/${video}` : ''; }
  getFullProductGlbUrl(glbFile?: string): string { return glbFile ? `${this.environment.endpoint}uploads/productos/modelos/${glbFile}` : ''; }

  trackByTagId(index: number, tag: { id: number }): number { return tag.id; }
  trackByProductId(index: number, product: { id: number }): number { return product.id; }
  trackByIndex(index: number): number { return index; }

  private onResize = (): void => { this.ngZone.runOutsideAngular(() => { this.sceneService.onWindowResize(); }); };

  getShortBiography(biography?: string): string {
    if (!biography) return 'No se ha proporcionado biografía.';
    const maxLength = 80;
    return biography.length > maxLength ? biography.substring(0, maxLength) + '...' : biography;
  }

  getPhoneNumber(profile?: any): string {
    return profile?.auth?.phoneNumber || 'No disponible';
  }

  getIndicatorColorForList(indicator: IndicatorResponse): string {
    return indicator.color || '#999999';
  }

  // Mantenemos esta función porque se usa en el modal. Ya no se usa en la tarjeta Campiamigo.
  getFormattedLocation(indicator: IndicatorResponse): string {
    const parts = [];
    if (indicator.userProfile?.direccion) {
      parts.push(indicator.userProfile.direccion);
    }
    if (indicator.zone?.name) {
      if (!indicator.userProfile?.direccion || !indicator.userProfile.direccion.toLowerCase().includes(indicator.zone.name.toLowerCase())) {
        parts.push(indicator.zone.name);
      }
    }
    if (indicator.zone?.departamentoName && !parts.some(p => p.toLowerCase().includes(indicator.zone!.departamentoName!.toLowerCase()))) {
        parts.push(indicator.zone.departamentoName);
    }
    if (indicator.zone?.tipoZona && !parts.some(p => p.toLowerCase().includes(indicator.zone!.tipoZona!.toLowerCase()))) {
        parts.push(indicator.zone.tipoZona);
    }
    return parts.length > 0 ? parts.join(', ') : 'Ubicación no especificada';
  }
}
// #endregion -- FIN DE world-viewer.component.ts --