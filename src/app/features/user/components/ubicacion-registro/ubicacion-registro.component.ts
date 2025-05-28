import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { ToastrService } from 'ngx-toastr';
import { BotInfoService } from '../../../admin/services/botInfo.service';
import { ProfileService } from '../../../profile/services/profileServices';
import { CommonModule } from '@angular/common'; // Necesario para *ngIf
import { ReactiveFormsModule } from '@angular/forms'; // Si usas formularios reactivos

@Component({
  selector: 'app-ubicacion-registro',
  imports: [CommonModule, ReactiveFormsModule], 
  templateUrl: './ubicacion-registro.component.html',
  styleUrl: './ubicacion-registro.component.css'
})
export class UbicacionRegistroComponent implements OnInit, OnDestroy {

  private map!: L.Map;
  private marker: L.Marker | null = null;
  selectedLocation: { lat: number; lng: number } | null = null;
  direccionSeleccionada: string = '';
  isLoading: boolean = false;
  // isLoadingMap: boolean = true; // ELIMINADO: Ya no necesitamos esta variable para el spinner
  isRegistered: boolean = false;

  private defaultCoords = { lat: 4.6097, lng: -74.0817 }; // Coordenadas por defecto (Bogotá, Colombia)

  private infoUbicacion: string[] = [
    "Bienvenido a la sección de selección de ubicación.",
    "Se intentará detectar tu ubicación automáticamente. Si no es posible, selecciona un punto en el mapa.",
    "Haz clic en el mapa para elegir el lugar del incidente.",
    "Una vez seleccionada la ubicación, presiona el botón 'Continuar' para avanzar."
  ];

  constructor(
    private router: Router,
    private toastr: ToastrService,
    private botInfoService: BotInfoService,
    private profileService: ProfileService
  ) {
    L.Icon.Default.imagePath = 'assets/leaflet/images/';
  }

  ngOnInit(): void {
    this.botInfoService.setInfoList(this.infoUbicacion);

    this.profileService.getProfile().subscribe(
      profile => {
        if (profile && profile.campiamigo) {
          this.isRegistered = true;
          this.toastr.info('Ya estás registrado, redirigiendo al Dashboard.');
          this.router.navigate(['/user/dashboard']);
        } else {
          // Llama a la función que intenta obtener la ubicación y luego inicializa el mapa.
          this.tryGetUserLocationAndInitializeMap();
        }
      },
      error => {
        console.error('Error al obtener el perfil:', error);
        // Si hay un error, procede de igual forma a intentar obtener la ubicación y mostrar el mapa.
        this.tryGetUserLocationAndInitializeMap();
      }
    );
  }

  /**
   * Intenta obtener la ubicación actual del usuario y luego inicializa el mapa.
   * El mapa se mostrará solo cuando se tenga una ubicación.
   */
  private tryGetUserLocationAndInitializeMap(): void {
    // ELIMINADO: this.isLoadingMap = true; // Ya no necesitamos mostrar un spinner

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          // Si tiene éxito, inicializa el mapa con la ubicación real
          this.initializeMapWithLocation(latitude, longitude);
          // Coloca el marcador y obtiene la dirección para la ubicación detectada
          this.handleMapClick({ latlng: { lat: latitude, lng: longitude } } as L.LeafletMouseEvent);
        },
        (error) => {
          this.toastr.error('No se pudo obtener la ubicación actual. Mapa centrado por defecto. Usa el mapa para seleccionar una ubicación.');
          // Si falla, inicializa el mapa con la ubicación por defecto
          this.initializeMapWithLocation(this.defaultCoords.lat, this.defaultCoords.lng);
          // Coloca el marcador y obtiene la dirección para la ubicación por defecto
          this.handleMapClick({ latlng: { lat: this.defaultCoords.lat, lng: this.defaultCoords.lng } } as L.LeafletMouseEvent);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 } 
      );
    } else {
      this.toastr.error('Tu dispositivo no soporta geolocalización. Mapa centrado por defecto. Selecciona la ubicación manualmente.');
      // Si no hay soporte, inicializa el mapa con la ubicación por defecto
      this.initializeMapWithLocation(this.defaultCoords.lat, this.defaultCoords.lng);
      // Coloca el marcador y obtiene la dirección para la ubicación por defecto
      this.handleMapClick({ latlng: { lat: this.defaultCoords.lat, lng: this.defaultCoords.lng } } as L.LeafletMouseEvent);
    }
  }

  /**
   * Crea e inicializa el objeto del mapa de Leaflet con las coordenadas dadas.
   * Solo se llama una vez para crear el mapa.
   */
  private initializeMapWithLocation(lat: number, lng: number): void {
    if (this.map) { return; } 

    this.map = L.map('map', { zoomControl: false }).setView([lat, lng], 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors, © CartoDB',
      maxZoom: 19 
    }).addTo(this.map);

    // Cuando el mapa esté listo y sus tiles cargados, se asegura que el renderizado sea correcto.
    this.map.whenReady(() => {
      // ELIMINADO: this.isLoadingMap = false; // Ya no necesitamos ocultar un spinner
      this.map.invalidateSize(); // Asegura que el mapa se renderice correctamente en su contenedor
    });

    // Escucha el evento de clic en el mapa para que el usuario pueda seleccionar ubicaciones
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.handleMapClick(e);
    });
  }

  /**
   * Maneja el clic en el mapa: mueve o crea un marcador y obtiene la dirección.
   * También se usa para establecer el marcador inicial.
   */
  private async handleMapClick(e: L.LeafletMouseEvent): Promise<void> {
    const { lat, lng } = e.latlng;
    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
    } else {
      this.marker = L.marker([lat, lng]).addTo(this.map);
    }
    this.selectedLocation = { lat, lng };
    await this.obtenerDireccion(lat, lng);
  }

  /**
   * Obtiene la dirección legible a partir de las coordenadas usando Nominatim.
   */
  private async obtenerDireccion(lat: number, lng: number): Promise<void> {
    this.isLoading = true; 
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
      const data = await response.json();
      if (data.address) {
        let formattedAddress = this.formatAddress(data.address);
        if (!formattedAddress && data.display_name) {
          formattedAddress = data.display_name;
        }
        this.direccionSeleccionada = `${formattedAddress} (Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)})`;
      } else {
        this.direccionSeleccionada = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
      }
      this.toastr.success('Ubicación seleccionada correctamente');
    } catch (error) {
      this.toastr.error('Error al obtener la dirección');
      this.direccionSeleccionada = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
    } finally {
      this.isLoading = false; 
    }
  }

  /**
   * Formatea el objeto de dirección de Nominatim en una cadena legible.
   */
  private formatAddress(address: any): string {
    if (address.road && address.house_number) {
      let formatted = `${address.road} #${address.house_number}`;
      if (address.neighbourhood || address.suburb) {
        formatted += `, ${address.neighbourhood || address.suburb}`;
      }
      if (address.city || address.town || address.village) {
        formatted += `, ${address.city || address.town || address.village}`;
      }
      if (address.state) {
        formatted += `, ${address.state}`;
      }
      return formatted;
    } else if (address.road) {
      return address.road;
    } else if (address.display_name) {
      const parts = address.display_name.split(',');
      return parts.slice(0, Math.min(parts.length, 3)).map((p: string) => p.trim()).join(', ');
    }
    return '';
  }

  /**
   * Centra el mapa en la ubicación actual del usuario a petición.
   */
  centrarEnUbicacionActual(): void {
    // ELIMINADO: if (this.isLoadingMap) { ... } // Ya no necesitamos esta verificación
    
    if ('geolocation' in navigator) {
      this.toastr.info('Intentando centrar en tu ubicación actual...');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          if (this.map) {
            this.map.setView([latitude, longitude], 13);
            this.handleMapClick({ latlng: { lat: latitude, lng: longitude } } as L.LeafletMouseEvent);
            this.toastr.success('Ubicación actualizada');
          } else {
            this.toastr.warning('El mapa no está inicializado. No se puede centrar.');
          }
        },
        (error) => {
          this.toastr.error('No se pudo obtener la ubicación actual.');
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      this.toastr.error('Tu dispositivo no soporta geolocalización.');
    }
  }

  /**
   * Maneja el clic en el botón "Continuar".
   */
  handleContinue(): void {
    if (this.isRegistered) {
       this.toastr.warning('Ya estás registrado, no se permite actualizar la ubicación.');
       return;
    }
    if (!this.selectedLocation) {
      this.toastr.error('Por favor, selecciona una ubicación en el mapa');
      return;
    }
    const userLocation = {
      direccion: this.direccionSeleccionada,
      coords: this.selectedLocation
    };
    localStorage.setItem('userLocation', JSON.stringify(userLocation));
    this.router.navigate(['/user/registerCampiamigo']);
  }

  /**
   * Limpia el mapa al destruir el componente para evitar fugas de memoria.
   */
  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }
}