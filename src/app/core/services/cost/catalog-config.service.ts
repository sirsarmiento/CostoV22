import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { MaterialCatalogo, TecnologiaCatalogo } from '../../models/Cost/catalog-config';

@Injectable({
  providedIn: 'root'
})
export class CatalogConfigService {
  private http = inject(HttpClient);

  private defaultTecnologias(): TecnologiaCatalogo[] {
    return [
      { id: 1, codigo: 'FDM', nombre: 'Filamento' },
      { id: 2, codigo: 'SLA', nombre: 'Resina' }
    ];
  }

  private defaultMateriales(): MaterialCatalogo[] {
    return [
      { id: 1, codigo: 'PLA', nombre: 'Ácido Poliláctico', tecnologias: [{ id: 1, codigo: 'FDM', nombre: 'Filamento' }] },
      { id: 2, codigo: 'ABS', nombre: 'Acrilonitrilo Butadieno Estireno', tecnologias: [{ id: 1, codigo: 'FDM', nombre: 'Filamento' }] },
      { id: 3, codigo: 'PET', nombre: 'Polietileno Tereftalato', tecnologias: [{ id: 1, codigo: 'FDM', nombre: 'Filamento' }] },
      { id: 4, codigo: 'RES', nombre: 'Resina', tecnologias: [{ id: 2, codigo: 'SLA', nombre: 'Resina' }] }
    ];
  }

  private getMockTecnologias(): TecnologiaCatalogo[] {
    const stored = localStorage.getItem('cost_tecnologias');
    if (stored) {
      return JSON.parse(stored);
    }
    const initial = this.defaultTecnologias();
    localStorage.setItem('cost_tecnologias', JSON.stringify(initial));
    return initial;
  }

  private getMockMateriales(): MaterialCatalogo[] {
    const stored = localStorage.getItem('cost_materiales_catalogo');
    if (stored) {
      return JSON.parse(stored);
    }
    const initial = this.defaultMateriales();
    localStorage.setItem('cost_materiales_catalogo', JSON.stringify(initial));
    return initial;
  }

  getTecnologias(): Observable<TecnologiaCatalogo[]> {
    if (environment.useMocks) {
      return of(this.getMockTecnologias());
    }
    return this.http.get<{ data?: TecnologiaCatalogo[] } | TecnologiaCatalogo[]>(`${environment.apiUrl}/tecnologias`).pipe(
      map(res => (Array.isArray(res) ? res : res.data) || [])
    );
  }

  createTecnologia(item: TecnologiaCatalogo): Observable<TecnologiaCatalogo> {
    if (environment.useMocks) {
      const list = this.getMockTecnologias();
      const created = { ...item, id: Math.max(0, ...list.map(x => x.id || 0)) + 1 };
      list.push(created);
      localStorage.setItem('cost_tecnologias', JSON.stringify(list));
      return of(created);
    }
    return this.http.post<{ data?: TecnologiaCatalogo } | TecnologiaCatalogo>(`${environment.apiUrl}/tecnologia`, {
      ...item,
      materiales: (item.materiales || []).map(m => m.id)
    }).pipe(map(res => ((res as { data?: TecnologiaCatalogo }).data ?? res) as TecnologiaCatalogo));
  }

  updateTecnologia(id: number, item: TecnologiaCatalogo): Observable<TecnologiaCatalogo> {
    if (environment.useMocks) {
      const list = this.getMockTecnologias();
      const index = list.findIndex(x => x.id === id);
      if (index !== -1) {
        list[index] = { ...item, id };
        localStorage.setItem('cost_tecnologias', JSON.stringify(list));
        return of(list[index]);
      }
      return of(item);
    }
    return this.http.put<{ data?: TecnologiaCatalogo } | TecnologiaCatalogo>(`${environment.apiUrl}/tecnologia/${id}`, {
      ...item,
      materiales: (item.materiales || []).map(m => m.id)
    }).pipe(map(res => ((res as { data?: TecnologiaCatalogo }).data ?? res) as TecnologiaCatalogo));
  }

  deleteTecnologia(id: number): Observable<void> {
    if (environment.useMocks) {
      localStorage.setItem('cost_tecnologias', JSON.stringify(this.getMockTecnologias().filter(x => x.id !== id)));
      return of(undefined);
    }
    return this.http.delete<void>(`${environment.apiUrl}/tecnologia/${id}`);
  }

  getMateriales(): Observable<MaterialCatalogo[]> {
    if (environment.useMocks) {
      return of(this.getMockMateriales());
    }
    return this.http.get<{ data?: MaterialCatalogo[] } | MaterialCatalogo[]>(`${environment.apiUrl}/materiales-catalogo`).pipe(
      map(res => (Array.isArray(res) ? res : res.data) || [])
    );
  }

  createMaterial(item: MaterialCatalogo): Observable<MaterialCatalogo> {
    if (environment.useMocks) {
      const list = this.getMockMateriales();
      const created = { ...item, id: Math.max(0, ...list.map(x => x.id || 0)) + 1 };
      list.push(created);
      localStorage.setItem('cost_materiales_catalogo', JSON.stringify(list));
      return of(created);
    }
    return this.http.post<{ data?: MaterialCatalogo } | MaterialCatalogo>(`${environment.apiUrl}/material-catalogo`, {
      ...item,
      tecnologias: (item.tecnologias || []).map(t => t.id)
    }).pipe(map(res => ((res as { data?: MaterialCatalogo }).data ?? res) as MaterialCatalogo));
  }

  updateMaterial(id: number, item: MaterialCatalogo): Observable<MaterialCatalogo> {
    if (environment.useMocks) {
      const list = this.getMockMateriales();
      const index = list.findIndex(x => x.id === id);
      if (index !== -1) {
        list[index] = { ...item, id };
        localStorage.setItem('cost_materiales_catalogo', JSON.stringify(list));
        return of(list[index]);
      }
      return of(item);
    }
    return this.http.put<{ data?: MaterialCatalogo } | MaterialCatalogo>(`${environment.apiUrl}/material-catalogo/${id}`, {
      ...item,
      tecnologias: (item.tecnologias || []).map(t => t.id)
    }).pipe(map(res => ((res as { data?: MaterialCatalogo }).data ?? res) as MaterialCatalogo));
  }

  deleteMaterial(id: number): Observable<void> {
    if (environment.useMocks) {
      localStorage.setItem('cost_materiales_catalogo', JSON.stringify(this.getMockMateriales().filter(x => x.id !== id)));
      return of(undefined);
    }
    return this.http.delete<void>(`${environment.apiUrl}/material-catalogo/${id}`);
  }
}
