import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { ToastrService } from 'ngx-toastr';
import { BotInfoService } from '../../../admin/services/botInfo.service';
import { ProfileService } from '../../../profile/services/profileServices';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-ubicacion-registro',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './ubicacion-registro.component.html',
  styleUrls: ['./ubicacion-registro.component.css']
})
export class UbicacionRegistroComponent implements OnInit, OnDestroy {

  private map!: L.Map;
  private marker: L.Marker | null = null;
  selectedLocation: { lat: number; lng: number } | null = null;
  direccionSeleccionada = '';
  isLoading = false;
  isRegistered = false;

  private defaultCoords = { lat: 4.6097, lng: -74.0817 };
  private infoUbicacion = [
    "Bienvenido a la sección de selección de ubicación.",
    "Se intentará detectar tu ubicación automáticamente. Si no es posible, selecciona un punto en el mapa.",
    "Haz clic en el mapa para elegir el lugar del incidente.",
    "Una vez seleccionada la ubicación, presiona el botón 'Continuar' para avanzar."
  ];

  constructor(
    private router: Router,
    private toastr: ToastrService,
    private botInfoService: BotInfoService,
    private profileService: ProfileService,
    private http: HttpClient
  ) {
    L.Icon.Default.imagePath = 'assets/leaflet/images/';
  }

  ngOnInit(): void {
    // 1) Mostrar mensajes iniciales
    this.botInfoService.setInfoList(this.infoUbicacion);

    // 2) Inicializar el mapa inmediatamente en coords por defecto
    this.initializeMapWithLocation(this.defaultCoords.lat, this.defaultCoords.lng);

    // 3) En paralelo: detectamos registro y geolocalización
    this.profileService.getProfile().subscribe(
      profile => {
        if (profile?.campiamigo) {
          this.isRegistered = true;
          this.toastr.info('Ya estás registrado, redirigiendo al Dashboard.');
          this.router.navigate(['/user/dashboard']);
        }
      },
      () => {
        // Si falla obtener perfil, simplemente seguimos con el mapa
      }
    );

    // 4) Intentar geolocalización para centrar mapa y marcar
    this.tryGetUserLocation();
  }

  /** Solo pide geolocalización y, en callback, centra y marca */
  private tryGetUserLocation(): void {
    if (!navigator.geolocation) {
      this.toastr.error('Tu dispositivo no soporta geolocalización.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        this.setMapView(latitude, longitude);
        this.placeMarkerAndFetchAddress(latitude, longitude);
      },
      () => {
        // Si falla, dejamos el mapa en coords por defecto
        this.toastr.warning('No se pudo detectar tu ubicación. Usa el mapa para seleccionar.');
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }

  /** Crea el mapa solo UNA vez */
 // 1) Al crear el mapa, habilita el control de zoom (si lo deseas visible)
//    y deja el scrollWheelZoom en true para que el usuario haga scroll.
private initializeMapWithLocation(lat: number, lng: number): void {
  if (this.map) return;

  this.map = L.map('map', {
      zoomControl: true,        // muestra los botones + / – (opcional)
      scrollWheelZoom: true     // permite zoom con la rueda
    })
    .setView([lat, lng], 13);  // zoom inicial = 13

  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    { attribution: '© OpenStreetMap contributors, © CartoDB', maxZoom: 19 }
  ).addTo(this.map);

  this.map.whenReady(() => this.map.invalidateSize());

  // En lugar de setView con zoom rígido, sólo panTo:
  this.map.on('click', e => {
    const { lat, lng } = (e as L.LeafletMouseEvent).latlng;
    this.map.panTo([lat, lng]);                            // <-- sólo centra
    this.placeMarkerAndFetchAddress(lat, lng);
  });
}

// 2) Reemplaza la función setMapView para que no resetee el zoom:
private setMapView(lat: number, lng: number): void {
  // Antes hacías: this.map.setView([lat, lng], 13);
  // Ahora:
  this.map.panTo([lat, lng]);
}

 

  /** Mueve o crea marcador, y extrae dirección vía proxy */
  private async placeMarkerAndFetchAddress(lat: number, lng: number): Promise<void> {
    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
    } else {
      this.marker = L.marker([lat, lng]).addTo(this.map);
    }
    this.selectedLocation = { lat, lng };
    await this.obtenerDireccion(lat, lng);
  }

  /** Llama al backend proxy y formatea la dirección */
  private async obtenerDireccion(lat: number, lng: number): Promise<void> {
    this.isLoading = true;
    try {
      const params = new HttpParams()
        .set('lat', lat.toString())
        .set('lon', lng.toString());

      const url = environment.endpoint.replace(/\/+$/, '') + '/api/reverse';
      const data: any = await this.http.get<any>(url, { params }).toPromise();

      let formatted = data.address
        ? this.formatAddress(data.address) || data.display_name
        : '';
      this.direccionSeleccionada = formatted
        ? `${formatted} (Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)})`
        : `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;

      this.toastr.success('Ubicación seleccionada correctamente');
    } catch {
      this.toastr.error('Error al obtener la dirección');
      this.direccionSeleccionada = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
    } finally {
      this.isLoading = false;
    }
  }

  private formatAddress(address: any): string {
    if (address.road && address.house_number) {
      let s = `${address.road} #${address.house_number}`;
      if (address.suburb) s += `, ${address.suburb}`;
      if (address.city)   s += `, ${address.city}`;
      if (address.state)  s += `, ${address.state}`;
      return s;
    }
    if (address.road) return address.road;
    if (address.display_name) {
      return address.display_name.split(',').slice(0,3).join(', ').trim();
    }
    return '';
  }

  centrarEnUbicacionActual(): void {
    this.tryGetUserLocation();
  }

  handleContinue(): void {
    if (this.isRegistered) {
      this.toastr.warning('No puedes actualizar la ubicación.');
      return;
    }
    if (!this.selectedLocation) {
      this.toastr.error('Selecciona primero una ubicación en el mapa.');
      return;
    }
    localStorage.setItem('userLocation',
      JSON.stringify({
        direccion: this.direccionSeleccionada,
        coords: this.selectedLocation
      })
    );
    this.router.navigate(['/user/registerCampiamigo']);
  }

  ngOnDestroy(): void {
    if (this.map) this.map.remove();
  }

}
