import { Component, OnInit, AfterViewInit, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { Router, NavigationEnd, NavigationStart } from '@angular/router';
import { navbarData } from './datlinks/navbarData';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
 import { filter, map, distinctUntilChanged, debounceTime } from 'rxjs/operators';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { BotInfoService } from '../../../admin/services/botInfo.service';

@Component({
  selector: 'app-navbar-campiamigo',
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar-campiamigo.component.html',
  styleUrls: ['./navbar-campiamigo.component.css']
})
export class NavbarCampiamigoComponent implements OnInit, AfterViewInit {

  navData = navbarData;
  isSceneRoute: boolean = false;
  private lastUrl: string = '';
  private routeSpeakInProgress: boolean = false;

  @ViewChildren('listItem') listItems!: QueryList<ElementRef<HTMLLIElement>>;

  constructor(private router: Router, private botInfoService: BotInfoService) { }

  ngOnInit(): void {
    // Cancelar cualquier reproducción activa al iniciar un cambio de ruta
    this.router.events
      .pipe(filter(event => event instanceof NavigationStart))
      .subscribe(() => {
        this.botInfoService.cancelSpeak();
      });

    // Al finalizar la navegación, comprobamos si la URL coincide EXACTAMENTE con el routerLink del nav item
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        map((event: NavigationEnd) => event.urlAfterRedirects),
        distinctUntilChanged(),
        debounceTime(300)
      )
      .subscribe((currentUrl: string) => {
        if (currentUrl === this.lastUrl) {
          return;
        }
        this.lastUrl = currentUrl;

        // Buscar el elemento del menú cuyo routerLink coincida EXACTAMENTE con la URL actual.
        const matched = this.navData.find(item => currentUrl === item.routerLink);
        if (matched) {
          // Si la URL es EXACTA al routerLink, activamos el speak.
          // (Si no, significa que es una ruta hija y no queremos disparar el bot.)
          this.isSceneRoute = currentUrl.includes('/user/zonas/scene');
          this.routeSpeakInProgress = true;
          this.botInfoService.speak(matched.label)
            .catch((error) => console.error('Error en el bot:', error))
            .finally(() => {
              this.routeSpeakInProgress = false;
            });
        } else {
          this.isSceneRoute = false;
        }
      });
  }

  ngAfterViewInit(): void {
    // Agrega la clase "active" al item clickeado
    this.listItems.forEach((itemRef: ElementRef) => {
      const liElement = itemRef.nativeElement;
      liElement.addEventListener('click', () => {
        this.listItems.forEach(li => li.nativeElement.classList.remove('active'));
        liElement.classList.add('active');
      });
    });
  }

  hasActiveNav(): boolean {
    const currentUrl = this.router.url;
    return this.navData.some(item => currentUrl.startsWith(item.routerLink));
  }
}
