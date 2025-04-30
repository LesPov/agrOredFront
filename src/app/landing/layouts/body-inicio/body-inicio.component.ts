import { Component } from '@angular/core';
import { HeaderInicioComponent } from '../header-inicio/header-inicio.component';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-body-inicio',
  imports: [HeaderInicioComponent,RouterModule], 
  templateUrl: './body-inicio.component.html',
  styleUrl: './body-inicio.component.css'
})
export class BodyInicioComponent {

}
