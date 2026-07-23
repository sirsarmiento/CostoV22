import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Asset } from '../../models/Cost/asset';

@Injectable({
  providedIn: 'root'
})
export class AssetService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/assets`;

  private getMockAssets(): Asset[] {
    const stored = localStorage.getItem('cost_assets');
    if (stored) {
      return JSON.parse(stored);
    }
    const initial = environment.mockData.assets as Asset[];
    localStorage.setItem('cost_assets', JSON.stringify(initial));
    return initial;
  }

  getAssets(): Observable<Asset[]> {
    if (environment.useMocks) {
      return of(this.getMockAssets());
    }
    return this.http.get<Asset[]>(this.url);
  }

  createAsset(asset: Asset): Observable<Asset> {
    if (environment.useMocks) {
      const assets = this.getMockAssets();
      const newId = assets.length > 0 ? Math.max(...assets.map(a => a.id || 0)) + 1 : 1;
      const newAsset = { ...asset, id: newId };
      assets.push(newAsset);
      localStorage.setItem('cost_assets', JSON.stringify(assets));
      return of(newAsset);
    }
    return this.http.post<Asset>(this.url, asset);
  }

  updateAsset(id: number, asset: Asset): Observable<Asset> {
    if (environment.useMocks) {
      const assets = this.getMockAssets();
      const index = assets.findIndex(a => a.id === id);
      if (index !== -1) {
        assets[index] = { ...asset, id };
        localStorage.setItem('cost_assets', JSON.stringify(assets));
        return of(assets[index]);
      }
      return of(asset);
    }
    return this.http.put<Asset>(`${this.url}/${id}`, asset);
  }

  deleteAsset(id: number): Observable<void> {
    if (environment.useMocks) {
      let assets = this.getMockAssets();
      assets = assets.filter(a => a.id !== id);
      localStorage.setItem('cost_assets', JSON.stringify(assets));
      return of(undefined);
    }
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
