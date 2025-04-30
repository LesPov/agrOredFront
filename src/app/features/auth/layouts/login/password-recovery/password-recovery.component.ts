import { Component } from '@angular/core';
 import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { FormsModule, NgForm } from '@angular/forms';
import { authService } from '../../../services/auths';

@Component({
  selector: 'app-password-recovery',
  imports: [FormsModule],
  templateUrl: './password-recovery.component.html',
  styleUrls: ['./password-recovery.component.css']
})
export class PasswordRecoveryComponent {
  usernameOrEmail: string = '';

  constructor(
    private authService: authService,
    private toastr: ToastrService,
    private router: Router
  ) { }

  ngOnInit(): void {}

  requestPasswordReset(form: NgForm): void {
    if (form.invalid || this.usernameOrEmail.trim() === '') {
      this.toastr.error('Por favor ingresa tu correo o nombre de usuario', 'Error');
      return;
    }
    this.authService.requestPasswordReset(this.usernameOrEmail).subscribe({
      next: () => {
        this.toastr.success('Se ha enviado un correo para la recuperación de contraseña', 'Éxito');
        // Redirige al usuario al login
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.toastr.error(err.error.msg || 'Error al solicitar la recuperación de contraseña', 'Error');
      }
    });
  }

  // Función que redirige al login
  goBack(): void {
    this.router.navigate(['/auth/login']);
  }
}
