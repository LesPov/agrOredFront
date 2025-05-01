import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login-prompt',
  imports: [],
  templateUrl: './login-prompt.component.html',
  styleUrl: './login-prompt.component.css'
})
export class LoginPromptComponent {

  // --- NUEVOS INPUTS ---
  @Input() modalTitle: string = 'Acción Requerida'; // Título por defecto
  @Input() modalMessage: string = 'Para continuar, necesitas iniciar sesión o crear una cuenta.'; // Mensaje por defecto
  // --- FIN NUEVOS INPUTS ---

  @Output() closeModal = new EventEmitter<void>();

  constructor(private router: Router) { }

  goToLogin(): void {
    this.router.navigate(['/auth/login']);
    this.close();
  }

  goToRegister(): void {
    this.router.navigate(['/auth/register']);
    this.close();
  }

  close(): void {
    this.closeModal.emit();
  }
}