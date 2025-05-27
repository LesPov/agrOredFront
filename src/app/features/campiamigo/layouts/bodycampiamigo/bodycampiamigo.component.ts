import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { HeaderCampiamigoComponent } from '../header-campiamigo/header-campiamigo.component';
import { NavbarCampiamigoComponent } from '../navbar-campiamigo/navbar-campiamigo.component';

@Component({
  selector: 'app-bodycampiamigo',
  imports: [HeaderCampiamigoComponent, RouterModule, NavbarCampiamigoComponent],
  templateUrl: './bodycampiamigo.component.html',
  styleUrl: './bodycampiamigo.component.css'
})
export class BodycampiamigoComponent {

}
