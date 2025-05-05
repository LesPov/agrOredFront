import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-estaciones',
  imports: [CommonModule],
  templateUrl: './estaciones.component.html',
  styleUrls: ['./estaciones.component.css']
})
export class EstacionesComponent implements OnInit {
  // Índice de la slide actual
  currentSlide: number = 0;
  totalSlides: number = 2;

  // Variables para swipe/touch/mouse drag
  private startX: number | null = null;
  private isDragging: boolean = false;
  // Umbral mínimo (en píxeles) para considerar el gesto como un swipe
  private swipeThreshold: number = 50;

  constructor(private router: Router) {}

  ngOnInit(): void { }

  seleccionarZona(zona: string): void {
    console.log('Zona seleccionada:', zona);
    const climateValue = zona === 'clima cálido' ? 'calido' : (zona === 'clima frío' ? 'frio' : '');
    localStorage.setItem('climate', climateValue);
    this.router.navigate(['/user/estaciones/departamentos'], { queryParams: { climate: climateValue } });
  }

  nextSlide(): void {
    if (this.currentSlide < this.totalSlides - 1) {
      this.currentSlide++;
    }
  }

  prevSlide(): void {
    if (this.currentSlide > 0) {
      this.currentSlide--;
    }
  }

  // Métodos para dispositivos táctiles
  onTouchStart(event: TouchEvent): void {
    this.startX = event.touches[0].clientX;
  }

  onTouchMove(event: TouchEvent): void {
    // Opcional: podrías implementar un efecto "arrastrando" visual
  }

  onTouchEnd(event: TouchEvent): void {
    if (this.startX === null) return;
    const endX = event.changedTouches[0].clientX;
    this.handleSwipe(this.startX, endX);
    this.startX = null;
  }

  // Métodos para mouse drag (deslizar con mouse)
  onDragStart(event: MouseEvent): void {
    this.isDragging = true;
    this.startX = event.clientX;
  }

  onDragMove(event: MouseEvent): void {
    if (!this.isDragging || this.startX === null) return;
    // Aquí podrías implementar un efecto visual de “arrastre”
  }

  onDragEnd(event: MouseEvent): void {
    if (!this.isDragging || this.startX === null) return;
    const endX = event.clientX;
    this.handleSwipe(this.startX, endX);
    this.isDragging = false;
    this.startX = null;
  }

  // Método común para determinar la dirección del swipe
  private handleSwipe(start: number, end: number): void {
    const diff = start - end;
    if (Math.abs(diff) < this.swipeThreshold) return; // Movimiento insuficiente para disparar un swipe
    if (diff > 0) {
      // Se deslizó hacia la izquierda: siguiente slide
      this.nextSlide();
    } else {
      // Se deslizó hacia la derecha: slide anterior
      this.prevSlide();
    }
  }
}
