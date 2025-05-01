import { Injectable } from '@angular/core';
import * as THREE from 'three';

@Injectable({
  providedIn: 'root',
})
export class LightingService {
  private hemisphereLight!: THREE.HemisphereLight;
  private nightLight!: THREE.SpotLight;
  private lightGroup!: THREE.Group;
  private rotationSpeed: number = 0.005; // Velocidad de rotación para animación
  private rotateSun: boolean = false;      // Flag para indicar si el sol rota

  // Colores para día y atardecer/amanecer:
  private daySkyColor: THREE.Color = new THREE.Color(0xffffff);   // Cielo de día (blanco brillante)
  private dayGroundColor: THREE.Color = new THREE.Color(0x444444);  // Suelo de día (gris oscuro)

  private sunsetSkyColor: THREE.Color = new THREE.Color(0xffd1a4);  // Cielo de atardecer/amanecer (naranja claro)
  private sunsetGroundColor: THREE.Color = new THREE.Color(0x331100); // Suelo de atardecer/amanecer (tonos cálidos)

  // Intensidad deseada para la luz nocturna
  private desiredNightIntensity: number = 1.0;

  // Método para agregar la luz hemisférica y la luz nocturna a la escena.
  // Se utiliza un grupo para agrupar ambas luces y facilitar la rotación.
  public addHemisphereLight(scene: THREE.Scene, modelCenter: THREE.Vector3): void {
    // Creamos el grupo y lo posicionamos en el centro del modelo (terreno)
    this.lightGroup = new THREE.Group();
    this.lightGroup.position.copy(modelCenter);

    // Creación de la luz hemisférica (simula el sol)
    this.hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 5.5);
    // Posicion inicial: por encima y adelantada
    this.hemisphereLight.position.set(0, 500, 500);
    this.lightGroup.add(this.hemisphereLight);

    // Creación de la luz nocturna (SpotLight) que solo ilumina hacia abajo
    // La intensidad se ajustará dinámicamente (0 cuando es de día, y aumenta de noche)
    this.nightLight = new THREE.SpotLight(0xffffff, 0);
    // Posicionar la luz directamente sobre el modelo (por ejemplo, 50 unidades en el eje Y)
    this.nightLight.position.set(0, 50, 0);
    // Configuramos el ángulo, penumbra y distancia para simular una luz que ilumine una parte del terreno
    this.nightLight.angle = Math.PI / 6;
    this.nightLight.penumbra = 0.5;
    this.nightLight.decay = 2;
    this.nightLight.distance = 100;
    // Para que la luz apunte hacia abajo, el target se coloca en el centro del modelo
    this.nightLight.target.position.set(0, 0, 0);
    // Agregamos la luz y su target al grupo
    this.lightGroup.add(this.nightLight);
    this.lightGroup.add(this.nightLight.target);

    // Agregamos el grupo de luces a la escena
    scene.add(this.lightGroup);
  }

  // Alterna el modo de rotación del sol (rotativo o fijo)
  public toggleSunRotation(): void {
    this.rotateSun = !this.rotateSun;
  }
  public isSunRotating(): boolean {
    return this.rotateSun;
  }
  
  // Este método se llama en cada frame para actualizar la iluminación.
  // Se ajustan la intensidad y el color de la luz hemisférica y se activa la luz nocturna cuando es de noche.
  public update(): void {
    if (this.lightGroup) {
      // Si el sol rota, actualizamos la rotación; si no, forzamos una posición fija (por ejemplo, sol en su punto máximo)
      if (this.rotateSun) {
        this.lightGroup.rotation.x += this.rotationSpeed;
      } else {
        this.lightGroup.rotation.x = Math.PI / 2;
      }

      // Calculamos el ángulo actual de rotación (eje X) normalizado entre 0 y 2π
      const angle = (this.lightGroup.rotation.x % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);

      // Definimos intensidades para el día y para la noche (usadas en la luz hemisférica)
      const dayIntensity = 3.5;
      const nightIntensity = 3.0;

      // Usamos una función coseno para suavizar la transición:
      // El máximo (sol en su punto más alto) ocurre en PI/2.
      let t = Math.cos(angle - Math.PI / 2);
      // Si t es negativo (el sol está "por debajo"), lo forzamos a 0
      t = Math.max(0, t);
      // Interpolamos la intensidad de la luz hemisférica de forma suave
      this.hemisphereLight.intensity = nightIntensity + (dayIntensity - nightIntensity) * t;

      // Interpolamos los colores del cielo y del suelo entre el día y el atardecer/amanecer
      let diff = Math.abs(angle - Math.PI / 2);
      if (angle > Math.PI) {
        diff = Math.abs(angle - (3 * Math.PI) / 2);
      }
      let colorFactor = THREE.MathUtils.clamp(1 - diff / (Math.PI / 2), 0, 1);
      this.hemisphereLight.color.copy(this.sunsetSkyColor).lerp(this.daySkyColor, colorFactor);
      this.hemisphereLight.groundColor.copy(this.sunsetGroundColor).lerp(this.dayGroundColor, colorFactor);

      // Aquí activamos la luz nocturna:
      // Cuando t es 0 (el sol no ilumina, es de noche) la luz nocturna tendrá su intensidad deseada,
      // y cuando t es 1 (día) se apagará.
      this.nightLight.intensity = this.desiredNightIntensity * (1 - t);
    }
  }
}