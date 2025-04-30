// services/product-campiamigo.service.ts
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

/**
 * Zonas de cultivo
 */
export interface Zone {
  id: number;
  name: string;
  departamentoName: string;
  tipoZona: 'municipio' | 'departamento' | 'vereda' | 'ciudad';
  climate: 'frio'   | 'calido'   ;
  cityImage?: string;
  zoneImage?: string;
  // --- CAMPOS AÑADIDOS DESDE EL BACKEND ---
  modelPath?: string; // Ruta al modelo 3D del terreno
  titleGlb?: string;  // Ruta al modelo 3D del título
}

/**
 * Etiquetas de usuario
 */
export interface Tag {
  id: number;
  name: string;
  color: string; // hex o nombre
}

/**
 * Perfil de usuario
 */
export interface UserProfile {
  id: number;
  firstName: string;
  lastName: string;
  biography:string;
  profilePicture?: string;
  direccion?: string;
  zone?: Zone;
  tags?: Tag[];
}

/**
 * Datos de autenticación junto al perfil
 */
export interface Auth {
  id: number;
  email: string;
  phoneNumber?: string;
  rol: 'user' | 'admin' | 'campesino' | 'supervisor';
  status: 'Activado' | 'Desactivado';
  userProfile?: UserProfile;
}

/**
 * Producto (resumen)
 */
export interface Product {
  id: number;
  name: string;
  subtitle?: string;
  description?: string;
  price: number;
  image?: string;
  glbFile?: string;
  video?: string;
  stock: number;
  rating: number;
  reviewCount: number; 
  userId: number;
  auth?: Auth;
}

/**
 * Producto (detalle completo)
 */
export interface ProductDetail extends Product {
  unit: string;                   // ej. "kg"
  minOrder: number;               // pedido mínimoa
  deliveryTime?: string;          // ej. "1-3 días"
  harvestDate?: string;           // YYYY-MM-DD


  // Información nutricional
  calories?: number;              // kcal
  proteins?: number;              // g
  carbohydrates?: number;         // g
  fats?: number;                  // g

  // Arrays
  vitamins?: string[];
  categories?: string[];

  conservation?: string;          // texto de conservación
}

@Injectable({ providedIn: 'root' })
export class CampiAmigoProductsService {
  private baseUrl = `${environment.endpoint}user/admin/`;

  constructor(private http: HttpClient) {}

  /**
   * Crear producto para un usuario
   */
  createProduct(formData: FormData, userId: number): Observable<{ msg: string; product: ProductDetail }> {
    const headers = this.getAuthHeaders();
    return this.http.post<{ msg: string; product: ProductDetail }>(
      `${this.baseUrl}product/${userId}`,
      formData,
      { headers }
    );
  }

  /**
   * Obtener productos de un usuario específico
   */
  getUserProducts(userId: number): Observable<{ msg: string; products: Product[]; count: number }> {
    const headers = this.getAuthHeaders();
    return this.http.get<{ msg: string; products: Product[]; count: number }>(
      `${this.baseUrl}product/${userId}/count`,
      { headers }
    );
  }

  /**
   * Obtener todos los productos con usuarios y perfil
   */
  getAllProductsWithUsers(): Observable<{ msg: string; products: Product[]; count: number }> {
    const headers = this.getAuthHeaders();
    return this.http.get<{ msg: string; products: Product[]; count: number }>(
      `${this.baseUrl}products/all`,
      { headers }
    );
  }

  /**
   * Obtener detalle de un producto por su ID
   */
  getProductById(productId: number): Observable<{ msg: string; product: ProductDetail }> {
    const headers = this.getAuthHeaders();
    return this.http.get<{ msg: string; product: ProductDetail }>(
      `${this.baseUrl}product/detail/${productId}`,
      { headers }
    );
  }

  /**
   * Cabeceras con token JWT
   */
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || '';
    return new HttpHeaders().set('Authorization', `Bearer ${token}`);
  }
}
