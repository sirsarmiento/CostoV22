import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { InventoryService } from '../../../../../core/services/cost/inventory.service';
import { Sale, EstadoVenta } from '../../../../../core/models/Cost/inventory';
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

  // Filtro por Estado de Venta
  filtroEstado: 'TODOS' | 'PAGADO' | 'ABONADO' | 'PENDIENTE' = 'TODOS';

  // Modal de Estado de Venta
  showPaymentModal = false;
  selectedSaleForPayment: Sale | null = null;
  paymentModalData: {
    estadoVenta: EstadoVenta;
    montoAbonado: number;
    metodoPago: string;
    observacionesPago: string;
  } = {
    estadoVenta: 'PAGADO',
    montoAbonado: 0,
    metodoPago: 'Efectivo / Transferencia',
    observacionesPago: ''
  };

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
        const localOverrides = this.getLocalPaymentOverrides();
        this.sales = (sales || []).map(s => {
          const sId = s.id ? String(s.id) : '';
          const override = sId ? localOverrides[sId] : null;

          let estado = (override?.estadoVenta || s.estadoVenta || 'PAGADO') as EstadoVenta;
          if (estado !== 'PAGADO' && estado !== 'ABONADO' && estado !== 'PENDIENTE') {
            estado = 'PAGADO';
          }

          const total = Number(s.total) || 0;
          let abonado = override?.montoAbonado !== undefined ? Number(override.montoAbonado) : (s.montoAbonado !== undefined ? Number(s.montoAbonado) : (estado === 'PAGADO' ? total : 0));
          if (estado === 'PAGADO') abonado = total;
          if (estado === 'PENDIENTE') abonado = 0;

          const pendiente = Math.max(0, total - abonado);

          return {
            ...s,
            estadoVenta: estado,
            montoAbonado: abonado,
            montoPendiente: pendiente,
            metodoPago: override?.metodoPago || s.metodoPago || '',
            observacionesPago: override?.observacionesPago || s.observacionesPago || ''
          };
        });

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

  // --- Métricas Financieras (KPIs) ---
  get totalFacturado(): number {
    return this.sales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
  }

  get totalCobrado(): number {
    return this.sales.reduce((sum, s) => {
      const estado = this.getEstadoVenta(s);
      const total = Number(s.total) || 0;
      if (estado === 'PAGADO') return sum + total;
      if (estado === 'ABONADO') return sum + (Number(s.montoAbonado) || 0);
      return sum;
    }, 0);
  }

  get totalPendiente(): number {
    return Math.max(0, this.totalFacturado - this.totalCobrado);
  }

  getEstadoVenta(row: Sale): EstadoVenta {
    const st = (row.estadoVenta || 'PAGADO').toUpperCase();
    if (st === 'PAGADO' || st === 'ABONADO' || st === 'PENDIENTE') {
      return st as EstadoVenta;
    }
    return 'PAGADO';
  }

  getDescripcionOProducto(row: Sale): string {
    const rawR = row as unknown as Record<string, unknown>;
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

  onFilterStatus(estado: 'TODOS' | 'PAGADO' | 'ABONADO' | 'PENDIENTE') {
    this.filtroEstado = estado;
    this.currentPage = 1;
    this.applyFilter();
  }

  onSearchChange() {
    this.currentPage = 1;
    this.applyFilter();
  }

  applyFilter() {
    const q = this.searchTerm.toLowerCase().trim();
    let temp = [...this.sales];

    // Filtro por Estado
    if (this.filtroEstado !== 'TODOS') {
      temp = temp.filter(s => this.getEstadoVenta(s) === this.filtroEstado);
    }

    // Filtro por Búsqueda de Texto
    if (q) {
      temp = temp.filter(s =>
        (s.numero || '').toLowerCase().includes(q) ||
        (s.descripcion || '').toLowerCase().includes(q) ||
        this.getDescripcionOProducto(s).toLowerCase().includes(q) ||
        this.getClienteNombre(s).toLowerCase().includes(q) ||
        (s.cliente?.nombre || '').toLowerCase().includes(q) ||
        this.getEstadoVenta(s).toLowerCase().includes(q)
      );
    }

    this.filtered = temp;
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

  // =========================================================================
  // GESTIÓN DEL MODAL DE ESTADO DE VENTA
  // =========================================================================
  openPaymentModal(sale: Sale, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.selectedSaleForPayment = sale;
    const total = Number(sale.total) || 0;
    const currentEstado = this.getEstadoVenta(sale);
    const currentAbonado = currentEstado === 'PAGADO' ? total : (currentEstado === 'PENDIENTE' ? 0 : (Number(sale.montoAbonado) || 0));

    this.paymentModalData = {
      estadoVenta: currentEstado,
      montoAbonado: currentAbonado,
      metodoPago: sale.metodoPago || 'Efectivo / Transferencia',
      observacionesPago: sale.observacionesPago || ''
    };

    this.showPaymentModal = true;
  }

  closePaymentModal() {
    this.showPaymentModal = false;
    this.selectedSaleForPayment = null;
  }

  onEstadoVentaSelect(nuevoEstado: EstadoVenta) {
    this.paymentModalData.estadoVenta = nuevoEstado;
    if (!this.selectedSaleForPayment) return;

    const total = Number(this.selectedSaleForPayment.total) || 0;
    if (nuevoEstado === 'PAGADO') {
      this.paymentModalData.montoAbonado = total;
    } else if (nuevoEstado === 'PENDIENTE') {
      this.paymentModalData.montoAbonado = 0;
    } else if (nuevoEstado === 'ABONADO') {
      if (this.paymentModalData.montoAbonado <= 0 || this.paymentModalData.montoAbonado >= total) {
        this.paymentModalData.montoAbonado = Math.round((total / 2) * 100) / 100;
      }
    }
  }

  get saldoRestanteModal(): number {
    if (!this.selectedSaleForPayment) return 0;
    const total = Number(this.selectedSaleForPayment.total) || 0;
    const abonado = Number(this.paymentModalData.montoAbonado) || 0;
    return Math.max(0, total - abonado);
  }

  savePaymentStatus() {
    if (!this.selectedSaleForPayment || !this.selectedSaleForPayment.id) {
      this.closePaymentModal();
      return;
    }

    const sale = this.selectedSaleForPayment;
    const total = Number(sale.total) || 0;
    let abonado = Number(this.paymentModalData.montoAbonado) || 0;
    let estado = this.paymentModalData.estadoVenta;

    if (abonado < 0) abonado = 0;
    if (abonado >= total && total > 0) {
      abonado = total;
      estado = 'PAGADO';
    } else if (abonado === 0 && estado === 'ABONADO') {
      estado = 'PENDIENTE';
    }

    const pendiente = Math.max(0, total - abonado);

    const updatedFields: Partial<Sale> = {
      estadoVenta: estado,
      montoAbonado: abonado,
      montoPendiente: pendiente,
      metodoPago: this.paymentModalData.metodoPago,
      observacionesPago: this.paymentModalData.observacionesPago
    };

    // 1. Actualizar en memoria inmediatamente
    Object.assign(sale, updatedFields);

    // 2. Guardar en LocalStorage como persistencia segura
    this.saveLocalPaymentOverride(Number(sale.id), updatedFields);

    // 3. Notificar a la API
    this.service.updateSale(Number(sale.id), updatedFields).subscribe({
      next: () => {},
      error: () => {} // Tolerante a fallos
    });

    this.applyFilter();
    this.closePaymentModal();

    Swal.fire({
      title: '¡Estado Actualizado!',
      text: `La venta #${sale.numero || sale.id} quedó marcada como ${estado}.`,
      icon: 'success',
      timer: 2000,
      showConfirmButton: false
    });
  }

  // --- Persistencia en LocalStorage como salvaguarda ---
  private getLocalPaymentOverrides(): Record<string, Partial<Sale>> {
    try {
      const data = localStorage.getItem('costo_sales_payments');
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  private saveLocalPaymentOverride(saleId: number, data: Partial<Sale>) {
    try {
      const current = this.getLocalPaymentOverrides();
      current[String(saleId)] = { ...(current[String(saleId)] || {}), ...data };
      localStorage.setItem('costo_sales_payments', JSON.stringify(current));
    } catch (e) {
      console.error('Error saving local payment status', e);
    }
  }
}
