// src/app/services/tag.service.ts
import { HttpClient, HttpHeaders } from '@angular/common/http'; 
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface TagData {
    id: number;
    userProfileId: number;
    name: string;
    color: string;         // ← ahora incluimos color
    createdAt: string;
    updatedAt: string;
}

@Injectable({
    providedIn: 'root',
})
export class TagCampiaMiGoService {
    private baseUrl: string = `${environment.endpoint}user/admin/`;

    constructor(private http: HttpClient) { }

    private authHeaders(): HttpHeaders {
        const token = localStorage.getItem('token') || '';
        return new HttpHeaders().set('Authorization', `Bearer ${token}`);
    }

    /**
     * Crea una nueva etiqueta con nombre y color.
     * POST /user/admin/tag/{userProfileId}
     */
    createTag(
        userProfileId: number,
        name: string,
        color: string
    ): Observable<{ msg: string; tag: TagData }> {
        const url = `${this.baseUrl}tag/${userProfileId}`;
        return this.http.post<{ msg: string; tag: TagData }>(
            url,
            { name, color },
            { headers: this.authHeaders() }
        );
    }

    /**
     * Obtiene todas las etiquetas de un usuario, incluyendo su color.
     * GET /user/admin/tag/{userProfileId}
     */
    // src/app/services/tag.service.ts
    getUserTags(userProfileId: number): Observable<{ userProfileId: number; tags: TagData[] }> {
        const url = `${this.baseUrl}tag/${userProfileId}/count`;  // <-- añado '/count'
        return this.http.get<{ userProfileId: number; tags: TagData[] }>(
            url,
            { headers: this.authHeaders() }
        );
    }

}
