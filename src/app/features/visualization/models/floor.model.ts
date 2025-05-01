import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as CANNON from 'cannon';

@Injectable({
  providedIn: 'root',
})
export class ModeloPisoService {
  public model?: THREE.Object3D; 
  public boundingBox?: THREE.Box3;
  public physicsBodyOffsetY: number = 0;

  loadGLTFModel(
    scene: THREE.Scene,
    modelPath: string,
    world: CANNON.World | null,
    startPosition?: THREE.Vector3,
    onLoaded?: () => void
  ): void {
    const loader = new GLTFLoader();
    loader.load(
      modelPath,
      (gltf) => {
        this.model = gltf.scene;
        if (startPosition) {
          this.model.position.set(startPosition.x, startPosition.y, startPosition.z);
        } else {
          this.model.position.set(0, 0, 0);
        }
        this.model.scale.set(0.01, 0.01, 0.01);
        scene.add(this.model);
        const bbox = new THREE.Box3().setFromObject(this.model);
        const shift = 50 - bbox.max.y;
        this.model.position.y += shift;
        this.boundingBox = new THREE.Box3().setFromObject(this.model);
        const size = new THREE.Vector3();
        this.boundingBox.getSize(size);
        const halfExtents = new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2);
        this.physicsBodyOffsetY = halfExtents.y;
        this.model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });
        if (world) {
          const physicsBody = new CANNON.Body({ mass: 1 });
          const boxShape = new CANNON.Box(halfExtents);
          physicsBody.addShape(boxShape, new CANNON.Vec3(0, halfExtents.y, 0));
          physicsBody.position.set(
            this.model.position.x,
            this.model.position.y,
            this.model.position.z
          );
          world.addBody(physicsBody);
        }
        if (onLoaded) onLoaded();
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + '% cargado');
      },
      (error) => {
        console.error('Error al cargar el modelo GLTF:', error);
      }
    );
  }
}
