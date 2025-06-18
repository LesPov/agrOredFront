import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener } from '@angular/core';
import { RouterLink, Router } from '@angular/router'; // RouterLink ya está importado
import { BotInfoService } from '../../../features/admin/services/botInfo.service';

@Component({
  selector: 'app-header-inicio',
  imports: [CommonModule, RouterLink],  
  templateUrl: './header-inicio.component.html',
  styleUrl: './header-inicio.component.css'
})
export class HeaderInicioComponent {

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