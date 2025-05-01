import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
 import { ModeloPisoService } from '../models/floor.model';
import { CameraService } from '../services/camera.service';


/**
 * Manejador del evento "mousedown" para realizar panning cuando se presiona Shift + clic izquierdo.
 * Realiza un raycast para determinar el punto de interacción en el modelo principal y mueve la cámara.
 */
export function onMouseDown(
  event: MouseEvent,
  renderer: THREE.WebGLRenderer,
  cameraService: CameraService,
  modelo1: ModeloPisoService,
  controls: OrbitControls
): void {
  if (event.shiftKey && event.button === 0) {
    event.preventDefault();
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraService.getActiveCamera());
    if (modelo1.model) {
      const intersects = raycaster.intersectObject(modelo1.model, true);
      if (intersects.length > 0) {
        const point = intersects[0].point;
        const currentCamera = cameraService.getActiveCamera();
        const currentTarget = controls.target.clone();
        const newTarget = new THREE.Vector3(point.x, currentTarget.y, point.z);
        const translation = new THREE.Vector3().subVectors(newTarget, currentTarget);
        controls.target.copy(newTarget);
        currentCamera.position.add(translation);
      }
    }
  }
}
