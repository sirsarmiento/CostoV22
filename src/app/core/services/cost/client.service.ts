import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { Client } from '../../models/Cost/client';

@Injectable({
  providedIn: 'root'
})
export class ClientService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/clientes`;

  private getMockClients(): Client[] {
    const stored = localStorage.getItem('cost_clients');
    if (stored) {
      return JSON.parse(stored);
    }
    const initial: Client[] = [
      { id: 1, nombre: 'Empresa', apellido: 'Alpha S.A.', email: 'contacto@alpha.com', telefono: '+58 412 111 2233', direccion: 'Caracas, Venezuela', totalCompras: 1250.00, fechaRegistro: '2026-01-15' },
      { id: 2, nombre: 'Industrias', apellido: 'Beta C.A.', email: 'ventas@beta.com', telefono: '+58 414 555 6677', direccion: 'Valencia, Venezuela', totalCompras: 3400.50, fechaRegistro: '2026-02-10' }
    ];
    localStorage.setItem('cost_clients', JSON.stringify(initial));
    return initial;
  }

  getClients(): Observable<Client[]> {
    if (environment.useMocks) {
      return of(this.getMockClients());
    }
    return this.http.get<{ data?: Client[] } | Client[]>(this.url).pipe(
      map(res => (Array.isArray(res) ? res : res.data) || []),
      catchError(() => of([]))
    );
  }

  getClientById(id: number): Observable<Client | undefined> {
    if (environment.useMocks) {
      const clients = this.getMockClients();
      return of(clients.find(c => Number(c.id) === Number(id)));
    }
    return this.http.get<{ data?: Client } | Client>(`${environment.apiUrl}/clientes/${id}`).pipe(
      map(res => {
        if (!res) return undefined;
        if (typeof res === 'object' && 'data' in res && res.data) {
          return res.data;
        }
        return res as Client;
      }),
      catchError(() => {
        return this.http.get<{ data?: Client } | Client>(`${environment.apiUrl}/cliente/${id}`).pipe(
          map(res => {
            if (!res) return undefined;
            if (typeof res === 'object' && 'data' in res && res.data) {
              return res.data;
            }
            return res as Client;
          }),
          catchError(() => {
            return this.getClients().pipe(
              map(clients => clients.find(c => Number(c.id) === Number(id)))
            );
          })
        );
      })
    );
  }

  createClient(client: Client): Observable<Client> {
    if (environment.useMocks) {
      const clients = this.getMockClients();
      const newId = clients.length > 0 ? Math.max(...clients.map(c => c.id || 0)) + 1 : 1;
      const newClient = { ...client, id: newId, fechaRegistro: new Date().toISOString().split('T')[0] };
      clients.push(newClient);
      localStorage.setItem('cost_clients', JSON.stringify(clients));
      return of(newClient);
    }
    const payload: Partial<Client> = { ...client };
    delete payload.id;
    return this.http.post<Client>(`${environment.apiUrl}/cliente`, payload);
  }

  updateClient(id: number, client: Client): Observable<Client> {
    if (environment.useMocks) {
      const clients = this.getMockClients();
      const index = clients.findIndex(c => c.id === id);
      if (index !== -1) {
        clients[index] = { ...client, id };
        localStorage.setItem('cost_clients', JSON.stringify(clients));
        return of(clients[index]);
      }
      return of(client);
    }
    const payload: Partial<Client> = { ...client };
    delete payload.id;
    return this.http.put<Client>(`${environment.apiUrl}/cliente/${id}`, payload);
  }

  deleteClient(id: number): Observable<void> {
    if (environment.useMocks) {
      let clients = this.getMockClients();
      clients = clients.filter(c => c.id !== id);
      localStorage.setItem('cost_clients', JSON.stringify(clients));
      return of(undefined);
    }
    return this.http.delete<void>(`${environment.apiUrl}/cliente/${id}`);
  }
}
