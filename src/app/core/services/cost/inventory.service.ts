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

  // ==========================================
  // PROVEEDORES
  // ==========================================
  getSuppliers(): Observable<Supplier[]> {
    return this.http.get<{ data?: Supplier[] } | Supplier[]>(`${this.api}/proveedores`).pipe(
      map(res => (Array.isArray(res) ? res : res.data) || [])
    );
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

  deleteSupplier(id: number): Observable<unknown> {
    return this.http.delete(`${this.api}/proveedor/${id}`);
  }

  // ==========================================
  // COMPRAS / REPOSICION
  // ==========================================
  getPurchases(): Observable<Purchase[]> {
    return this.http.get<{ data?: Purchase[] } | Purchase[]>(`${this.api}/compras`).pipe(
      map(res => (Array.isArray(res) ? res : res.data) || [])
    );
  }

  createPurchase(purchase: Purchase): Observable<Purchase> {
    return this.http.post<Purchase>(`${this.api}/compra`, purchase);
  }

  // ==========================================
  // VENTAS CONCRETADAS
  // ==========================================
  getSales(): Observable<Sale[]> {
    return this.http.get<{ data?: Sale[] } | Sale[]>(`${this.api}/ventas`).pipe(
      map(res => (Array.isArray(res) ? res : res.data) || [])
    );
  }

  createSale(presupuestoId: number, cantidad?: number): Observable<Sale> {
    return this.http.post<Sale>(`${this.api}/venta`, { presupuesto: presupuestoId, cantidad });
  }

  // ==========================================
  // STOCK DE PRODUCTO TERMINADO Y DESACOLPE
  // ==========================================
  getStock(): Observable<StockItem[]> {
    return this.http.get<{ data?: StockItem[] } | StockItem[]>(`${this.api}/stock`).pipe(
      map(res => (Array.isArray(res) ? res : res.data) || [])
    );
  }

  ingresarStock(productoId: number, cantidad: number): Observable<unknown> {
    return this.http.post(`${this.api}/stock/ingreso`, { producto: productoId, cantidad });
  }

  createDecouple(payload: Decouple): Observable<unknown> {
    return this.http.post(`${this.api}/desacople`, payload);
  }

  // ==========================================
  // MOVIMIENTOS KARDEX
  // ==========================================
  getMovements(): Observable<InventoryMovement[]> {
    return this.http.get<{ data?: InventoryMovement[] } | InventoryMovement[]>(`${this.api}/movimientos`).pipe(
      map(res => (Array.isArray(res) ? res : res.data) || [])
    );
  }
}
