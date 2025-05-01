// src/app/admin/user-summary/utils/user-summary-user.logic.ts
import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs';
import { AdminService, AdminUser } from '../../../../services/admin.service';

export class UserLogic {
  // Propiedades de usuario
  userId: number;
  user!: AdminUser | undefined;
  originalUser!: AdminUser;
  errorMessage: string = '';
  selectedFile: File | null = null;
  isModified: boolean = false;

  constructor(
    private adminService: AdminService,
    private toastr: ToastrService,
    userId: number
  ) {
    this.userId = userId;
  }

  /**
   * Carga la información de usuarios y asigna el usuario actual según userId.
   * Se puede pasar un callback para ejecutar acciones tras la carga.
   */
  loadUser(callback?: () => void): Subscription {
    return this.adminService.getAllUsers().subscribe({
      next: (data: AdminUser[]) => {
        this.user = data.find(u => u.id === this.userId);
        if (!this.user) {
          this.errorMessage = 'Usuario no encontrado.';
        } else {
          // Copia del usuario para comparar cambios
          this.originalUser = JSON.parse(JSON.stringify(this.user));
        }
        if (callback) callback();
      },
      error: (err) => {
        console.error("Error al obtener usuarios:", err);
        this.errorMessage = 'No se pudo cargar la información del usuario.';
        if (callback) callback();
      }
    });
  }

  /**
   * Verifica si hubo modificaciones en la información del usuario.
   */
  checkUserModified(): void {
    if (!this.user || !this.originalUser) {
      this.isModified = false;
      return;
    }
    this.isModified =
      this.user.username !== this.originalUser.username ||
      this.user.email !== this.originalUser.email ||
      this.user.phoneNumber !== this.originalUser.phoneNumber ||
      this.user.rol !== this.originalUser.rol ||
      !!this.selectedFile;
  }

  /**
   * Construye el FormData para actualizar el usuario.
   */
  buildUserFormData(): FormData {
    const formData = new FormData();
    if (this.user) {
      formData.append('username', this.user.username);
      formData.append('email', this.user.email);
      formData.append('rol', this.user.rol);
      if (this.user.phoneNumber) {
        formData.append('phoneNumber', this.user.phoneNumber);
      }
      if (this.selectedFile) {
        formData.append('profilePicture', this.selectedFile);
      }
    }
    return formData;
  }

  /**
   * Envía la actualización del usuario.
   */
  updateUser(callback?: () => void): void {
    if (!this.isModified) {
      this.toastr.info('No se han realizado cambios para actualizar', 'Información');
      return;
    }
    if (!this.user) return;

    const formData = this.buildUserFormData();
    this.adminService.updateUser(this.user.id, formData).subscribe({
      next: () => {
        this.toastr.success('Cuenta actualizada exitosamente', 'Éxito');
        this.isModified = false;
        this.selectedFile = null;
        // Recarga el usuario luego de la actualización
        this.loadUser(callback);
      },
      error: (err) => {
        this.toastr.error(err.error.msg || 'Error al actualizar el usuario', 'Error');
        this.errorMessage = 'Error al actualizar el usuario.';
      }
    });
  }

  /**
   * Maneja la selección de archivo para la imagen del usuario.
   */
  onFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      this.selectedFile = target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        this.checkUserModified();
      };
      reader.readAsDataURL(this.selectedFile);
    }
  }

  /**
   * Actualiza el estado actual del usuario consultando al backend.
   */
  updateUserStatus(callback?: () => void): Subscription {
    return this.adminService.getAllUsers().subscribe({
      next: (data: AdminUser[]) => {
        const updatedUser = data.find(u => u.id === this.userId);
        if (updatedUser && this.user) {
          this.user.status = updatedUser.status;
        }
        if (callback) callback();
      },
      error: (err) => {
        console.error("Error al actualizar el status del usuario:", err);
        if (callback) callback();
      }
    });
  }
}
