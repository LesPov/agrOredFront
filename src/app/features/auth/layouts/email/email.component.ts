import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
 import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { authService } from '../../services/auths';

@Component({
  selector: 'app-email',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './email.component.html',
  styleUrl: './email.component.css'
})
export class EmailComponent implements OnInit {
  username: string = ''; // Variable para almacenar el nombre de usuario
  verificationDigits: string[] = ['', '', '', '', '', '']; // Array para almacenar los dígitos del código
  showUsernameForm: boolean = true;
  showConfirmationMessage: boolean = false;
  timeLeft: number = 120; // 3 minutos en segundos
  interval: any;
  timerVisible: boolean = false;

  constructor(
    private authService: authService,
    private route: ActivatedRoute,
    private location: Location,

    private toastr: ToastrService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.username = params['username'];
      if (this.username) {
        this.showUsernameForm = false;
      }
    });
    this.startTimer();

  }
  // Método para volver
  goBack(): void {
    this.location.back();
  }
  startTimer() {
    this.timerVisible = true;
    this.interval = setInterval(() => {
      if (this.timeLeft > 0) {
        this.timeLeft--;
      } else {
        clearInterval(this.interval);
        this.timerVisible = false; // Oculta el temporizador cuando se completa
      }
    }, 1000);
  }
  ngOnDestroy() {
    clearInterval(this.interval);
  }

  showConfirmationDialog() {
    this.showConfirmationMessage = true;
  }

  handleKeyUp(currentInput: HTMLInputElement, prevInput: HTMLInputElement | null, nextInput: HTMLInputElement | null, event: KeyboardEvent) {
    if (event.key === 'Backspace' && currentInput.value === '' && prevInput) {
      event.preventDefault(); // Evita el comportamiento por defecto del navegador (retroceder página)
      prevInput.focus();
    } else if (event.key !== 'Backspace' && nextInput && currentInput.value !== '') {
      event.preventDefault(); // Evita el comportamiento por defecto del navegador (avanzar página)
      nextInput.focus();
    }

    // Si es el último input y tiene un valor, realizar la verificación
    if (!nextInput && currentInput.value !== '') {
      this.verifyCode();
    }
  }

  verifyCode() {
    const fullCode = this.verificationDigits.join('');

    if (!this.username || fullCode.length !== 6) {
      this.toastr.error('Por favor, ingresa el código de verificación completo.', 'Error');
      return;
    }

    this.authService.verifyEmail(this.username, fullCode).subscribe(
      () => {
        this.toastr.success('Correo electrónico verificado con éxito, ahora verifica tu numero celular', 'Éxito');
        this.router.navigate(['/auth/number'], { queryParams: { username: this.username } });
      },
      (error: HttpErrorResponse) => {
        if (error.error.msg) {
          this.toastr.error(error.error.msg, 'Error');
        } else {
          this.toastr.error('Error al verificar el correo electrónico', 'Error');
        }
      }
    );
  }


  formatTimeLeft(): string {
    const minutes = Math.floor(this.timeLeft / 60);
    const seconds = this.timeLeft % 60;

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  resendVerificationCode() {
    this.authService.resendVerificationEmail(this.username).subscribe(
      () => {
        this.toastr.success('Se ha reenviado el código de verificación.', 'Éxito');
        this.timeLeft = 120; // Reinicia el temporizador
        this.startTimer();  // Inicia el temporizador nuevamente
        this.timerVisible = true; // Muestra el temporizador

        // Reinicia los inputs del código
        this.verificationDigits = ['', '', '', '', '', ''];
      },
      error => {
        this.toastr.error('No se pudo reenviar el código de verificación. Inténtalo de nuevo.', 'Error');
      }
    );
  }

}