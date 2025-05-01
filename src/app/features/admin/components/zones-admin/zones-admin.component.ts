import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../../../environments/environment';
import { CampiAmigoZonesService, ZoneData } from '../../../campiamigo/services/campiAmigoZones.service';
import { Profile } from '../../../profile/interfaces/profileInterfaces';
import { CommonModule, Location } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-zones-admin',
  imports: [RouterModule, FormsModule, CommonModule],
  templateUrl: './zones-admin.component.html',
  styleUrl: './zones-admin.component.css'
})
export class ZonesAdminComponent implements OnInit {
  // Datos para crear o actualizar la zona
  zoneData: ZoneData = {
    id: 0,
    name: '',
    tipoZona: '' as 'municipio' | 'departamento' | 'vereda' | 'ciudad',
    description: '',
    climate: '' as 'frio' | 'calido',
    departamentoName: '',
    // --- INICIALIZACIÓN DE NUEVOS CAMPOS ---
    elevation: undefined, // O usar null. undefined es común para campos opcionales
    temperature: undefined, // O usar null
    about: ''
  };

  // Variables para zonas
  zones: ZoneData[] = [];
  filteredZones: ZoneData[] = [];
  isZonesLoading: boolean = true;
  zonesErrorMessage: string = '';

  // Variables para productos

  // Variables para imágenes y archivos
  selectedCityImage: File | null = null;
  selectedZoneImage: File | null = null;
  cityImagePreview: string | ArrayBuffer | null = null;
  zoneImagePreview: string | ArrayBuffer | null = null;
  selectedVideo: File | null = null;
  selectedModelFile: File | null = null;
  selectedTitleGlb: File | null = null;
  videoPreview: string | ArrayBuffer | null = null;
  modelFileName: string = '';
  titleGlbFileName: string = '';

  zoneExists: boolean = false;

  // Propiedades para filtros de zonas
  isFilterModalOpen: boolean = false;
  filters = { name: '', tipoZona: '', climate: '' };

  // Propiedad para controlar la fila con menú abierto
  selectedProductIndex: number | null = null;

  // Otras propiedades
  profile!: Profile | null;
  savedCampiamigo: boolean = false;

  @ViewChild('userDetails') userDetails!: ElementRef;
  @ViewChild('profileDetails') profileDetails!: ElementRef;
  @ViewChild('zoneDetails') zoneDetails!: ElementRef;
  @ViewChild('zoneForm') zoneForm!: NgForm; // Para poder resetear el estado del form si es necesario

  constructor(
    private campiAmigoService: CampiAmigoZonesService,
    private location: Location,
    private toastr: ToastrService,
  ) { }

  ngOnInit(): void {
    this.loadZones();
  }

  goBack(): void {
    this.location.back();
  }

  // Método para cargar zonas
  loadZones(): void {
    this.isZonesLoading = true;
    this.campiAmigoService.getAllZones().subscribe({
      next: (data) => {
        this.zones = data;
        this.filteredZones = data;
        this.isZonesLoading = false;
      },
      error: (error) => {
        this.zonesErrorMessage = 'Error al cargar las zonas.';
        console.error(error);
        this.isZonesLoading = false;
      }
    });
  }

  

  /* Añade esto a tu componente TypeScript */
  toggleActions(index: number): void {
    if (this.selectedProductIndex === index) {
      this.selectedProductIndex = null;
    } else {
      this.selectedProductIndex = index;

      setTimeout(() => {
        const button = document.querySelectorAll('.btn-action')[index] as HTMLElement;
        const menu = document.querySelector('.dropdown-menu') as HTMLElement;

        if (button && menu) {
          const buttonRect = button.getBoundingClientRect();
          const spaceBelow = window.innerHeight - buttonRect.bottom;
          const menuHeight = 150; // Altura estimada del menú

          // Posicionar arriba si no hay espacio debajo
          if (spaceBelow < menuHeight) {
            menu.style.top = 'auto';
            menu.style.bottom = `${window.innerHeight - buttonRect.top + 10}px`;
          } else {
            menu.style.top = `${buttonRect.bottom + 10}px`;
            menu.style.bottom = 'auto';
          }

          // Centrar horizontalmente
          menu.style.left = `${buttonRect.left - (menu.offsetWidth / 2) + (button.offsetWidth / 2)}px`;
        }

        // Cerrar al hacer clic fuera
        const closeMenu = (e: MouseEvent) => {
          if (!menu.contains(e.target as Node)) {
            this.selectedProductIndex = null;
            document.removeEventListener('click', closeMenu);
          }
        };
        document.addEventListener('click', closeMenu);
      }, 0);
    }
  }


  // Métodos de ejemplo para las acciones
  viewProduct(product: any): void {
    // Aquí puedes redirigir o abrir un modal para ver los detalles del producto
    this.toastr.info(`Ver producto: ${product.name}`, 'Acción');
    this.selectedProductIndex = null; // Cerrar menú después de la acción
  }

  editProduct(product: any): void {
    // Aquí puedes redirigir a la vista de edición o abrir un modal de edición
    this.toastr.info(`Editar producto: ${product.name}`, 'Acción');
    this.selectedProductIndex = null;
  }

  deleteProduct(product: any): void {
    // Implementa la lógica para eliminar el producto. Por ejemplo, llamar a un servicio.
    if (confirm(`¿Estás seguro de eliminar el producto "${product.name}"?`)) {
      // Llama al servicio para eliminar el producto (ejemplo):
      this.toastr.success(`Producto "${product.name}" eliminado.`, 'Acción');
      this.selectedProductIndex = null;
    }
  }

  openFilterModal(): void {
    this.isFilterModalOpen = true;
  }

  closeFilterModal(): void {
    this.isFilterModalOpen = false;
  }

  private isFilterValid(): boolean {
    return this.filters.name.trim() !== '' ||
      this.filters.tipoZona.trim() !== '' ||
      this.filters.climate.trim() !== '';
  }

  applyFilters(): void {
    if (!this.isFilterValid()) {
      this.toastr.warning('No se puede filtrar, ningún campo está lleno', 'Advertencia');
      this.filteredZones = this.zones;
      this.closeFilterModal();
      return;
    }

    const result = this.zones.filter(zone =>
      (this.filters.name ? zone.name.toLowerCase().includes(this.filters.name.toLowerCase()) : true) &&
      (this.filters.tipoZona ? zone.tipoZona.toLowerCase().includes(this.filters.tipoZona.toLowerCase()) : true) &&
      (this.filters.climate ? (zone.climate || '').toLowerCase().includes(this.filters.climate.toLowerCase()) : true)
    );

    if (result.length === 0) {
      this.toastr.error('No se encontraron zonas que coincidan con los filtros', 'Error');
      this.filteredZones = this.zones;
    } else {
      this.filteredZones = result;
    }
    this.closeFilterModal();
  }

  buildZoneFormData(): FormData {
    const formData = new FormData();
    formData.append('name', this.zoneData.name);
    formData.append('tipoZona', this.zoneData.tipoZona);
    formData.append('description', this.zoneData.description || '');
    formData.append('climate', this.zoneData.climate || '');
    formData.append('departamentoName', this.zoneData.departamentoName || '');
     // --- AÑADIR NUEVOS CAMPOS AL FORMDATA ---
    // Convertir números a string al añadirlos si existen
    if (this.zoneData.elevation !== null && this.zoneData.elevation !== undefined) {
      formData.append('elevation', this.zoneData.elevation.toString());
    }
    if (this.zoneData.temperature !== null && this.zoneData.temperature !== undefined) {
      formData.append('temperature', this.zoneData.temperature.toString());
    }
    if (this.zoneData.about) { // Añadir solo si no está vacío
      formData.append('about', this.zoneData.about);
    }
    // --- FIN NUEVOS CAMPOS ---
    if (this.selectedCityImage) {
      formData.append('cityImage', this.selectedCityImage);
    }
    if (this.selectedZoneImage) {
      formData.append('zoneImage', this.selectedZoneImage);
    }
    if (this.selectedVideo) {
      formData.append('video', this.selectedVideo);
    }
    if (this.selectedModelFile) {
      formData.append('modelPath', this.selectedModelFile);
    }
    if (this.selectedTitleGlb) {
      formData.append('titleGlb', this.selectedTitleGlb);
    }
    return formData;
  }

    // --- FUNCIÓN MODIFICADA ---
  // Lógica para crear la zona, incluyendo el reseteo de los nuevos campos
  createZone(): void {
    // Validaciones básicas (puedes añadir más si necesitas)
    if (!this.zoneData.name || !this.zoneData.tipoZona) {
      this.toastr.error('El nombre y el tipo de zona son requeridos.', 'Error de Validación');
      return;
    }

    // Lógica para manejar actualización vs creación (si 'zoneExists' es relevante)
    // if (this.zoneExists) {
    //   // Llama a un método de actualización si es necesario
    //   // this.updateZone();
    //   return;
    // }

    const formData = this.buildZoneFormData();

    // Depuración opcional: Ver qué se envía
    // console.log('Enviando FormData:');
    // for (let [key, value] of formData.entries()) {
    //   console.log(`${key}:`, value);
    // }

    this.campiAmigoService.createZone(formData).subscribe({
      next: (response) => {
        this.toastr.success(
          this.zoneExists ? 'Zona actualizada correctamente.' : 'Zona creada correctamente.', // Ajusta mensaje si manejas update
          'Éxito'
        );
        this.loadZones(); // Recargar la lista de zonas
        // this.loadZone(); // Recargar datos de la zona actual si es relevante

        // --- RESETEO DEL FORMULARIO (INCLUYE NUEVOS CAMPOS) ---
        this.zoneData = {
          id: 0, // O null/undefined
          name: '',
          tipoZona: '' as 'municipio' | 'departamento' | 'vereda' | 'ciudad',
          description: '',
          climate: '' as 'frio' | 'calido',
          departamentoName: '',
          // Resetea nuevos campos
          elevation: undefined,
          temperature: undefined,
          about: ''
        };
        this.selectedCityImage = null;
        this.selectedZoneImage = null;
        this.cityImagePreview = null;
        this.zoneImagePreview = null;
        this.selectedVideo = null;
        this.videoPreview = null;
        this.selectedModelFile = null;
        this.modelFileName = '';
        this.selectedTitleGlb = null;
        this.titleGlbFileName = '';
        this.zoneExists = false; // Asumiendo que se resetea después de crear

        // Opcional: Resetea el estado del formulario (validación, pristine, etc.)
        if (this.zoneForm) {
          this.zoneForm.resetForm();
          // Puede que necesites re-asignar el valor inicial de los selects si resetForm() los deja en blanco
          setTimeout(() => {
            this.zoneData.tipoZona = '' as any;
            this.zoneData.climate = '' as any;
          }, 0);
        }

        // Opcional: Cerrar el <details>
        if(this.zoneDetails) {
          this.zoneDetails.nativeElement.removeAttribute('open');
        }

      },
      error: (error) => {
        let errorMessage = 'Error al crear la zona.';
        if (error.error && error.error.msg) {
           // Intenta usar el mensaje específico del backend
          errorMessage = error.error.msg;
        } else if (error.message) {
            // Mensaje de error genérico de HttpClient
            errorMessage = error.message;
        }
        this.toastr.error(errorMessage, 'Error');
        console.error('Error en createZone:', error);
      }
    });
  }

  loadZone(): void {
    if (this.profile && this.profile.zoneId) {
      this.campiAmigoService.getZoneById(this.profile.zoneId).subscribe({
        next: (zone: ZoneData) => {
          this.zoneData = zone;
          this.zoneExists = true;
        },
        error: (err) => {
          console.error('Error al cargar la zona:', err);
          this.zoneExists = false;
        }
      });
    } else {
      this.zoneExists = false;
    }
  }

  deleteZone(zone: ZoneData): void {
    if (confirm(`¿Está seguro de eliminar la zona "${zone.name}"?`)) {
      this.campiAmigoService.deleteZone(zone.id)
        .subscribe({
          next: (response) => {
            this.toastr.success('Zona eliminada correctamente.', 'Éxito');
            this.loadZones();
          },
          error: (error) => {
            this.toastr.error('Error al eliminar la zona.', 'Error');
            console.error(error);
          }
        });
    }
  }

  onCityImageSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      this.selectedCityImage = target.files[0];
      const reader = new FileReader();
      reader.onload = e => this.cityImagePreview = (e.target?.result ?? null);
      reader.readAsDataURL(this.selectedCityImage);
    }
  }

  onZoneImageSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      this.selectedZoneImage = target.files[0];
      const reader = new FileReader();
      reader.onload = e => this.zoneImagePreview = (e.target?.result ?? null);
      reader.readAsDataURL(this.selectedZoneImage);
    }
  }

  onVideoSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      this.selectedVideo = target.files[0];
      this.videoPreview = URL.createObjectURL(this.selectedVideo);
    }
  }

  onModelFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      this.selectedModelFile = target.files[0];
      this.modelFileName = this.selectedModelFile.name;
    }
  }

  onTitleGlbSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      this.selectedTitleGlb = target.files[0];
      this.titleGlbFileName = this.selectedTitleGlb.name;
    }
  }

  getCityImageUrl(): string {
    if (this.cityImagePreview) {
      return this.cityImagePreview as string;
    } else if (this.zoneData?.cityImage) {
      return `${environment.endpoint}uploads/zones/${this.zoneData.cityImage}`;
    }
    return 'assets/img/zonas/default-zone.png';
  }

  getZoneImageUrl(): string {
    if (this.zoneImagePreview) {
      return this.zoneImagePreview as string;
    } else if (this.zoneData?.zoneImage) {
      return `${environment.endpoint}uploads/zones/${this.zoneData.zoneImage}`;
    }
    return 'assets/img/zonas/default-zone.png';
  }
}
