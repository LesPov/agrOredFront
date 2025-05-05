import { Component } from '@angular/core';
import { HeaderUserComponent } from '../header-user/header-user.component';
import { NavbarUserComponent } from '../navbar-user/navbar-user.component';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-body-user',
  imports: [HeaderUserComponent,NavbarUserComponent,RouterModule ],
  templateUrl: './body-user.component.html', 
  styleUrl: './body-user.component.css'
})
export class BodyUserComponent {

}
