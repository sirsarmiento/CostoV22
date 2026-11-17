import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CatalogoSimple, MaterialCatalogo, TecnologiaCatalogo } from '../../models/Cost/catalog-config';

@Injectable({
  providedIn: 'root'
})
export class CatalogConfigService {
  private http = inject(HttpClient);

  private defaultTecnologias(): TecnologiaCatalogo[] {
    return [
      { id: 1, codigo: 'FDM', nombre: 'Filamento' },
      { id: 2, codigo: 'SLA', nombre: 'Resina' },
      { id: 3, codigo: 'CNC', nombre: 'Control numérico' },
      { id: 4, codigo: 'LSR', nombre: 'Corte láser' },
      { id: 5, codigo: 'CHO', nombre: 'Chocolate' },
      { id: 6, codigo: 'ALM', nombre: 'Alimentos' }
    ];
  }

  private defaultMateriales(): MaterialCatalogo[] {
    const fdm = { id: 1, codigo: 'FDM', nombre: 'Filamento' };
    const sla = { id: 2, codigo: 'SLA', nombre: 'Resina' };
    const cnc = { id: 3, codigo: 'CNC', nombre: 'Control numérico' };
    const lsr = { id: 4, codigo: 'LSR', nombre: 'Corte láser' };
    const cho = { id: 5, codigo: 'CHO', nombre: 'Chocolate' };
    return [
      { id: 1, codigo: 'PLA', nombre: 'Ácido Poliláctico', tecnologias: [fdm] },
      { id: 2, codigo: 'ABS', nombre: 'Acrilonitrilo Butadieno Estireno', tecnologias: [fdm] },
      { id: 3, codigo: 'PET', nombre: 'Polietileno Tereftalato', tecnologias: [fdm] },
      { id: 4, codigo: 'RES', nombre: 'Resina', tecnologias: [sla] },
      { id: 5, codigo: 'PCB', nombre: 'Circuito impreso', tecnologias: [cnc] },
      { id: 6, codigo: 'ACR', nombre: 'Acrílico negro', tecnologias: [lsr] },
      { id: 7, codigo: 'CUE', nombre: 'Cuero', tecnologias: [lsr] },
      { id: 8, codigo: 'CAR', nombre: 'Cartón', tecnologias: [lsr] },
      { id: 9, codigo: 'CTU', nombre: 'Cartulina', tecnologias: [lsr] },
      { id: 10, codigo: 'VIN', nombre: 'Vinilo', tecnologias: [lsr] },
      { id: 11, codigo: 'CHO', nombre: 'Chocolate', tecnologias: [cho] }
    ];
  }

  private getMockTecnologias(): TecnologiaCatalogo[] {
    const stored = localStorage.getItem('cost_tecnologias');
    const actuales: TecnologiaCatalogo[] = stored ? JSON.parse(stored) : [];
    const fusion = [...actuales];
    this.defaultTecnologias().forEach(defecto => {
      if (!fusion.some(item => (item.codigo || '').toUpperCase() === defecto.codigo)) {
        fusion.push({ ...defecto, id: Math.max(0, ...fusion.map(x => x.id || 0)) + 1 });
      }
    });
    localStorage.setItem('cost_tecnologias', JSON.stringify(fusion.length ? fusion : this.defaultTecnologias()));
    return fusion.length ? fusion : this.defaultTecnologias();
  }

  private getMockMateriales(): MaterialCatalogo[] {
    const stored = localStorage.getItem('cost_materiales_catalogo');
    const actuales: MaterialCatalogo[] = stored ? JSON.parse(stored) : [];
    const fusion = [...actuales];
    this.defaultMateriales().forEach(defecto => {
      if (!fusion.some(item => (item.codigo || '').toUpperCase() === defecto.codigo)) {
        fusion.push({ ...defecto, id: Math.max(0, ...fusion.map(x => x.id || 0)) + 1 });
      }
    });
    localStorage.setItem('cost_materiales_catalogo', JSON.stringify(fusion.length ? fusion : this.defaultMateriales()));
    return fusion.length ? fusion : this.defaultMateriales();
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

  private defaultMarcas(): CatalogoSimple[] {
    return [
      { id: 1, nombre: 'Overtour' },
      { id: 2, nombre: 'Politra' },
      { id: 3, nombre: 'Guimodor' },
      { id: 4, nombre: 'Rebel' },
      { id: 5, nombre: 'Creimatx' }
    ];
  }

  private defaultColores(): CatalogoSimple[] {
    return [
      { id: 1, nombre: 'Negro' },
      { id: 2, nombre: 'Blanco' },
      { id: 3, nombre: 'Gris' },
      { id: 4, nombre: 'Rojo' },
      { id: 5, nombre: 'Azul' },
      { id: 6, nombre: 'Amarillo' },
      { id: 7, nombre: 'Verde' },
      { id: 8, nombre: 'Transparente' },
      { id: 9, nombre: 'Natural' }
    ];
  }

  private getMockSimple(key: string, seed: CatalogoSimple[]): CatalogoSimple[] {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
    localStorage.setItem(key, JSON.stringify(seed));
    return seed;
  }

  getMarcas(): Observable<CatalogoSimple[]> {
    if (environment.useMocks) {
      return of(this.getMockSimple('cost_marcas', this.defaultMarcas()));
    }
    return this.http.get<{ data?: CatalogoSimple[] } | CatalogoSimple[]>(`${environment.apiUrl}/marcas`).pipe(
      map(res => (Array.isArray(res) ? res : res.data) || [])
    );
  }

  createMarca(item: CatalogoSimple): Observable<CatalogoSimple> {
    return this.guardarSimple('cost_marcas', this.defaultMarcas(), item, 'marca');
  }

  updateMarca(id: number, item: CatalogoSimple): Observable<CatalogoSimple> {
    return this.actualizarSimple('cost_marcas', this.defaultMarcas(), id, item, 'marca');
  }

  deleteMarca(id: number): Observable<void> {
    return this.borrarSimple('cost_marcas', this.defaultMarcas(), id, 'marca');
  }

  getColores(): Observable<CatalogoSimple[]> {
    if (environment.useMocks) {
      return of(this.getMockSimple('cost_colores', this.defaultColores()));
    }
    return this.http.get<{ data?: CatalogoSimple[] } | CatalogoSimple[]>(`${environment.apiUrl}/colores`).pipe(
      map(res => (Array.isArray(res) ? res : res.data) || [])
    );
  }

  createColor(item: CatalogoSimple): Observable<CatalogoSimple> {
    return this.guardarSimple('cost_colores', this.defaultColores(), item, 'color');
  }

  updateColor(id: number, item: CatalogoSimple): Observable<CatalogoSimple> {
    return this.actualizarSimple('cost_colores', this.defaultColores(), id, item, 'color');
  }

  deleteColor(id: number): Observable<void> {
    return this.borrarSimple('cost_colores', this.defaultColores(), id, 'color');
  }

  private guardarSimple(key: string, seed: CatalogoSimple[], item: CatalogoSimple, endpoint: string): Observable<CatalogoSimple> {
    if (environment.useMocks) {
      const list = this.getMockSimple(key, seed);
      const created = { ...item, id: Math.max(0, ...list.map(x => x.id || 0)) + 1 };
      list.push(created);
      localStorage.setItem(key, JSON.stringify(list));
      return of(created);
    }
    return this.http.post<{ data?: CatalogoSimple } | CatalogoSimple>(`${environment.apiUrl}/${endpoint}`, item).pipe(
      map(res => ((res as { data?: CatalogoSimple }).data ?? res) as CatalogoSimple)
    );
  }

  private actualizarSimple(key: string, seed: CatalogoSimple[], id: number, item: CatalogoSimple, endpoint: string): Observable<CatalogoSimple> {
    if (environment.useMocks) {
      const list = this.getMockSimple(key, seed);
      const index = list.findIndex(x => x.id === id);
      if (index !== -1) {
        list[index] = { ...item, id };
        localStorage.setItem(key, JSON.stringify(list));
        return of(list[index]);
      }
      return of(item);
    }
    return this.http.put<{ data?: CatalogoSimple } | CatalogoSimple>(`${environment.apiUrl}/${endpoint}/${id}`, item).pipe(
      map(res => ((res as { data?: CatalogoSimple }).data ?? res) as CatalogoSimple)
    );
  }

  private borrarSimple(key: string, seed: CatalogoSimple[], id: number, endpoint: string): Observable<void> {
    if (environment.useMocks) {
      localStorage.setItem(key, JSON.stringify(this.getMockSimple(key, seed).filter(x => x.id !== id)));
      return of(undefined);
    }
    return this.http.delete<void>(`${environment.apiUrl}/${endpoint}/${id}`);
  }
}
