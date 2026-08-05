import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Rol } from '../models/rol';

@Injectable({
  providedIn: 'root'
})
export class RolesPermissionsService {
  private http = inject(HttpClient);

  // Mocks fallback
  private getMockRoles(): Rol[] {
    const stored = localStorage.getItem('cost_roles');
    if (stored) {
      return JSON.parse(stored);
    }
    const initial: Rol[] = [
      { id: 1, descripcion: 'Administrador', statusId: 1 },
      { id: 2, descripcion: 'Usuario Normal', statusId: 1 }
    ];
    localStorage.setItem('cost_roles', JSON.stringify(initial));
    return initial;
  }

  getRoles(): Observable<Rol[]> {
    if (environment.useMocks) {
      return of(this.getMockRoles());
    }
    return this.http.get<{ data?: Rol[] } | Rol[]>(`${environment.apiUrl}/rol/list`).pipe(
      map(res => {
        // En caso de que el backend responda con { data: [...] } o directamente el arreglo
        return (Array.isArray(res) ? res : res.data) || [];
      })
    );
  }

  createRole(role: Rol): Observable<Rol> {
    if (environment.useMocks) {
      const roles = this.getMockRoles();
      const newId = roles.length > 0 ? Math.max(...roles.map(r => r.id || 0)) + 1 : 1;
      const newRole = { ...role, id: newId };
      roles.push(newRole);
      localStorage.setItem('cost_roles', JSON.stringify(roles));
      return of(newRole);
    }
    return this.http.post<Rol>(`${environment.apiUrl}/rol`, role);
  }

  updateRole(id: number, role: Rol): Observable<Rol> {
    if (environment.useMocks) {
      const roles = this.getMockRoles();
      const index = roles.findIndex(r => r.id === id);
      if (index !== -1) {
        roles[index] = { ...role, id };
        localStorage.setItem('cost_roles', JSON.stringify(roles));
        return of(roles[index]);
      }
      return of(role);
    }
    return this.http.put<Rol>(`${environment.apiUrl}/rol/${id}`, role);
  }

  deleteRole(id: number): Observable<void> {
    if (environment.useMocks) {
      let roles = this.getMockRoles();
      roles = roles.filter(r => r.id !== id);
      localStorage.setItem('cost_roles', JSON.stringify(roles));
      return of(undefined);
    }
    return this.http.delete<void>(`${environment.apiUrl}/rol/${id}`);
  }
}
