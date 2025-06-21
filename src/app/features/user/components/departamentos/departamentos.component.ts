import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
 import { CommonModule, Location } from '@angular/common';
 import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { CampiAmigoZonesService } from '../../../campiamigo/services/campiAmigoZones.service';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-departamentos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './departamentos.component.html',
  styleUrls: ['./departamentos.component.css'],
})
export class CiudadesComponent implements OnInit {
  ciudadesUnicas: {
    departamentoName: string;
    cityImage: string;
    characterImage: string;
    climate: string;
  }[] = [];

  // Lista de departamentos con overlay "Próximamente" (en minúsculas y sin tildes)
  proximamenteDepartamentos: string[] = ['boyaca', 'norte de santander'];
  // Array normalizado para comparar en el template
  proximamenteDepartamentosNormalized: string[] = [];

  // Variables del carrusel
  currentSlide: number = 0;
  totalSlides: number = 0;
  private startX: number | null = null;
  private isDragging: boolean = false;
  private swipeThreshold: number = 50;

  // Mapas de imágenes para cada departamento
  readonly imagenesPorDepartamento: Record<string, string> = {
    'cundinamarca': 'Cundinamarca.jpg',
    'boyaca': 'Boyaca.jpg',
    'norte de santander': 'Boyaca.jpg',
  };

  readonly charactersPorDepartamento: Record<string, string> = {
    'cundinamarca': 'DSC01271-removebg-preview.png',
  };

  // Variables para el modal de búsqueda
  filterModalOpen: boolean = false;
  filterQuery: string = '';

  constructor(
    private campiService: CampiAmigoZonesService,
    private route: ActivatedRoute,
    private router: Router,
    private toastr: ToastrService,
    private location: Location,
  ) { }

  ngOnInit(): void {
    // Normalizamos el array de overlay para comparaciones sin fallos
    this.proximamenteDepartamentosNormalized = this.proximamenteDepartamentos.map(dep => this.normalizeName(dep));

    // Suscripción a queryParams para obtener el clima y cargar departamentos
    this.route.queryParams.subscribe((params) => {
      const clima = params['climate'];
      localStorage.setItem('climate', clima);
      this.cargarCiudades(clima);
    });
  }

  // Función para normalizar el string (quita espacios, tildes y pasa a minúsculas)
  normalizeName(name: string): string {
    return name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  private async cargarCiudades(climate?: string): Promise<void> {
    this.campiService.getZones(climate).subscribe({
      next: async (response) => {
        const zonas = response.zones;
        const ciudadesMap = new Map<
          string,
          { departamentoName: string; cityImage: string; characterImage: string; climate: string }
        >();

        zonas.forEach((zona) => {
          const depto = zona.departamento ;
          if (depto && !ciudadesMap.has(depto)) {
            ciudadesMap.set(depto, {
              departamentoName: depto,
              cityImage: '',
              characterImage: '',
              climate: zona.climate || 'desconocido',
            });
          }
        });

        const ciudadArray = Array.from(ciudadesMap.entries()).map(
          async ([departamentoName, ciudad]) => {
            const deptoNormalized = this.normalizeName(departamentoName);
            const nombreImagen = this.imagenesPorDepartamento[deptoNormalized] || '';
            const nombrePersonaje = this.charactersPorDepartamento[deptoNormalized] || '';
            return {
              ...ciudad,
              cityImage: nombreImagen
                ? `${environment.endpoint}uploads/zones/images/${nombreImagen}`
                : 'assets/img/default-city.jpg',
              characterImage: nombrePersonaje
                ? `${environment.endpoint}uploads/mejorCampiamigo/${nombrePersonaje}`
                : '',
            };
          }
        );

        this.ciudadesUnicas = await Promise.all(ciudadArray);
        this.totalSlides = this.ciudadesUnicas.length;
      },
      error: (err) => {
        console.error('Error cargando departamentos:', err);
      },
    });
  }

  // Navegación a la zona seleccionada.
  // Si el departamento está en "próximamente" (usando normalización), cancela la navegación.
  navigateToZone(ciudad: any): void {
    if (this.proximamenteDepartamentosNormalized.includes(this.normalizeName(ciudad.departamentoName))) return;
    localStorage.setItem('departamento', ciudad.departamentoName);
    localStorage.setItem('climate', ciudad.climate);
    this.router.navigate(['/user/estaciones/zone'], {
      queryParams: {
        dept: ciudad.departamentoName,
        climate: ciudad.climate,
      },
    });
  }

  // Vuelve a la página anterior
  goBack(): void {
    this.location.back();
  }

  // Métodos para el carrusel
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

  onTouchStart(event: TouchEvent): void {
    this.startX = event.touches[0].clientX;
  }
  onTouchMove(event: TouchEvent): void { }
  onTouchEnd(event: TouchEvent): void {
    if (this.startX === null) return;
    const endX = event.changedTouches[0].clientX;
    this.handleSwipe(this.startX, endX);
    this.startX = null;
  }
  onDragStart(event: MouseEvent): void {
    this.isDragging = true;
    this.startX = event.clientX;
  }
  onDragMove(event: MouseEvent): void {
    if (!this.isDragging || this.startX === null) return;
  }
  onDragEnd(event: MouseEvent): void {
    if (!this.isDragging || this.startX === null) return;
    const endX = event.clientX;
    this.handleSwipe(this.startX, endX);
    this.isDragging = false;
    this.startX = null;
  }
  private handleSwipe(start: number, end: number): void {
    const diff = start - end;
    if (Math.abs(diff) < this.swipeThreshold) return;
    diff > 0 ? this.nextSlide() : this.prevSlide();
  }

  // Métodos para el Modal de búsqueda
  openFilterModal(): void {
    this.filterModalOpen = true;
    this.filterQuery = '';
  }

  closeFilterModal(): void {
    this.filterModalOpen = false;
  }

  searchDepartment(): void {
    const queryNormalized = this.normalizeName(this.filterQuery);
    if (!queryNormalized) {
      this.toastr.warning('Por favor ingrese un nombre.');
      return;
    }
    // Busca el índice del departamento comparando las versiones normalizadas
    const foundIndex = this.ciudadesUnicas.findIndex(ciudad =>
      this.normalizeName(ciudad.departamentoName) === queryNormalized
    );
    if (foundIndex !== -1) {
      this.currentSlide = foundIndex;
    } else {
      this.toastr.warning('Departamento no encontrado.');
    }
    this.closeFilterModal();
  }
}
