// src/app/pages/inicio/services/territory-interaction.service.ts // O la ruta correcta
import { Injectable, ElementRef } from '@angular/core';
import { BehaviorSubject, Subject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment'; // Ajusta ruta
import { ZoneData } from '../../features/campiamigo/services/campiAmigoZones.service'; // Ajusta ruta
import { TerritorySceneService } from './territory-scene.service';

export interface TerritoryState {
    activeZone: ZoneData | null;
    isLoading: boolean;
    modelsReady: boolean;
    isLoaded: boolean;
}

export interface TerritoryInteractionEvent {
    type: 'requestProductDeactivation' | 'statusUpdate' | 'error';
    message?: string;
    details?: any;
}

@Injectable({
    providedIn: 'root'
})
export class TerritoryInteractionService {

    private state = new BehaviorSubject<TerritoryState>({
        activeZone: null, isLoading: false, modelsReady: false, isLoaded: false,
    });
    public state$: Observable<TerritoryState> = this.state.asObservable();

    private events = new Subject<TerritoryInteractionEvent>();
    public events$: Observable<TerritoryInteractionEvent> = this.events.asObservable();

    private isPreloadingInBackground = false;
    private terrainCanvasElement: HTMLCanvasElement | null = null; // Se establece en initialize
    private baseAssetUrl = environment.endpoint.endsWith('/') ? environment.endpoint : environment.endpoint + '/';

    constructor(
        private territorySceneService: TerritorySceneService,
    ) { }

    // --- Initialization ---
    /**
     * Inicializa el servicio con la referencia al elemento Canvas.
     * Este es el punto donde el servicio sabe que puede empezar a interactuar con el canvas.
     * Si ya había una zona activa esperando, inicia la precarga aquí.
     */
    public initialize(canvasRef: ElementRef<HTMLCanvasElement>): void {
        if (canvasRef && canvasRef.nativeElement) {
            if (!this.terrainCanvasElement) { // Evitar reinicializar si ya tiene el canvas
                this.terrainCanvasElement = canvasRef.nativeElement;
                console.log("TerritoryInteractionService Initialized with Canvas.");

                // *** LÓGICA CLAVE AQUÍ ***
                // Después de obtener el canvas, verifica si hay una zona activa esperando precarga
                const currentState = this.state.getValue();
                if (currentState.activeZone && this.zoneHasModels(currentState.activeZone) && !currentState.modelsReady && !currentState.isLoading) {
                    console.log(`Initialization: Triggering preload for waiting active zone: ${currentState.activeZone.name}`);
                    // Usamos setTimeout para asegurar que la inicialización actual termine antes de empezar la carga
                    setTimeout(() => this.preloadModels(currentState.activeZone!), 0);
                }
            }
        } else {
            console.error("TerritoryInteractionService: Canvas reference provided during initialization is invalid.");
            this.emitEvent({ type: 'error', message: 'Canvas no disponible para inicializar servicio de interacción.' });
        }
    }

    /**
     * Limpia la referencia interna al canvas. Debe ser llamado
     * cuando el componente que lo proporcionó se destruye.
     */
    public clearCanvasReference(): void {
        console.log("TerritoryInteractionService: Clearing canvas reference.");
        this.terrainCanvasElement = null;
        // Opcional: También podrías resetear el estado aquí si tiene sentido
        // this.updateState({ activeZone: null, isLoading: false, modelsReady: false, isLoaded: false });
    }



    /**
     * Establece la zona activa. Si el servicio ya está inicializado (tiene el canvas),
     * y la zona tiene modelos, inicia la precarga. Si no, solo actualiza el estado.
     */
    public setActiveZone(zone: ZoneData | null): void {
        const currentState = this.state.getValue();
        if (currentState.activeZone?.id === zone?.id && currentState.activeZone !== null) return;

        console.log(`setActiveZone called for: ${zone?.name ?? 'null'}. Canvas set: ${!!this.terrainCanvasElement}`);

        // Siempre actualiza el estado y desactiva vistas anteriores
        this.updateState({ activeZone: zone, isLoaded: false, modelsReady: false, isLoading: false });
        this.deactivateView();
        this.emitEvent({ type: 'requestProductDeactivation' });

        if (zone && this.zoneHasModels(zone)) {
            // *** MODIFICACIÓN CLAVE AQUÍ ***
            // Solo intentar precargar SI el servicio ya tiene la referencia al canvas
            if (this.terrainCanvasElement && !this.isPreloadingInBackground) {
                console.log(`setActiveZone: Canvas is set. Triggering preload for ${zone.name}`);
                // Usamos setTimeout para desacoplar de la llamada actual si es necesario
                setTimeout(() => this.preloadModels(zone!), 0);
            } else if (!this.terrainCanvasElement) {
                console.log(`setActiveZone: Canvas NOT set yet for ${zone.name}. Preload will be triggered by initialize().`);
                // No hacemos nada aquí, initialize() se encargará cuando reciba el canvas
            }
        } else if (zone && !this.zoneHasModels(zone)) {
            // Si no tiene modelos, marcar como listo inmediatamente
            this.updateState({ modelsReady: true });
        } else {
            // Si zone es null, resetear
            this.updateState({ modelsReady: false, isLoading: false, isLoaded: false });
        }
    }

    public handleCanvasClick(): void {
        const currentState = this.state.getValue();

        if (!currentState.activeZone) {
            this.emitEvent({ type: 'statusUpdate', message: 'Selecciona una zona primero.', details: { level: 'warning' } });
            return;
        }
        if (!this.zoneHasModels(currentState.activeZone)) {
            this.emitEvent({ type: 'statusUpdate', message: 'Zona sin modelo 3D disponible.', details: { level: 'info' } });
            this.deactivateView();
            return;
        }

        // Asegurarse que el servicio esté inicializado antes de actuar sobre el clic
        if (!this.terrainCanvasElement) {
            console.error("handleCanvasClick: Interaction service not initialized with canvas yet!");
            this.emitEvent({ type: 'error', message: 'Error interno: Vista 3D no lista.' });
            return;
        }

        if (currentState.modelsReady && !currentState.isLoaded) {
            this.showAndAnimate();
        } else if (currentState.isLoaded) {
            this.emitEvent({ type: 'statusUpdate', message: 'Modelo 3D ya visible.', details: { level: 'info' } });
        } else if (currentState.isLoading || this.isPreloadingInBackground) {
            this.emitEvent({ type: 'statusUpdate', message: 'Modelo 3D aún no está listo...', details: { level: 'info', title: 'Preparando' } });
        } else {
            // No está listo, no está cargando -> Iniciar carga ahora (por clic)
            this.emitEvent({ type: 'requestProductDeactivation' });
            this.updateState({ isLoading: true });
            this.preloadModels(currentState.activeZone).then(() => {
                const finalState = this.state.getValue();
                if (finalState.modelsReady) { // Verificar si terminó exitosamente
                    this.emitEvent({ type: 'statusUpdate', message: 'Modelo 3D preparado. Clic de nuevo para verlo.', details: { level: 'success', title: 'Listo' } });
                }
                // isLoading se resetea en el finally de preloadModels
            }).catch(err => {
                // El error ya se maneja dentro de preloadModels (emite evento), pero aseguramos isLoading=false
                this.updateState({ isLoading: false });
            });
        }
    }

    /**
     * Precarga los modelos. AHORA ASUME que this.terrainCanvasElement ya está establecido
     * porque solo se llama desde lugares donde debería estarlo (initialize o setActiveZone/handleCanvasClick después de initialize).
     */
    public async preloadModels(zoneToPreload: ZoneData): Promise<void> {
        // *** YA NO ES NECESARIO EL CHECK PRINCIPAL AQUÍ, SE HACE EN initialize/setActiveZone ***
        // if (!this.terrainCanvasElement) {
        //     console.error("preloadModels called before canvas element was set!");
        //     this.emitEvent({ type: 'error', message: 'Error interno al precargar modelo.' });
        //     throw new Error("TerritoryInteractionService: Canvas element not set before preloading."); // Lanzar error para detener
        // }
        // PERO mantenemos un check por si acaso algo sale muy mal
        if (!this.terrainCanvasElement) {
            console.error("CRITICAL: preloadModels called without canvas element!");
            this.emitEvent({ type: 'error', message: 'Fallo crítico al cargar modelo 3D.' });
            this.updateState({ isLoading: false, modelsReady: false }); // Asegurar estado consistente
            return; // Salir para evitar más errores
        }


        const currentState = this.state.getValue();
        const isActiveZone = currentState.activeZone?.id === zoneToPreload.id;

        if (!this.zoneHasModels(zoneToPreload)) {
            if (isActiveZone) this.updateState({ modelsReady: true, isLoading: false });
            return;
        }

        // Evitar recargas concurrentes o si ya está listo
        if ((isActiveZone && currentState.modelsReady) || this.isPreloadingInBackground) {
            if (!isActiveZone || !currentState.modelsReady) {
                // console.log("Preload skipped: Already preloading or models ready for active zone.");
            }
            return;
        }

        this.isPreloadingInBackground = true;
        // Marcar modelsReady = false solo si es la zona activa la que se va a cargar/recargar
        if (isActiveZone) {
            this.updateState({ modelsReady: false }); // isLoading ya está marcado si fue por handleCanvasClick
        }
        console.log(`Preloading models for zone: ${zoneToPreload.name}`);

        try {
            // Asegurar inicialización del SERVICIO DE ESCENA (puede ser la primera vez que se usa)
            if (!this.territorySceneService.isInitialized()) {
                if (this.terrainCanvasElement.isConnected) {
                    await this.ensureCanvasIsReady(this.terrainCanvasElement); // Asegurar dimensiones
                    await this.territorySceneService.init(this.terrainCanvasElement, this.baseAssetUrl);
                    console.log("Territory Scene Service initialized during preload.");
                } else {
                    throw new Error("Canvas not connected during preload initialization attempt.");
                }
            } else {
                // Si ya está inicializado, limpiar modelos anteriores
                this.territorySceneService.clearModels();
            }

            // Cargar modelos
            await this.territorySceneService.loadModels(zoneToPreload.modelPath, zoneToPreload.titleGlb);
            console.log(`Models loaded successfully for zone: ${zoneToPreload.name}`);

            // Actualizar estado SI la zona cargada AÚN es la activa
            if (this.state.getValue().activeZone?.id === zoneToPreload.id) {
                this.updateState({ modelsReady: true });
            } else {
                console.log(`Models loaded for ${zoneToPreload.name}, but it's no longer the active zone.`);
                // No marcamos como listo si ya no es la zona activa
            }

        } catch (error) {
            console.error(`Error during PRELOAD for ${zoneToPreload.name}:`, error);
            // Si falló para la zona activa, marcar que no está listo y emitir error
            if (this.state.getValue().activeZone?.id === zoneToPreload.id) {
                this.updateState({ modelsReady: false }); // Ya estaba en false, pero reconfirmar
                this.emitEvent({ type: 'error', message: `Error cargando modelo 3D para ${zoneToPreload.name}.`, details: error });
            }
        } finally {
            this.isPreloadingInBackground = false;
            // Resetear isLoading SIEMPRE si era la zona activa la que se intentó cargar (por clic o inicial)
            if (this.state.getValue().activeZone?.id === zoneToPreload.id) {
                this.updateState({ isLoading: false });
            }
            // console.log(`Preloading finished for zone: ${zoneToPreload.name}. Final state for active zone:`, this.state.getValue());
        }
    }

    public showAndAnimate(): void {
        const currentState = this.state.getValue();
        // Añadir check de inicialización del servicio de interacción
        if (!this.terrainCanvasElement) {
            console.error("showAndAnimate: Interaction service not initialized!");
            return;
        }
        if (currentState.activeZone && this.zoneHasModels(currentState.activeZone) && currentState.modelsReady) {
            this.emitEvent({ type: 'requestProductDeactivation' });
            if (!currentState.isLoaded) {
                this.updateState({ isLoaded: true });
            }
            // Animación sólo si el servicio de escena está listo
            if (this.territorySceneService.isInitialized() && !this.territorySceneService.isAnimating()) {
                this.territorySceneService.startAnimation();
            } else if (!this.territorySceneService.isInitialized()) {
                console.error("Cannot animate: Territory Scene Service not initialized.");
                this.emitEvent({ type: 'error', message: 'Error al iniciar animación 3D.' });
            }
        } else {
            console.warn("showAndAnimate called but conditions not met:", currentState);
        }
    }

    public deactivateView(): void {
        const currentState = this.state.getValue();
        if (currentState.isLoaded) {
            this.updateState({ isLoaded: false });
        }
        if (this.territorySceneService.isInitialized() && this.territorySceneService.isAnimating()) {
            this.territorySceneService.stopAnimation();
        }
    }

    public zoneHasModels(zone: ZoneData | null): boolean {
        if (!zone) return false;
        return !!(zone.modelPath || zone.titleGlb);
    }

    private async ensureCanvasIsReady(canvasElement: HTMLCanvasElement): Promise<void> {
        let attempts = 0;
        const maxAttempts = 10;
        const delay = 50;
        while ((!canvasElement.clientWidth || !canvasElement.clientHeight) && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, delay));
            attempts++;
        }
        if (!canvasElement.clientWidth || !canvasElement.clientHeight) {
            console.error("Canvas dimensions not valid after waiting.", canvasElement);
            throw new Error("Canvas no tiene dimensiones válidas después de esperar.");
        }
    }

    private updateState(newState: Partial<TerritoryState>): void {
        this.state.next({ ...this.state.getValue(), ...newState });
    }

    private emitEvent(event: TerritoryInteractionEvent): void {
        this.events.next(event);
    }
}