import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ModeloIndicador } from '../models/indicator.model';
import { CameraService } from '../services/camera.service';
  

/**
 * Reposiciona la cámara para centrarla en el indicado r especificado.
 * @param index Índice del indicador en el arreglo indicators.
 */
export function goToIndicator(
  index: number,
  indicators: ModeloIndicador[],
  cameraService: CameraService,
  controls: OrbitControls
): void {
  if (indicators.length > index && indicators[index].model) {
    const indicatorPos = new THREE.Vector3();
    indicators[index].model.getWorldPosition(indicatorPos);
    controls.target.copy(indicatorPos);
    const direction = new THREE.Vector3();
    cameraService.getActiveCamera().getWorldDirection(direction);
    direction.multiplyScalar(-10);
    cameraService.getActiveCamera().position.copy(indicatorPos.clone().add(direction));
    controls.update();
  }
}
 