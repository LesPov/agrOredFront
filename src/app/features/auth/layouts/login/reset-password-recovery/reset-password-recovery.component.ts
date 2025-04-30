import { Component } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { authService } from '../../../services/auths';
 
@Component({
  selector: 'app-reset-password-recovery',
  imports: [FormsModule],
  templateUrl: './reset-password-recovery.component.html',
  styleUrls: ['./reset-password-recovery.component.css']
})
export class ResetPasswordRecoveryComponent {
  // Este campo se obtiene del query param o de otra fuente (por ejemplo, header) y se mantiene oculto
  usernameOrEmail: string = '';
  randomPassword: string = '';
  newPassword: string = '';
  confirmNewPassword: string = '';
  token: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: authService,
    private toastr: ToastrService
  ) { }

  ngOnInit(): void {
    // Intenta obtener el token desde los query params o, si no existe, desde localStorage
    this.token = this.route.snapshot.queryParamMap.get('token') || localStorage.getItem('token') || '';
    this.usernameOrEmail = this.route.snapshot.queryParamMap.get('usernameOrEmail') ||
      this.route.snapshot.queryParamMap.get('username') || '';

    if (!this.token) {
      this.toastr.error('No se recibió el token de recuperación', 'Error');
      return;
    }

    console.log('Token recibido:', this.token);
  }


  resetPassword(form: NgForm): void {
    if (form.invalid) {
      this.toastr.error('Por favor, completa todos los campos requeridos', 'Error');
      return;
    }
    if (this.newPassword !== this.confirmNewPassword) {
      this.toastr.error('Las contraseñas no coinciden', 'Error');
      return;
    }

    // Se llama al servicio, pasando el token del query param
    this.authService.resetPassword(this.usernameOrEmail, this.randomPassword, this.newPassword, this.token)
      .subscribe({
        next: () => {
          this.toastr.success('Contraseña actualizada correctamente', 'Éxito');
          this.router.navigate(['/auth/login']);
        },
        error: (err) => {
          this.toastr.error(err.error.msg || 'Error al restablecer la contraseña', 'Error');
        }
      });

  }
  goBack(): void {
    this.router.navigate(['/auth/login']);
  }
}  
