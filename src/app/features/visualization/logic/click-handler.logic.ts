import * as THREE from 'three';

import { Subject } from 'rxjs';
 import { ModeloIndicador } from '../models/indicator.model';
import { CameraService } from '../services/camera.service';
 
/**
 * Manejador del evento "click" para detectar si se hizo clic en algún indicador.
 * Emite el índice del indicador clickeado a través del Subject.
 */
export function onClick(
  event: MouseEvent,
  renderer: THREE.WebGLRenderer,
  cameraService: CameraService,
  indicators: ModeloIndicador[],
  indicatorClick$: Subject<number> 
): void {
  if (event.shiftKey) {
    return;
  }
  const rect = renderer.domElement.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, cameraService.getActiveCamera());

  for (let i = 0; i < indicators.length; i++) {
    const indicator = indicators[i];
    if (indicator.model) {
      const intersects = raycaster.intersectObject(indicator.model, true);
      if (intersects.length > 0) {
        indicatorClick$.next(i);
        break;
      }
    }
  }
}
