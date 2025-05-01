import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

@Injectable({
    providedIn: 'root',
})
export class OrbitControlsService {
    private controls!: OrbitControls;
    private maxPanDistance: number = 500;
    private panCenter: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

    /**
     * Configura los controles orbitales para una escena de Three.js.
     * @param camera Cámara principal de la escena. 
     * @param rendererElement Elemento DOM del renderizador.
     */
    configureControls(
        camera: THREE.PerspectiveCamera,
        rendererElement: HTMLCanvasElement
    ): OrbitControls {
        this.controls = new OrbitControls(camera, rendererElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.1;
        this.controls.enablePan = true;
        // Permite acercarse lo más posible
        this.controls.minDistance = 0;
        this.controls.maxDistance = 550;
        this.controls.screenSpacePanning = false;
        // Evita que la cámara se mueva por debajo del horizonte
        this.controls.maxPolarAngle = Math.PI / 2;
        // Configuración de botones del mouse:
        this.controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
        };
        this.controls.addEventListener('change', () => {
            this.limitPan();
        });
        return this.controls;
    }


    /**
     * Limita el panning para que el target no se aleje más allá de un radio definido a partir del centro.
     */
    private limitPan(): void {
        const currentTarget = this.controls.target.clone();
        currentTarget.y = 0;
        const offset = new THREE.Vector3().subVectors(currentTarget, this.panCenter);
        const distance = offset.length();
        if (distance > this.maxPanDistance) {
            offset.normalize().multiplyScalar(this.maxPanDistance);
            this.controls.target.set(
                this.panCenter.x + offset.x,
                this.controls.target.y,
                this.panCenter.z + offset.z
            );
        }
    }
}
