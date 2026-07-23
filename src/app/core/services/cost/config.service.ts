import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Config } from '../../models/Cost/config';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/configs`;

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
    return this.http.get<Config[]>(this.url);
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
    return this.http.post<Config>(this.url, config);
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
    return this.http.put<Config>(`${this.url}/${id}`, config);
  }

  deleteConfig(id: number): Observable<void> {
    if (environment.useMocks) {
      let configs = this.getMockConfigs();
      configs = configs.filter(c => c.id !== id);
      localStorage.setItem('cost_configs', JSON.stringify(configs));
      return of(undefined);
    }
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
