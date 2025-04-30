import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { environment } from '../../../environments/environment';
 
@Injectable({ providedIn: 'root' })
export class ProductSceneService {
    // --- Referencias a Clases Three.js ---
    private three = THREE;
    private GLTFLoader = GLTFLoader;
    private OrbitControls = OrbitControls;

    // --- Objetos Principales de Three.js ---
    private renderer: THREE.WebGLRenderer | null = null;
    private scene: THREE.Scene | null = null;
    private camera: THREE.PerspectiveCamera | null = null;
    private controls: OrbitControls | null = null;
    public currentModel: THREE.Group | null = null;

    // --- Estado Interno del Servicio ---
    private frameId: number = 0;
    private animateActive = false;
    private isLoading = false;
    private initialized = false;
    private currentCanvas: HTMLCanvasElement | null = null;

    // --- Configuración ---
    /** URL base del backend (asegurada con '/' al final). */
    private readonly baseAssetUrl: string;
    /** Ruta relativa dentro del backend donde se esperan los modelos de producto. */
    private readonly productModelPath = 'uploads/productos/modelos/';
    /** Nombre del archivo del modelo GLB por defecto (esperado en la ruta productModelPath del backend). */
    private readonly defaultModelFilename = 'default.glb'; // O el nombre de tu archivo por defecto
    readonly DESIRED_SIZE = 150; // Tamaño base para escalar modelos

    constructor(/* No se inyecta ThreeLoaderService aquí si no se usa DRACO */) {
        // Inicializa la URL base del backend desde environment
        this.baseAssetUrl = environment.endpoint.endsWith('/')
            ? environment.endpoint
            : environment.endpoint + '/';
        console.log("ProductSceneService: Using baseAssetUrl:", this.baseAssetUrl);
    }

    /** Limpia todos los recursos de Three.js usados por este servicio */
    destroy() {
        console.log("ProductSceneService: Destroying...");
        this.stopAnimation();
        this.clearCurrentModel();
        this.controls?.dispose();
        this.renderer?.dispose();

        this.scene = null;
        this.camera = null;
        this.controls = null;
        this.renderer = null;
        this.currentCanvas = null;
        this.initialized = false;
        this.isLoading = false;
        this.animateActive = false;
        this.currentModel = null;
        cancelAnimationFrame(this.frameId);
        console.log("ProductSceneService: Destroyed.");
    }

    /** Configura la escena base (cámara, luces) la primera vez */
    private async setupScene(): Promise<void> {
        // ... (sin cambios respecto a tu versión anterior)
        if (this.scene && this.camera) return;
        console.log("ProductSceneService: Setting up base scene (camera, lights)...");

        this.scene = new this.three.Scene();
        this.scene.background = null; // Fondo transparente

        this.camera = new this.three.PerspectiveCamera(50, 1, 0.1, 1000);
        this.camera.position.set(0, this.DESIRED_SIZE * 0.4, this.DESIRED_SIZE * 1.5);
        this.camera.lookAt(0, 0, 0);

        const ambientLight = new this.three.AmbientLight(0xffffff, 1.5);
        this.scene.add(ambientLight);
        const directionalLight1 = new this.three.DirectionalLight(0xffffff, 2.0);
        directionalLight1.position.set(5, 10, 7.5);
        this.scene.add(directionalLight1);
        const directionalLight2 = new this.three.DirectionalLight(0xffffff, 0.8);
        directionalLight2.position.set(-5, -5, -7.5);
        this.scene.add(directionalLight2);

        console.log("ProductSceneService: Base scene setup complete.");
    }

    /**
     * Inicializa el servicio para un canvas específico. Crea Renderer y Controls.
     * @param canvas El elemento HTMLCanvasElement donde se renderizará.
     */
    async init(canvas: HTMLCanvasElement): Promise<void> {
        // ... (lógica similar a tu versión anterior, ya no necesita cargar módulos Three)
        if (!canvas) {
            console.error("ProductSceneService: init() called with null canvas.");
            throw new Error("Canvas element is required for initialization.");
        }
        if (this.initialized && this.currentCanvas === canvas) {
           console.warn("ProductSceneService: Already initialized with this canvas. Resizing if needed.");
           this.onResize(canvas);
           return;
        }
        console.log("ProductSceneService: Initializing for canvas:", canvas);

        await this.setupScene(); // Asegura que la escena base esté lista
        if (!this.scene || !this.camera) {
           console.error("ProductSceneService: Scene or Camera failed to setup.");
           throw new Error("Failed to setup Three.js scene components.");
        }

        this.controls?.dispose(); // Limpia controles anteriores si existían

        this.currentCanvas = canvas;
        const width = canvas.clientWidth || this.DESIRED_SIZE;
        const height = canvas.clientHeight || this.DESIRED_SIZE;
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width > 0 ? width : this.DESIRED_SIZE;
            canvas.height = height > 0 ? height : this.DESIRED_SIZE;
        }

        this.renderer = new this.three.WebGLRenderer({
           canvas: this.currentCanvas,
           antialias: true,
           alpha: true // Mantiene fondo transparente
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(width, height, false);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        // Configuración de OrbitControls (auto-rotación, zoom habilitado, rotación manual deshabilitada)
        this.controls = new this.OrbitControls(this.camera, this.renderer.domElement);
        Object.assign(this.controls, {
           enableDamping: true,
           dampingFactor: 0.1,
           enableRotate: false, // <--- Rotación manual DESHABILITADA
           enablePan: false,
           enableZoom: true,    // <--- Zoom HABILITADO
           minDistance: this.DESIRED_SIZE * 0.5,
           maxDistance: this.DESIRED_SIZE * 2.5,
           autoRotate: true,    // <--- Auto-rotación HABILITADA
           autoRotateSpeed: 10.7, // Ajusta la velocidad
        });
        this.controls.target.set(0, 0, 0);
        this.controls.update();

        this.initialized = true;
        console.log(`ProductSceneService: Initialized. Auto-rotate: ${this.controls.autoRotate}, Manual Rotate: ${this.controls.enableRotate}`);
    }

    /**
     * Cambia el canvas de renderizado. Reconfigura Renderer y Controls.
     * @param canvas El nuevo HTMLCanvasElement de destino.
     */
    async setRenderingTarget(canvas: HTMLCanvasElement): Promise<void> {
        // ... (sin cambios respecto a tu versión anterior)
        if (!canvas) {
             console.error("ProductSceneService: setRenderingTarget() called with null canvas.");
             throw new Error("A valid canvas element is required to set rendering target.");
        }
        if (this.currentCanvas === canvas && this.renderer && this.initialized) {
           console.log("ProductSceneService: Already rendering to this canvas. Adjusting size.");
           this.onResize(canvas);
           return;
        }
        console.log("ProductSceneService: Setting new rendering target canvas.");
        // Llama a init para reconfigurar renderer y controles para el nuevo canvas
        await this.init(canvas);
    }

    /**
     * Carga un modelo 3D basado en su nombre de archivo GLB desde el backend.
     * @param filename Nombre del archivo GLB (ej: 'manzana-roja.glb') o null/undefined.
     */
    async loadModelByFilename(filename: string | null | undefined): Promise<void> {
        if (!this.isInitialized()) {
            console.error("ProductSceneService: Cannot load model - service not fully initialized.");
            throw new Error("ProductSceneService is not ready to load models.");
        }
        if (this.isLoading) {
            console.warn("ProductSceneService: Model loading already in progress.");
            return;
        }

        this.isLoading = true;
        this.clearCurrentModel();
        this.stopAnimation(); // Pausar animación mientras carga

        // Determina qué modelo cargar: el solicitado o el por defecto
        const modelToLoadFilename = filename ? filename : this.defaultModelFilename;
        const modelUrl = `${this.baseAssetUrl}${this.productModelPath}${modelToLoadFilename}`;

        console.log(`ProductSceneService: Attempting to load model from: ${modelUrl}`);

        const loader = new this.GLTFLoader(); // No necesita DRACO aquí a menos que tus modelos de producto lo usen

        try {
            const gltf = await loader.loadAsync(modelUrl);
            this.currentModel = gltf.scene;

            // Centrado y escalado (igual que antes)
            const box = new this.three.Box3().setFromObject(this.currentModel);
            const size = new this.three.Vector3();
            const center = new this.three.Vector3();
            box.getSize(size);
            box.getCenter(center);

            const maxDim = Math.max(size.x, size.y, size.z);
            let scale = 1;
            if (maxDim > 0) {
                // Escala para que quepa bien, ajusta el multiplicador si es necesario
                scale = (this.DESIRED_SIZE * 0.8) / maxDim;
            }
            this.currentModel.scale.set(scale, scale, scale);

            // Recalcula el centro después de escalar y lo mueve al origen
            const scaledBox = new this.three.Box3().setFromObject(this.currentModel);
            const scaledCenter = new this.three.Vector3();
            scaledBox.getCenter(scaledCenter);
            this.currentModel.position.sub(scaledCenter); // Mueve el modelo para que su centro esté en (0,0,0)

            this.scene!.add(this.currentModel);
            console.log(`ProductSceneService: Model loaded successfully: ${modelToLoadFilename}`);

            // Solo activa la animación si la carga fue exitosa
            this.isLoading = false;
            this.controls?.update(); // Asegurar actualización de controles
            this.startAnimation(); // Reanuda la animación (y la auto-rotación)

        } catch (error) {
            console.error(`ProductSceneService: Error loading GLB model from ${modelUrl}:`, error);
            this.isLoading = false;
            this.currentModel = null; // Asegurarse que no quede un modelo a medias

            // Intento de cargar el modelo por defecto si falló el específico y no era ya el defecto
            if (filename && modelToLoadFilename !== this.defaultModelFilename) {
                console.warn(`ProductSceneService: Failed to load specific model, attempting to load default model...`);
                try {
                    // Llama recursivamente para cargar el por defecto. Cuidado con bucles infinitos si el default también falla.
                    await this.loadModelByFilename(null); // Pasa null para forzar el default
                } catch (defaultError) {
                    console.error(`ProductSceneService: Failed to load default model as well:`, defaultError);
                    // Aquí ya no hay más fallback
                }
            } else if (!filename) {
                 // Si falló cargando el default directamente, ya no hay más que hacer
                 console.error(`ProductSceneService: Failed to load the default model (${this.defaultModelFilename}). No fallback available.`);
            }
            // No lanzar error necesariamente, puede que queramos que la app siga funcionando sin el 3D
            // throw error; // Descomentar si se prefiere que el error se propague
        }
    }

    /** Elimina el modelo actual de la escena y libera sus recursos */
    clearCurrentModel() {
        if (this.currentModel && this.scene) {
            this.scene.remove(this.currentModel);
            this.disposeModel(this.currentModel); // Libera geometría/materiales
            this.currentModel = null;
        }
    }

    /** Inicia el bucle de renderizado/animación */
    startAnimation() {
        // ... (sin cambios respecto a tu versión anterior)
        if (!this.isInitialized()) {
             console.warn("ProductSceneService: Cannot start animation - not initialized.");
             return;
        }
        if (this.animateActive) return;

        console.log("ProductSceneService: Starting animation loop.");
        this.animateActive = true;
        const loop = () => {
           if (!this.animateActive) return;
           this.frameId = requestAnimationFrame(loop);
           this.controls?.update(); // ESENCIAL para damping y auto-rotación
           if(this.renderer && this.scene && this.camera) {
              this.renderer.render(this.scene, this.camera);
           }
        };
        loop();
    }

    /** Detiene el bucle de animación */
    stopAnimation() {
        // ... (sin cambios respecto a tu versión anterior)
        if (!this.animateActive) return;
        this.animateActive = false;
        cancelAnimationFrame(this.frameId);
    }

    /** Devuelve true si el bucle de animación está activo */
    isAnimating(): boolean { return this.animateActive; }

    /** Devuelve true si el servicio está inicializado y listo para usarse */
    public isInitialized(): boolean { return this.initialized && !!this.renderer && !!this.scene && !!this.camera && !!this.controls; }

    /** Ajusta el tamaño del renderer y la cámara si el canvas cambia de tamaño */
    onResize(canvas: HTMLCanvasElement) {
        // ... (sin cambios respecto a tu versión anterior)
         if (!this.isInitialized() || !canvas) return;
         const width = canvas.clientWidth;
         const height = canvas.clientHeight;
         if (width === 0 || height === 0) return;

         if (this.renderer && (canvas.width !== width || canvas.height !== height)) {
            this.renderer.setSize(width, height, false);
         }
         if (this.camera) {
             this.camera.aspect = width / height;
             this.camera.updateProjectionMatrix();
         }
    }

    /** Libera geometría y materiales de un modelo 3D recursivamente */
    private disposeModel(model: THREE.Object3D | null) {
        // ... (sin cambios respecto a tu versión anterior)
         if (!model) return;
         model.traverse((object: any) => {
             if (object.isMesh) {
                 object.geometry?.dispose();
                 if (object.material) {
                     if (Array.isArray(object.material)) {
                         object.material.forEach((material: THREE.Material) => this.disposeMaterial(material));
                     } else {
                         this.disposeMaterial(object.material);
                     }
                 }
             }
         });
    }

    /** Libera un material y sus texturas asociadas */
    private disposeMaterial(material: THREE.Material | null) {
        // ... (sin cambios respecto a tu versión anterior)
         if (!material) return;
         material.dispose();
         for (const key of Object.keys(material)) {
             const value = (material as any)[key];
             if (value && typeof value === 'object' && 'isTexture' in value) { // Chequeo más seguro para texturas
                 (value as THREE.Texture).dispose();
             }
         }
    }
} // Fin ProductSceneService