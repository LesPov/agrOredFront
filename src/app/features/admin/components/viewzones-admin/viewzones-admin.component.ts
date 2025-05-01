import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { environment } from '../../../../../environments/environment';
import { CampiAmigoZonesService, ZoneData } from '../../../campiamigo/services/campiAmigoZones.service';
interface AggregatedZone {
  zone: ZoneData;
  count: number;
  campiamigoIds: number[]; // Lista de IDs de campiamigos asociados (userIds)
}

@Component({
  selector: 'app-viewzones-admin',
  imports: [CommonModule],
  templateUrl: './viewzones-admin.component.html',
  styleUrl: './viewzones-admin.component.css'
})
export class ViewzonesAdminComponent implements OnInit {
  public environment = environment;
  aggregatedZones: AggregatedZone[] = [];

  // Mapas de imágenes fijas para cada zona (o departamento)
  readonly imagenesPorZona: Record<string, string> = {
    'Pasca': 'pasca.jpg',
    'Funsa': 'campesino-colombiano-revista.jpg',
    // Agrega más zonas si lo requieres...
  };

  constructor(
    private campiService: CampiAmigoZonesService,
    private route: ActivatedRoute,
    private router: Router,
    private toastr: ToastrService  // Inyectamos el servicio de ToastFr
  ) { }

  ngOnInit(): void {
    // Capturamos filtros desde queryParams (por ejemplo clima y depto)
    this.route.queryParams.subscribe(params => {
      const climate = params['climate'];
      const dept = params['dept'];
      localStorage.setItem('climate', climate);
      localStorage.setItem('departamento', dept);
      this.loadZones(climate, dept);
    });
  }

  private loadZones(climate?: string, dept?: string): void {
    this.campiService.getZones(climate).subscribe({
      next: (response) => {
        let zones: ZoneData[] = response.zones;
        if (dept) {
          zones = zones.filter(zone => zone.departamentoName === dept);
        }
        // Creamos un Map para agrupar por nombre de zona
        const zoneMap = new Map<string, AggregatedZone>();
        zones.forEach(zone => {
          const key = zone.name;
          // Extraemos los userIds de los perfiles asociados (userProfiles)
          const campIds: number[] = zone.userProfiles ? zone.userProfiles.map(profile => profile.userId) : [];
          if (zoneMap.has(key)) {
            const agg = zoneMap.get(key)!;
            agg.count += campIds.length;
            agg.campiamigoIds = agg.campiamigoIds.concat(campIds);
          } else {
            zoneMap.set(key, { zone, count: campIds.length, campiamigoIds: campIds });
          }
        });
        this.aggregatedZones = Array.from(zoneMap.values());
        // Ordena: primero las zonas activas (con video y modelPath) y luego las inactivas.
        this.aggregatedZones.sort((a, b) => {
          const aActive = this.canViewModel(a.zone) ? 1 : 0;
          const bActive = this.canViewModel(b.zone) ? 1 : 0;
          return bActive - aActive;
        });
        // Log para verificar la cantidad, los IDs y si están activas
        this.aggregatedZones.forEach(agg => {
          console.log(`Zona: ${agg.zone.name} - Count: ${agg.count} - Active: ${this.canViewModel(agg.zone)} - Campiamigo IDs: ${agg.campiamigoIds}`);
        });
      },
      error: (err) => {
        console.error('Error al cargar zonas:', err);
      }
    });
  }

  // Función para determinar la imagen a mostrar en cada zona
  public getZoneImage(zone: ZoneData): string {
    if (this.imagenesPorZona[zone.name]) {
      return this.environment.endpoint + 'uploads/zones/images/' + this.imagenesPorZona[zone.name];
    }
    return zone.zoneImage
      ? this.environment.endpoint + 'uploads/zones/images/' + zone.zoneImage
      : 'assets/img/default-zone.png';
  }

  // Verifica si la zona tiene modelo disponible basándose en que el back proporcione video y modelPath
  public canViewModel(zone: ZoneData): boolean {
    return !!zone.video && !!zone.modelPath;
  }

  // Navega a la escena pasando, además, el count y el listado de campiamigoIds como query params.
  // Se utiliza el ID de la zona en lugar del nombre.
  public viewScene(aggregated: AggregatedZone): void {
    if (this.canViewModel(aggregated.zone)) {
      console.log('Navegando a la escena para la zona:', aggregated.zone.name);
      console.log('Campiamigo IDs a enviar:', aggregated.campiamigoIds);
      this.router.navigate(
        ['/admin/zones/scene', aggregated.zone.id],
        {
          queryParams: {
            count: aggregated.count,
            campiamigoIds: JSON.stringify(aggregated.campiamigoIds)
          }
        }
      );
    } else {
      // Muestra el mensaje de advertencia usando Toastr
      this.toastr.warning('Esta zona no tiene modelo por el momento, espera unos días.');
    }
  }
}
