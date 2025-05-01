import { Injectable } from '@angular/core';
import * as THREE from 'three';

@Injectable({
    providedIn: 'root',
}) 
export class CameraService {
    private cameras: THREE.PerspectiveCamera[] = [];
    private activeCameraIndex: number = 0;
    private cameraInfoElement!: HTMLDivElement;

    constructor() { }

    // Método para crear el elemento de información de cámara
    initCameraInfo(container: HTMLElement): void {
        this.cameraInfoElement = document.createElement('div');
        Object.assign(this.cameraInfoElement.style, {
            display: 'none',
            position: 'absolute',
            top: '50px',
            margin: '5px',
            padding: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: '#fff',
            borderRadius: '5px',
            fontFamily: 'Arial, sans-serif',
            zIndex: '1000',
        });
        this.updateCameraDisplay();
        container.appendChild(this.cameraInfoElement);
    }


    // Actualizar el texto del indicador de cámara
    private updateCameraDisplay(): void {
        if (this.cameraInfoElement) {
            this.cameraInfoElement.innerHTML = `Cámara: ${this.activeCameraIndex + 1}`;
        }
    }

    // Método para cambiar de cámara con actualización de UI
    switchToNextCamera(): void {
        this.activeCameraIndex = (this.activeCameraIndex + 1) % this.cameras.length;
        this.updateCameraDisplay();
    }

    // Resto de métodos existentes
    createCamera(
        position: THREE.Vector3 = new THREE.Vector3(1, 1, 1),
        fov: number = 60,
        aspect: number = window.innerWidth / window.innerHeight,
        near: number = 1,
        far: number = 500000
    ): THREE.PerspectiveCamera {
        const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        camera.position.copy(position);
        this.cameras.push(camera);
        return camera;
    }

    createDefaultCameras(): void {
        this.createCamera(new THREE.Vector3(-550, 500, 500));
        this.createCamera(new THREE.Vector3(300, 300, -300));
        this.createCamera(new THREE.Vector3(200, 300, 200));
    }

    getActiveCamera(): THREE.PerspectiveCamera {
        return this.cameras[this.activeCameraIndex];
    }

    getCameras(): THREE.PerspectiveCamera[] {
        return this.cameras;
    }
}