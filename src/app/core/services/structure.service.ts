import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class StructureService {
  private http = inject(HttpClient);

  getAll() {
    return this.http.get<any>(`${environment.apiUrl}/estructuraorganizativa/list`);
  }

  getById(id: number) {
    return this.http.get<any>(`${environment.apiUrl}/estructuraorganizativa/listid/${id}`);
  }
}
