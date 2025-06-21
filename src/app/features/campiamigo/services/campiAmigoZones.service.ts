import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
 
export interface ZoneData {
  id: number;
 departamento: string;    // Nombre del departamento. Es un campo obligatorio.
  municipio: string;       // Nombre del municipio. Es un campo obligatorio.
  vereda?: string;         // Nombre de la vereda, quebrada o zona específica. Es opcional.

  cityImage?: string;              // URL o path de la imagen de la ciudad (opcional)
  zoneImage?: string;              // URL o path de la imagen representativa de la zona (opcional) 
   description?: string;
  climate?: 'frio' | 'calido';
  userProfiles?: Array<{ id: number; userId: number }>; // Asumo que esto viene de alguna relación en el backend
  video?: string;                  // Ruta o URL del video asociado a la zona
  modelPath?: string;              // Ruta o URL del modelo 3D (terreno) de la zona
  titleGlb?: string;               // Ruta o URL del archivo .glb para el título u otro asset 3D

  // --- NUEVOS CAMPOS AÑADIDOS ---
  elevation?: number;              // Elevación promedio en metros sobre el nivel del mar (opcional)
  temperature?: number;            // Temperatura promedio en grados Celsius (opcional)
  about?: string;                  // Texto adicional "acerca de" la zona (opcional)
}
// Define la estructura de los filtros que podemos enviar.
export interface ZoneFilters {
  departamento?: string;
  municipio?: string;
  vereda?: string;
  climate?: 'frio' | 'calido';
  search?: string;
}


@Injectable({
  providedIn: 'root',
}) 
export class CampiAmigoZonesService {
  private baseUrl = `${environment.endpoint}user/admin/`;

  constructor(private http: HttpClient) { }

  createZone(formData: FormData): Observable<any> {
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.post<any>(`${this.baseUrl}zones`, formData, { headers });
  }

  /**
   * Obtiene la información de una zona específica.
   */
  getZoneById(zoneId: number): Observable<ZoneData> {
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http
      .get<{ zone: ZoneData }>(`${this.baseUrl}zone/${zoneId}`, { headers })
      .pipe(map(response => response.zone));
  }

  /**
   * Obtiene todas las zonas.
   */
  getAllZones(): Observable<ZoneData[]> {
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http
      .get<{ msg: string; zones: ZoneData[] }>(`${this.baseUrl}zone`, { headers })
      .pipe(map(response => response.zones));
  }

  /**
   * Obtiene zonas, opcionalmente filtrando por clima.
   */
  getZones(climate?: string): Observable<{ msg: string; zones: ZoneData[] }> {
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    let params = new HttpParams();
    if (climate) { params = params.set('climate', climate); }
    return this.http.get<{ msg: string; zones: ZoneData[] }>(`${this.baseUrl}zone`, { headers, params });
  }

  /**
   * Actualiza la zona de un usuario específico.
   */
  updateUserZone(userId: number, zoneId: number): Observable<any> {
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.put<any>(`${this.baseUrl}user/${userId}/zone`, { zoneId }, { headers });
  }

  /**
   * Elimina una zona por su ID.
   */
  deleteZone(zoneId: number): Observable<any> {
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.delete<any>(`${this.baseUrl}zones/${zoneId}`, { headers });
  }
}
