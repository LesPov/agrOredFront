import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

@Injectable({
  providedIn: 'root',
})
export class ModeloLetras {
  public model?: THREE.Object3D;
  public boundingBox?: THREE.Box3;

  private fadeDistance: number = 50;
  private minDistance: number = 10;

  /**
   * Carga el modelo GLTF de las letras, lo centra y lo escala.
   * @param scene La escena donde se agrega el modelo.
   * @param modelPath Ruta del modelo GLTF.
   * @param onLoaded Callback opcional que se ejecuta cuando la carga finaliza.
   */
  loadGLTFModel(
    scene: THREE.Scene,
    modelPath: string,
    onLoaded?: () => void
  ): void {
    const loader = new GLTFLoader();
    loader.load(
      modelPath,
      (gltf) => {
        this.model = gltf.scene;
        
        // Crear un grupo que actuará como pivote
        const pivot = new THREE.Group();
        pivot.position.set(0, 80, 0);
        
        // Calcular la bounding box para centrar el modelo
        const bbox = new THREE.Box3().setFromObject(this.model);
        const center = bbox.getCenter(new THREE.Vector3());
        // Ajustar la posición del modelo para centrarlo en el grupo
        this.model.position.sub(center);
    
        // Añadir el modelo al grupo
        pivot.add(this.model);
        
        // Ajustes adicionales de rotación y escala
        pivot.rotation.set(0, 0, 5);
        pivot.scale.set(15, 15, 15);
    
        // Agregar el grupo a la escena
        scene.add(pivot);
        
        // Usar el grupo como el objeto a actualizar
        this.model = pivot;
        
        console.log('Modelo de letras cargado y centrado:', this.model);
        if (onLoaded) {
          onLoaded();
        }
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + '% cargado para las letras');
      },
      (error) => {
        console.error('Error al cargar el modelo GLTF de letras:', error);
      }
    );
  }

  /**
   * Actualiza la rotación y la opacidad para que el modelo "mire" a la cámara.
   * @param camera La cámara activa de la escena.
   */
  update(camera: THREE.Camera): void {
    if (this.model) {
      const modelPos = new THREE.Vector3();
      this.model.getWorldPosition(modelPos);
      const cameraPos = new THREE.Vector3();
      camera.getWorldPosition(cameraPos);

      // Calcular la dirección hacia la cámara (ignorando la componente Y)
      const direction = new THREE.Vector3(
        cameraPos.x - modelPos.x,
        0,
        cameraPos.z - modelPos.z
      ).normalize();

      let angle = Math.atan2(direction.x, direction.z);
      const offset = -Math.PI / 2;
      angle += offset;
      this.model.rotation.y = angle;

      // Calcular la opacidad en función de la distancia
      const distance = cameraPos.distanceTo(modelPos);
      let opacity = 1;
      if (distance < this.minDistance) {
        opacity = 0;
      } else if (distance < this.fadeDistance) {
        opacity = (distance - this.minDistance) / (this.fadeDistance - this.minDistance);
      }
      
      // Actualizar la opacidad en cada mesh
      this.model.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => {
              mat.color.set(0xffffff);
              mat.transparent = true;
              mat.opacity = opacity;
            });
          } else {
            child.material.color.set(0xffffff);
            child.material.transparent = true;
            child.material.opacity = opacity;
          }
        }
      });
    }
  }
}
