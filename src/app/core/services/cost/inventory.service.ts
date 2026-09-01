import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  Decouple,
  InventoryMovement,
  Purchase,
  Sale,
  StockItem,
  Supplier
} from '../../models/Cost/inventory';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  getSuppliers(): Observable<Supplier[]> {
    return this.http.get<{ data?: Supplier[] }>(`${this.api}/proveedores`).pipe(map(r => r.data || []));
  }

  createSupplier(supplier: Supplier): Observable<Supplier> {
    const payload = { ...supplier };
    delete payload.id;
    return this.http.post<Supplier>(`${this.api}/proveedor`, payload);
  }

  updateSupplier(id: number, supplier: Supplier): Observable<Supplier> {
    const payload = { ...supplier };
    delete payload.id;
    return this.http.put<Supplier>(`${this.api}/proveedor/${id}`, payload);
  }

  getPurchases(): Observable<Purchase[]> {
    return this.http.get<{ data?: Purchase[] }>(`${this.api}/compras`).pipe(map(r => r.data || []));
  }

  createPurchase(purchase: Purchase): Observable<Purchase> {
    return this.http.post<Purchase>(`${this.api}/compra`, purchase);
  }

  getSales(): Observable<Sale[]> {
    return this.http.get<{ data?: Sale[] }>(`${this.api}/ventas`).pipe(map(r => r.data || []));
  }

  createSale(presupuestoId: number, cantidad?: number): Observable<Sale> {
    return this.http.post<Sale>(`${this.api}/venta`, { presupuesto: presupuestoId, cantidad });
  }

  getStock(): Observable<StockItem[]> {
    return this.http.get<{ data?: StockItem[] }>(`${this.api}/stock`).pipe(map(r => r.data || []));
  }

  ingresarStock(productoId: number, cantidad: number) {
    return this.http.post(`${this.api}/stock/ingreso`, { producto: productoId, cantidad });
  }

  getMovements(): Observable<InventoryMovement[]> {
    return this.http.get<{ data?: InventoryMovement[] }>(`${this.api}/movimientos`).pipe(map(r => r.data || []));
  }

  createDecouple(payload: Decouple) {
    return this.http.post(`${this.api}/desacople`, payload);
  }
}
