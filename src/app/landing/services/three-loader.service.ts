import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThreeLoaderService {
  /** Carga dinámica de los módulos de Three.js */
  async loadModules() {
    const three = await import('three');
    const { GLTFLoader } = await import(
      'three/examples/jsm/loaders/GLTFLoader.js'
    );
    const { OrbitControls } = await import(
      'three/examples/jsm/controls/OrbitControls.js'
    );
    const { DRACOLoader } = await import(
      'three/examples/jsm/loaders/DRACOLoader.js'
    );

    return { three, GLTFLoader, OrbitControls, DRACOLoader };
  }
}
