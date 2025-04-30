/**
 * Componente de Login
 * 
 * Este componente gestiona el inicio de sesión de los usuarios.  
 * Se encarga de validar los campos de entrada, llamar al servicio de autenticación,
 * gestionar el almacenamiento del token y la redirección según el rol del usuario.
 * 
 * Notas importantes:
 * - Se utiliza el servicio 'authService' para interactuar con el backend.
 * - Se utiliza 'ToastrService' para mostrar notificaciones de éxito o error.
 * - La lógica de redirección se divide en funciones auxiliares para mantener el código modular y legible.
 * - Se valida que los campos obligatorios no estén vacíos antes de proceder.
 */
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { auth } from '../../interfaces/auth';
import { authService } from '../../services/auths';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserStatusService } from '../../../admin/services/user-status.service';
 
@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  /**
   * Objeto que representa los datos del usuario para el login.
   */
  user: auth = {
    username: '',
    password: '',
    email: '',
    passwordorrandomPassword: '',
  };

  /**
   * Indicador de estado para mostrar una animación de carga mientras se procesa el login.
   */

  /**
   * Constructor del componente.
   * @param toastr Servicio para mostrar notificaciones.
   * @param authService Servicio de autenticación para conectarse al backend.
   * @param router Servicio de enrutamiento para redirecciones.
   * @param userStatusService Servicio para gestionar el estado del usuario.
   * @param route Servicio para acceder a la ruta activa.
   */
  constructor(
    private toastr: ToastrService,
    private authService: authService,
    private router: Router,
    private location: Location,

    private userStatusService: UserStatusService,
    private route: ActivatedRoute
  ) { }

  /**
   * Método del ciclo de vida de Angular que se ejecuta al inicializar el componente.
   */
  ngOnInit(): void { }

  /**
   * Método principal que inicia el proceso de login.
   * Valida la entrada, llama al servicio de autenticación y gestiona la respuesta.
   */
  loginUser(): void {
    // Validamos que los campos obligatorios estén completos.
    if (!this.areFieldsValid()) {
      this.toastr.error('Todos los campos son obligatorios', 'Error');
      return;
    }

    // Llamada al servicio de autenticación
    this.authService.login(this.user).subscribe(
      response => {
        if (response.token) {
          this.handleSuccessfulLogin(response);
        }
      },
      (error: HttpErrorResponse) => {
        this.handleError(error);
      }
    );
  }
  // Método para volver
  goBack(): void {
    this.location.back();
  }
  /**
   * Valida que los campos 'username' y 'passwordorrandomPassword' no estén vacíos.
   * @returns {boolean} True si ambos campos tienen contenido, false de lo contrario.
   */
  private areFieldsValid(): boolean {
    return this.user.username.trim() !== '' && (this.user.passwordorrandomPassword || '').trim() !== '';
  }

  /**
   * Maneja el login exitoso:
   * - Muestra una notificación de bienvenida.
   * - Almacena el token y el userId en localStorage.
   * - Redirige al usuario según el estado de la contraseña y su rol.
   * 
   * @param response Objeto de respuesta que contiene 'token', 'userId', 'rol' y 'passwordorrandomPassword'.
   */
  private handleSuccessfulLogin(response: any): void {
    // Notificación de éxito
    this.toastr.success(`Bienvenido, ${this.user.username}!`);
    // Almacenamiento del token y del userId
    this.storeTokenAndUserId(response);

    // Si se usó una contraseña aleatoria, forzamos el cambio de contraseña
    if (response.passwordorrandomPassword === 'randomPassword') {
      this.router.navigate(['/auth/resetPassword'], {
        queryParams: {
          username: this.user.username,
          token: response.token  // Pasa el token aquí
        }
      });
    } else {
      this.redirectBasedOnRole(response.rol);
    }

  }

  /**
   * Guarda el token y el userId (si está presente) en el localStorage.
   * @param response Objeto de respuesta que contiene el token y el userId.
   */
  private storeTokenAndUserId(response: any): void {
    localStorage.setItem('token', response.token);
    if (response.userId) {
      localStorage.setItem('userId', response.userId);
    }
  }

  /**
   * Redirige al usuario a la ruta correspondiente según el rol asignado.
   * @param role Rol del usuario (ej. 'admin', 'client', 'campesino', 'constructoracivil').
   */
  private redirectBasedOnRole(role: string): void {
    switch (role) {
      case 'admin':
        this.router.navigate(['/admin/dashboard']);
        break;
      case 'user':
        this.router.navigate(['/user/dashboard']);
        break;
      case 'campesino':
        this.router.navigate(['/campesino/dashboard']);
        break;
        case 'supervisor':
          this.router.navigate(['/supervisor/dashboard']);
          break;
      default:
        this.router.navigate(['/']);
        break;
    }
  }

  /**
   * Maneja los errores ocurridos durante el proceso de login.
   * Muestra una notificación con el mensaje de error recibido del backend.
   * @param error Objeto HttpErrorResponse con los detalles del error.
   */
  private handleError(error: HttpErrorResponse): void {
    // Eliminamos el console.log para que no se imprima en la consola.
    // console.log('Error recibido:', error.error);
    const errorMsg = error.error.msg || error.error.errors || 'Ocurrió un error';
    this.toastr.error(errorMsg, 'Error');
  }
}  