// RUTA: src/app/components/inicio/utils/territory-scene.service.ts
import { Injectable } from '@angular/core';
import { ThreeLoaderService } from './three-loader.service';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { environment } from '../../../environments/environment';

/**
 * @Injectable
 * Servicio para gestionar la escena 3D específica del territorio (mapa y título).
 * Se encarga de inicializar Three.js, cargar los modelos GLB (usando DRACO),
 * configurar la cámara, luces, controles y manejar el bucle de animación y la limpieza de recursos.
 */
@Injectable({ providedIn: 'root' })
export class TerritorySceneService {

    // ==========================================
    //      THREE.JS MODULE REFERENCES
    // ==========================================
    private three = THREE; // Namespace principal de Three.js
    private GLTFLoader!: typeof GLTFLoader; // Cargador para modelos GLTF/GLB
    private OrbitControls!: typeof OrbitControls; // Controles de órbita para la cámara
    private DRACOLoader!: typeof DRACOLoader; // Decodificador para geometría comprimida con DRACO
    // ==========================================
    //    FIN THREE.JS MODULE REFERENCES
    // ==========================================

    // ==========================================
    //        CORE THREE.JS PROPERTIES
    // ==========================================
    /** El renderizador WebGL de Three.js. */
    private renderer: THREE.WebGLRenderer | null = null;
    /** La escena principal que contiene todos los objetos 3D. */
    private scene: THREE.Scene | null = null;
    /** La cámara perspectiva a través de la cual se ve la escena. */
    private camera: THREE.PerspectiveCamera | null = null;
    /** Controles para interactuar con la cámara (zoom, paneo, rotación). */
    private controls: OrbitControls | null = null;
    /** Grupo que contiene el modelo 3D del mapa. */
    private mapModel: THREE.Group | null = null;
    /** Grupo que contiene el modelo 3D de las letras del título. */
    private lettersModel: THREE.Group | null = null;
    // ==========================================
    //      FIN CORE THREE.JS PROPERTIES
    // ==========================================

    // ==========================================
    //         SERVICE STATE FLAGS
    // ==========================================
    /** ID del frame de animación actual, usado para cancelar el bucle. */
    private frameId: number = 0;
    /** Indica si el bucle de animación está activo. */
    private animateActive = false;
    /** Indica si el servicio ha sido inicializado completamente. */
    private initialized: boolean = false;
    // ==========================================
    //       FIN SERVICE STATE FLAGS
    // ==========================================
    private modelsLoaded: boolean = false; // NUEVO: Indica si loadModels() completó

    // ==========================================
    //      CONFIGURATION PROPERTIES
    // ==========================================
    /** URL base del backend desde donde se cargarán los modelos. */
    private baseAssetUrl: string = '';
    /** Ruta relativa dentro del backend donde se esperan los modelos del territorio. */
    private readonly territoryModelPath = 'uploads/productos/modelos/';
    // ==========================================
    //    FIN CONFIGURATION PROPERTIES
    // ==========================================

     private readonly modelBasePath = 'uploads/zones/models/'; // Mantenemos la carpeta base
    // ==========================================
    //            CONSTRUCTOR
    // ==========================================
    constructor(private loader: ThreeLoaderService) { }

    // ==========================================
    //       MODIFIED: init()
    // ==========================================
    /**
     * Inicializa los componentes básicos de la escena 3D (renderer, scene, camera, lights, controls).
     * NO carga los modelos 3D; eso se hace con loadModels().
     * @param canvas El elemento HTMLCanvasElement.
     * @param baseAssetUrl La URL base del backend.
     * @throws Error si falla la inicialización básica.
     */
    async init(canvas: HTMLCanvasElement, baseAssetUrl: string): Promise<void> {
        if (this.initialized) {
            console.warn("TerritorySceneService: Already initialized.");
            // ... (lógica existente para actualizar baseAssetUrl si cambia) ...
             if (baseAssetUrl && this.baseAssetUrl !== (baseAssetUrl.endsWith('/') ? baseAssetUrl : baseAssetUrl + '/')) {
                console.log("TerritorySceneService: Updating baseAssetUrl.");
                this.baseAssetUrl = baseAssetUrl.endsWith('/') ? baseAssetUrl : baseAssetUrl + '/';
             }
            if (this.renderer?.domElement !== canvas) {
                 console.warn("TerritorySceneService: Initializing on a different canvas. Re-initializing needed?");
                 // Podrías necesitar destruir y recrear si el canvas cambia.
                 // Por ahora, solo ajustamos tamaño si es el mismo.
                 if (this.renderer) this.onResize(canvas); // Ajusta si el canvas cambió pero el servicio no se destruyó
             } else {
                 if (this.renderer) this.onResize(canvas);
             }
            return;
        }
        console.log("TerritorySceneService: Initializing base scene...");

        // Guarda y normaliza la URL base (lógica existente)
        // ...
        if (!baseAssetUrl) {
            console.warn("TerritorySceneService: baseAssetUrl not provided during init. Falling back to environment.");
            this.baseAssetUrl = environment.endpoint.endsWith('/') ? environment.endpoint : environment.endpoint + '/';
        } else {
            this.baseAssetUrl = baseAssetUrl.endsWith('/') ? baseAssetUrl : baseAssetUrl + '/';
        }
        console.log("TerritorySceneService: Using baseAssetUrl:", this.baseAssetUrl);


        try {
            // Carga módulos Three.js (lógica existente)
            const { three, GLTFLoader, OrbitControls, DRACOLoader } = await this.loader.loadModules();
            this.three = three; this.GLTFLoader = GLTFLoader; this.OrbitControls = OrbitControls; this.DRACOLoader = DRACOLoader;


            const width = canvas.clientWidth;
            const height = canvas.clientHeight;
            if (width <= 0 || height <= 0) { throw new Error("Canvas has zero dimensions."); }

            // Configura Renderer, Scene, Camera, Controls, Lights (lógica existente)
            // ... (igual que tu código anterior) ...
             // --- Configuración del Renderer ---
             this.renderer = new this.three.WebGLRenderer({
               canvas: canvas,
               antialias: true,
               alpha: false
             });
             this.renderer.setPixelRatio(window.devicePixelRatio);
             this.renderer.setSize(width, height);
             this.renderer.outputColorSpace = THREE.SRGBColorSpace;

             // --- Configuración de la Escena ---
             this.scene = new this.three.Scene();
             this.scene.background = new this.three.Color(0x000000);

             // --- Configuración de la Cámara ---
             this.camera = new this.three.PerspectiveCamera(60, width / height, 0.1, 100000);
             this.camera.position.set(0, 700, 1400);
             this.camera.lookAt(0, 0, 0);

             // --- Configuración de Controles ---
             this.controls = new this.OrbitControls(this.camera, this.renderer.domElement);
             this.controls.enableRotate = false;
             this.controls.enablePan = false;
             this.controls.enableZoom = true;
             this.controls.minDistance = 1250;
             this.controls.maxDistance = 2000;
             this.controls.enableDamping = true;
             this.controls.dampingFactor = 0.1;

             // --- Configuración de Luces ---
             const hemisphereLight = new this.three.HemisphereLight(0xffffff, 0xcccccc, 2.0);
             this.scene.add(hemisphereLight);

            // *** NO LLAMAR a loadModels() aquí ***

            this.initialized = true; // Marca que la base está lista
            this.modelsLoaded = false; // Asegura que los modelos no están marcados como cargados
            console.log("TerritorySceneService base scene initialized successfully.");
        } catch (error) {
            console.error("Error during TerritorySceneService base initialization:", error);
            this.destroyPartial(); // Limpia lo que se haya podido crear
            this.initialized = false;
            this.modelsLoaded = false;
            throw error; // Propaga el error
        }
    }
    // ==========================================
    //       FIN MODIFIED: init()
    // ==========================================


    // ==========================================
    //       MODIFIED: loadModels()
    // ==========================================
    /**
     * Carga los modelos 3D específicos (mapa y título) para una zona.
     * Debe llamarse DESPUÉS de que init() haya completado exitosamente.
     * @param mapModelFilename El nombre del archivo GLB para el mapa (ej: 'mapa_pasca.glb').
     * @param titleModelFilename El nombre del archivo GLB para el título (ej: 'titulo_pasca.glb').
     * @throws Error si falla la carga de los modelos o si el servicio no está inicializado.
     */
    async loadModels(mapModelFilename?: string, titleModelFilename?: string): Promise<void> {
        // Verifica si la base de la escena está inicializada
        if (!this.isInitialized() || !this.scene) {
            throw new Error("TerritorySceneService: Base scene not initialized. Call init() before loadModels().");
        }
        // Verifica si los modelos ya están cargados para evitar recargas innecesarias
        if (this.modelsLoaded) {
            console.warn("TerritorySceneService: Models already loaded. Skipping reload. Call clearModels() first if needed.");
            return;
        }
        // Limpia modelos anteriores si existieran (por si acaso)
        this.clearModels();

        console.log(`TerritorySceneService: Loading models - Map: ${mapModelFilename || 'N/A'}, Title: ${titleModelFilename || 'N/A'}`);

        // Verifica que haya al menos un modelo para cargar
        if (!mapModelFilename && !titleModelFilename) {
            console.warn("TerritorySceneService: No model filenames provided to loadModels().");
            this.modelsLoaded = true; // Marcar como "cargado" aunque no haya nada
            return; // No hay nada que cargar
        }

        // Configura DRACOLoader y GLTFLoader (igual que antes)
        const dracoLoader = new this.DRACOLoader();
        dracoLoader.setDecoderPath('assets/libs/draco/');
        const loader = new this.GLTFLoader();
        loader.setDRACOLoader(dracoLoader);

        const loadPromises: Promise<any>[] = [];
        let mapModelFullPath: string | null = null;
        let titleModelFullPath: string | null = null;

        // Prepara la promesa de carga para el mapa si se proporcionó el nombre
        if (mapModelFilename) {
            mapModelFullPath = `${this.baseAssetUrl}${this.modelBasePath}${mapModelFilename}`;
            console.log("TerritorySceneService: Preparing to load map from:", mapModelFullPath);
            loadPromises.push(loader.loadAsync(mapModelFullPath).catch(err => {
                console.error(`Failed to load map model from ${mapModelFullPath}:`, err);
                return null; // Devuelve null en caso de error para que Promise.all no falle
            }));
        } else {
            loadPromises.push(Promise.resolve(null)); // Placeholder para mantener el índice
        }

        // Prepara la promesa de carga para el título si se proporcionó el nombre
        if (titleModelFilename) {
            titleModelFullPath = `${this.baseAssetUrl}${this.modelBasePath}${titleModelFilename}`;
            console.log("TerritorySceneService: Preparing to load title from:", titleModelFullPath);
            loadPromises.push(loader.loadAsync(titleModelFullPath).catch(err => {
                console.error(`Failed to load title model from ${titleModelFullPath}:`, err);
                return null; // Devuelve null en caso de error
            }));
        } else {
            loadPromises.push(Promise.resolve(null)); // Placeholder
        }

        try {
            // Espera a que todas las promesas de carga (o placeholders) se resuelvan
            const [mapGltf, titleGltf] = await Promise.all(loadPromises);

            // Procesa y añade el modelo del mapa si se cargó correctamente
            if (mapGltf) {
                this.mapModel = mapGltf.scene;
                if (this.mapModel) {
                    this.mapModel.position.set(0, 0, 0);
                    this.mapModel.scale.set(0.1, 0.1, 0.1); // Ajusta la escala según tus modelos
                    this.scene.add(this.mapModel);
                    console.log("Map model loaded and added to scene.");
                }
            }

            // Procesa y añade el modelo del título si se cargó correctamente
            if (titleGltf) {
                this.lettersModel = titleGltf.scene;
                if (this.lettersModel) {
                  // Ajusta posición, escala y rotación según tus modelos específicos
                  this.lettersModel.position.set(-580, 650, 0);
                  this.lettersModel.scale.set(200, 200, 200);
                  this.lettersModel.rotation.set(0, -39.3, 5); // Asegúrate que esto esté en radianes si es necesario
                  this.lettersModel.traverse((child: any) => {
                    if (child.isMesh && child.material && 'color' in child.material) {
                        child.material.color.set(0xffffff); // Blanco
                    }
                });
                this.scene.add(this.lettersModel);
                console.log("Title model loaded and added to scene.");
            }
        }

            this.modelsLoaded = true; // Marca que los modelos (solicitados) están cargados
            console.log("TerritorySceneService: Model loading process finished.");

        } catch (error) { // Error general en Promise.all (aunque los catch individuales deberían prevenirlo)
            console.error(`Error during model loading process:`, error);
            this.modelsLoaded = false; // Asegura que no se marque como cargado si hubo un error inesperado
            // No relanzar aquí necesariamente, los errores específicos ya se loguearon
        } finally {
            dracoLoader.dispose(); // Siempre liberar DRACOLoader
        }
    }
    // ==========================================
    //     FIN MODIFIED: loadModels()
    // ==========================================

    // ==========================================
    //          NUEVO: clearModels()
    // ==========================================
    /**
     * Elimina los modelos 3D actuales (mapa y título) de la escena y libera sus recursos.
     * Útil antes de cargar modelos de una nueva zona.
     */
    clearModels(): void {
        if (!this.scene) return; // No hacer nada si no hay escena

        console.log("TerritorySceneService: Clearing existing models...");
        // Limpia y remueve el mapa
        if (this.mapModel) {
            this.disposeObject(this.mapModel);
            this.scene.remove(this.mapModel);
            this.mapModel = null;
        }
        // Limpia y remueve las letras
        if (this.lettersModel) {
            this.disposeObject(this.lettersModel);
            this.scene.remove(this.lettersModel);
            this.lettersModel = null;
        }
        this.modelsLoaded = false; // Resetea el flag de modelos cargados
        console.log("TerritorySceneService: Models cleared.");
    }
    // ==========================================
    //        FIN NUEVO: clearModels()
    // ==========================================


    // ... (Métodos existentes: startAnimation, stopAnimation, isAnimating, isInitialized, onResize) ...
     /** Inicia el bucle de animación si está inicializado y no activo */
     startAnimation() {
       // Ahora también requiere que los modelos estén cargados (o que el proceso de carga haya terminado)
       if (!this.isInitialized() || !this.modelsLoaded || this.animateActive) return;
       this.animateActive = true;
       console.log("TerritorySceneService: Starting animation loop.");
       const loop = () => {
           if (!this.animateActive) return;
           this.frameId = requestAnimationFrame(loop);

           if (this.mapModel) this.mapModel.rotation.y += 0.003; // Rotación suave si existe el mapa
           this.controls?.update();
           this.renderer!.render(this.scene!, this.camera!);
       };
       loop();
     }

     /** Detiene el bucle de animación */
     stopAnimation() {
         if (!this.animateActive) return;
         this.animateActive = false;
         cancelAnimationFrame(this.frameId);
         console.log("TerritorySceneService: Animation loop stopped.");
     }

     /** Devuelve si la animación está activa */
     isAnimating(): boolean { return this.animateActive; }

     /** Devuelve si el servicio está completamente inicializado */
     isInitialized(): boolean { return this.initialized && !!this.renderer && !!this.scene && !!this.camera; }

     /** Maneja el redimensionamiento del canvas */
     onResize(canvas: HTMLCanvasElement) {
         if (!this.isInitialized() || !canvas) return;
         const width = canvas.clientWidth;
         const height = canvas.clientHeight;
         if (width <= 0 || height <= 0) return;

         this.renderer!.setPixelRatio(window.devicePixelRatio); // Reafirmar por si acaso
         this.renderer!.setSize(width, height, false); // false para no tocar estilos CSS
         this.camera!.aspect = width / height;
         this.camera!.updateProjectionMatrix();

         console.log(`TerritorySceneService: Resized to ${width}x${height}`);
     }

    // ... (Métodos existentes: destroyPartial, destroy, disposeObject, disposeMaterial) ...
     /** Limpia recursos parcialmente */
     private destroyPartial() {
         console.log("TerritorySceneService: Cleaning up partial resources...");
         this.stopAnimation();
         this.clearModels(); // Usa el nuevo método para limpiar modelos
         this.controls?.dispose();
         this.renderer?.dispose();
         this.scene = null;
         this.camera = null;
         this.renderer = null;
         this.controls = null;
         this.modelsLoaded = false; // Asegura resetear flag
     }

     /** Destruye completamente el servicio y libera todos los recursos */
     destroy() {
         console.log("TerritorySceneService: Destroying completely...");
         this.destroyPartial();
         this.initialized = false; // Asegura resetear flag
         console.log("TerritorySceneService: Destroyed.");
     }

     /** Libera geometría y materiales de un objeto 3D y sus hijos */
      public disposeObject(obj: THREE.Object3D | null) {
        // ... (sin cambios) ...
        if (!obj) return;
         obj.traverse((child: any) => {
             if (child.isMesh) {
                 child.geometry?.dispose();
                  if (Array.isArray(child.material)) {
                     child.material.forEach((material: THREE.Material) => this.disposeMaterial(material));
                  } else if (child.material) {
                     this.disposeMaterial(child.material);
                  }
             }
         });
         if (obj instanceof THREE.Mesh) {
             obj.geometry?.dispose();
             if (Array.isArray(obj.material)) {
                obj.material.forEach((material: THREE.Material) => this.disposeMaterial(material));
             } else if (obj.material) {
                this.disposeMaterial(obj.material);
             }
         }
     }

     /** Libera un material y sus texturas asociadas */
     private disposeMaterial(material: THREE.Material | null) {
        // ... (sin cambios) ...
        if (!material) return;
         material.dispose();
         for (const key of Object.keys(material)) {
             const value = (material as any)[key];
             if (value && typeof value === 'object' && 'isTexture' in value) {
                 (value as THREE.Texture).dispose();
             }
         }
     }

} // Fin TerritorySceneService