import { Component } from '@angular/core';
 import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { HttpErrorResponse } from '@angular/common/http'; 
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { authService } from '../../services/auths';

@Component({
  selector: 'app-number',
  imports: [CommonModule, FormsModule],
  templateUrl: './number.component.html',
  styleUrl: './number.component.css'
})
export class NumberComponent {
  username: string = ''; // Variable para almacenar el nombre de usuario
  selectedCountryCode: string = ''; // Variable para almacenar el código de país seleccionado
  phoneNumber: string = ''; // Variable para almacenar el número de teléfono
  loading: boolean = false;
  showUsernameForm: boolean = true;
  showConfirmationMessage: boolean = false;
  countries: any[] = []; // Variable para almacenar la lista de códigos de país
  showLogo: boolean | undefined;
  showCountryName: boolean | undefined;

  constructor(
    private authService: authService,
    private route: ActivatedRoute,
    private location: Location,

    private toastr: ToastrService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.username = params['username'];
      if (this.username) {
        this.showUsernameForm = false;
      }
    });

    this.loadCountries(); // Cargar la lista de códigos de país al iniciar el componente
  }
  onCountryCodeChange() {
    this.showLogo = this.selectedCountryCode === '+57';
    this.showCountryName = this.selectedCountryCode !== '+57';
  }
   // Método para volver
   goBack(): void {
    this.location.back();
  }
  loadCountries() {
    this.authService.getCountries().subscribe(
      countries => {
        this.countries = countries;
      },
      error => {
        console.error('Error al obtener la lista de códigos de país:', error);
      }
    );
  }

  showConfirmationDialog() {
    this.showConfirmationMessage = true;
  }

  // Ajusta el método registerPhoneNumber para enviar el nombre de usuario, el código de país y el número de teléfono
  registerPhoneNumber() {
    if (!this.username || !this.selectedCountryCode || !this.phoneNumber) {
      this.toastr.error('Por favor, ingresa un código de país y un número de teléfono válido.', 'Error');
      return;
    }
  
    this.loading = true;
    const formattedPhoneNumber = this.selectedCountryCode + this.phoneNumber.replace(/\D/g, '');
    this.authService.registerPhoneNumber(this.username, formattedPhoneNumber).subscribe(
      () => {
        this.loading = false;
        this.phoneNumber = formattedPhoneNumber;
        this.toastr.success('Se ha enviado un código de verificación a tu número de teléfono.', 'Éxito');
        // Redirigir a la página de verificación del número de teléfono con el nombre de usuario y el número de teléfono
        this.router.navigate(['/auth/verifynumber'], { queryParams: { username: this.username, phoneNumber: formattedPhoneNumber } });
      },
      (error: HttpErrorResponse) => { // Manejo de errores con HttpErrorResponse
        this.loading = false;
        if (error.error && error.error.msg) {
          this.toastr.error(error.error.msg, 'Error');
        } else {
          this.toastr.error('Error al enviar el código de verificación.', 'Error');
        }
      }
    );
  }
}