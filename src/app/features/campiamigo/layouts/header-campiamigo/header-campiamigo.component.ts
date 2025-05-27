import { ChangeDetectorRef, Component, ElementRef, HostListener, OnInit, QueryList, ViewChildren } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
 import { CommonModule } from '@angular/common';
import { BotInfoService } from '../../../admin/services/botInfo.service';

@Component({
  selector: 'app-header-campiamigo',
  templateUrl: './header-campiamigo.component.html',
  styleUrls: ['./header-campiamigo.component.css'],
  imports: [RouterLink, RouterLinkActive, CommonModule]
})
export class HeaderCampiamigoComponent implements OnInit {

  dropdownVisible: boolean = false;
  isBotSpeaking: boolean = false; // Estado del bot

  @ViewChildren('listItem') listItems!: QueryList<ElementRef<HTMLLIElement>>;

  constructor(
    private router: Router,
    private elementRef: ElementRef,
    private botInfoService: BotInfoService,
    private cd: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    // Suscribirse al observable para actualizar el estado del bot y forzar la detección de cambios
    this.botInfoService.getIsSpeaking().subscribe((isSpeaking: boolean) => {
      this.isBotSpeaking = isSpeaking;
      this.cd.detectChanges();
    });
  }

  // Alterna la visibilidad del menú desplegable
  toggleDropdown(): void {
    this.dropdownVisible = !this.dropdownVisible;
  }

  // Cierra el dropdown si se hace clic fuera del componente
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.dropdownVisible && !this.elementRef.nativeElement.contains(event.target)) {
      this.dropdownVisible = false;
    }
  }

  // Función para activar o cancelar la voz al hacer clic en el ícono
  speakBot(): void {
    if (this.botInfoService.isSpeakingNow()) {
      // Si el bot está hablando, cancelamos la reproducción actual.
      this.botInfoService.cancelSpeak();
    } else {
      // Si no está hablando, obtenemos el siguiente mensaje y lo reproducimos.
      const info = this.botInfoService.getNextInfo();
      this.botInfoService.speak(info)
        .catch((error) => console.error('Error en el bot:', error));
    }
  }
}
