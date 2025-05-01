// src/app/shared/inicio/territory/scene/scene.service.ts                   <-- Verifica esta ruta si es necesario
import * as THREE from 'three';
import * as CANNON from 'cannon'; // Si usas física
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BehaviorSubject, Subject } from 'rxjs';

 
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Injectable } from '@angular/core';
import { ModeloIndicador } from '../models/indicator.model';
import {   clampCameraToTerrain } from '../logic/camera-terrain.logic';
import { onClick } from '../logic/click-handler.logic';
import { goToIndicator } from '../logic/indicator-navigation.logic';
import { ModeloPisoService } from '../models/floor.model';
import { ModeloLetras } from '../models/text.model';
import { LightingService } from './lighting.service';
import { OrbitControlsService } from './orbit-controls.service';
import { RendererService } from './renderer.service';
import { CameraService } from './camera.service';

export interface ZoneConfig {
  video: string;
  modelPath: string; // Modelo del terreno/piso
  titleModel: string; // Modelo del título/letras
}

@Injectable({ providedIn: 'root' })
export class SceneService {
  private scene = new THREE.Scene();
  private world = new CANNON.World(); // Mundo físico (si aplica)
  private clock = new THREE.Clock();

  public renderer!: THREE.WebGLRenderer;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;

  private initialized = false;
  private animationFrameId: number | null = null; // ID del ciclo principal de animación

  // --- Estado de Carga ---
  public modelsLoaded$ = new BehaviorSubject<boolean>(false); // Estado general (terreno + título)
  private totalZoneModelsToLoad = 0; // Cuántos modelos de zona (piso, letras) se esperan
  private loadedZoneModels = 0; // Cuántos modelos de zona se han cargado
  private loadedIndicators = 0; // Cuántos indicadores se han cargado
  private totalIndicatorsToLoad = 0; // Cuántos indicadores se esperan

  // --- Indicadores y Eventos ---
  public indicators: ModeloIndicador[] = [];
  public indicatorClick$ = new Subject<number>(); // Evento al hacer clic en un indicador
  public dragEnd$ = new Subject<{ index: number, position: THREE.Vector3 }>(); // Evento al soltar un indicador

  private zoneConfig?: ZoneConfig; // Configuración de la zona actual

  // --- Estado Persistente Cámara ---
  private lastCameraPosition: THREE.Vector3 | null = null;
  private lastControlsTarget: THREE.Vector3 | null = null;

  // --- Estado de Interacción (Arrastre y Edición) ---
  private dragEnabled = false;
  private isDragging = false;
  public selectedIndicator: ModeloIndicador | null = null;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0)); // Plano horizontal para arrastrar
  private dragOffset = new THREE.Vector3(); // Offset entre click y centro del objeto
  private editMode: boolean = false;
  private isOrbitingAfterAnimation: boolean = false;
  private orbitStartTime: number = 0;
 // --- AJUSTA ESTAS CONSTANTES ---

  // --- CONSTANTES (sin cambios aquí, pero revisa los valores) ---
  private readonly ZOOM_DURATION: number = 4000;
  private readonly ORBIT_DURATION: number = 5000;
  // Este factor determinará el tamaño del indicador DURANTE la animación de enfoque
  private readonly FOCUSED_INDICATOR_SCALE_FACTOR = 0.7; // Renombrado para claridad (antes MIN_INDICATOR_SCALE_FACTOR)
  private readonly ORBIT_AUTO_ROTATE_SPEED = -35;
  private readonly DAMPING_FACTOR = 0.02;

  private isAnimatingCamera: boolean = false;
  private cameraAnimationId: number | null = null;
 

  constructor(
    // --- Inyección de Dependencias ---
    private cameraService: CameraService,
    private rendererService: RendererService,
    private modeloPiso: ModeloPisoService, // Renombrado para claridad (antes modelo1)
    private lightingService: LightingService,
    private orbitControlsService: OrbitControlsService,
    private modeloLetras: ModeloLetras,
  ) {
    this.world.gravity.set(0, -9.82, 0); // Configurar gravedad (si usas física)
    console.log("SceneService Constructor: Instancia creada.");
  }

  // --- Habilitar/Deshabilitar Arrastre de Indicadores ---
  public enableDrag(): void {
    if (!this.dragEnabled) {
      this.dragEnabled = true;
      this.setupDragEvents();
      console.log("SceneService: Drag enabled.");
    }
  }

  public disableDrag(): void {
    if (this.dragEnabled) {
      this.dragEnabled = false;
      this.cleanupDragEvents();
      if (this.renderer) this.renderer.domElement.style.cursor = 'default';
      console.log("SceneService: Drag disabled.");
      if (this.isDragging) { // Cancelar arrastre si estaba en curso
          this.isDragging = false;
          this.selectedIndicator = null;
          if(this.controls) this.controls.enabled = !this.editMode; // Restaurar controles
      }
    }
  }
  // --- Guardar/Restaurar Estado Cámara (Sin cambios, ya los teníamos) ---
  public saveCameraState(): void { /* ... tu código existente ... */
    if (this.initialized && this.camera && this.controls) {
        this.lastCameraPosition = this.camera.position.clone();
        this.lastControlsTarget = this.controls.target.clone();
        console.log("[DEBUG] SceneService: Camera state SAVED.", {
          pos: this.lastCameraPosition.toArray(),
          target: this.lastControlsTarget.toArray()
        });
      } else {
        console.log("[DEBUG] SceneService: Could not save camera state (not initialized or camera/controls missing).");
        this.lastCameraPosition = null;
        this.lastControlsTarget = null;
      }
   }
   private restoreCameraState(): void { /* ... tu código existente ... */
    if (this.camera && this.controls && this.lastCameraPosition && this.lastControlsTarget) {
        this.camera.position.copy(this.lastCameraPosition);
        this.controls.target.copy(this.lastControlsTarget);
        this.controls.update();
        console.log("[DEBUG] SceneService: Camera state RESTORED.", {
           pos: this.camera.position.toArray(),
           target: this.controls.target.toArray()
          });
      } else {
        console.log("[DEBUG] SceneService: No saved camera state to restore or camera/controls not ready yet.");
      }
   }
  // --- Configuración/Limpieza de Eventos del DOM para Arrastre ---
  private setupDragEvents(): void {
    if (!this.renderer) return;
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown);
    this.renderer.domElement.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp); // Escuchar en window para soltar fuera
    this.renderer.domElement.addEventListener('mousemove', this.onCursorUpdate);
    this.renderer.domElement.addEventListener('dragstart', (e) => e.preventDefault()); // Evitar arrastre nativo
  }

  private cleanupDragEvents(): void {
    if (!this.renderer) return;
    this.renderer.domElement.removeEventListener('mousedown', this.onMouseDown);
    this.renderer.domElement.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.renderer.domElement.removeEventListener('mousemove', this.onCursorUpdate);
    this.renderer.domElement.removeEventListener('dragstart', (e) => e.preventDefault());
  }

  // --- Actualizar Cursor (Hover sobre Indicadores) ---
  private onCursorUpdate = (event: MouseEvent): void => {
    if (this.isDragging || this.isAnimatingCamera || !this.renderer || !this.camera || !this.initialized) return;
    this.updateMousePosition(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const indicatorModels = this.indicators.map(ind => ind.model!).filter(model => model);
    if (indicatorModels.length === 0) {
        if(this.renderer) this.renderer.domElement.style.cursor = 'default'; // Asegurar cursor por defecto
        return;
    }
    const intersects = this.raycaster.intersectObjects(indicatorModels, true);
    const canInteract = this.editMode || true; // Permitir hover siempre por ahora
    if(this.renderer) this.renderer.domElement.style.cursor = (intersects.length > 0 && canInteract) ? 'pointer' : 'default';
  };

  // --- Cargar Modelo 3D en Tarjeta de Producto ---
  public loadProductModelForCard(glbUrl: string, canvas: HTMLCanvasElement): void {
     // (Mantenemos la implementación detallada de la versión anterior,
     //  ya que parecía correcta y robusta, incluyendo limpieza)
    if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
        console.error('Canvas inválido proporcionado a loadProductModelForCard');
        return;
    }
    if ((canvas as any).__cleanupThree) {
        console.log("Limpiando instancia 3D anterior de la tarjeta...");
        (canvas as any).__cleanupThree();
        delete (canvas as any).__cleanupThree;
    }
    if (!canvas.isConnected) {
         console.warn("El canvas para la tarjeta no está conectado al DOM.");
    }

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    camera.position.set(0, 0.5, 2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = true; controls.enablePan = false;
    controls.target.set(0, 0.2, 0); controls.autoRotate = true;
    controls.autoRotateSpeed = 1.0; controls.enableDamping = true;
    controls.dampingFactor = 0.1;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7); scene.add(dirLight);
    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    dirLight2.position.set(-5, -5, -7); scene.add(dirLight2);

    const loader = new GLTFLoader();
    loader.load(glbUrl, (gltf) => {
        const model = gltf.scene; scene.add(model);
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const desiredSize = 1.5;
        const scale = maxDim > 0 ? desiredSize / maxDim : 1;
        model.scale.setScalar(scale);
        box.setFromObject(model); box.getCenter(center);
        model.position.sub(center);
        controls.target.set(0, 0, 0); controls.update();

        let cardAnimationId: number;
        const animateCard = () => {
          cardAnimationId = requestAnimationFrame(animateCard);
          if (canvas.isConnected) { controls.update(); renderer.render(scene, camera); }
          else { console.log("Canvas tarjeta desconectado."); cancelAnimationFrame(cardAnimationId); cleanup(); }
        };
        animateCard();

        const cleanup = () => { /* ... (código de limpieza como antes) ... */ };
        (canvas as any).__cleanupThree = cleanup;
      }, undefined, (error) => { console.error(`Error cargando ${glbUrl}:`, error); /* ... (dibujar error) ... */ });
  }

  // --- Lógica de Arrastre de Indicadores (MouseDown, MouseMove, MouseUp) ---
  private onMouseDown = (event: MouseEvent): void => {
    if (!this.editMode || !this.dragEnabled || event.button !== 0 || !this.renderer || !this.camera) return;
    this.updateMousePosition(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const indicatorModels = this.indicators.map(ind => ind.model!).filter(model => model);
    if (indicatorModels.length === 0) return;
    const intersects = this.raycaster.intersectObjects(indicatorModels, true);

    if (intersects.length > 0) {
      let targetIndicator: ModeloIndicador | null = null;
      let intersectedObject: THREE.Object3D | null = intersects[0].object;
      while (intersectedObject && !targetIndicator) {
          targetIndicator = this.indicators.find(ind => ind.model === intersectedObject) || null;
          intersectedObject = intersectedObject.parent;
      }

      if (targetIndicator) {
        this.isDragging = true; this.selectedIndicator = targetIndicator;
        const indicatorPos = targetIndicator.getPosition();
        this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), indicatorPos);
        const intersectionPoint = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.dragPlane, intersectionPoint)) {
            this.calculateDragOffset(intersectionPoint);
        } else { this.calculateDragOffset(indicatorPos); } // Fallback
        if(this.renderer) this.renderer.domElement.style.cursor = 'grabbing';
        if(this.controls) this.controls.enabled = false;
      }
    }
  };

  private onMouseMove = (event: MouseEvent): void => {
    if (!this.isDragging || !this.selectedIndicator || !this.renderer || !this.camera) return;
    this.updateMousePosition(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersection = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.dragPlane, intersection)) {
        let newPos = intersection.add(this.dragOffset);
        newPos.y = this.dragPlane.constant; // Mantener altura del plano
        this.selectedIndicator.setPosition(newPos.x, newPos.y, newPos.z);
    }
  };

  private onMouseUp = (): void => {
    if (this.isDragging && this.selectedIndicator) {
      const finalPos = this.selectedIndicator.getPosition();
      let finalY = finalPos.y; // Mantener Y si no hay terreno

      if (this.modeloPiso?.model) { // Ajustar al terreno si existe
          const terrainHeight = this.getTerrainHeight(finalPos.x, finalPos.z);
          finalY = terrainHeight + 0.2; // Offset sobre el terreno
          this.selectedIndicator.setPosition(finalPos.x, finalY, finalPos.z);
          console.log(`Indicator dropped. Adjusted Y to terrain: ${finalY}`);
      } else {
           console.log(`Indicator dropped. Final Y: ${finalY} (No terrain adjustment)`);
      }

      const idx = this.indicators.indexOf(this.selectedIndicator);
      if (idx !== -1) {
          // Emitir la posición final CON la Y ajustada
          this.dragEnd$.next({ index: idx, position: new THREE.Vector3(finalPos.x, finalY, finalPos.z) });
      }

      this.isDragging = false; this.selectedIndicator = null;
      if(this.renderer) this.renderer.domElement.style.cursor = 'default';
      if(this.controls) this.controls.enabled = !this.editMode; // Habilitar si no está en modo edición
      this.onCursorUpdate({} as MouseEvent); // Actualizar cursor por si quedó sobre algo
    }
  };

  // --- Helpers de Arrastre ---
  private updateMousePosition(event: MouseEvent): void {
    if (this.renderer) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }
  }

  private calculateDragOffset(intersectionPoint: THREE.Vector3): void {
    if (this.selectedIndicator) {
        this.dragOffset = this.selectedIndicator.getPosition().clone().sub(intersectionPoint);
    }
  }

  // --- Obtener Altura del Terreno ---
  private getTerrainHeight(x: number, z: number): number {
    if (!this.modeloPiso?.model || !this.modeloPiso.model.visible) return 0;
    const origin = new THREE.Vector3(x, 100, z); // Empezar alto
    const direction = new THREE.Vector3(0, -1, 0);
    const raycaster = new THREE.Raycaster(origin, direction);
    const intersects = raycaster.intersectObject(this.modeloPiso.model, true);
    return intersects.length > 0 ? intersects[0].point.y : 0;
  }

  // --- Inicialización Principal de la Escena ---
  public init(container: HTMLElement, indicatorCount: number, force: boolean = false, initialIndicatorColors?: string[]): void {
    // Detener animación de cámara si está en curso
    if (this.isAnimatingCamera && this.cameraAnimationId !== null) {
        cancelAnimationFrame(this.cameraAnimationId);
        this.isAnimatingCamera = false; this.cameraAnimationId = null;
    }

    if (this.initialized && !force) {
      this.attachRenderer(container); this.controls?.update(); return;
    }
    if (this.initialized && force) { this.dispose(); }

    console.log(`Initializing SceneService with ${indicatorCount} indicators...`);
    this.initialized = false; // Marcar como NO inicializado hasta el final
    this.indicators = []; this.totalIndicatorsToLoad = indicatorCount; this.loadedIndicators = 0;
    this.loadedZoneModels = 0; this.totalZoneModelsToLoad = 0; // Se calculará en loadZoneModels

    // --- Configuración Básica (Cámara, Renderer, Luces) ---
    this.cameraService.createDefaultCameras();
    this.cameraService.initCameraInfo(container);
    this.camera = this.cameraService.getActiveCamera();
    this.renderer = this.rendererService.getRenderer();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.innerHTML = ''; container.appendChild(this.renderer.domElement);
    this.renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

    this.scene.clear(); // Limpiar escena
    this.lightingService.addHemisphereLight(this.scene, new THREE.Vector3(0, 0, 0));

    // --- Carga Secuencial: Indicadores PRIMERO, luego Modelos de Zona ---
    console.log("Starting indicator initialization...");
    this.initIndicators(indicatorCount, initialIndicatorColors, () => {
        // Este callback se ejecuta CUANDO TODOS los indicadores han llamado a su propio callback de carga
        console.log("All indicators reported loaded. Proceeding to load zone models.");
        this.loadZoneModels();
    });

    // --- Controles y Ciclo de Animación ---
    if (this.controls) this.controls.dispose(); // Limpiar controles anteriores
    this.controls = this.orbitControlsService.configureControls(this.camera, this.renderer.domElement);
    this.controls.enabled = true; // Habilitados por defecto

    // Listener de click (asegurarse que no se duplique)
    this.renderer.domElement.removeEventListener('click', this.handleRendererClick);
    this.renderer.domElement.addEventListener('click', this.handleRendererClick);

    // Iniciar ciclo de animación principal (si no está ya corriendo)
    if (this.animationFrameId === null) {
        console.log("Starting main animation loop.");
        this.animate(); // Llama a requestAnimationFrame internamente
    }

    // Marcar como inicializado AL FINAL
    this.initialized = true;
    console.log("SceneService initialization process finished.");
    // Nota: modelsLoaded$ se pondrá a true cuando los modelos de ZONA terminen.
}


  // --- Handler para Click en Renderer (Llama a onClick util) ---
  private handleRendererClick = (event: MouseEvent) => {
      if (this.isDragging || this.isAnimatingCamera) return; // Ignorar clicks durante interacciones
      onClick(event, this.renderer, this.cameraService, this.indicators, this.indicatorClick$);
  }

  // --- Inicializar Indicadores (Carga Modelos de Indicadores) ---
  private initIndicators(count: number, initialColors?: string[], onAllLoadedCallback?: () => void): void {
    console.log(`Initializing ${count} indicators...`);
    // Reiniciar estado de carga de indicadores
    this.indicators = [];
    this.totalIndicatorsToLoad = count;
    this.loadedIndicators = 0;

    if (count === 0) {
      console.log("No indicators to load.");
      if (onAllLoadedCallback) onAllLoadedCallback(); // Ejecutar callback inmediatamente si no hay nada que cargar
      return;
    }

    for (let i = 0; i < count; i++) {
      const initialPos = new THREE.Vector3(0, 50, 0); // Posición inicial temporal alta
      const ind = new ModeloIndicador();

      // Definir el callback que se ejecuta CUANDO ESTE indicador específico termina de cargar
      const onSingleIndicatorLoaded = () => {
        if (initialColors && initialColors[i]) {
          ind.setColor(initialColors[i]);
        }
        this.loadedIndicators++;
        console.log(`Indicator ${i + 1}/${this.totalIndicatorsToLoad} loaded.`);

        // Comprobar si TODOS los indicadores esperados se han cargado
        if (this.loadedIndicators === this.totalIndicatorsToLoad) {
          console.log("All indicators loaded successfully.");
          if (onAllLoadedCallback) {
              console.log("Executing onAllLoadedCallback for indicators.");
              onAllLoadedCallback(); // Llamar al callback principal AHORA
          }
        }
      };

      // Cargar el modelo del indicador
      ind.loadGLTFModel(
        this.scene,
        'assets/models/llavero1.glb', // Ruta al modelo GLB del indicador
        this.world, // Mundo físico
        initialPos,
        10, // Masa
        onSingleIndicatorLoaded // Pasar el callback específico
      );
      this.indicators.push(ind); // Añadir a la lista inmediatamente
    }
  }

  // --- Cargar Modelos de Zona (Terreno y Título) ---
  // *** ESTA ES LA PARTE QUE PARECÍA FALLAR ANTES ***
  private loadZoneModels(): void {
    if (!this.zoneConfig) {
      console.warn("Cannot load zone models: zoneConfig is not set.");
      this.modelsLoaded$.next(true); // Si no hay config, considerar cargado
      return;
    }

    // Reiniciar estado de carga de modelos de zona
    this.loadedZoneModels = 0;
    this.totalZoneModelsToLoad = 0;
    if (this.zoneConfig.modelPath) this.totalZoneModelsToLoad++;
    if (this.zoneConfig.titleModel) this.totalZoneModelsToLoad++;

    if (this.totalZoneModelsToLoad === 0) {
      console.log("No zone models (terrain/title) specified in config. Skipping load.");
      this.modelsLoaded$.next(true); // Considerar cargado si no hay nada que cargar
      return;
    }

    console.log(`Starting to load ${this.totalZoneModelsToLoad} zone models...`);
    this.modelsLoaded$.next(false); // Marcar como NO cargado al iniciar

    // --- Cargar Modelo del Terreno/Piso ---
    if (this.zoneConfig.modelPath) {
      console.log("Loading terrain model from:", this.zoneConfig.modelPath);
      // Asegurarse que modeloPiso existe y tiene el método
      if (this.modeloPiso && typeof this.modeloPiso.loadGLTFModel === 'function') {
          this.modeloPiso.loadGLTFModel(
              this.scene, // Pasar la escena donde añadirlo
              this.zoneConfig.modelPath,
              this.world, // Pasar mundo físico si aplica
              undefined, // Posición inicial (opcional, puede definirse en el servicio)
              () => { // Callback cuando ESTE modelo termine
                  console.log("Terrain model finished loading.");
                  this.onZoneModelLoaded(); // Notificar que un modelo de zona terminó
              }
          );
      } else {
          console.error("ModeloPisoService not available or missing loadGLTFModel method.");
          // Si falta este servicio/método, necesitamos contarlo como 'cargado' para no bloquear
          this.onZoneModelLoaded();
      }
    }

    // --- Cargar Modelo del Título/Letras ---
    if (this.zoneConfig.titleModel) {
      console.log("Loading title model from:", this.zoneConfig.titleModel);
       // Asegurarse que modeloLetras existe y tiene el método
       if (this.modeloLetras && typeof this.modeloLetras.loadGLTFModel === 'function') {
           this.modeloLetras.loadGLTFModel(
               this.scene, // Pasar la escena donde añadirlo
               this.zoneConfig.titleModel,
               () => { // Callback cuando ESTE modelo termine
                   console.log("Title model finished loading.");
                   this.onZoneModelLoaded(); // Notificar que un modelo de zona terminó
               }
           );
       } else {
           console.error("ModeloLetrasService not available or missing loadGLTFModel method.");
           // Si falta este servicio/método, necesitamos contarlo como 'cargado' para no bloquear
           this.onZoneModelLoaded();
       }
    }
  }

  // --- Callback Invocado cuando un Modelo de ZONA (Piso o Letras) Termina de Cargar ---
  private onZoneModelLoaded(): void {
    this.loadedZoneModels++;
    console.log(`A zone model has loaded (${this.loadedZoneModels}/${this.totalZoneModelsToLoad}).`);

    // Comprobar si TODOS los modelos de zona ESPERADOS se han cargado
    if (this.loadedZoneModels >= this.totalZoneModelsToLoad) {
      console.log("All expected zone models have finished loading.");
      this.modelsLoaded$.next(true); // Emitir que TODO (terreno+título) está listo
      // Ajustar indicadores al terreno AHORA que el terreno está cargado
      this.adjustIndicatorsToTerrain();
    }
  }

  // --- Ajustar Altura de Indicadores al Terreno ---
  public adjustIndicatorsToTerrain(): void {
    if (!this.modeloPiso?.model) {
        // No ajustar si el modelo de piso no está cargado (puede pasar si solo hay título)
        // console.warn("Cannot adjust indicators: Terrain model not available.");
        return;
    }
    if (this.indicators.length === 0) {
        // console.log("No indicators to adjust.");
        return;
    }
    console.log("Adjusting indicator heights based on terrain...");
    let adjustedCount = 0;
    this.indicators.forEach((indicator, index) => {
        if (indicator.model) { // Asegurarse que el modelo del indicador existe
            const currentPos = indicator.getPosition();
            const terrainHeight = this.getTerrainHeight(currentPos.x, currentPos.z);
            // Aplicar solo si la altura calculada es razonable (evitar NaN o Infinito)
            if (isFinite(terrainHeight)) {
                const finalY = terrainHeight + 0.2; // Offset sobre el terreno
                indicator.setPosition(currentPos.x, finalY, currentPos.z);
                adjustedCount++;
            } else {
                console.warn(`Could not get valid terrain height for indicator ${index} at (x=${currentPos.x}, z=${currentPos.z}). Keeping original Y.`);
            }
        }
    });
     console.log(`Finished adjusting heights for ${adjustedCount}/${this.indicators.length} indicators.`);
}

  // --- Ciclo Principal de Animación/Renderizado ---
  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    // ***** MODIFICACIÓN CLAVE *****
    // El ciclo principal NO renderiza si la cámara está en su propia animación (acercamiento u órbita)
    if (!this.initialized || this.isAnimatingCamera) {
         return; // La animación de cámara se encarga de su propio renderizado
    }
    // ***** FIN MODIFICACIÓN *****

    const delta = this.clock.getDelta();

    // Actualizar Controles Orbitales (solo si están habilitados)
    if (this.controls && this.controls.enabled) {
        this.controls.update();
    }

    // Actualizar Indicadores, Terreno, Letras, Luces, Física...
    this.indicators.forEach(ind => ind.update(delta, this.camera, this.editMode));
    if (this.modeloPiso && this.cameraService) {
        clampCameraToTerrain(this.modeloPiso, this.cameraService);
    }
    if (this.modeloLetras) this.modeloLetras.update(this.camera);
    if (this.lightingService) this.lightingService.update();
    if (this.world) this.world.step(1 / 60, delta, 3);

    // Renderizar Escena (solo si la cámara no está animándose)
    if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
    }
};


  // --- Redimensionar Ventana ---
  public onWindowResize(): void {
    if (!this.initialized || !this.camera || !this.renderer) return;
    const container = this.renderer.domElement.parentElement;
    if (!container) return;
    const width = container.clientWidth; const height = container.clientHeight;
    if (width > 0 && height > 0) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
  }

  // --- Establecer Configuración de la Zona ---
  public setZoneConfiguration(config: ZoneConfig): void {
    this.zoneConfig = config;
    console.log("SceneService: Zone configuration set", this.zoneConfig);
  }

  // --- Adjuntar Renderer al Contenedor HTML ---
  private attachRenderer(container: HTMLElement) {
    if (this.renderer && this.renderer.domElement.parentElement !== container) {
      if (this.renderer.domElement.parentElement) {
        this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
      }
      container.appendChild(this.renderer.domElement);
      this.renderer.setSize(container.clientWidth, container.clientHeight);
      this.onWindowResize(); // Reajustar cámara
    }
  }

  // --- Limpieza Completa del Servicio y Recursos ---
  public dispose(): void {
    console.log("Disposing SceneService...");
    if (!this.initialized) return;

    // Detener ciclos de animación
    if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);
    if (this.isAnimatingCamera && this.cameraAnimationId !== null) cancelAnimationFrame(this.cameraAnimationId);
    this.animationFrameId = null; this.cameraAnimationId = null; this.isAnimatingCamera = false;

    // Limpiar eventos del DOM
    this.cleanupDragEvents();
    if (this.renderer) {
        this.renderer.domElement.removeEventListener('click', this.handleRendererClick);
        this.renderer.domElement.removeEventListener('contextmenu', e => e.preventDefault());
         if (this.renderer.domElement.parentElement) {
           this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
         }
         this.renderer.dispose();
    }

    // Limpiar Controles
    if (this.controls) this.controls.dispose();

    // Limpiar Indicadores (quitar de escena, TODO: añadir dispose interno si es necesario)
    this.indicators.forEach(ind => { if(ind.model) this.scene.remove(ind.model); /* ind.dispose(); */ });
    this.indicators = [];

    // Limpiar Modelos de Zona (quitar de escena, TODO: añadir dispose interno)
    if (this.modeloPiso?.model) this.scene.remove(this.modeloPiso.model); /* this.modeloPiso.dispose(); */
    if (this.modeloLetras?.model) this.scene.remove(this.modeloLetras.model); /* this.modeloLetras.dispose(); */

    // Limpiar Escena profundamente
    while(this.scene.children.length > 0){
        const child = this.scene.children[0];
        this.scene.remove(child);
        if ((child as any).geometry) (child as any).geometry.dispose();
        if ((child as any).material) {
            const materials = Array.isArray((child as any).material) ? (child as any).material : [(child as any).material];
            materials.forEach((material: THREE.Material | any) => {
                Object.values(material).forEach((value: any) => { // Limpiar texturas (map, normalMap, etc.)
                    if (value instanceof THREE.Texture) value.dispose();
                });
                material.dispose();
            });
        }
    }

    // Limpiar Mundo Físico
    if (this.world) { while(this.world.bodies.length > 0) this.world.remove(this.world.bodies[0]); }

    // Resetear Estado
    this.initialized = false; this.zoneConfig = undefined; this.editMode = false;
    this.dragEnabled = false; this.selectedIndicator = null; this.isDragging = false;
    this.modelsLoaded$.next(false); // Resetear observable de carga
    console.log("SceneService disposed.");
  }

  // --- Establecer Modo Edición ---
  public setEditMode(enabled: boolean): void {
    if (this.editMode === enabled) return;
    this.editMode = enabled;
    console.log(`SceneService: Edit mode ${enabled ? 'enabled' : 'disabled'}.`);
    if (this.controls) this.controls.enabled = !this.editMode && !this.isDragging;
    if (this.editMode) this.enableDrag(); else this.disableDrag();
    this.onCursorUpdate({} as MouseEvent); // Actualizar cursor
  }

  // --- Deshabilitar Controles Orbitales ---
  public disableOrbitControlsForAdmin(): void {
    if (this.controls) { this.controls.enabled = false; console.log('OrbitControls disabled.'); }
  }

  // --- Estado de Rotación del Sol ---
  public isSunRotating(): boolean { return this.lightingService?.isSunRotating() ?? false; }

  // --- Ir a Indicador (Sin Animación Suave) ---
  public goToIndicator(index: number): void {
      if (this.isAnimatingCamera) return; // No interrumpir animación
      goToIndicator(index, this.indicators, this.cameraService, this.controls);
  }

  // --- Alternar Animación del Sol ---
  public toggleSunAnimation(): void { this.lightingService?.toggleSunRotation(); }

  // ==================================================================
  // --- MÉTODO PARA ANIMAR CÁMARA (CON ÓRBITA AL FINAL) ---
  // ==================================================================
   public animateCameraToIndicator(index: number, onCompleteCallback: () => void): void {
    // --- Validaciones ---
    if (!this.initialized || !this.camera || !this.controls) {
      console.warn("Cannot animate camera: Scene not ready.");
      onCompleteCallback();
      return;
    }
    const targetIndicator = this.indicators[index];
    if (!targetIndicator?.model) {
      console.warn(`Cannot animate camera: Indicator ${index} invalid or model not loaded.`);
      onCompleteCallback();
      return;
    }
    // Cancelar animación anterior si existe
    if (this.isAnimatingCamera && this.cameraAnimationId !== null) {
      cancelAnimationFrame(this.cameraAnimationId);
      console.log("Cancelled previous camera animation to start new one.");
      // IMPORTANTE: Restaurar escala del indicador anterior si se interrumpe
      // (Asumimos que 'selectedIndicator' podría seguir apuntando al anterior si se cancela rápido)
      // Para ser más robusto, podríamos guardar el índice del indicador animado anteriormente.
      // Por ahora, intentamos restaurar el 'selectedIndicator' si existe.
      if (this.selectedIndicator?.model) {
         // Necesitaríamos guardar la escala inicial del *anterior* indicador.
         // Simplificación: Por ahora, no restauramos escala en cancelación aquí,
         // solo al final o en error de renderizado. El nuevo indicador se escalará correctamente.
         console.warn("Previous animation cancelled, scale restoration of previous indicator skipped for simplicity.");
      }
    }
    this.isOrbitingAfterAnimation = false; // Reiniciar estado de órbita

    const targetPosition = targetIndicator.getPosition();

    // --- Calcular Posiciones/Targets Finales ACERCAMIENTO ---
    const distance = 10; // Distancia final de la cámara al indicador
    const heightOffset = 5; // Altura de la cámara sobre el indicador
    const cameraOffset = new THREE.Vector3(0, heightOffset, distance);
    // La posición final de la cámara después del zoom
    const zoomEndCameraPosition = targetPosition.clone().add(cameraOffset);
    // El punto al que mirará la cámara (un poco por encima del indicador)
    const finalLookAt = targetPosition.clone().add(new THREE.Vector3(0, 1.5, 0));

    // --- Configuración Animación ---
    const zoomStartTime = performance.now();
    const startPosition = this.camera.position.clone(); // Posición actual
    const startTarget = this.controls.target.clone(); // Target actual

    // --- Variables de Escala ---
    const initialIndicatorScale = targetIndicator.model.scale.clone(); // Guardar escala original
    // Calcular la escala deseada DURANTE la animación
    const focusedIndicatorScale = initialIndicatorScale.clone().multiplyScalar(this.FOCUSED_INDICATOR_SCALE_FACTOR);

    // --- Iniciar Animación ---
    const originalControlsState = this.controls.enabled;
    const originalDampingState = this.controls.enableDamping;
    const originalDampingFactor = this.controls.dampingFactor;

    // --- !! APLICAR ESCALA REDUCIDA ANTES DE ANIMAR !! ---
    targetIndicator.model.scale.copy(focusedIndicatorScale);
    console.log(`Indicator ${index} scale set to focused size (${this.FOCUSED_INDICATOR_SCALE_FACTOR}).`);
    // Marcar cuál es el indicador seleccionado *para esta animación*
    this.selectedIndicator = targetIndicator;


    this.controls.enabled = false; // Deshabilitar input usuario
    this.isAnimatingCamera = true;
    this.isOrbitingAfterAnimation = false; // Asegurarse de que no está en modo órbita aún
    if (this.renderer) this.renderer.domElement.style.cursor = 'progress';
    console.log(`Starting animation sequence (Zoom: ${this.ZOOM_DURATION}ms, Orbit: ${this.ORBIT_DURATION}ms) for indicator ${index}...`);

    // --- Ciclo de Animación Principal ---
    const animateStep = (currentTime: number) => {
      // --- Calcular Posición/Target de la Cámara ---
      if (!this.isOrbitingAfterAnimation) {
        // --- FASE 1: Acercamiento (Zoom) ---
        const zoomElapsedTime = currentTime - zoomStartTime;
        let zoomProgress = Math.min(zoomElapsedTime / this.ZOOM_DURATION, 1);
        // Aplicar easing para suavizar inicio y fin del zoom
        zoomProgress = zoomProgress < 0.5 ? 4 * zoomProgress * zoomProgress * zoomProgress : 1 - Math.pow(-2 * zoomProgress + 2, 3) / 2; // EaseInOutCubic

        // Interpolar posición y target
        this.camera.position.lerpVectors(startPosition, zoomEndCameraPosition, zoomProgress);
        this.controls.target.lerpVectors(startTarget, finalLookAt, zoomProgress);
        this.camera.lookAt(this.controls.target); // Asegurar mirada

        if (zoomProgress >= 1) {
          // --- TRANSICIÓN A FASE 2: INICIO DE ÓRBITA SUAVE ---
          console.log("Zoom phase complete. Starting smooth orbit phase...");
          // Establecer el TARGET final en los controles para la órbita
          this.controls.target.copy(finalLookAt);
          // Asegurar que la cámara está en la posición final del zoom para evitar saltos
          this.camera.position.copy(zoomEndCameraPosition);
          this.camera.lookAt(this.controls.target);

          // Configurar OrbitControls para órbita automática CON DAMPING
          this.controls.autoRotate = true;
          this.controls.autoRotateSpeed = this.ORBIT_AUTO_ROTATE_SPEED;
          this.controls.enableDamping = true; // *** Asegurar Damping ACTIVO ***
          this.controls.dampingFactor = this.DAMPING_FACTOR; // Usar nuestro factor
          // *** HABILITAR controles para que update() aplique damping y autoRotate ***
          // ¡PERO! Mantenemos los controles lógicamente deshabilitados para el usuario
          // hasta que la animación termine por completo. 'enabled' aquí es para que .update() funcione internamente.
          // La variable `isAnimatingCamera` previene el renderizado del loop principal y la interacción del usuario.
          this.controls.enabled = true; // Necesario para que .update() funcione internamente

          this.isOrbitingAfterAnimation = true; // Marcar inicio de fase órbita
          this.orbitStartTime = currentTime;    // Registrar tiempo de inicio de órbita
        }
      } else {
        // --- FASE 2: Órbita (Controlada por OrbitControls.update) ---
        const orbitElapsedTime = currentTime - this.orbitStartTime;

        // *** LLAMAR A controls.update() ES CLAVE ***
        // Aplica autoRotate Y damping para suavizar el movimiento orbital
        this.controls.update();
        // *** FIN LLAMADA CLAVE ***

        if (orbitElapsedTime >= this.ORBIT_DURATION) {
          // --- Finalizar Órbita y Animación ---
          console.log("Orbit phase complete.");
          this.controls.autoRotate = false; // Detener giro

          // Restaurar estado
          this.isOrbitingAfterAnimation = false;
          this.isAnimatingCamera = false;
          this.cameraAnimationId = null;
          if (this.renderer) this.renderer.domElement.style.cursor = 'default';
          this.selectedIndicator = null; // Desmarcar indicador

          // Restaurar estado original de controles y damping
          this.controls.enabled = !this.editMode && !this.isDragging; // Restaurar según modo edición/arrastre
          this.controls.enableDamping = originalDampingState;
          this.controls.dampingFactor = originalDampingFactor;
          this.controls.target.copy(finalLookAt); // Asegurar target final explícitamente

          // --- !! RESTAURAR ESCALA ORIGINAL DEL INDICADOR !! ---
          targetIndicator.model?.scale.copy(initialIndicatorScale);
          console.log(`Indicator ${index} scale restored to original.`);

          console.log("Full camera animation sequence finished.");
          // Ejecutar callback final
          if (onCompleteCallback) {
            try {
              onCompleteCallback();
            } catch (e) {
              console.error("Error in onCompleteCallback:", e);
            }
          }
          return; // DETENER el ciclo de animación
        }
      }

      // --- NO HAY ANIMACIÓN DE ESCALA AQUÍ DENTRO ---
      // La escala se mantiene fija (focusedIndicatorScale) durante todo el animateStep

      // --- Renderizar el Frame Actual ---
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      } else {
        // Manejo de error si el contexto de renderizado se pierde
        console.error("Rendering context lost during animation. Stopping animation.");
        if (this.cameraAnimationId) cancelAnimationFrame(this.cameraAnimationId);

        // Restaurar estado en caso de error
        this.isAnimatingCamera = false;
        this.isOrbitingAfterAnimation = false;
        this.cameraAnimationId = null;
        if (this.renderer) this.renderer.domElement.style.cursor = 'default';

        // Restaurar controles/damping
        if (this.controls) {
          this.controls.autoRotate = false;
          this.controls.enabled = !this.editMode && !this.isDragging;
          this.controls.enableDamping = originalDampingState;
          this.controls.dampingFactor = originalDampingFactor;
          // Intentar restaurar el target por si acaso
          this.controls.target.copy(startTarget);
        }

        // --- !! RESTAURAR ESCALA ORIGINAL (También en caso de error) !! ---
        if (targetIndicator?.model) {
            targetIndicator.model.scale.copy(initialIndicatorScale);
            console.log(`Indicator ${index} scale restored due to rendering error.`);
        }
        this.selectedIndicator = null; // Desmarcar

        // Intentar llamar al callback incluso en error, si existe
        if (onCompleteCallback) { try { onCompleteCallback(); } catch(e) { console.error("Error in onCompleteCallback during error handling:", e); } }
        return; // Detener
      }

      // --- Solicitar Siguiente Frame ---
      this.cameraAnimationId = requestAnimationFrame(animateStep);
    };

    // --- Iniciar el Primer Frame ---
    // Asegurarse de cancelar cualquier ID pendiente antes de asignar uno nuevo
    if (this.cameraAnimationId !== null) cancelAnimationFrame(this.cameraAnimationId);
    this.cameraAnimationId = requestAnimationFrame(animateStep);
  }
  // ==================================================================
  // --- FIN MÉTODO MODIFICADO ---
  // ==================================================================

} // Fin de la clase SceneService