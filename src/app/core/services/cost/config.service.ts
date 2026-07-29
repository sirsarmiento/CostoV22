import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Config } from '../../models/Cost/config';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/perfil`;

  private getMockConfigs(): Config[] {
    const stored = localStorage.getItem('cost_configs');
    if (stored) {
      return JSON.parse(stored);
    }
    const initial = environment.mockData.configs as Config[];
    localStorage.setItem('cost_configs', JSON.stringify(initial));
    return initial;
  }

  getConfigs(): Observable<Config[]> {
    if (environment.useMocks) {
      return of(this.getMockConfigs());
    }
    return this.http.get<{ data?: Config[] } | Config[]>(this.url).pipe(
      map(res => (Array.isArray(res) ? res : res.data) || [])
    );
  }

  createConfig(config: Config): Observable<Config> {
    if (environment.useMocks) {
      const configs = this.getMockConfigs();
      const newId = configs.length > 0 ? Math.max(...configs.map(c => c.id || 0)) + 1 : 1;
      const newConfig = { ...config, id: newId };
      configs.push(newConfig);
      localStorage.setItem('cost_configs', JSON.stringify(configs));
      return of(newConfig);
    }
    const payload: Partial<Config> = { ...config };
    delete payload.id;
    return this.http.post<Config>(this.url, payload);
  }

  updateConfig(id: number, config: Config): Observable<Config> {
    if (environment.useMocks) {
      const configs = this.getMockConfigs();
      const index = configs.findIndex(c => c.id === id);
      if (index !== -1) {
        configs[index] = { ...config, id };
        localStorage.setItem('cost_configs', JSON.stringify(configs));
        return of(configs[index]);
      }
      return of(config); // Si no se encuentra, retornamos igual para evitar errores
    }
    const payload: Partial<Config> = { ...config };
    delete payload.id;
    return this.http.put<Config>(`${environment.apiUrl}/perfil/${id}`, payload);
  }

  deleteConfig(id: number): Observable<void> {
    if (environment.useMocks) {
      let configs = this.getMockConfigs();
      configs = configs.filter(c => c.id !== id);
      localStorage.setItem('cost_configs', JSON.stringify(configs));
      return of(undefined);
    }
    return this.http.delete<void>(`${environment.apiUrl}/config/${id}`);
  }
}
