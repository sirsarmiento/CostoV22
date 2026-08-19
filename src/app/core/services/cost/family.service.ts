import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { Family } from '../../models/Cost/family';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FamilyService {
  private http = inject(HttpClient);

  private sharingObservable = new BehaviorSubject<Family>(this.getEmptyConfig());

  getEmptyConfig(): Family {
    return {
      id: 0,
      codigo: '',
      nombre: '',
      subFamilias: []
    };
  }

  get sharingProject() {
    return this.sharingObservable.asObservable();
  }

  set sharingData(data: Family) {
    this.sharingObservable.next(data);
  }

  resetData() {
    this.sharingObservable.next(this.getEmptyConfig());
  }

  getAll(): Observable<Family[] | { data: Family[] }> {
    return this.http.get<Family[] | { data: Family[] }>(`${environment.apiUrl}/familia`);
  }

  async add(data: Partial<Family>): Promise<Family> {
    const payload = {
      codigo: data.codigo,
      nombre: data.nombre,
      empresaId: 1,
      createBy: 'admin',
      subFamilias: data.subFamilias || []
    };
    return firstValueFrom(this.http.post<Family>(`${environment.apiUrl}/familia`, payload));
  }

  async update(id: number, data: Partial<Family>): Promise<Family> {
    const payload = {
      codigo: data.codigo,
      nombre: data.nombre,
      empresaId: 1,
      createBy: 'admin',
      subFamilias: data.subFamilias || []
    };
    const response = await firstValueFrom(this.http.put<Family>(`${environment.apiUrl}/familia/${id}`, payload));
    this.resetData();
    return response;
  }

  async deleteFamily(id: number): Promise<void> {
    await firstValueFrom(this.http.delete(`${environment.apiUrl}/familia/${id}`));
  }
}
