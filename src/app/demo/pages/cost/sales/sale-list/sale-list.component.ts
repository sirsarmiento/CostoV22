import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { InventoryService } from '../../../../../core/services/cost/inventory.service';
import { Sale } from '../../../../../core/models/Cost/inventory';
import Swal from 'sweetalert2';

import { ProductService } from '../../../../../core/services/cost/product.service';
import { BudgetService } from '../../../../../core/services/cost/budget.service';
import { Product } from '../../../../../core/models/Cost/product';
import { Budget } from '../../../../../core/models/Cost/budge';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-sale-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './sale-list.component.html'
})
export class SaleListComponent implements OnInit {
  protected readonly Math = Math;

  private service = inject(InventoryService);
  private productService = inject(ProductService);
  private budgetService = inject(BudgetService);
  private cdr = inject(ChangeDetectorRef);

  sales: Sale[] = [];
  filtered: Sale[] = [];
  products: Product[] = [];
  budgets: Budget[] = [];
  searchTerm = '';
  loading = false;
  selectedRow: Sale | null = null;

  // Paginación y ordenamiento
  sortColumn = 'fecha';
  sortAscending = false;
  currentPage = 1;
  pageSize = 10;

  ngOnInit(): void {
    this.loadSales();
  }

  loadSales() {
    this.loading = true;
    forkJoin({
      sales: this.service.getSales(),
      products: this.productService.getProducts(),
      budgets: this.budgetService.getBudgets()
    }).subscribe({
      next: ({ sales, products, budgets }) => {
        this.sales = sales || [];
        this.products = products || [];
        this.budgets = budgets || [];
        this.applyFilter();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
        Swal.fire('Error', 'No se pudieron cargar las ventas.', 'error');
      }
    });
  }

  getDescripcionOProducto(row: Sale): string {
    const rawR = row as unknown as Record<string, unknown>;
    
    // 1. Si la venta ya trae el objeto producto
    if (row.producto?.nombre) {
      return row.producto.nombre;
    }
    const prodId = Number(rawR['producto'] ?? rawR['producto_id'] ?? rawR['productoId']);
    if (prodId && this.products.length > 0) {
      const foundProd = this.products.find(p => p.id == prodId);
      if (foundProd?.nombre) {
        return foundProd.nombre;
      }
    }

    // 2. Si la venta proviene de un presupuesto, verificar si dicho presupuesto tiene producto
    const presId = Number(row.presupuesto ?? rawR['presupuesto_id'] ?? rawR['presupuestoId']);
    if (presId && this.budgets.length > 0) {
      const foundBudget = this.budgets.find(b => b.id == presId);
      if (foundBudget) {
        const bProdId = Number(foundBudget.producto);
        if (bProdId && this.products.length > 0) {
          const foundProd = this.products.find(p => p.id == bProdId);
          if (foundProd?.nombre) {
            return foundProd.nombre;
          }
        }
      }
    }

    return row.descripcion || (presId ? `Venta de Presupuesto #${presId}` : 'Venta');
  }

  getClienteNombre(row: Sale): string {
    const rawR = row as unknown as Record<string, unknown>;
    if (row.cliente?.nombre) {
      return row.cliente.nombre;
    }
    const presId = Number(row.presupuesto ?? rawR['presupuesto_id'] ?? rawR['presupuestoId']);
    if (presId && this.budgets.length > 0) {
      const foundBudget = this.budgets.find(b => b.id == presId);
      if (foundBudget) {
        if (foundBudget.clienteNombre) return foundBudget.clienteNombre;
        const cliDet = foundBudget.clienteDetalle as Record<string, unknown> | undefined;
        if (cliDet && cliDet['nombre']) return String(cliDet['nombre']);
      }
    }
    return '-';
  }

  onSearchChange() {
    this.currentPage = 1;
    this.applyFilter();
  }

  applyFilter() {
    const q = this.searchTerm.toLowerCase().trim();
    if (!q) {
      this.filtered = [...this.sales];
    } else {
      this.filtered = this.sales.filter(s =>
        (s.numero || '').toLowerCase().includes(q) ||
        (s.descripcion || '').toLowerCase().includes(q) ||
        this.getDescripcionOProducto(s).toLowerCase().includes(q) ||
        this.getClienteNombre(s).toLowerCase().includes(q) ||
        (s.cliente?.nombre || '').toLowerCase().includes(q)
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

  get paginatedSales(): Sale[] {
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
}
