// RUTA: src/app/components/inicio/utils/product-scene.service.ts
import { Injectable } from '@angular/core';
import { ThreeLoaderService } from './three-loader.service';
// Importa tipos específicos de Three.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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
    public currentModel: THREE.Group | null = null; // Modelo GLTF cargado

    // --- Estado Interno del Servicio ---
    private frameId: number = 0; // ID para cancelar requestAnimationFrame
    private animateActive = false; // Flag: ¿Está el bucle de animación activo?
    private isLoading = false; // Flag: ¿Se está cargando un modelo?
    private initialized = false; // Flag: ¿Se ha configurado la escena base?
    private currentCanvas: HTMLCanvasElement | null = null; // Referencia al canvas actual

    // --- Configuración Específica de Productos ---
    public productModels = [
        'assets/models3d/default.glb', // Modelo fallback en índice 0
        'assets/models3d/apples.glb',
        'assets/models3d/potatoes.glb',
        'assets/models3d/pumpkin.glb',
        // Añade aquí más rutas a tus modelos GLB de productos
    ];
    // Nombres opcionales (pueden ser útiles para debug)
    public productNames = ['Default', 'Manzanas', 'Papas', 'Calabaza'];
    public currentIndex = 0; // Índice del modelo actual en productModels
    readonly DESIRED_SIZE = 150; // Tamaño base para escalar modelos

    constructor(private loader: ThreeLoaderService) { }

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
     * Inicializa el servicio para un canvas específico. Crea Renderer y Controls por primera vez.
     * Llama a setupScene si es necesario.
     * @param canvas El elemento HTMLCanvasElement donde se renderizará.
     */
    async init(canvas: HTMLCanvasElement): Promise<void> {
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

        await this.setupScene();
        if (!this.scene || !this.camera) {
            console.error("ProductSceneService: Scene or Camera failed to setup.");
            throw new Error("Failed to setup Three.js scene components.");
        }

        this.controls?.dispose();

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
            alpha: true
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(width, height, false);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        // ***** ESTA ES LA CONFIGURACIÓN CLAVE *****
        this.controls = new this.OrbitControls(this.camera, this.renderer.domElement);
        Object.assign(this.controls, {
            enableDamping: true,        // Movimiento suave (recomendado)
            dampingFactor: 0.1,
            enableRotate: false,        // <-- MUY IMPORTANTE: Deshabilita rotación manual
            enablePan: false,           // Deshabilitar mover (arrastrar)
            enableZoom: true,           // <-- MUY IMPORTANTE: Permite el zoom
            minDistance: this.DESIRED_SIZE * 0.5, // Límite de acercamiento
            maxDistance: this.DESIRED_SIZE * 2.5, // Límite de alejamiento
            autoRotate: true,           // <-- MUY IMPORTANTE: Habilita la rotación automática
            autoRotateSpeed: 10.7,       // <-- MUY IMPORTANTE: Velocidad de rotación (ajusta si quieres)
        });
        // ******************************************

        this.controls.target.set(0, 0, 0); // Centro de rotación en el origen
        this.controls.update(); // Aplicar configuración inicial

        this.initialized = true;
        console.log(`ProductSceneService: Renderer & Controls ready. Auto-rotate: ${this.controls.autoRotate}, Manual Rotate: ${this.controls.enableRotate}`);
    }

    /**
     * Cambia el canvas de renderizado. Reconfigura Renderer y Controls para el nuevo canvas.
     * Llama a `init()` internamente para realizar la reconfiguración.
     * @param canvas El nuevo HTMLCanvasElement de destino.
     */
    async setRenderingTarget(canvas: HTMLCanvasElement): Promise<void> {
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
        // init AHORA aplicará la configuración correcta de OrbitControls (autoRotate: true, enableRotate: false)
        await this.init(canvas);
    }

    /**
     * Carga un modelo 3D basado en su índice en el array `productModels`.
     * @param index Índice del modelo a cargar (en this.productModels).
     */
    async loadModelByIndex(index: number): Promise<void> {
        if (!this.isInitialized()) {
            console.error("ProductSceneService: Cannot load model - service not fully initialized.");
            throw new Error("ProductSceneService is not ready to load models.");
        }
        if (this.isLoading) {
            console.warn("ProductSceneService: Model loading already in progress.");
            return;
        }
        if (index < 0 || index >= this.productModels.length) {
            console.warn(`ProductSceneService: Invalid model index ${index}. Loading default (0).`);
            index = 0;
        }

        this.isLoading = true;
        this.currentIndex = index;
        const modelPath = this.productModels[this.currentIndex];
        console.log(`ProductSceneService: Loading model index ${this.currentIndex} from ${modelPath}`);

        this.clearCurrentModel();
        this.stopAnimation(); // Pausar animación mientras carga

        const loader = new this.GLTFLoader();
        try {
            const gltf = await loader.loadAsync(modelPath);
            this.currentModel = gltf.scene;

            const box = new this.three.Box3().setFromObject(this.currentModel);
            const size = new this.three.Vector3();
            const center = new this.three.Vector3();
            box.getSize(size);
            box.getCenter(center);

            const maxDim = Math.max(size.x, size.y, size.z);
            let scale = 1;
            if (maxDim > 0) {
                scale = (this.DESIRED_SIZE * 0.8) / maxDim;
            }
            this.currentModel.scale.set(scale, scale, scale);

            const scaledBox = new this.three.Box3().setFromObject(this.currentModel);
            const scaledCenter = new this.three.Vector3();
            scaledBox.getCenter(scaledCenter);
            this.currentModel.position.sub(scaledCenter);

            this.scene!.add(this.currentModel);
            console.log(`ProductSceneService: Model loaded, scaled, centered.`);

            this.isLoading = false;
            // Asegurarse de que los controles estén actualizados ANTES de iniciar la animación
            this.controls?.update();
            this.startAnimation(); // <-- REANUDA la animación (y la auto-rotación)

        } catch (error) {
            console.error(`ProductSceneService: Error loading GLB model ${modelPath}:`, error);
            this.isLoading = false;
            this.currentModel = null;
            throw error; // Propaga el error
        }
    }

    /** Elimina el modelo actual de la escena y libera sus recursos */
    clearCurrentModel() {
        if (this.currentModel && this.scene) {
            // console.log("ProductSceneService: Clearing current model...");
            this.scene.remove(this.currentModel);
            this.disposeModel(this.currentModel);
            this.currentModel = null;
        }
    }

    /** Inicia el bucle de renderizado/animación */
    startAnimation() {
        if (!this.isInitialized()) {
             console.warn("ProductSceneService: Cannot start animation - not initialized.");
             return;
        }
        if (this.animateActive) {
            // console.log("ProductSceneService: Animation already active.");
            return;
        }

        console.log("ProductSceneService: Starting animation loop.");
        this.animateActive = true;
        const loop = () => {
            if (!this.animateActive) return; // Condición de parada

            this.frameId = requestAnimationFrame(loop); // Programa el siguiente frame

            // ***** ESTA LÍNEA ES ESENCIAL para damping Y auto-rotación *****
            this.controls?.update();
            // **************************************************************

            // Renderiza la escena (asegúrate de que renderer, scene y camera no sean null)
            if(this.renderer && this.scene && this.camera) {
               this.renderer.render(this.scene, this.camera);
            }
        };
        loop(); // Inicia el bucle
    }

    /** Detiene el bucle de animación */
    stopAnimation() {
        if (!this.animateActive) return;
        // console.log("ProductSceneService: Stopping animation loop.");
        this.animateActive = false;
        cancelAnimationFrame(this.frameId);
    }

    /** Devuelve true si el bucle de animación está activo */
    isAnimating(): boolean {
        return this.animateActive;
    }

    /** Devuelve true si el servicio está inicializado y listo para usarse */
    public isInitialized(): boolean {
        return this.initialized && !!this.renderer && !!this.scene && !!this.camera && !!this.controls;
    }

    /** Ajusta el tamaño del renderer y la cámara si el canvas cambia de tamaño */
    onResize(canvas: HTMLCanvasElement) {
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
        // console.log(`ProductSceneService: Resized to ${width}x${height}`);
    }

    /** Libera geometría y materiales de un modelo 3D recursivamente */
    private disposeModel(model: THREE.Object3D | null) {
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
        if (!material) return;
        material.dispose();
        for (const key of Object.keys(material)) {
            const value = (material as any)[key];
            if (value && typeof value === 'object' && value.isTexture) {
                (value as THREE.Texture).dispose();
            }
        }
    }
} // Fin ProductSceneService