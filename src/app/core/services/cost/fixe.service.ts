import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Fixe } from '../../models/Cost/fixe';

@Injectable({
  providedIn: 'root'
})
export class FixeService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/fixes`;

  private getMockFixes(): Fixe[] {
    const stored = localStorage.getItem('cost_fixes');
    if (stored) return JSON.parse(stored);
    const initial = environment.mockData.fixes as Fixe[];
    localStorage.setItem('cost_fixes', JSON.stringify(initial));
    return initial;
  }

  getFixes(): Observable<Fixe[]> {
    if (environment.useMocks) return of(this.getMockFixes());
    return this.http.get<Fixe[]>(this.url);
  }

  createFixe(fixe: Fixe): Observable<Fixe> {
    if (environment.useMocks) {
      const fixes = this.getMockFixes();
      const newId = fixes.length > 0 ? Math.max(...fixes.map(f => f.id || 0)) + 1 : 1;
      const newFixe = { ...fixe, id: newId };
      fixes.push(newFixe);
      localStorage.setItem('cost_fixes', JSON.stringify(fixes));
      return of(newFixe);
    }
    return this.http.post<Fixe>(this.url, fixe);
  }

  updateFixe(id: number, fixe: Fixe): Observable<Fixe> {
    if (environment.useMocks) {
      const fixes = this.getMockFixes();
      const index = fixes.findIndex(f => f.id === id);
      if (index !== -1) {
        fixes[index] = { ...fixe, id };
        localStorage.setItem('cost_fixes', JSON.stringify(fixes));
        return of(fixes[index]);
      }
      return of(fixe);
    }
    return this.http.put<Fixe>(`${this.url}/${id}`, fixe);
  }

  deleteFixe(id: number): Observable<void> {
    if (environment.useMocks) {
      let fixes = this.getMockFixes();
      fixes = fixes.filter(f => f.id !== id);
      localStorage.setItem('cost_fixes', JSON.stringify(fixes));
      return of(undefined);
    }
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
