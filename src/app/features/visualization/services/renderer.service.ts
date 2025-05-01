import { Injectable } from '@angular/core';
import * as THREE from 'three';

@Injectable({
  providedIn: 'root',
})
export class RendererService {
  private renderer: THREE.WebGLRenderer;
 
  constructor() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true, // Suavizado de bordes
    });
    this.initRenderer();
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  private initRenderer(): void {
    // Tamaño inicial y limitación de devicePixelRatio
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Habilitar sombras y seleccionar PCFSoftShadowMap para suavidad
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Configuración de tone mapping y exposición para un mejor rango dinámico
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

   

    // Establecer color de fondo
    this.renderer.setClearColor(0x000000);
  }
 
  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  private onWindowResize(): void {
    // Ajuste dinámico del tamaño y devicePixelRatio al redimensionar la ventana
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }
}
