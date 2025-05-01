import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs';
import { Profile } from '../../../../../profile/interfaces/profileInterfaces';
import { AdminService } from '../../../../services/admin.service';

export class ProfileLogic {
  profile!: Profile;
  originalProfile!: Profile;
  isModified: boolean = false;
  errorMessage: string = '';

  constructor(
    private adminService: AdminService,
    private toastr: ToastrService,
    private userId: number
  ) { }

  /**
   * Carga el perfil del usuario a partir del userId.
   * Se puede pasar un callback que se ejecuta al finalizar la carga.
   */
  loadProfile(callback?: () => void): Subscription {
    return this.adminService.getProfileByUserIdAdmin(this.userId).subscribe({
      next: (profileData: Profile) => {
        this.profile = profileData;
        // Se crea una copia profunda para poder comparar cambios
        this.originalProfile = JSON.parse(JSON.stringify(profileData));
        if (callback) callback();
      },
      error: (err) => {
        console.error("Error al cargar perfil:", err);
        this.errorMessage = 'Error al cargar el perfil.';
        if (callback) callback();
      }
    });
  }

  /**
   * Verifica si se han realizado modificaciones en el perfil.
   * Se incluye la comparación del campo status.
   */
  checkModified(): void {
    if (!this.profile || !this.originalProfile) {
      this.isModified = false;
      return;
    }
    this.isModified =
      this.profile.firstName !== this.originalProfile.firstName ||
      this.profile.lastName !== this.originalProfile.lastName ||
      this.profile.identificationType !== this.originalProfile.identificationType ||
      this.profile.identificationNumber !== this.originalProfile.identificationNumber ||
      this.profile.biography !== this.originalProfile.biography ||
      this.profile.direccion !== this.originalProfile.direccion ||
      this.profile.birthDate !== this.originalProfile.birthDate ||
      this.profile.gender !== this.originalProfile.gender ||
      this.profile.campiamigo !== this.originalProfile.campiamigo ||
      this.profile.status !== this.originalProfile.status; // Se agrega la comparación de status
  }

  /**
   * Construye el objeto Profile con los datos actuales.
   * Se añade el campo status.
   */
  buildProfileJSON(): Profile {
    if (!this.profile) {
      throw new Error('No hay datos de perfil');
    }
    return {
      userId: this.userId,
      firstName: this.profile.firstName,
      lastName: this.profile.lastName,
      identificationType: this.profile.identificationType,
      identificationNumber: this.profile.identificationNumber,
      biography: this.profile.biography,
      direccion: this.profile.direccion,
      birthDate: this.profile.birthDate,
      gender: this.profile.gender,
      profilePicture: this.profile.profilePicture,
      campiamigo: this.profile.campiamigo,
      // Incluir el campo status con sus opciones: 'pendiente' | 'aprobado' | 'rechazado'
      status: this.profile.status
    };
  }

  /**
   * Envía la actualización del perfil al backend.
   * Se puede pasar un callback para ejecutar acciones tras la actualización.
   */
  updateProfile(callback?: () => void): void {
    if (!this.isModified) {
      this.toastr.info('No se han realizado cambios en el perfil', 'Información');
      return;
    }
    const profileJSON = this.buildProfileJSON();
    this.adminService.updateProfile(this.userId, profileJSON).subscribe({
      next: () => {
        this.toastr.success('Perfil actualizado exitosamente', 'Éxito');
        // Recarga el perfil actualizado
        this.loadProfile(callback);
      },
      error: (err) => {
        this.toastr.error(err.error.msg || 'Error al actualizar el perfil', 'Error');
      }
    });
  }
}
