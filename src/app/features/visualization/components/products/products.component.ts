import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
 
import { environment } from '../../../../../environments/environment';
import { CampiAmigoProductsService, Product } from '../../../campiamigo/services/campiAmigoProducts.service';

interface DisplayProduct extends Product {
  imageUrl: string;
  producerName: string;
  producerLocation: string;
  ratingCount?: number; // Añade si lo tienes

}

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.css']
})
export class ProductsComponent implements OnInit {
  searchTerm = '';
  categories = ['Frutas', 'Verduras', 'Orgánicos', 'Lácteos'];
  selectedCategory: string | null = null;
  sortOptions = ['Relevancia', 'Precio ascendente', 'Precio descendente'];
  selectedSort = this.sortOptions[0];

  products: DisplayProduct[] = [];
  loading = false;
  errorMsg: string | null = null;

  defaultImage = 'assets/img/default-product.png';
  accessMode: 'public' | 'private' = 'public'; // Para almacenar el modo de acceso

  constructor(
    private productService: CampiAmigoProductsService,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,

  ) { }

  ngOnInit(): void {
    this.accessMode = this.route.snapshot.data['mode'] || 'public';
    console.log(`ProductsComponent cargado en modo: ${this.accessMode}`); // Para depuración

    this.fetchAllProducts();
  }

  private fetchAllProducts() {
    this.loading = true;
    this.productService.getAllProductsWithUsers().subscribe({
      next: resp => {
        const base = environment.endpoint.endsWith('/') ? environment.endpoint : environment.endpoint + '/';
        this.products = resp.products.map(p => ({
          ...p,
          // imagen
          imageUrl: p.image
            ? `${base}uploads/productos/imagenes/${p.image}`
            : this.defaultImage,
          // productor y ubicación
          producerName: p.auth?.userProfile
            ? `${p.auth.userProfile.firstName} ${p.auth.userProfile.lastName}`
            : '—',
          producerLocation: p.auth?.userProfile?.zone
            ? `${p.auth.userProfile.zone.name} - ${p.auth.userProfile.zone.departamentoName}`
            : '—'
        }));
        this.loading = false;
      },
      error: err => {
        console.error(err);
        this.errorMsg = 'No se pudieron cargar los productos.';
        this.loading = false;
      }
    });
  }

  onImgError(event: Event) {
    const img = event.target as HTMLImageElement;
    if (!img.src.includes(this.defaultImage)) {
      img.src = this.defaultImage;
    }
  }

  getStarType(index: number, rating: number): 'full' | 'half' | 'empty' {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5;
    if (index < full) return 'full';
    if (index === full && half) return 'half';
    return 'empty';
  }
  // Vuelve a la página anterior
  goBack(): void {
    if (this.accessMode === 'private') {
      // Si el usuario está logueado (accedió vía /user/productos),
      // llévalo a su dashboard o a la página anterior relevante en la sección de usuario.
      // '/user/dashboard' es una opción segura.
      console.log('Navegando atrás hacia /user/dashboard');
      this.router.navigate(['/user/dashboard']);
    } else {
      // Si el usuario es público (accedió vía /inicio/productos),
      // llévalo a la página principal de inicio.
      console.log('Navegando atrás hacia /inicio');
      this.router.navigate(['/inicio']);
    }
    // Ya no necesitas this.location.back();
  }
  get filteredProducts() {
    return this.products
      .filter(p =>
        p.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (p.description?.toLowerCase().includes(this.searchTerm.toLowerCase()) ?? false)
      )
      .filter(p =>
        !this.selectedCategory ||
        (p as any).category === this.selectedCategory
      )
      .sort((a, b) => {
        if (this.selectedSort === 'Precio ascendente') return a.price - b.price;
        if (this.selectedSort === 'Precio descendente') return b.price - a.price;
        return 0;
      });
  }

  toggleCategory(cat: string) {
    this.selectedCategory = this.selectedCategory === cat ? null : cat;
  }

  changeSort(opt: string) {
    this.selectedSort = opt;
  }


   // --- ¡FUNCIÓN CORREGIDA! ---
   goToDetail(productId: number): void {
    console.log(`Navegando a detalle del producto ID: ${productId} en modo: ${this.accessMode}`);

    if (this.accessMode === 'private') {
      // Navegación PRIVADA: Usa queryParams (porque dijiste que así funciona)
      console.log('Usando ruta privada con queryParams');
      this.router.navigate(['/user/detalleProducto'], {
        queryParams: { id: productId }
      });
    } else {
      // Navegación PÚBLICA: Usa parámetro de ruta (coincide con :id en inicioRouter.ts)
      console.log('Usando ruta pública con parámetro de ruta');
      this.router.navigate(['/inicio/detalleProducto', productId]); // Pasa el ID como parte de la ruta
    }
  }
}
