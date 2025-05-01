import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as CANNON from 'cannon';

@Injectable({
  providedIn: 'root',
})
export class ModeloIndicador {
  public model?: THREE.Object3D;
  public physicsBody?: CANNON.Body; 
  public boundingBox?: THREE.Box3;
  private animationTime: number = 0;
  public currentColor: string = 'white';

  loadGLTFModel(
    scene: THREE.Scene,
    modelPath: string,
    world: CANNON.World,
    startPosition?: THREE.Vector3,
    verticalOffset: number = 10,
    onLoaded?: () => void
  ): void {
    const loader = new GLTFLoader();
    loader.load(
      modelPath,
      (gltf) => {
        this.model = gltf.scene;
        if (startPosition) {
          this.model.position.copy(startPosition);
        } else {
          this.model.position.set(2.5, 13, 5.5);
        }
        this.model.position.y += verticalOffset;
        this.model.scale.set(0.2, 0.2, 0.2);
        scene.add(this.model);
        console.log('Indicador cargado:', this.model);

        // Calcular el bounding box del modelo
        this.boundingBox = new THREE.Box3().setFromObject(this.model);
        const size = new THREE.Vector3();
        this.boundingBox.getSize(size);
        const center = new THREE.Vector3();
        this.boundingBox.getCenter(center);

        // Crear un mesh invisible que cubra todo el bounding box
        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const material = new THREE.MeshBasicMaterial({ 
          color: 0xffffff, 
          transparent: true, 
          opacity: 0 // Totalmente invisible
        });
        const pickingMesh = new THREE.Mesh(geometry, material);
        pickingMesh.position.copy(center);
        pickingMesh.name = 'pickingMesh';
        this.model.add(pickingMesh);

        // Configurar el cuerpo físico sin offset vertical para que coincida con la base del modelo
        const halfExtents = new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2);
        this.physicsBody = new CANNON.Body({ mass: 0 });
        // Se elimina el offset: se usa (0, 0, 0) en lugar de (0, halfExtents.y, 0)
        this.physicsBody.addShape(new CANNON.Box(halfExtents), new CANNON.Vec3(0, 0, 0));
        this.physicsBody.position.set(
          this.model.position.x,
          this.model.position.y,
          this.model.position.z
        );
        world.addBody(this.physicsBody);
        
        if (onLoaded) onLoaded();
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + '% cargado para el indicador');
      },
      (error) => {
        console.error('Error al cargar el modelo GLTF del indicador:', error);
      }
    );
  }

  public setPosition(x: number, y: number, z: number): void {
    if (this.model) {
      this.model.position.set(x, y, z);
    }
    if (this.physicsBody) {
      this.physicsBody.position.set(x, y, z);
    }
  }

  public getPosition(): THREE.Vector3 {
    return this.model?.position.clone() || new THREE.Vector3();
  }

  update(delta: number, activeCamera: THREE.Camera, editMode: boolean = false): void {
    if (this.model) {
      // Si no estamos en modo edición, se actualiza la animación de rotación
      if (!editMode) {
        this.animationTime += delta;
        this.model.rotation.y += delta * (Math.PI / 2);
      }
      // Ajustar la escala: si se está editando, se mantiene una escala base sin pulsación
      const baseScale = 0.3;
      const amplitude = 0.3;
      const pulsateScale = (!editMode) ? baseScale + amplitude * Math.sin(2 * this.animationTime) : baseScale;

      const indicatorPos = new THREE.Vector3();
      this.model.getWorldPosition(indicatorPos);
      const camPos = new THREE.Vector3();
      activeCamera.getWorldPosition(camPos);
      const distance = indicatorPos.distanceTo(camPos);

      const minDistance = 1;
      const maxDistance = 60;
      const minFactor = 0.;
      const maxFactor = 0.8;
      let distanceFactor: number;
      if (distance <= minDistance) {
        distanceFactor = minFactor;
      } else if (distance >= maxDistance) {
        distanceFactor = maxFactor;
      } else {
        const t = (distance - minDistance) / (maxDistance - minDistance);
        distanceFactor = THREE.MathUtils.lerp(minFactor, maxFactor, t);
      }

      const finalScale = pulsateScale * distanceFactor;
      this.model.scale.set(finalScale, finalScale, finalScale);
    }
  }

  setColor(color: string | THREE.Color): void {
    if (this.model) {
      this.model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach(mat => {
                if (mat instanceof THREE.MeshBasicMaterial ||
                    mat instanceof THREE.MeshStandardMaterial ||
                    mat instanceof THREE.MeshPhongMaterial) {
                  mat.color.set(color);
                  mat.needsUpdate = true;
                }
              });
            } else {
              if (mesh.material instanceof THREE.MeshBasicMaterial ||
                  mesh.material instanceof THREE.MeshStandardMaterial ||
                  mesh.material instanceof THREE.MeshPhongMaterial) {
                mesh.material.color.set(color);
                mesh.material.needsUpdate = true;
              }
            }
          }
        }
      });
      this.currentColor = typeof color === 'string' ? color : color.getStyle();
      console.log('Se actualizó el color del indicador a:', this.currentColor);
    }
  }
}
