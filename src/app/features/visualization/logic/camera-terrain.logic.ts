 
import * as THREE from 'three';
import { ModeloPisoService } from '../models/floor.model';
import { CameraService } from '../services/camera.service';

/**
 * Ajusta la posición de la cámara para que no se hunda bajo el terreno.
 * Realiza un raycast desde arriba del modelo principal para obtener la altura del terreno.
 */
export function clampCameraToTerrain(
  modelo1: ModeloPisoService,
  cameraService: CameraService
): void {
  if (modelo1.model) {
    const camera = cameraService.getActiveCamera();
    const rayOrigin = new THREE.Vector3(camera.position.x, 10000, camera.position.z);
    const rayDirection = new THREE.Vector3(0, -1, 0);
    const raycaster = new THREE.Raycaster(rayOrigin, rayDirection);
    const intersects = raycaster.intersectObject(modelo1.model, true);
    if (intersects.length > 0) {
      const terrainY = intersects[0].point.y;
      const margin = 1;
      if (camera.position.y < terrainY + margin) {
        camera.position.y = terrainY + margin;
      }
    }
  }
}
