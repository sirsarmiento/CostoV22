import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Product } from '../../models/Cost/product';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/productos`;

  private getMockProducts(): Product[] {
    const stored = localStorage.getItem('cost_products');
    if (stored) {
      return JSON.parse(stored);
    }
    const initial = environment.mockData.products as Product[];
    localStorage.setItem('cost_products', JSON.stringify(initial));
    return initial;
  }

  getProducts(): Observable<Product[]> {
    if (environment.useMocks) {
      return of(this.getMockProducts());
    }
    return this.http.get<{ data?: Product[] } | Product[]>(this.url).pipe(
      map(res => (Array.isArray(res) ? res : res.data) || [])
    );
  }

  createProduct(product: Product): Observable<Product> {
    if (environment.useMocks) {
      const products = this.getMockProducts();
      const newId = products.length > 0 ? Math.max(...products.map(p => p.id || 0)) + 1 : 1;
      const newProduct = { ...product, id: newId };
      products.push(newProduct);
      localStorage.setItem('cost_products', JSON.stringify(products));
      return of(newProduct);
    }
    const payload: Partial<Product> = { ...product };
    delete payload.id;
    return this.http.post<Product>(`${environment.apiUrl}/producto`, payload);
  }

  updateProduct(id: number, product: Product): Observable<Product> {
    if (environment.useMocks) {
      const products = this.getMockProducts();
      const index = products.findIndex(p => p.id === id);
      if (index !== -1) {
        products[index] = { ...product, id };
        localStorage.setItem('cost_products', JSON.stringify(products));
        return of(products[index]);
      }
      return of(product);
    }
    const payload: Partial<Product> = { ...product };
    delete payload.id;
    return this.http.put<Product>(`${environment.apiUrl}/producto/${id}`, payload);
  }

  deleteProduct(id: number): Observable<void> {
    if (environment.useMocks) {
      let products = this.getMockProducts();
      products = products.filter(p => p.id !== id);
      localStorage.setItem('cost_products', JSON.stringify(products));
      return of(undefined);
    }
    return this.http.delete<void>(`${environment.apiUrl}/product/${id}`);
  }
}
