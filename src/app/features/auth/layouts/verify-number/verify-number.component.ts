import { CommonModule, Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr'; 
import { authService } from '../../services/auths';

@Component({
  selector: 'app-verify-number',
  imports: [CommonModule, FormsModule],
  templateUrl: './verify-number.component.html',
  styleUrl: './verify-number.component.css'
})
export class VerifyNumberComponent {
  phoneNumber: string = '';
  username: string = ''; // Variable para almacenar el nombre de usuario
  verificationDigits: string[] = ['', '', '', '', '', '']; // Array para almacenar los dígitos del código
  loading: boolean = false;
  showUsernameForm: boolean = true;
  showConfirmationMessage: boolean = false;
  timeLeft: number = 120; // 3 minutos en segundos
  interval: any;
  timerVisible: boolean = false;

  constructor(
    private authService: authService,
    private route: ActivatedRoute,
    private toastr: ToastrService,
    private location: Location,

    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.username = params['username'];
      this.phoneNumber = params['phoneNumber'] ? params['phoneNumber'].replace(/\D/g, '') : ''; // Formatea el número quitando caracteres no numéricos
      if (this.username && this.phoneNumber) {
        this.showUsernameForm = false; // Ocultar el formulario cuando se obtienen ambos valores
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
  
    if (!this.username || !this.phoneNumber || fullCode.length !== 6) {
      this.toastr.error('Por favor, ingresa el código de verificación completo.', 'Error');
      return;
    }
  
    this.loading = true;
    const formattedPhoneNumber = '+' + this.phoneNumber.replace(/\D/g, ''); // Formatea el número con el prefijo de código de país
    this.authService.verifyPhoneNumber(this.username, formattedPhoneNumber, fullCode).subscribe(
      () => {
        this.loading = false;
        this.toastr.success('Número de teléfono verificado con éxito.', 'Éxito');
        this.showUsernameForm = false;
        this.router.navigate(['/auth/login']);
      },
      (error: HttpErrorResponse) => {
        this.loading = false;
        if (error.error.msg) {
          this.toastr.error(error.error.msg, 'Error');
        } else {
          this.toastr.error('Error al verificar el número de teléfono', 'Error');
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
    this.loading = true;
    this.authService.resendVerificationPhone(this.username, this.phoneNumber).subscribe(
      () => {
        this.loading = false;
        this.toastr.success('Se ha reenviado el código de verificación.', 'Éxito');
        this.timeLeft = 120; // Reinicia el temporizador
        this.startTimer(); // Inicia el temporizador nuevamente
        this.timerVisible = true; // Muestra el temporizador
  
        // Reinicia los inputs del código
        this.verificationDigits = ['', '', '', '', '', ''];
      },
      error => {
        this.loading = false;
        this.toastr.error('No se pudo reenviar el código de verificación. Inténtalo de nuevo.', 'Error');
      }
    );
  }
}