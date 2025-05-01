import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnInit, QueryList, ViewChildren } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { navbarData } from './datlinks/navbarData';

@Component({
  selector: 'app-navbar-admin',
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar-admin.component.html',
  styleUrl: './navbar-admin.component.css'
})
export class NavbarAdminComponent implements OnInit, AfterViewInit {

  navData = navbarData;
  isSceneRoute: boolean = false; 

  @ViewChildren('listItem') listItems!: QueryList<ElementRef<HTMLLIElement>>;

  constructor(private router: Router) { }

  ngOnInit(): void {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        const currentUrl = event.urlAfterRedirects;
        // Verificar si la URL actual pertenece a alguno de los links del navbar
        const matched = this.navData.find(item => currentUrl.startsWith(item.routerLink));
        if (matched) {
          // Si se trata de la ruta de zonas/scene, actualizar el flag para estilos específicos
          this.isSceneRoute = currentUrl.includes('/user/zonas/scene');
        } else {
          // Si no coincide con ninguno, reiniciamos la bandera
          this.isSceneRoute = false;
        }
      }
    });
  }

  ngAfterViewInit(): void {
    this.listItems.forEach((itemRef: ElementRef) => {
      const liElement = itemRef.nativeElement;
      liElement.addEventListener('click', () => {
        this.listItems.forEach(li => li.nativeElement.classList.remove('active'));
        liElement.classList.add('active');
      });
    });
  }

  // Método que retorna true si la ruta actual coincide con algún link del navbar
  hasActiveNav(): boolean {
    const currentUrl = this.router.url;
    return this.navData.some(item => currentUrl.startsWith(item.routerLink));
  }
}
