import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { interval, Subscription } from 'rxjs';

// Servicios y modelos
import { AdminService } from '../../../services/admin.service';
import { UserStatusService } from '../../../services/user-status.service';

import { environment } from '../../../../../../environments/environment';

// Importar las lógicas existentes
import { UserLogic } from './utils/user-summary-user.logic';
import { ProfileLogic } from './utils/user-summary-profile.logic';
import { ZoneIndicatorLogic } from './utils/user-summary-zone.logic';
import { TagCampiaMiGoService, TagData } from '../../../../campiamigo/services/tag.service';
import { CampiAmigoProductsService, ProductDetail } from '../../../../campiamigo/services/campiAmigoProducts.service';
import { IndicatorService } from '../../../../campiamigo/services/indicator.service';
import { CampiAmigoZonesService } from '../../../../campiamigo/services/campiAmigoZones.service';

@Component({
  selector: 'app-user-summary',
  imports: [RouterModule, CommonModule, FormsModule],
  templateUrl: './user-summary.component.html',
  styleUrls: ['./user-summary.component.css']
})
export class UserSummaryComponent implements OnInit, OnDestroy {

  // IDs y flags
  userId!: number;
  errorMessage = '';
  savedCampiamigo = false;

  // Lógicas delegadas
  userLogic!: UserLogic;
  profileLogic!: ProfileLogic;
  zoneIndicatorLogic!: ZoneIndicatorLogic;

  // Archivos para perfil
  selectedProfileFile: File | null = null;
  profilePreview: string | ArrayBuffer | null = null;

  // *** NUEVAS PROPIEDADES PARA CREAR PRODUCTO ***
  productName = '';
  productDescription = '';
  productSubtitle = '';

  productPrice!: number;
  productUnit = 'kg';

  productStock = 0;           // ← stock como número
  productMinOrder = 1;
  productDeliveryTime = '';
  productHarvestDate = '';

  productConservation = '';

  productCalories!: number;
  productProteins!: number;
  productCarbohydrates!: number;
  productFats!: number;

  // Se reciben como CSV o JSON-string
  productVitamins = '';
  productCategories = '';

  // Archivos multimedia
  selectedProductImage: File | null = null;
  selectedProductVideo: File | null = null;
  selectedProductModel: File | null = null;

  roles = ['user', 'admin', 'supervisor'];

  // Subscripciones
  statusSubscription!: Subscription;
  pollingSubscription!: Subscription;
  profileSubscription!: Subscription;

  // Productos paginados
  products: ProductDetail[] = [];
  productCount = 0;
  currentPage = 1;
  itemsPerPage = 5;

  // Etiquetas
  tagColor = '#cccccc';
  tagName = '';
  tags: TagData[] = [];
  tagsLoading = false;

  @ViewChild('userDetails') userDetails!: ElementRef;
  @ViewChild('profileDetails') profileDetails!: ElementRef;
  @ViewChild('zoneDetails') zoneDetails!: ElementRef;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private adminService: AdminService,
    private userStatusService: UserStatusService,
    private toastr: ToastrService,
    private campiAmigoService: CampiAmigoZonesService,
    private indicatorService: IndicatorService,
    private productService: CampiAmigoProductsService,
    private tagService: TagCampiaMiGoService,
  ) { }
  ngOnInit(): void {
    // Obtiene el userId de la URL
    this.userId = Number(this.route.snapshot.paramMap.get('id'));

    // Inicializar las lógicas existentes
    this.userLogic = new UserLogic(this.adminService, this.toastr, this.userId);
    this.profileLogic = new ProfileLogic(this.adminService, this.toastr, this.userId);
    this.zoneIndicatorLogic = new ZoneIndicatorLogic(this.campiAmigoService, this.indicatorService, this.toastr);

    this.zoneIndicatorLogic.loadAllZones();

    this.profileSubscription = this.profileLogic.loadProfile(() => {
      this.savedCampiamigo = this.profileLogic.profile.campiamigo ?? false;
      if (this.savedCampiamigo) {
        this.zoneIndicatorLogic.loadCurrentZone({
          campiamigo: this.profileLogic.profile.campiamigo ?? false,
          zoneId: this.profileLogic.profile.zoneId
        });
        this.zoneIndicatorLogic.loadIndicatorColor(this.profileLogic.profile.userId);
      } else {
        this.zoneIndicatorLogic.currentZone = null;
        this.zoneIndicatorLogic.indicatorColor = '';
      }
      // Cargar el listado completo de productos del usuario
      this.loadUserProducts();
    });

    // Otros métodos de carga, suscripciones, polling, etc.
    this.userLogic.loadUser(() => {
      this.errorMessage = this.userLogic.errorMessage;
    });
    this.statusSubscription = this.userStatusService.status$.subscribe(status => {
      if (this.userLogic.user) {
        this.userLogic.user.status = status as 'Activado' | 'Desactivado';
      }
    });
    this.pollingSubscription = interval(5000).subscribe(() => {
      this.userLogic.updateUserStatus();
    });
    // cargar etiquetas tras cargar perfil
    this.profileSubscription.add(() => {
      this.loadUserTags();
    });
  }

  ngOnDestroy(): void {
    this.statusSubscription?.unsubscribe();
    this.pollingSubscription?.unsubscribe();
    this.profileSubscription?.unsubscribe();
  }

  loadUserTags(): void {
    this.tagsLoading = true;
    this.tagService.getUserTags(this.userId).subscribe({
      next: (res) => {
        this.tags = res.tags;
        this.tagsLoading = false;
      },
      error: (err) => {
        console.error('Error al cargar etiquetas:', err);
        this.toastr.error('No se pudieron cargar las etiquetas.', 'Error');
        this.tagsLoading = false;
      }
    });
  }

  createTag(): void {
    if (!this.tagName.trim()) {
      this.toastr.error('El nombre de la etiqueta no puede estar vacío.', 'Error');
      return;
    }
    // Llamamos al servicio con name + color
    this.tagService.createTag(this.userId, this.tagName.trim(), this.tagColor).subscribe({
      next: () => {
        this.toastr.success('Etiqueta creada.', 'Éxito');
        this.tagName = '';
        this.tagColor = '#cccccc';   // reinicio al color por defecto
        this.loadUserTags();
      },
      error: (err) => {
        console.error('Error al crear etiqueta:', err);
        const msg = err.error?.msg || 'Error al crear etiqueta.';
        this.toastr.error(msg, 'Error');
      }
    });
  }

  // Optimiza *ngFor en la lista de tags
  trackByTagId(index: number, tag: TagData): number {
    return tag.id;
  }
  // Getter para obtener los productos de la página actual.
  // --- Productos ---
  get paginatedProducts(): ProductDetail[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.products.slice(start, start + this.itemsPerPage);
  }
  get totalPages(): number {
    return Math.ceil(this.products.length / this.itemsPerPage);
  }
  nextPage() { if (this.currentPage < this.totalPages) this.currentPage++; }
  prevPage() { if (this.currentPage > 1) this.currentPage--; }


  loadUserProducts(): void {
    this.productService.getUserProducts(this.userId).subscribe({
      next: res => {
        // Asumo que back ya envía todos los campos de ProductDetail
        this.products = res.products as ProductDetail[];
        this.productCount = res.count;
        this.currentPage = 1;
      },
      error: err => console.error('Error al cargar productos:', err)
    });
  }

  // Métodos delegados a la lógica de usuario
  updateUser(): void {
    this.userLogic.updateUser(() => {
      this.userDetails.nativeElement.removeAttribute('open');
    });
  }

  onFileSelected(event: Event): void {
    this.userLogic.onFileSelected(event);
  }

  // Métodos para el perfil delegados a ProfileLogic
  checkProfileModified(): void {
    this.profileLogic.checkModified();
  }

  updateProfileData(): void {
    this.profileLogic.updateProfile(() => {
      this.profileDetails.nativeElement.removeAttribute('open');
    });
  }

  onProfileFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      this.selectedProfileFile = target.files[0];
      this.checkProfileModified();
    }
  }

  // Funciones para la imagen del perfil
  getImageUrl(profilePicture?: string): string {
    if (this.profilePreview) {
      return this.profilePreview as string;
    }
    if (!profilePicture) {
      return '../../../../../../assets/img/default-user.png';
    }
    return `${environment.endpoint}uploads/client/profile/${profilePicture}`;
  }

  getProfileImageUrl(profilePicture: string): string {
    if (!profilePicture) {
      return '../../../../../../assets/img/default-user.png';
    }
    return `${environment.endpoint}uploads/profile/${profilePicture}`;
  }

  // Métodos delegados a la lógica de zona e indicador
  toggleDepartmentList(): void {
    this.zoneIndicatorLogic.toggleDepartmentList();
  }

  onDepartmentSelect(dept: string): void {
    this.zoneIndicatorLogic.onDepartmentSelect(dept);
  }

  onZoneSelect(zoneId: any): void {
    this.zoneIndicatorLogic.onZoneSelect(zoneId);
  }

  updateUserZone(): void {
    this.zoneIndicatorLogic.updateUserZone(this.userId, () => {
      this.profileLogic.loadProfile();
    });
  }

  updateIndicator(): void {
    this.zoneIndicatorLogic.updateIndicator(
      this.profileLogic.profile ? this.profileLogic.profile.userId : this.userId,
      () => {
        this.zoneIndicatorLogic.loadIndicatorColor(
          this.profileLogic.profile ? this.profileLogic.profile.userId : this.userId
        );
      }
    );
  }

  loadIndicatorColor(): void {
    this.zoneIndicatorLogic.loadIndicatorColor(
      this.profileLogic.profile ? this.profileLogic.profile.userId : this.userId
    );
  }

  onProductImageSelected(e: Event) {
    const f = (e.target as HTMLInputElement).files;
    if (f?.length) this.selectedProductImage = f[0];
  }
  onProductVideoSelected(e: Event) {
    const f = (e.target as HTMLInputElement).files;
    if (f?.length) this.selectedProductVideo = f[0];
  }
  onProductModelSelected(e: Event) {
    const f = (e.target as HTMLInputElement).files;
    if (f?.length) this.selectedProductModel = f[0];
  }

  createProduct(): void {
    if (!this.productName || this.productPrice == null) {
      this.toastr.error('Nombre y precio son obligatorios.', 'Error');
      return;
    }
    const fd = new FormData();
    fd.append('name', this.productName);
    fd.append('price', this.productPrice.toString());
    fd.append('stock', this.productStock.toString());

    if (this.productSubtitle) fd.append('subtitle', this.productSubtitle);

    if (this.productDescription) fd.append('description', this.productDescription);
 
    fd.append('unit', this.productUnit);
    fd.append('minOrder', this.productMinOrder.toString());
    if (this.productDeliveryTime) fd.append('deliveryTime', this.productDeliveryTime);
    if (this.productHarvestDate) fd.append('harvestDate', this.productHarvestDate);
  
    if (this.productConservation) fd.append('conservation', this.productConservation);

    fd.append('calories', String(this.productCalories || ''));
    fd.append('proteins', String(this.productProteins || ''));
    fd.append('carbohydrates', String(this.productCarbohydrates || ''));
    fd.append('fats', String(this.productFats || ''));

    // vitamins & categories como JSON
    try {
      const vArr = JSON.parse(this.productVitamins);
      fd.append('vitamins', JSON.stringify(Array.isArray(vArr) ? vArr : this.productVitamins.split(',').map(s=>s.trim())));
    } catch {
      fd.append('vitamins', JSON.stringify(this.productVitamins.split(',').map(s=>s.trim())));
    }
    try {
      const cArr = JSON.parse(this.productCategories);
      fd.append('categories', JSON.stringify(Array.isArray(cArr) ? cArr : this.productCategories.split(',').map(s=>s.trim())));
    } catch {
      fd.append('categories', JSON.stringify(this.productCategories.split(',').map(s=>s.trim())));
    }

    if (this.selectedProductImage)
      fd.append('imagenes', this.selectedProductImage, this.selectedProductImage.name);
    if (this.selectedProductVideo)
      fd.append('videos', this.selectedProductVideo, this.selectedProductVideo.name);
    if (this.selectedProductModel)
      fd.append('modelos', this.selectedProductModel, this.selectedProductModel.name);

    this.productService.createProduct(fd, this.userId).subscribe({
      next: () => {
        this.toastr.success('Producto creado exitosamente', 'Éxito');
        // reset campos
        this.productName = this.productSubtitle = this.productDescription = '';
        this.productPrice = this.productStock = this.productMinOrder =
        this.productCalories = this.productProteins =
        this.productCarbohydrates = this.productFats = 0;
        this.productUnit = 'kg';
        this.productDeliveryTime = this.productHarvestDate = '';
        this.productVitamins = this.productCategories = '';
        this.productConservation = '';
        this.selectedProductImage = this.selectedProductVideo = this.selectedProductModel = null;

        this.loadUserProducts();
      },
      error: err => {
        console.error(err);
        this.toastr.error(err.error?.msg || 'Error al crear producto', 'Error');
      }
    });
  }
  
  viewProduct(id: number) {
    this.router.navigate(['/admin/users', this.userId, 'product', id]);
  }
  // Funciones compartidas y de navegación
  goBack(): void {
    this.router.navigate(['/admin/users']);
  }

  getStatusClass(status: string): string {
    if (!status) return 'status-default';
    switch (status.toLowerCase()) {
      case 'activado':
        return 'status-activado';
      case 'desactivado':
        return 'status-desactivado';
      default:
        return 'status-default';
    }
  }
}
