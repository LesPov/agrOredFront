// #region -- COMIENZO DE user-status.service.ts (MODIFICADO) --
import { Injectable } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { jwtDecode } from 'jwt-decode';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserStatusService {
  // Inicializado con un valor más neutral o el valor por defecto si no hay token
  public status$ = new BehaviorSubject<string>('Desconocido'); 

  private allowedRoutes: { [role: string]: string[] } = {
    admin: ['/admin'],
    user: ['/user'],
    campesino: ['/campesino'], // Añadido rol campesino
    supervisor: ['/supervisor']
  };

  constructor(private router: Router, private http: HttpClient) {
    // Suscripción a los eventos de navegación para actualizar el estado
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.updateStatus(event.urlAfterRedirects);
      });

    // Cargar el estado inicial al arrancar el servicio (por si el usuario ya estaba logueado)
    // Esto se ejecuta una vez al inicio. El primer NavigationEnd también lo actualizará.
    this.updateStatus(this.router.url); 
  }

  updateStatus(currentUrl: string): void {
    const token = localStorage.getItem('token');
    let userRole = '';
    let newStatus = 'Desactivado'; // Por defecto, si no hay token o rol válido/ruta permitida

    if (token) {
      try {
        const payload: any = jwtDecode(token);
        userRole = payload.rol;

        // Comprobamos si el usuario está en una ruta permitida para su rol
        if (
          userRole &&
          this.allowedRoutes[userRole] &&
          this.allowedRoutes[userRole].some(route => currentUrl.startsWith(route))
        ) {
          newStatus = 'Activado';
        }
      } catch (error) {
        console.error('Error al decodificar el token o token inválido, asumiendo "Desactivado":', error);
        // Si el token es inválido, forzamos un logout. Esto previene un estado inconsistente.
        this.logoutUser(); 
        return; // Salir de la función después de logout
      }
    } else {
      // Si no hay token, el usuario está 'Desactivado'
      newStatus = 'Desactivado';
    }

    // Solo actualizamos y enviamos al backend si el estado ha cambiado
    if (this.status$.value !== newStatus) {
      console.log(`Cambiando estado de ${this.status$.value} a ${newStatus}`);
      this.status$.next(newStatus);
      this.updateStatusInBackend(newStatus);
    }
  }

  updateStatusInBackend(newStatus: string): void {
    const token = localStorage.getItem('token') || '';
    if (!token) {
      console.warn('No hay token disponible para actualizar el estado en backend. Redirigiendo al login...');
      this.logoutUser();
      return;
    }

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });

    this.http.put(`${environment.endpoint}auth/user/updateStatus`, { status: newStatus }, { headers })
      .subscribe({
        next: (res) => console.log('Estado de autenticación actualizado en BD', res),
        error: (err) => {
          console.error('Error al actualizar el estado en BD:', err);
          // Si hay un error de autorización (401), el token es inválido/expirado
          if (err.status === 401 || err.status === 403) { 
            console.warn('Token inválido o expirado al intentar actualizar el estado. Cerrando sesión...');
            this.logoutUser();
          }
          // Manejar otros errores si es necesario
        }
      });
  }

  // Método para cerrar sesión (llamado por IdleService o por error de token)
  logoutUser(): void {
    console.log('Ejecutando logoutUser: Limpiando localStorage y redirigiendo a /login.');
    localStorage.clear();
    this.status$.next('Desactivado'); // Asegurar que el estado sea 'Desactivado' al cerrar sesión
    this.router.navigate(['/login']);
  }
}
// #endregion -- FIN DE user-status.service.ts --