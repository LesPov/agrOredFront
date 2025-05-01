import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs';
import { CampiAmigoZonesService, ZoneData } from '../../../../../campiamigo/services/campiAmigoZones.service';
import { IndicatorService } from '../../../../../campiamigo/services/indicator.service';

export class ZoneIndicatorLogic {

  // Propiedades para zona
  currentZone: ZoneData | null = null;
  allZones: ZoneData[] = [];
  availableDepartments: string[] = [];
  showDepartmentList: boolean = false;
  selectedDepartment: string = '';
  availableZonesByDept: ZoneData[] = [];
  selectedZoneId: number | null = null;
  indicatorColor: string = '';
  indicatorLoading: boolean = false;

  constructor(
    private campiAmigoService: CampiAmigoZonesService,
    private indicatorService: IndicatorService,
    private toastr: ToastrService
  ) { }

  /**
   * Carga todas las zonas y extrae los departamentos únicos.
   */
  loadAllZones(callback?: () => void): Subscription {
    return this.campiAmigoService.getAllZones().subscribe({
      next: (zones: ZoneData[]) => {
        this.allZones = zones;
        const deptSet = new Set<string>();
        zones.forEach(zone => {
          if (zone.departamentoName) {
            deptSet.add(zone.departamentoName);
          }
        });
        this.availableDepartments = Array.from(deptSet);
        if (callback) callback();
      },
      error: (err) => {
        console.error('Error al cargar zonas:', err);
        if (callback) callback();
      }
    });
  }

  /**
   * Carga la zona actual asignada basándose en el perfil del usuario.
   * Se espera que el parámetro tenga la propiedad "campiamigo" (boolean) y
   * opcionalmente "zoneId" (number).
   */
  loadCurrentZone(profile: { campiamigo: boolean; zoneId?: number }, callback?: () => void): Subscription | null {
    if (profile.campiamigo && profile.zoneId) {
      return this.campiAmigoService.getZoneById(profile.zoneId).subscribe({
        next: (zone: ZoneData) => {
          this.currentZone = zone;
          if (callback) callback();
        },
        error: (err) => {
          console.error('Error al cargar la zona actual:', err);
          this.currentZone = null;
          if (callback) callback();
        }
      });
    } else {
      this.currentZone = null;
      if (callback) callback();
      return null;
    }
  }

  /**
   * Alterna la visualización del listado de departamentos.
   */
  toggleDepartmentList(): void {
    this.showDepartmentList = !this.showDepartmentList;
    if (!this.showDepartmentList) {
      this.selectedDepartment = '';
      this.availableZonesByDept = [];
      this.selectedZoneId = null;
    }
  }

  /**
   * Filtra las zonas de acuerdo al departamento seleccionado.
   */
  onDepartmentSelect(dept: string): void {
    this.selectedDepartment = dept;
    this.availableZonesByDept = this.allZones.filter(zone => zone.departamentoName === dept);
    this.selectedZoneId = null;
  }

  /**
   * Asigna el ID de la zona seleccionada.
   */
  onZoneSelect(zoneId: any): void {
    this.selectedZoneId = zoneId ? Number(zoneId) : null;
  }

  /**
   * Actualiza la zona del usuario en el backend.
   */
  updateUserZone(userId: number, callback?: () => void): Subscription {
    if (this.selectedZoneId === null) {
      this.toastr.error("Seleccione una zona válida antes de actualizar.", "Error");
      throw new Error("Zona no seleccionada");
    }
    return this.campiAmigoService.updateUserZone(userId, this.selectedZoneId).subscribe({
      next: () => {
        this.toastr.success("Zona actualizada exitosamente", "Éxito");
        if (callback) callback();
      },
      error: (err) => {
        console.error("Error al actualizar la zona:", err);
        this.toastr.error(err.error.msg || "Error al actualizar la zona", "Error");
      }
    });
  }

  /**
   * Envía la actualización del color del indicador.
   */
  updateIndicator(userId: number, callback?: () => void): Subscription {
    if (!this.indicatorColor) {
      this.toastr.error('Debe ingresar un color.', 'Error');
      throw new Error("Color no ingresado");
    }
    this.indicatorLoading = true;
    return this.indicatorService.updateIndicatorColor(userId, { color: this.indicatorColor, updatedBy: userId })
      .subscribe({
        next: () => {
          this.toastr.success('Indicador actualizado exitosamente.', 'Éxito');
          this.indicatorLoading = false;
          if (callback) callback();
        },
        error: (err) => {
          this.toastr.error(err.error.msg || 'Error al actualizar el indicador.', 'Error');
          this.indicatorLoading = false;
        }
      });
  }

  /**
   * Carga el color actual del indicador.
   */
  loadIndicatorColor(userId: number, callback?: () => void): Subscription {
    return this.indicatorService.getIndicatorData(userId).subscribe({
      next: (data) => {
        this.indicatorColor = data.indicator?.color || '';
        if (callback) callback();
      },
      error: (err) => {
        console.error('Error al cargar el indicador:', err);
        this.indicatorColor = '';
        if (callback) callback();
      }
    });
  }
}
