import { Component } from '@angular/core';
import { NavbarAdminComponent } from '../navbar-admin/navbar-admin.component';
import { RouterModule } from '@angular/router';
import { HeaderAdminComponent } from '../header-admin/header-admin.component';

@Component({
  selector: 'app-body-admin',
  imports: [NavbarAdminComponent,HeaderAdminComponent, RouterModule],
  templateUrl: './body-admin.component.html',
  styleUrl: './body-admin.component.css'
})
export class BodyAdminComponent {

}
