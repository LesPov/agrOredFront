import { Component, ElementRef, HostListener } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BotInfoService } from '../../../admin/services/botInfo.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-header-user',
  imports: [CommonModule, RouterLink], 
  templateUrl: './header-user.component.html',
  styleUrl: './header-user.component.css'
})
export class HeaderUserComponent {


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
    this.botInfoService.speakNextAndScroll()
      .catch((error) => console.error('Error en el bot:', error));
  }
}
