// #region -- COMIENZO DE idle.service.ts (MODIFICADO) --
import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { fromEvent, merge, Subscription, timer } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { UserStatusService } from '../../../features/admin/services/user-status.service'; // Asegúrate de que esta ruta sea correcta

@Injectable({
  providedIn: 'root'
})
export class IdleService {
  // MODIFICADO: Tiempo de inactividad en milisegundos (ej. 60 segundos para probar)
  // ¡RECORDATORIO!: En producción, este valor debería ser más alto (ej. 5-15 minutos = 300000 a 900000 ms)
  private inactivityTime: number = 600000; 

  private timerSubscription: Subscription = new Subscription();
  private activitySubscription: Subscription = new Subscription();

  constructor(
    private router: Router,
    private ngZone: NgZone,
    private toastr: ToastrService,
    private userStatusService: UserStatusService // Ya lo inyectas
  ) {
    this.initializeListener();
  }

  private initializeListener(): void {
    // Eventos que reinician el contador de inactividad
    const activityEvents = merge(
      fromEvent(document, 'mousemove'),
      fromEvent(document, 'keydown'),
      fromEvent(document, 'click'),
      fromEvent(document, 'scroll'),
      fromEvent(document, 'touchstart') // Para dispositivos táctiles
    );

    // Suscribe a los eventos de actividad para reiniciar el temporizador
    this.activitySubscription = activityEvents.subscribe(() => {
      this.resetTimer();
    });

    // Inicia el temporizador de inactividad
    this.startTimer();
  }

  private startTimer(): void {
    // Si ya hay un temporizador activo, lo cancela
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
    }

    // Inicia un nuevo temporizador
    this.timerSubscription = timer(this.inactivityTime).subscribe(() => {
      // ngZone.run asegura que el código dentro se ejecuta en la zona de Angular
      // para que la detección de cambios y las notificaciones funcionen correctamente.
      this.ngZone.run(() => {
        this.logoutUser();
      });
    });
  }

  private resetTimer(): void {
    // Simplemente reinicia el temporizador (llamando a startTimer, que lo limpia antes)
    this.startTimer();
  }

  private logoutUser(): void {
    console.warn('Inactividad detectada. Cerrando sesión...');
    // Llama al servicio de estado de usuario para actualizar el backend
    // y para realizar el logout definitivo (limpiar localStorage y navegar).
    this.userStatusService.updateStatusInBackend('Desactivado'); // Informa al backend
    this.toastr.info('Sesión expirada por inactividad'); // Muestra notificación
    
    // **Importante:** Llamar al logoutUser de UserStatusService que ya limpia el localStorage y navega.
    // Esto asegura que la lógica de limpieza y navegación esté centralizada en un solo lugar.
    this.userStatusService.logoutUser();
  }

  // Método para limpiar suscripciones al destruir el servicio (si fuera un componente)
  // Aunque es un servicio `providedIn: 'root'`, buena práctica si se usara en un ámbito menor.
  ngOnDestroy(): void {
    this.timerSubscription.unsubscribe();
    this.activitySubscription.unsubscribe();
  }
}
// #endregion -- FIN DE idle.service.ts --