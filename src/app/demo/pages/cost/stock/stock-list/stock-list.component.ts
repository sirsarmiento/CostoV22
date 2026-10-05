import { Component, OnInit, inject, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { NgbDate, NgbCalendar, NgbDatepickerModule, NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { forkJoin } from 'rxjs';
import { InventoryService } from '../../../../../core/services/cost/inventory.service';
import { AssetService } from '../../../../../core/services/cost/asset.service';
import { ProductService } from '../../../../../core/services/cost/product.service';
import { Decouple, InventoryMovement, StockItem } from '../../../../../core/models/Cost/inventory';
import { Asset } from '../../../../../core/models/Cost/asset';
import { Product } from '../../../../../core/models/Cost/product';
import {
  calcularDesgloseDesacople,
  filtrarInsumosParaProducto,
  clasificarTipoMovimiento,
  obtenerBadgeClassMovimiento,
  formatFechaLocal,
  LineaDesacopleCalculada
} from '../../../../../core/utils/stock-decouple.helper';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-stock-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, NgSelectModule, NgbDatepickerModule, NgbDropdownModule],
  templateUrl: './stock-list.component.html'
})
export class StockListComponent implements OnInit {
  protected readonly Math = Math;

  private inventory = inject(InventoryService);
  private assets = inject(AssetService);
  private productService = inject(ProductService);
  private calendar = inject(NgbCalendar);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  activeTab: 'stock' | 'movimientos' | 'desacople' = 'stock';
  stock: StockItem[] = [];
  filteredStock: StockItem[] = [];
  movements: InventoryMovement[] = [];
  filteredMovements: InventoryMovement[] = [];
  circulantes: Asset[] = [];
  allAssets: Asset[] = [];
  products: Product[] = [];
  loading = false;
  ingresoQty: Record<number, number> = {};
  searchTerm = '';

  // Ordenamiento
  sortColumn = 'nombre';
  sortAscending = true;

  // Paginación Stock
  currentPage = 1;
  pageSize = 10;

  // Paginación Movimientos
  movCurrentPage = 1;
  movPageSize = 10;

  // Formulario y estado de Desacople
  decoupleForm!: FormGroup;
  decoupleSubmitting = false;
  decoupleSubmitted = false;
  tempTipoInsumo: 'Circulante' | 'Material' = 'Circulante';
  tempMaterialId: number | null = null;
  tempRecuperado: number | null = null;
  tempMerma: number | null = null;
  materialesDesacople: LineaDesacopleCalculada[] = [];
  insumosFiltrados: Asset[] = [];
  productoSinPiezas = false;
  selectedProductPiecesCount = 0;

  // Filtros avanzados Movimientos
  movTipoFiltro = 'TODOS';
  readonly tiposMovimientoList = [
    { value: 'TODOS', label: 'Todos los tipos' },
    { value: 'PRODUCCIÓN', label: 'Producción' },
    { value: 'VENTA', label: 'Venta' },
    { value: 'DESACOPLE', label: 'Desacople' },
    { value: 'COMPRA INSUMO', label: 'Compra Insumo' },
    { value: 'CONSUMO INSUMO', label: 'Consumo Insumo' },
    { value: 'RECUPERACIÓN', label: 'Recuperación Insumo' },
    { value: 'PÉRDIDA / MERMA', label: 'Pérdida / Merma' }
  ];

  hoveredDate: NgbDate | null = null;
  fromDate: NgbDate | null = null;
  toDate: NgbDate | null = null;
  rangoFechasTexto = '';
  readonly minDate = new NgbDate(2026, 1, 1);
  readonly maxDate = new NgbDate(2036, 12, 31);

  ngOnInit(): void {
    this.decoupleForm = this.fb.group({
      producto: [null, Validators.required],
      cantidadProducto: [1, [Validators.required, Validators.min(0.01)]],
      observacion: ['']
    });

    this.decoupleForm.get('producto')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(prodId => {
      this.tempMaterialId = null;
      if (prodId) {
        const pId = Number(prodId);
        if (!isNaN(pId) && pId > 0) {
          this.productService.getProduct(pId).pipe(
            takeUntilDestroyed(this.destroyRef)
          ).subscribe({
            next: (prodDetail) => {
              if (prodDetail && prodDetail.id) {
                const idx = this.products.findIndex(p => p.id === prodDetail.id);
                if (idx !== -1) {
                  this.products[idx] = prodDetail;
                } else {
                  this.products.push(prodDetail);
                }
              }
              this.actualizarInsumosFiltrados();
              this.calcularDesgloseAutomatico();
            },
            error: () => {
              this.actualizarInsumosFiltrados();
              this.calcularDesgloseAutomatico();
            }
          });
        }
      } else {
        this.insumosFiltrados = [];
        this.productoSinPiezas = false;
        this.selectedProductPiecesCount = 0;
        this.materialesDesacople = [];
        this.cdr.detectChanges();
      }
    });

    this.decoupleForm.get('cantidadProducto')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.calcularDesgloseAutomatico();
    });

    this.reload();
  }

  reload() {
    this.loading = true;
    forkJoin({
      stock: this.inventory.getStock(),
      movements: this.inventory.getMovements(),
      assets: this.assets.getAssets(),
      products: this.productService.getProducts()
    }).subscribe({
      next: ({ stock, movements, assets, products }) => {
        this.products = products || [];
        this.allAssets = assets || [];
        this.stock = stock || [];
        this.filteredStock = [...this.stock];
        this.movements = (movements || []).map(m => ({
          ...m,
          tipo: clasificarTipoMovimiento(m)
        }));
        this.filteredMovements = [...this.movements];
        this.circulantes = (assets || []).filter(a => {
          const t = (a.tipo || '').toLowerCase();
          return t === 'circulante' || t === 'material';
        });
        this.applyFilter();
        this.actualizarInsumosFiltrados();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onTipoInsumoChange() {
    this.tempMaterialId = null;
    this.actualizarInsumosFiltrados();
  }

  actualizarInsumosFiltrados() {
    const selectedProdId = this.decoupleForm.get('producto')?.value;
    const currentProd = selectedProdId ? this.products.find(p => p.id == selectedProdId) : null;
    
    const resultado = filtrarInsumosParaProducto(currentProd, this.tempTipoInsumo, this.allAssets);
    this.insumosFiltrados = resultado.insumosFiltrados;
    this.productoSinPiezas = resultado.productoSinPiezas;
    this.selectedProductPiecesCount = resultado.selectedProductPiecesCount;
    this.cdr.detectChanges();
  }

  calcularDesgloseAutomatico() {
    const selectedProdId = this.decoupleForm.get('producto')?.value;
    const cantProd = Number(this.decoupleForm.get('cantidadProducto')?.value) || 1;
    const currentProd = selectedProdId ? this.products.find(p => p.id == selectedProdId) : null;

    this.materialesDesacople = calcularDesgloseDesacople(currentProd, cantProd, this.allAssets);
    this.cdr.detectChanges();
  }

  onSearch() {
    this.currentPage = 1;
    this.movCurrentPage = 1;
    this.applyFilter();
  }

  getTipoMovimiento(m: InventoryMovement): string {
    return clasificarTipoMovimiento(m);
  }

  getTipoBadgeClass(tipo: string): string {
    return obtenerBadgeClassMovimiento(tipo);
  }

  onMovFilterChange() {
    this.movCurrentPage = 1;
    this.applyFilter();
  }

  onDateSelection(date: NgbDate, datepickerDropdown?: { close: () => void }) {
    if (!this.fromDate && !this.toDate) {
      this.fromDate = date;
    } else if (this.fromDate && !this.toDate && (date.after(this.fromDate) || date.equals(this.fromDate))) {
      this.toDate = date;
      if (datepickerDropdown) {
        datepickerDropdown.close();
      }
    } else {
      this.toDate = null;
      this.fromDate = date;
    }
    this.actualizarRangoTexto();
    this.onMovFilterChange();
  }

  isHovered(date: NgbDate) {
    return (
      this.fromDate &&
      !this.toDate &&
      this.hoveredDate &&
      date.after(this.fromDate) &&
      date.before(this.hoveredDate)
    );
  }

  isInside(date: NgbDate) {
    return this.toDate && date.after(this.fromDate) && date.before(this.toDate);
  }

  isRange(date: NgbDate) {
    return (
      date.equals(this.fromDate) ||
      (this.toDate && date.equals(this.toDate)) ||
      this.isInside(date) ||
      this.isHovered(date)
    );
  }

  actualizarRangoTexto() {
    if (this.fromDate && this.toDate) {
      const pad = (n: number) => n.toString().padStart(2, '0');
      const fStr = `${pad(this.fromDate.day)}/${pad(this.fromDate.month)}/${this.fromDate.year}`;
      const tStr = `${pad(this.toDate.day)}/${pad(this.toDate.month)}/${this.toDate.year}`;
      this.rangoFechasTexto = `${fStr} - ${tStr}`;
    } else if (this.fromDate) {
      const pad = (n: number) => n.toString().padStart(2, '0');
      this.rangoFechasTexto = `Desde ${pad(this.fromDate.day)}/${pad(this.fromDate.month)}/${this.fromDate.year}`;
    } else {
      this.rangoFechasTexto = '';
    }
  }

  seleccionarPreset(preset: 'hoy' | '7dias' | 'esteMes' | 'todo', datepickerDropdown?: { close: () => void }) {
    const today = this.calendar.getToday();
    if (preset === 'hoy') {
      this.fromDate = today;
      this.toDate = today;
    } else if (preset === '7dias') {
      this.toDate = today;
      const d = new Date();
      d.setDate(d.getDate() - 6);
      this.fromDate = new NgbDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
    } else if (preset === 'esteMes') {
      this.fromDate = new NgbDate(today.year, today.month, 1);
      this.toDate = today;
    } else if (preset === 'todo') {
      this.fromDate = null;
      this.toDate = null;
    }
    this.actualizarRangoTexto();
    this.onMovFilterChange();
    if (datepickerDropdown) {
      datepickerDropdown.close();
    }
  }

  limpiarRangoFechas(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.fromDate = null;
    this.toDate = null;
    this.rangoFechasTexto = '';
    this.onMovFilterChange();
  }

  limpiarFiltrosMovimientos() {
    this.searchTerm = '';
    this.movTipoFiltro = 'TODOS';
    this.fromDate = null;
    this.toDate = null;
    this.rangoFechasTexto = '';
    this.movCurrentPage = 1;
    this.applyFilter();
  }

  formatFechaLocal(dateStr?: string): string {
    return formatFechaLocal(dateStr);
  }

  applyFilter() {
    const q = this.searchTerm.toLowerCase().trim();
    if (!q) {
      this.filteredStock = [...this.stock];
    } else {
      this.filteredStock = this.stock.filter(s =>
        (s.nombre || '').toLowerCase().includes(q) ||
        (s.sku || '').toLowerCase().includes(q)
      );
    }

    // Filtrado de Movimientos
    this.filteredMovements = this.movements.filter(m => {
      if (q) {
        const matchText = (m.tipo || '').toLowerCase().includes(q) ||
          (m.observacion || '').toLowerCase().includes(q) ||
          (m.producto?.nombre || '').toLowerCase().includes(q) ||
          (m.activo?.nombre || '').toLowerCase().includes(q);
        if (!matchText) return false;
      }

      if (this.movTipoFiltro && this.movTipoFiltro !== 'TODOS') {
        if ((m.tipo || '').toUpperCase() !== this.movTipoFiltro.toUpperCase()) {
          return false;
        }
      }

      if (m.createAt && (this.fromDate || this.toDate)) {
        const localFormatted = formatFechaLocal(m.createAt);
        const [yStr, mStr, dStr] = localFormatted.split(' ')[0].split('-');
        const movDate = new NgbDate(Number(yStr), Number(mStr), Number(dStr));

        if (this.fromDate && movDate.before(this.fromDate)) {
          return false;
        }
        if (this.toDate && movDate.after(this.toDate)) {
          return false;
        }
      }

      return true;
    });

    this.sortDataStock();
  }

  sortData(column: string) {
    if (this.sortColumn === column) {
      this.sortAscending = !this.sortAscending;
    } else {
      this.sortColumn = column;
      this.sortAscending = true;
    }
    this.sortDataStock();
  }

  private sortDataStock() {
    this.filteredStock.sort((a, b) => {
      const aVal = (a as unknown as Record<string, unknown>)[this.sortColumn] ?? '';
      const bVal = (b as unknown as Record<string, unknown>)[this.sortColumn] ?? '';
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return this.sortAscending ? aVal - bVal : bVal - aVal;
      }
      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();
      return this.sortAscending ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }

  getSortClass(column: string): string {
    if (this.sortColumn !== column) return 'ti-selector text-muted';
    return this.sortAscending ? 'ti-chevron-up text-primary' : 'ti-chevron-down text-primary';
  }

  // Paginación Stock
  get paginatedStock(): StockItem[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredStock.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredStock.length / this.pageSize) || 1;
  }

  setPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  onPageSizeChange() {
    this.currentPage = 1;
  }

  // Paginación Movimientos
  get paginatedMovements(): InventoryMovement[] {
    const start = (this.movCurrentPage - 1) * this.movPageSize;
    return this.filteredMovements.slice(start, start + this.movPageSize);
  }

  get movTotalPages(): number {
    return Math.ceil(this.filteredMovements.length / this.movPageSize) || 1;
  }

  setMovPage(page: number) {
    if (page >= 1 && page <= this.movTotalPages) {
      this.movCurrentPage = page;
    }
  }

  onMovPageSizeChange() {
    this.movCurrentPage = 1;
  }

  ingresar(item: StockItem) {
    const qty = Number(this.ingresoQty[item.id]) || 0;
    if (qty <= 0) {
      Swal.fire('Cantidad Requerida', 'Indique cuántas unidades desea ingresar a stock.', 'info');
      return;
    }
    this.inventory.ingresarStock(item.id, qty).subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: 'Stock Actualizado',
          text: `Se incrementó el stock de "${item.nombre}" y se descontó la materia prima del inventario.`,
          timer: 2000,
          showConfirmButton: false
        });
        this.ingresoQty[item.id] = 0;
        this.reload();
      },
      error: (err) => Swal.fire('Error', err?.error?.msg || 'No se pudo ingresar a stock.', 'error')
    });
  }

  agregarMaterialDesacople() {
    if (!this.tempMaterialId) {
      Swal.fire('Atención', 'Seleccione un material o insumo circulante.', 'info');
      return;
    }
    const rec = Number(this.tempRecuperado) || 0;
    const mer = Number(this.tempMerma) || 0;
    if (rec <= 0 && mer <= 0) {
      Swal.fire('Atención', 'Indique al menos una cantidad recuperada o de merma.', 'info');
      return;
    }
    const asset = this.allAssets.find(a => a.id == this.tempMaterialId);
    this.materialesDesacople.push({
      activoId: this.tempMaterialId,
      nombre: asset?.nombre || `Insumo #${this.tempMaterialId}`,
      tipo: this.tempTipoInsumo === 'Circulante' ? 'Insumo Recuperable' : 'Material (Merma)',
      recuperado: rec,
      merma: mer,
      unidadMedida: asset?.unidadMedida || (this.tempTipoInsumo === 'Material' ? 'Gramos' : 'Unidades')
    });
    this.tempMaterialId = null;
    this.tempRecuperado = null;
    this.tempMerma = null;
  }

  removerMaterialDesacople(index: number) {
    this.materialesDesacople.splice(index, 1);
  }

  saveDecouple() {
    this.decoupleSubmitted = true;
    this.decoupleForm.markAllAsTouched();
    const prodId = this.decoupleForm.get('producto')?.value;
    const cant = Number(this.decoupleForm.get('cantidadProducto')?.value) || 0;
    if (this.decoupleForm.invalid || !prodId || cant <= 0) {
      Swal.fire('Formulario Incompleto', 'Seleccione el producto terminado y la cantidad a desacoplar.', 'warning');
      return;
    }
    if (this.materialesDesacople.length === 0) {
      Swal.fire('Atención', 'Agregue al menos un material a la lista de recuperación o merma.', 'info');
      return;
    }
    this.decoupleSubmitting = true;
    const payload: Decouple = {
      producto: prodId,
      cantidadProducto: cant,
      observacion: this.decoupleForm.get('observacion')?.value || '',
      lineas: this.materialesDesacople.map(m => ({
        activo: m.activoId,
        recuperado: m.recuperado,
        merma: m.merma
      }))
    };
    this.inventory.createDecouple(payload).subscribe({
      next: () => {
        this.decoupleSubmitting = false;
        Swal.fire({
          icon: 'success',
          title: 'Desacople Registrado',
          text: 'Se dio de baja al producto terminado y se reintegraron los materiales reutilizables al inventario.',
          timer: 2500,
          showConfirmButton: false
        });
        this.decoupleForm.reset({ cantidadProducto: 1 });
        this.materialesDesacople = [];
        this.decoupleSubmitted = false;
        this.reload();
      },
      error: (err) => {
        this.decoupleSubmitting = false;
        Swal.fire('Error', err?.error?.msg || 'No se pudo registrar el desacople.', 'error');
      }
    });
  }
}
