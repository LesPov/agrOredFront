import { Injectable } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {jwtDecode} from 'jwt-decode';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserStatusService {
  public status$ = new BehaviorSubject<string>('Desactivado');

  private allowedRoutes: { [role: string]: string[] } = {
    admin: ['/admin'],
    user: ['/user'],
    supervisor: ['/supervisor']
  };

  constructor(private router: Router, private http: HttpClient) {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.updateStatus(event.urlAfterRedirects);
      });
  } 

  updateStatus(currentUrl: string): void {
    const token = localStorage.getItem('token');
    let userRole = '';

    if (token) {
      try {
        const payload: any = jwtDecode(token);
        userRole = payload.rol;
      } catch (error) {
        console.error('Error al decodificar el token', error);
      }
    }

    let newStatus = 'Desactivado';
    if (
      userRole &&
      this.allowedRoutes[userRole] &&
      this.allowedRoutes[userRole].some(route => currentUrl.startsWith(route))
    ) {
      newStatus = 'Activado';
    }

    if (this.status$.value !== newStatus) {
      this.status$.next(newStatus);
      this.updateStatusInBackend(newStatus);

      if (newStatus === 'Desactivado' && currentUrl !== '/login') {
        this.logoutUser();
      }
    }
  }

  updateStatusInBackend(newStatus: string): void {
    const token = localStorage.getItem('token') || '';

    if (!token) {
      console.warn('No hay token disponible. Redirigiendo al login...');
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
          console.error('Error al actualizar el estado en BD', err);
          if (err.status === 401) {
            console.warn('Token inválido o expirado. Cerrando sesión...');
            this.logoutUser();
          }
        }
      });
  }

  logoutUser(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}
