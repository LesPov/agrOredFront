import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { BotInfoService } from '../../services/botInfo.service';

@Component({
  selector: 'app-header-admin',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header-admin.component.html',
  styleUrl: './header-admin.component.css'
})
export class HeaderAdminComponent {


  dropdownVisible: boolean = false;

  constructor(
    private router: Router, 
    private elementRef: ElementRef,
    private botInfoService: BotInfoService
  ) {}

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

  // Función para activar el bot de voz al hacer clic en el ícono
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