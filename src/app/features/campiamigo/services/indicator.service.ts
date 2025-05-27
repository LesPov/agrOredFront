// src/app/campiamigo/services/indicator.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface GetIndicatorResponse {
  msg: string;
  indicator: IndicatorResponse;
}

export interface IndicatorResponse {
  id: number;
  zoneId: number;
  userId: number;    // userProfile.id
  color: string;
  x: number; y: number; z: number;
  updatedBy?: number;
  createdAt?: string;
  updatedAt?: string;
  zone?: {
    id: number;
    name: string;
    tipoZona: string;
    zoneImage: string;
    departamentoName?: string; // <-- Nuevo campo
    climate?: string;        // <-- Nuevo campo
    about?: string;  
  };
  userProfile?: {
    id: number;          // userProfile.id
    userId: number;      // auth.id
    profilePicture?: string;
    firstName: string;
    lastName: string;
    identificationType?: string;
    identificationNumber?: string;
    biography?: string;
    direccion?: string;
    birthDate?: string;
    gender?: string;
    status?: string;
    campiamigo?: boolean;
    zoneId?: number;
    createdAt?: string;
    updatedAt?: string;
    auth?: {
      id: number;
      username?: string;
      email?: string;
      phoneNumber?: string;
      status?: 'Activado' | 'Desactivado';
      products?: Array<{
        id: number;
        name: string;
        description?: string;
        price: number;
        image?: string;
        glbFile?: string;
        video?: string;
      }>;
    };
    // Ahora las etiquetas vienen **directamente** en userProfile.tags
    tags?: Array<{
      id: number;
      name: string;
      color: string;
      createdAt: string;
      updatedAt: string;
    }>;
  };
}

@Injectable({ providedIn: 'root' })
export class IndicatorService {
  private baseUrl = `${environment.endpoint}user/admin/`;

  constructor(private http: HttpClient) { }

  getIndicatorData(userProfileId: number): Observable<GetIndicatorResponse> {
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.get<GetIndicatorResponse>(
      `${this.baseUrl}zones/indicator/${userProfileId}`,
      { headers }
    );
  }

  updateIndicatorColor(
    userProfileId: number,
    updateData: { color: string; updatedBy: number }
  ): Observable<IndicatorResponse> {
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.put<IndicatorResponse>(
      `${this.baseUrl}zones/indicator-colors/${userProfileId}`,
      updateData,
      { headers }
    );
  }

  updateIndicatorPosition(
    userProfileId: number,
    positionData: { x: number; y: number; z: number }
  ): Observable<any> {
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.put<any>(
      `${this.baseUrl}zones/indicator-position/${userProfileId}`,
      positionData,
      { headers }
    );
  }
}
