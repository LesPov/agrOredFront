import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Subscription, combineLatest, firstValueFrom, take } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { GetIndicatorResponse, IndicatorService } from '../../../campiamigo/services/indicator.service';
import * as THREE from 'three';
import { authService } from '../../../auth/services/auths';
import { CampiAmigoZonesService } from '../../../campiamigo/services/campiAmigoZones.service';
import { SceneService, ZoneConfig } from '../../services/scene-manager.service';


interface IndicatorData {
  color: string;
  position: THREE.Vector3;
  firstName?: string;
  lastName?: string;
}
@Component({
  selector: 'app-world-viewer',
  imports: [CommonModule],
  templateUrl: './world-viewer.component.html',
  styleUrl: './world-viewer.component.css'
})
export class WorldViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  environment = environment;
  @ViewChild('rendererContainer', { static: true }) rendererContainer!: ElementRef;
  @ViewChild('loadingVideo', { static: false }) loadingVideo!: ElementRef<HTMLVideoElement>;

  // --- Control UI ---
  isExpanded = false;
  modalVisible = false;
  colorModalVisible = false;
  showOverlay = true;
  modelsLoaded = false; // Estado carga modelos zona (terreno+título)
  zoneActive = true;
  editMode = false;
  isAdmin = false;

  // --- Datos ---
  modalIndicatorData?: GetIndicatorResponse['indicator']; // Datos completos para el modal
  activeTab: 'perfil' | 'productos' = 'perfil';
  zoneVideoSource = `${this.environment.endpoint}assets/videos/default.mp4`;
  campiamigoIds: number[] = []; // IDs de userProfile a mostrar
  indicatorData: IndicatorData[] = []; // Datos para lista lateral (usando tu interfaz original)
  mediaModes: { [productId: number]: string } = {}; // Mapeo de ID de producto a modo de vista ('image', 'video', '3d')

  // --- Interacción Indicador ---
  selectedIndicatorIndex: number | null = null;
  private lastClickTime = 0;
  private lastClickedIndex: number | null = null;

  // --- NUEVO: Estado Animación Indicador Único ---
  private isSingleIndicatorMode = false;
  private singleIndicatorAnimationTriggered = false;
  // --- FIN NUEVO ---

  private subs = new Subscription();
  private resizeListenerAdded = false;

  statusBadges: Record<string, { label: string; bg: string; fg: string }> = {
    aprobado: { label: 'Aprobado', bg: '#dcfce7', fg: '#166534' },
    pendiente: { label: 'Pendiente', bg: '#fef3c7', fg: '#92400e' },
    rechazado: { label: 'Rechazado', bg: '#fee2e2', fg: '#991b1b' },
  };

  constructor(
    private sceneService: SceneService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private toastr: ToastrService,
    private authService: authService,
    private indicatorService: IndicatorService,
    private campiService: CampiAmigoZonesService,
    private ngZone: NgZone // Inyectar NgZone
  ) { }

  // ==================================
  // Ciclo de Vida
  // ==================================
  ngOnInit(): void {
    console.log("SceneComponent OnInit");
    this.isAdmin = this.authService.isAdmin();
    this.initZoneAndProcessParams(); // Iniciar proceso
  }

  ngAfterViewInit(): void {
    console.log("SceneComponent AfterViewInit");
    this.cdr.detectChanges();
    if (!this.resizeListenerAdded && typeof window !== 'undefined') {
      window.addEventListener('resize', this.onResize);
      this.resizeListenerAdded = true;
      console.log("Resize listener added.");
    }
  }

  // --- MODIFICADO: ngOnDestroy() ---
  ngOnDestroy(): void {
    console.log("SceneComponent OnDestroy");
    this.subs.unsubscribe();
    if (this.resizeListenerAdded && typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onResize);
      this.resizeListenerAdded = false;
      console.log("Resize listener removed.");
    }

    // *** ¡GUARDAR ESTADO ANTES DE LLAMAR A DISPOSE! ***
    console.log("SceneComponent: Attempting to save camera state before disposing service...");
    this.sceneService.saveCameraState();
    // *** FIN GUARDADO ***

    // Ahora sí, limpiar los recursos de Three.js asociados a esta instancia del componente
    this.sceneService.dispose();
    console.log("SceneService disposed via SceneComponent.");
  }

  // ==================================
  // Inicialización y Carga
  // ==================================
  private initZoneAndProcessParams(): void {
    this.subs.add(
      combineLatest([this.route.paramMap, this.route.queryParamMap])
        .subscribe(([params, qparams]) => {
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
        next: (zoneData) => { // Asumimos que 'zoneData' es de tipo ZoneData directamente
          // CORREGIDO: Chequea directamente la respuesta 'zoneData'
          if (!zoneData) {
            this.handleZoneInactive(`Zona con ID ${zoneId} no encontrada.`);
            return;
          }
          console.log("Zone data received:", zoneData);

          const endpoint = environment.endpoint.endsWith('/') ? environment.endpoint : environment.endpoint + '/';
          // CORREGIDO: Usa directamente las propiedades de 'zoneData'
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

          this.fetchAndInitScene(); // Proceder a inicializar indicadores y escena
        },
        error: (err) => {
          console.error(`Error fetching zone data for ID ${zoneId}:`, err);
          this.handleZoneInactive("Error al cargar datos de la zona.");
        }
      })
    );
  }

  private async fetchAndInitScene(): Promise<void> {
    if (this.campiamigoIds.length === 0) {
      console.warn("No campiamigoIds provided. Initializing scene without indicators.");
      this.indicatorData = []; // Usar tu array original
      this.sceneService.init(this.rendererContainer.nativeElement, 0, true, []);
      this.setupSceneSubscriptions();
      this.zoneActive = true;
      this.cdr.detectChanges();
      return;
    }

    console.log("Fetching initial indicator data...");
    try {
      // Usa tu método original para obtener los datos (asume que devuelve IndicatorData[])
      this.indicatorData = await this.fetchIndicatorData();
      console.log("Initial indicator data fetched:", this.indicatorData);

      this.sceneService.init(
        this.rendererContainer.nativeElement,
        this.indicatorData.length,
        true,
        this.indicatorData.map(d => d.color) // Pasa los colores iniciales
      );
      console.log("SceneService initialized.");

      this.mediaModes = {}; // Resetear mediaModes
      this.setupSceneSubscriptions(); // Configurar listeners de eventos 3D
      this.zoneActive = true;
      this.cdr.detectChanges();

    } catch (error) {
      console.error("Error during fetchAndInitScene:", error);
      this.toastr.error("Error al inicializar indicadores.", "Error");
      this.indicatorData = [];
      this.zoneActive = false;
      this.cdr.detectChanges();
    }
  }

  /** Configura listeners para eventos de SceneService */
  private setupSceneSubscriptions(): void {
    // Models Loaded (Terreno + Título)
    this.subs.add(
      this.sceneService.modelsLoaded$.subscribe((loaded) => {
        if (this.modelsLoaded !== loaded) {
          this.modelsLoaded = loaded;
          console.log("SceneService Zone Models Loaded:", loaded);
          if (loaded) {
            this.applyIndicatorPositionsFromData(); // Aplicar posiciones de BD
            this.tryStartSingleIndicatorAnimation(); // Intentar animación si es modo único
          }
          this.cdr.detectChanges();
        }
      })
    );

    // Drag End
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

    // Indicator Click
    this.subs.add(
      this.sceneService.indicatorClick$.subscribe(index => {
        this.ngZone.run(() => this.handleIndicatorInteraction(index));
      })
    );
  }

  /** Obtiene datos iniciales (usa tu método original) */
  private async fetchIndicatorData(): Promise<IndicatorData[]> {
    // Manteniendo tu lógica original aquí
    const ids: number[] = this.campiamigoIds; // Ya los tenemos
    if (ids.length === 0) return [];

    console.log(`Fetching initial data for ${ids.length} indicators...`);
    const calls = ids.map(id =>
      firstValueFrom(this.indicatorService.getIndicatorData(id).pipe(take(1))) // take(1) es buena práctica con firstValueFrom
        .then(resp => {
          if (!resp?.indicator) {
            console.warn(`No indicator data found for userProfileId ${id}`);
            // Devolver un valor por defecto consistente con la interfaz IndicatorData
            return { color: '#FF0000', position: new THREE.Vector3(0, 50, 0), firstName: 'Error', lastName: `ID ${id}` };
          }
          // Mapear a la interfaz IndicatorData
          return {
            color: resp.indicator.color || '#FFFFFF', // Color por defecto
            position: new THREE.Vector3(resp.indicator.x ?? 0, resp.indicator.y ?? 50, resp.indicator.z ?? 0), // Posición con defaults
            firstName: resp.indicator.userProfile?.firstName,
            lastName: resp.indicator.userProfile?.lastName
          };
        })
        .catch(error => {
          console.error(`Failed fetch for ID ${id}:`, error);
          return { color: '#FF0000', position: new THREE.Vector3(0, 50, 0), firstName: 'Error', lastName: `ID ${id}` };
        })
    );
    return Promise.all(calls);
  }

  /** Aplica posiciones guardadas a los modelos 3D */
  private applyIndicatorPositionsFromData(): void {
    // Usa tu array original 'indicatorData'
    if (this.indicatorData.length !== this.sceneService.indicators.length) {
      console.error("Mismatch between indicator data and scene indicators."); return;
    }
    console.log("Applying initial positions from fetched data...");
    this.indicatorData.forEach((data, i) => {
      const indicatorModel = this.sceneService.indicators[i];
      // Accede a data.position que SÍ existe en la interfaz IndicatorData
      if (indicatorModel && data.position) {
        indicatorModel.setPosition(data.position.x, data.position.y, data.position.z);
      }
    });
    // Ajustar al terreno DESPUÉS de aplicar posiciones iniciales
    this.sceneService.adjustIndicatorsToTerrain();
  }

  /** Guarda la nueva posición en la BD */
  private updateIndicatorPosition(userProfileId: number, index: number, position: THREE.Vector3): void {
    console.log(`Updating position for userProfileId ${userProfileId} to`, position);
    this.indicatorService.updateIndicatorPosition(userProfileId, {
      x: position.x, y: position.y, z: position.z
    }).subscribe({
      next: () => {
        this.toastr.success('Posición guardada');
        // Actualiza la posición en tu array local 'indicatorData'
        if (this.indicatorData[index]) this.indicatorData[index].position = position.clone();
      },
      error: (err) => this.toastr.error('Error al guardar posición')
    });
  }

  /** Maneja zona no encontrada o errores */
  private handleZoneInactive(reason: string = 'Zona no activa'): void {
    this.zoneActive = false; this.showOverlay = false;
    this.toastr.warning(reason, 'Zona no disponible', { timeOut: 4000 });
    setTimeout(() => this.router.navigate(['/user/estaciones/zone']), 3000); // Ruta fallback
    this.cdr.detectChanges();
  }

  /** Resetea el estado antes de cargar nuevos datos */
  private resetComponentStateBeforeLoad(): void {
    console.log("Resetting component state...");
    this.modalVisible = false; this.colorModalVisible = false; this.modalIndicatorData = undefined;
    this.showOverlay = true; this.modelsLoaded = false; this.isExpanded = false; this.zoneActive = false;
    this.isSingleIndicatorMode = false; this.singleIndicatorAnimationTriggered = false;
    this.campiamigoIds = []; this.indicatorData = []; this.mediaModes = {}; // Usar tu array original
    this.selectedIndicatorIndex = null; this.lastClickTime = 0; this.lastClickedIndex = null;
    // No se tocan flags de SceneService aquí
  }

  // ==================================
  // Interacciones UI y 3D
  // ==================================
  private handleIndicatorInteraction(index: number): void {
    if (index < 0 || index >= this.campiamigoIds.length) return;
    const now = Date.now();
    if (this.editMode) { // Doble clic en modo edición
      if (this.lastClickedIndex === index && (now - this.lastClickTime) < 350) {
        this.selectedIndicatorIndex = index; this.openColorModal();
        this.lastClickTime = 0; this.lastClickedIndex = null;
      } else { this.lastClickTime = now; this.lastClickedIndex = index; }
    } else { // Clic normal
      const userProfileId = this.campiamigoIds[index];
      this.fetchAndShowIndicatorModal(userProfileId);
    }
  }

  private fetchAndShowIndicatorModal(userProfileId: number): void {
    console.log(`Fetching full data for indicator ${userProfileId} to show modal.`);
    this.subs.add(
      this.indicatorService.getIndicatorData(userProfileId).subscribe({
        next: (resp) => {
          if (resp?.indicator) {
            this.modalIndicatorData = resp.indicator;
            this.activeTab = 'perfil';
            this.initializeMediaModesForModal(); // Inicializar modos para productos
            this.openModal();
            this.cdr.detectChanges();
          } else { this.toastr.error('Datos incompletos recibidos.'); }
        },
        error: (err) => { console.error(err); this.toastr.error('No se pudo obtener la info del usuario.'); }
      })
    );
  }

  private initializeMediaModesForModal(): void {
    this.mediaModes = {}; // Resetear
    this.modalIndicatorData?.userProfile?.auth?.products?.forEach(prod => {
      // Usar productId como clave
      if (prod) this.mediaModes[prod.id] = 'image';
    });
  }

  /** Oculta el video y potentially inicia animación */
  onViewModel(): void {
    console.log("User dismissed loading video.");
    if (this.loadingVideo?.nativeElement) this.loadingVideo.nativeElement.pause();
    this.showOverlay = false;
    this.cdr.detectChanges();
    this.tryStartSingleIndicatorAnimation(); // Intentar iniciar animación AHORA
  }

  onVideoEnded(): void {
    if (this.loadingVideo?.nativeElement) {
      this.loadingVideo.nativeElement.currentTime = 0;
      this.loadingVideo.nativeElement.play().catch(err => console.warn("Video autoplay ended/prevented:", err));
    }
  }

  /** Activa/desactiva modo edición */
  onFutureButtonClick(): void {
    if (!this.isAdmin) return;
    this.editMode = !this.editMode;
    this.sceneService.setEditMode(this.editMode); // Notificar al servicio
    // La lógica de enable/disable Drag está dentro de setEditMode en SceneService
  }

  // ==================================
  // Lógica Animación Indicador Único
  // ==================================
  private tryStartSingleIndicatorAnimation(): void {
    // Verificar todas las condiciones necesarias
    if (!this.isSingleIndicatorMode || this.singleIndicatorAnimationTriggered || this.showOverlay || !this.modelsLoaded) {
      // Log detallado si no se cumplen
      // console.log(`Animation check failed: singleMode=${this.isSingleIndicatorMode}, triggered=${this.singleIndicatorAnimationTriggered}, overlayHidden=${!this.showOverlay}, modelsLoaded=${this.modelsLoaded}`);
      return;
    }

    this.singleIndicatorAnimationTriggered = true; // Marcar como ejecutada
    console.log("Conditions MET! Starting camera animation to single indicator...");

    // Animar cámara al índice 0
    this.sceneService.animateCameraToIndicator(0, () => {
      // --- Callback POST-animación ---
      this.ngZone.run(() => { // Asegurar ejecución en zona Angular
        console.log("Camera animation finished. Opening modal...");
        if (this.campiamigoIds.length > 0) {
          this.fetchAndShowIndicatorModal(this.campiamigoIds[0]); // Abrir modal para el único ID
        } else {
          console.error("Cannot open modal: campiamigoIds array is empty!");
        }
      });
    });
  }

  // ==================================
  // Control UI (Modales, Menú, etc.)
  // ==================================
  toggleMenu(): void { this.isExpanded = !this.isExpanded; }
  openModal(): void { this.modalVisible = true; this.cdr.detectChanges(); }
  closeModal(): void { this.modalVisible = false; this.modalIndicatorData = undefined; this.cdr.detectChanges(); }
  openColorModal(): void { this.colorModalVisible = true; this.cdr.detectChanges(); }
  closeColorModal(): void { this.colorModalVisible = false; this.selectedIndicatorIndex = null; this.cdr.detectChanges(); }

  /** Navega la cámara al indicador desde el menú (SIN animación suave) */
  // --- MÉTODO RESTAURADO ---
  // El método goToIndicator que llama a animateCameraToIndicator sigue igual.
  goToIndicator(index: number): void {
    console.log(`Requesting SMOOTH focus on indicator ${index} from menu.`);
    this.sceneService.animateCameraToIndicator(index, () => {
      console.log(`Smooth camera animation to indicator ${index} completed.`);
    });
    this.isExpanded = false;
  }
  // --- FIN MÉTODO RESTAURADO ---

  /** Cambia vista de producto en modal */
  switchMediaView(productId: number, view: 'image' | 'video' | '3d', productGlb?: string): void {
    // Usando productId como clave
    console.log(`Switching media view for product ${productId} to ${view}`);
    this.mediaModes[productId] = view;

    if (view === '3d' && productGlb) {
      this.ngZone.runOutsideAngular(() => {
        setTimeout(() => {
          // Selector usando data attribute
          const canvasElement = document.querySelector(`.modern-product-canvas[data-product-id="${productId}"]`);
          if (canvasElement instanceof HTMLCanvasElement) {
            this.sceneService.loadProductModelForCard(this.getFullProductGlbUrl(productGlb), canvasElement);
          } else { console.warn(`Canvas for product ${productId} not found.`); }
        }, 50);
      });
    } else { // Limpiar instancia 3D si se cambia a imagen/video
      const canvasElement = document.querySelector(`.modern-product-canvas[data-product-id="${productId}"]`);
      if (canvasElement && (canvasElement as any).__cleanupThree) {
        (canvasElement as any).__cleanupThree();
        delete (canvasElement as any).__cleanupThree;
      }
    }
    this.cdr.detectChanges();
  }

  /** Obtiene modo de vista del producto */
  getMediaMode(productId: number): string { return this.mediaModes[productId] || 'image'; }

  /** Guarda color seleccionado (Admin) */
  setIndicatorColor(color: string): void {
    if (this.selectedIndicatorIndex === null || !this.isAdmin) return;
    const idx = this.selectedIndicatorIndex;
    if (idx < 0 || idx >= this.campiamigoIds.length || !this.sceneService.indicators[idx]) {
      this.closeColorModal(); return;
    }
    const userProfileId = this.campiamigoIds[idx];
    const indicator = this.sceneService.indicators[idx];
    indicator.setColor(color); // Actualizar visualmente

    this.subs.add( // Guardar en BD
      this.indicatorService.updateIndicatorColor(userProfileId, {
        color, updatedBy: Number(localStorage.getItem('userId'))
      }).subscribe({
        next: () => {
          this.toastr.success('Color guardado');
          // Actualizar en tu array local 'indicatorData'
          if (this.indicatorData[idx]) this.indicatorData[idx].color = color;
        },
        error: (err) => this.toastr.error('Error al guardar el color')
      })
    );
    this.closeColorModal();
  }

  // ==================================
  // Helpers y Getters para Plantilla
  // ==================================
  get sunRotating(): boolean { return this.sceneService.isSunRotating(); }
  toggleSunAnimation(): void { this.sceneService.toggleSunAnimation(); }
  getStatusBadge(status?: string): { label: string; bg: string; fg: string } | undefined { return status ? this.statusBadges[status] : undefined; }
  getContrastColor(hexColor: string): string {
    // (Implementación de contraste como la tenías)
    const c = hexColor.charAt(0) === '#' ? hexColor.substring(1) : hexColor;
    if (c.length !== 6) return '#FFFFFF';
    try {
      const r = parseInt(c.substr(0, 2), 16); const g = parseInt(c.substr(2, 2), 16); const b = parseInt(c.substr(4, 2), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.6 ? '#000000' : '#FFFFFF';
    } catch (e) { return '#FFFFFF'; }
  }
  getFullProfileImageUrl(image?: string): string { return image ? `${this.environment.endpoint}uploads/client/profile/${image}` : 'assets/img/default-user.png'; }
  getFullProductImageUrl(image?: string): string { return image ? `${this.environment.endpoint}uploads/productos/imagenes/${image}` : ''; }
  getFullProductVideoUrl(video?: string): string { return video ? `${this.environment.endpoint}uploads/productos/videos/${video}` : ''; }
  getFullProductGlbUrl(glbFile?: string): string { return glbFile ? `${this.environment.endpoint}uploads/productos/modelos/${glbFile}` : ''; }
  trackByTagId(index: number, tag: { id: number }): number { return tag.id; }
  trackByProductId(index: number, product: { id: number }): number { return product.id; }
  trackByIndex(index: number): number { return index; }

  private onResize = (): void => { this.ngZone.runOutsideAngular(() => { this.sceneService.onWindowResize(); }); };

} // Fin de la clase SceneComponent