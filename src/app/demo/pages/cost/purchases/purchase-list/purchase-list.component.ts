import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { InventoryService } from '../../../../../core/services/cost/inventory.service';
import { AssetService } from '../../../../../core/services/cost/asset.service';
import { Purchase, PurchaseLine, Supplier } from '../../../../../core/models/Cost/inventory';
import { Asset } from '../../../../../core/models/Cost/asset';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-purchase-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './purchase-list.component.html'
})
export class PurchaseListComponent implements OnInit {
  protected readonly Math = Math;

  private service = inject(InventoryService);
  private assetService = inject(AssetService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  purchases: (Purchase & { itemsResumen?: string })[] = [];
  filtered: (Purchase & { itemsResumen?: string })[] = [];
  searchTerm = '';
  loading = false;
  selectedRow: (Purchase & { itemsResumen?: string }) | null = null;

  // Paginación y ordenamiento
  sortColumn = 'fecha';
  sortAscending = false;
  currentPage = 1;
  pageSize = 10;

  ngOnInit(): void {
    this.loadPurchases();
  }

  loadPurchases() {
    this.loading = true;
    forkJoin({
      purchases: this.service.getPurchases(),
      suppliers: this.service.getSuppliers(),
      assets: this.assetService.getAssets()
    }).subscribe({
      next: ({ purchases, suppliers, assets }) => {
        const supMap = new Map<number, string>();
        (suppliers || []).forEach((s: Supplier) => {
          if (s.id) supMap.set(Number(s.id), s.nombre);
        });

        const assetMap = new Map<number, string>();
        (assets || []).forEach((a: Asset) => {
          if (a.id) assetMap.set(Number(a.id), a.nombre);
        });

        this.purchases = (purchases || []).map((p: Purchase & { proveedor_id?: number; proveedorId?: number; supplier?: { nombre?: string }; items?: PurchaseLine[]; detalles?: PurchaseLine[] }, idx: number) => {
          let pName = p.proveedorNombre;
          if (!pName) {
            if (p.supplier && p.supplier.nombre) {
              pName = p.supplier.nombre;
            } else if (p.proveedor && typeof p.proveedor === 'object') {
              pName = (p.proveedor as { nombre?: string }).nombre;
            } else if (p.proveedor) {
              pName = supMap.get(Number(p.proveedor));
            } else if (p.proveedor_id || p.proveedorId) {
              pName = supMap.get(Number(p.proveedor_id || p.proveedorId));
            }
          }

          // Formato Propuesta A: OC-YYYY-001
          let ordenNumero = p.numero;
          const year = p.fecha ? new Date(p.fecha).getFullYear() || 2026 : 2026;
          if (!ordenNumero || ordenNumero.startsWith('C-202') || ordenNumero.startsWith('COMP-') || !ordenNumero.startsWith('OC-')) {
            const seq = p.id ? String(p.id).padStart(3, '0') : String(idx + 1).padStart(3, '0');
            ordenNumero = `OC-${year}-${seq}`;
          }

          // Resumen de ítems/activos comprados
          let itemsResumen = '';
          const rawRec = p as unknown as Record<string, unknown>;
          const rawLineas = (p.lineas || 
                             rawRec['compra_lineas'] || 
                             rawRec['compra_linea'] || 
                             rawRec['compraLineas'] || 
                             rawRec['lineas_compra'] || 
                             rawRec['lineasCompra'] || 
                             rawRec['detalles'] || 
                             rawRec['items'] || 
                             []) as unknown[];

          if (Array.isArray(rawLineas) && rawLineas.length > 0) {
            const lineasTexto = rawLineas.map((lineaObj) => {
              const l = (lineaObj || {}) as Record<string, unknown>;
              
              // 1. Si viene el objeto activo anidado (relación Eloquent)
              let nombre = '';
              if (l['activo'] && typeof l['activo'] === 'object') {
                nombre = String((l['activo'] as Record<string, unknown>)['nombre'] || '').trim();
              } else if (l['asset'] && typeof l['asset'] === 'object') {
                nombre = String((l['asset'] as Record<string, unknown>)['nombre'] || '').trim();
              }

              // 2. Si viene el nombre directo en la línea
              if (!nombre) {
                nombre = String(l['activoNombre'] || l['nombre'] || l['nombre_activo'] || l['nombreActivo'] || l['activo_nombre'] || '').trim();
              }

              // 3. Si no viene el nombre, buscar por ID en el mapa de activos
              const actId = Number(
                typeof l['activo'] === 'number' || typeof l['activo'] === 'string' ? l['activo'] :
                l['activo_id'] ?? l['activoId'] ?? l['asset_id'] ?? l['assetId'] ?? l['id_activo'] ?? 0
              );

              if (!nombre && actId && assetMap.has(actId)) {
                nombre = assetMap.get(actId) || '';
              }

              const cant = Number(l['cantidad']) || 1;
              return nombre ? `${nombre} (x${cant})` : (actId ? `Activo #${actId} (x${cant})` : `Insumo (x${cant})`);
            });

            itemsResumen = lineasTexto.filter(Boolean).join(', ');
          }

          return {
            ...p,
            numero: ordenNumero,
            proveedorNombre: pName || 'Proveedor',
            itemsResumen: itemsResumen || '-'
          };
        });
        this.applyFilter();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
        Swal.fire('Error', 'No se pudieron cargar las compras.', 'error');
      }
    });
  }

  onSearchChange() {
    this.currentPage = 1;
    this.applyFilter();
  }

  applyFilter() {
    const q = this.searchTerm.toLowerCase().trim();
    if (!q) {
      this.filtered = [...this.purchases];
    } else {
      this.filtered = this.purchases.filter(p =>
        (p.numero || '').toLowerCase().includes(q) ||
        (p.observacion || '').toLowerCase().includes(q) ||
        (p.proveedorNombre || '').toLowerCase().includes(q)
      );
    }
    this.sortFilteredData();
    this.cdr.detectChanges();
  }

  sortData(column: string) {
    if (this.sortColumn === column) {
      this.sortAscending = !this.sortAscending;
    } else {
      this.sortColumn = column;
      this.sortAscending = true;
    }
    this.sortFilteredData();
  }

  private sortFilteredData() {
    this.filtered.sort((a, b) => {
      const aVal = (a as unknown as Record<string, unknown>)[this.sortColumn] ?? '';
      const bVal = (b as unknown as Record<string, unknown>)[this.sortColumn] ?? '';
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return this.sortAscending ? aVal - bVal : bVal - aVal;
      }
      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();
      return this.sortAscending ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
    this.cdr.detectChanges();
  }

  getSortClass(column: string): string {
    if (this.sortColumn !== column) return 'ti-selector text-muted';
    return this.sortAscending ? 'ti-chevron-up text-primary' : 'ti-chevron-down text-primary';
  }

  get paginatedPurchases(): Purchase[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filtered.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.filtered.length / this.pageSize) || 1;
  }

  setPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.cdr.detectChanges();
    }
  }

  onPageSizeChange() {
    this.currentPage = 1;
    this.cdr.detectChanges();
  }

  openAdd() {
    this.router.navigate(['/purchases/add']);
  }
}
