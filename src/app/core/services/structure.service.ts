import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Structure } from '../models/structure';

@Injectable({
  providedIn: 'root'
})
export class StructureService {
  private http = inject(HttpClient);

  getAll() {
    return this.http.get<Structure[] | { data: Structure[] }>(`${environment.apiUrl}/estructuraorganizativa/list`);
  }

  getById(id: number) {
    return this.http.get<Structure[] | { data: Structure[] }>(`${environment.apiUrl}/estructuraorganizativa/listid/${id}`);
  }
}
