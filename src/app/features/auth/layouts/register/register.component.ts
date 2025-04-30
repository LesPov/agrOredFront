import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { auth } from '../../interfaces/auth';
import { authService } from '../../services/auths';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-register',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent implements OnInit {
  user: auth = {
    username: '',
    password: '',
    email: '',
    rol: 'user', // Valor por defecto para rol
  };
  confirmPassword: string = '';

  constructor(  
    private toastr: ToastrService,
    private location: Location,
    private authService: authService,
    private router: Router
  ) { }

  ngOnInit(): void { }
  // Método para volver
  goBack(): void {
    this.location.back();
  }
  addUser() {
    // Validamos que el usuario ingrese valores
    if (
      !this.user.email ||
      !this.user.username ||
      !this.user.password ||
      !this.confirmPassword
    ) {
      this.toastr.error('Todos los campos son obligatorios', 'Error');
      return;
    }

    // Validamos que las contraseñas sean iguales
    if (this.user.password !== this.confirmPassword) {
      this.toastr.error('Las contraseñas ingresadas son distintas', 'Error');
      return;
    }

    this.authService.register(this.user).subscribe(
      () => {
        this.toastr.success(`El usuario ${this.user.username} fue registrado con éxito`);
        this.router.navigate(['/auth/email'], { queryParams: { username: this.user.username } });
      },
      (error: HttpErrorResponse) => {
        this.toastr.error(error.error.msg, 'Error');
      }
    );
  }
}