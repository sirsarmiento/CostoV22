import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SkuCoding } from '../../models/Cost/coding';
import { Family } from '../../models/Cost/family';

@Injectable({
  providedIn: 'root'
})
export class CodingService {
  private http = inject(HttpClient);
  private skuUrl = `${environment.apiUrl}/skus`;
  private familyUrl = `${environment.apiUrl}/families`;

  // --- MOCK GETTERS ---
  private getMockSKUs(): SkuCoding[] {
    const stored = localStorage.getItem('cost_skus');
    if (stored) return JSON.parse(stored);
    const initial = environment.mockData.skus as SkuCoding[];
    localStorage.setItem('cost_skus', JSON.stringify(initial));
    return initial;
  }

  private getMockFamilies(): Family[] {
    const stored = localStorage.getItem('cost_families');
    if (stored) return JSON.parse(stored);
    const initial = environment.mockData.families as Family[];
    localStorage.setItem('cost_families', JSON.stringify(initial));
    return initial;
  }

  // --- SKUs CRUD ---
  getSKUs(): Observable<SkuCoding[]> {
    if (environment.useMocks) return of(this.getMockSKUs());
    return this.http.get<SkuCoding[]>(this.skuUrl);
  }

  createSKU(sku: SkuCoding): Observable<SkuCoding> {
    if (environment.useMocks) {
      const skus = this.getMockSKUs();
      const newId = skus.length > 0 ? Math.max(...skus.map(s => s.id || 0)) + 1 : 1;
      const newSku = { ...sku, id: newId };
      skus.push(newSku);
      localStorage.setItem('cost_skus', JSON.stringify(skus));
      return of(newSku);
    }
    return this.http.post<SkuCoding>(this.skuUrl, sku);
  }

  updateSKU(id: number, sku: SkuCoding): Observable<SkuCoding> {
    if (environment.useMocks) {
      const skus = this.getMockSKUs();
      const index = skus.findIndex(s => s.id === id);
      if (index !== -1) {
        skus[index] = { ...sku, id };
        localStorage.setItem('cost_skus', JSON.stringify(skus));
        return of(skus[index]);
      }
      return of(sku);
    }
    return this.http.put<SkuCoding>(`${this.skuUrl}/${id}`, sku);
  }

  deleteSKU(id: number): Observable<void> {
    if (environment.useMocks) {
      let skus = this.getMockSKUs();
      skus = skus.filter(s => s.id !== id);
      localStorage.setItem('cost_skus', JSON.stringify(skus));
      return of(undefined);
    }
    return this.http.delete<void>(`${this.skuUrl}/${id}`);
  }

  // --- FAMILIES CRUD ---
  getFamilies(): Observable<Family[]> {
    if (environment.useMocks) return of(this.getMockFamilies());
    return this.http.get<Family[]>(this.familyUrl);
  }

  createFamily(family: Family): Observable<Family> {
    if (environment.useMocks) {
      const families = this.getMockFamilies();
      const newId = families.length > 0 ? Math.max(...families.map(f => f.id || 0)) + 1 : 1;
      const newFamily = { ...family, id: newId };
      families.push(newFamily);
      localStorage.setItem('cost_families', JSON.stringify(families));
      return of(newFamily);
    }
    return this.http.post<Family>(this.familyUrl, family);
  }

  updateFamily(id: number, family: Family): Observable<Family> {
    if (environment.useMocks) {
      const families = this.getMockFamilies();
      const index = families.findIndex(f => f.id === id);
      if (index !== -1) {
        families[index] = { ...family, id };
        localStorage.setItem('cost_families', JSON.stringify(families));
        return of(families[index]);
      }
      return of(family);
    }
    return this.http.put<Family>(`${this.familyUrl}/${id}`, family);
  }

  deleteFamily(id: number): Observable<void> {
    if (environment.useMocks) {
      let families = this.getMockFamilies();
      families = families.filter(f => f.id !== id);
      localStorage.setItem('cost_families', JSON.stringify(families));
      return of(undefined);
    }
    return this.http.delete<void>(`${this.familyUrl}/${id}`);
  }
}
