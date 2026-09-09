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
import { Product, PiezaProducto } from '../../../../../core/models/Cost/product';
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
  tempTipoInsumo: 'Circulante' | 'Material' = 'Circulante';
  tempMaterialId: number | null = null;
  tempRecuperado: number | null = null;
  tempMerma: number | null = null;
  materialesDesacople: { activoId: number; nombre: string; tipo?: string; recuperado: number; merma: number; unidadMedida?: string }[] = [];
  insumosFiltrados: Asset[] = [];
  productoSinPiezas = false;
  selectedProductPiecesCount = 0;

  // Filtros avanzados Movimientos
  movTipoFiltro = 'TODOS';
  tiposMovimientoList = [
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
  minDate = new NgbDate(2026, 1, 1);
  maxDate = new NgbDate(2036, 12, 31);

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
        this.movements = (movements || []).map(m => {
          return {
            ...m,
            tipo: this.getTipoMovimiento(m)
          };
        });
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
    this.actualizarInsumosFiltrados();
  }

  actualizarInsumosFiltrados() {
    const selectedProdId = this.decoupleForm.get('producto')?.value;
    if (!selectedProdId) {
      this.insumosFiltrados = [];
      this.productoSinPiezas = false;
      this.selectedProductPiecesCount = 0;
      this.cdr.detectChanges();
      return;
    }

    const currentProd = this.products.find(p => p.id == selectedProdId);
    const piezasList = (currentProd?.piezasProducto || []) as PiezaProducto[];

    this.selectedProductPiecesCount = piezasList.length;

    const piezasActivosIds: number[] = [];
    const piezasNombres: string[] = [];

    piezasList.forEach(pz => {
      const rawPz = pz as unknown as Record<string, unknown>;
      const actId = pz.activoId || pz.activo || (rawPz['activo_id'] as number) || (rawPz['assetId'] as number);
      if (actId) {
        piezasActivosIds.push(Number(actId));
      }
      if (pz.activoNombre) {
        piezasNombres.push(pz.activoNombre.trim().toLowerCase());
      }
      if (pz.nombre) {
        piezasNombres.push(pz.nombre.trim().toLowerCase());
      }
    });

    if (piezasList.length === 0) {
      this.productoSinPiezas = true;
      this.selectedProductPiecesCount = 0;
    }

    const activosPorTipo = this.allAssets.filter(a => {
      const tipo = (a.tipo || '').toLowerCase().trim();
      const cat = (a.categoria || '').toLowerCase().trim();

      if (this.tempTipoInsumo === 'Circulante') {
        return tipo === 'circulante' && (cat === 'producción' || cat === 'produccion');
      } else if (this.tempTipoInsumo === 'Material') {
        return tipo === 'material';
      }
      return true;
    });

    if (piezasActivosIds.length > 0 || piezasNombres.length > 0) {
      this.productoSinPiezas = false;
      const matched = activosPorTipo.filter(a => {
        const matchId = piezasActivosIds.includes(Number(a.id));
        const matchNom = piezasNombres.includes((a.nombre || '').trim().toLowerCase());
        return matchId || matchNom;
      });

      this.insumosFiltrados = matched;
    } else {
      this.productoSinPiezas = true;
      this.insumosFiltrados = [];
    }

    this.cdr.detectChanges();
  }

  calcularDesgloseAutomatico() {
    const selectedProdId = this.decoupleForm.get('producto')?.value;
    const cantProd = Number(this.decoupleForm.get('cantidadProducto')?.value) || 1;
    if (!selectedProdId || cantProd <= 0) {
      this.materialesDesacople = [];
      this.cdr.detectChanges();
      return;
    }

    const currentProd = this.products.find(p => p.id == selectedProdId);
    if (!currentProd) return;

    const piezasList = (currentProd.piezasProducto || []) as PiezaProducto[];
    if (piezasList.length === 0) {
      this.materialesDesacople = [];
      this.cdr.detectChanges();
      return;
    }

    const lineasCalculadas: {
      activoId: number;
      nombre: string;
      tipo: string;
      recuperado: number;
      merma: number;
      unidadMedida: string;
    }[] = [];

    piezasList.forEach(pz => {
      const rawPz = pz as unknown as Record<string, unknown>;
      const actId = Number(pz.activoId || pz.activo || rawPz['activo_id'] || rawPz['assetId'] || rawPz['materialId']);
      
      const asset = this.allAssets.find(a => 
        (actId && a.id == actId) || 
        (a.nombre && pz.activoNombre && a.nombre.trim().toLowerCase() === pz.activoNombre.trim().toLowerCase()) || 
        (a.nombre && pz.nombre && a.nombre.trim().toLowerCase() === pz.nombre.trim().toLowerCase())
      );

      const realActivoId = asset?.id || actId || 0;
      const nombreActivo = asset?.nombre || pz.activoNombre || pz.nombre || `Insumo #${actId}`;
      const tipoActivo = (asset?.tipo || pz.tipo || '').toLowerCase();
      const catActivo = (asset?.categoria || '').toLowerCase();

      // Es material de impresión 3D / resina / filamento (Merma Irrecuperable):
      const esMaterial = tipoActivo === 'material' || catActivo === 'filamento' || catActivo === 'resina' || pz.tipo === 'Fabricada' || (pz.gramos && Number(pz.gramos) > 0);

      if (esMaterial) {
        const gramosUnitario = Number(pz.gramos) || Number(pz.cantidad) || 1;
        const totalMerma = Math.round(gramosUnitario * cantProd * 100) / 100;
        
        lineasCalculadas.push({
          activoId: realActivoId,
          nombre: nombreActivo,
          tipo: 'Material (Merma)',
          recuperado: 0,
          merma: totalMerma,
          unidadMedida: asset?.unidadMedida || 'Gramos'
        });
      } else {
        // Es insumo circulante / accesorio del inventario (Recuperable):
        const cantUnitaria = Number(pz.cantidad) || 1;
        const totalRecuperable = Math.round(cantUnitaria * cantProd * 100) / 100;
        
        lineasCalculadas.push({
          activoId: realActivoId,
          nombre: nombreActivo,
          tipo: 'Del Inventario (Recuperable)',
          recuperado: totalRecuperable,
          merma: 0,
          unidadMedida: asset?.unidadMedida || 'Unidades'
        });
      }
    });

    this.materialesDesacople = lineasCalculadas;
    this.cdr.detectChanges();
  }

  decoupleSubmitted = false;

  onSearch() {
    this.currentPage = 1;
    this.movCurrentPage = 1;
    this.applyFilter();
  }

  getTipoMovimiento(m: InventoryMovement): string {
    const rawM = m as unknown as Record<string, unknown>;
    const rawTipo = String(m.tipo || rawM['tipo_movimiento'] || rawM['tipoMovimiento'] || rawM['type'] || '').toUpperCase().trim();
    const obs = String(m.observacion || '').toLowerCase();
    const isProductoTerminado = !!(m.producto || rawM['producto_id'] || rawM['productoId'] || (obs.includes('producto') && !obs.includes('insumo') && !obs.includes('material')));

    // 1. Pérdida o Merma específica
    if (obs.includes('pérdida') || obs.includes('perdida') || obs.includes('merma') || rawTipo === 'PERDIDA' || rawTipo === 'MERMA' || rawTipo === 'PÉRDIDA / MERMA') {
      return 'PÉRDIDA / MERMA';
    }

    // 2. Recuperación de Insumos / Desacople de Insumos
    if (obs.includes('material recuperado') || obs.includes('recuperad') || rawTipo === 'RECUPERADO' || rawTipo === 'RECUPERACION' || rawTipo === 'RECUPERACIÓN') {
      return 'RECUPERACIÓN';
    }

    // 3. Desacople de Producto Terminado
    if (obs.includes('desacople de producto') || (obs.includes('desacople') && isProductoTerminado) || rawTipo === 'DESACOPLE (PT)' || rawTipo === 'DESACOPLE') {
      return isProductoTerminado ? 'DESACOPLE' : 'RECUPERACIÓN';
    }

    // 4. Desacoples generales
    if (obs.includes('desacople') || obs.includes('desarm') || rawTipo === 'DESACOPLE' || rawTipo === 'DESACOPLED') {
      return isProductoTerminado ? 'DESACOPLE' : 'RECUPERACIÓN';
    }

    // 5. Coincidencias exactas predefinidas
    if (
      rawTipo === 'PRODUCCIÓN' ||
      rawTipo === 'PRODUCCION' ||
      rawTipo === 'PRODUCCIÓN (PT)' ||
      rawTipo === 'PRODUCCION (PT)'
    ) {
      return 'PRODUCCIÓN';
    }

    if (rawTipo === 'VENTA' || rawTipo === 'VENTA (PT)') {
      return 'VENTA';
    }

    if (rawTipo === 'COMPRA INSUMO' || rawTipo === 'CONSUMO INSUMO' || rawTipo === 'RECUPERACIÓN' || rawTipo === 'PÉRDIDA / MERMA' || rawTipo === 'DESACOPLE') {
      return rawTipo;
    }

    // 6. Producción de PT
    if (rawTipo === 'ENTRADA_PT' || (isProductoTerminado && (obs.includes('ingreso a stock') || obs.includes('fabricaci') || obs.includes('producci')))) {
      return 'PRODUCCIÓN';
    }

    // 7. Venta de PT
    if (rawTipo === 'SALIDA_PT' || (isProductoTerminado && (obs.includes('salida de producto') || obs.includes('venta')))) {
      return 'VENTA';
    }

    // 8. Compras de Insumo
    if (obs.includes('compra') || obs.includes('proveedor')) {
      return 'COMPRA INSUMO';
    }

    // 9. Consumo de Insumo
    if (obs.includes('consumo')) {
      return 'CONSUMO INSUMO';
    }

    // 10. Movimientos genéricos
    if (rawTipo === 'SALIDA') {
      return isProductoTerminado ? 'VENTA' : 'CONSUMO INSUMO';
    }

    if (rawTipo === 'ENTRADA' || rawTipo === 'INGRESO') {
      return isProductoTerminado ? 'PRODUCCIÓN' : 'COMPRA INSUMO';
    }

    return rawTipo && rawTipo !== 'UNDEFINED' && rawTipo !== 'NULL' ? rawTipo : 'MOVIMIENTO';
  }

  getTipoBadgeClass(tipo: string): string {
    const t = (tipo || '').toUpperCase();
    if (t.includes('PRODUCCIÓN') || t.includes('PRODUCCION') || t.includes('COMPRA') || t.includes('RECUPERAC') || t === 'ENTRADA' || t === 'INGRESO') {
      return 'bg-light-success text-success';
    }
    if (t.includes('VENTA') || t.includes('CONSUMO') || t.includes('SALIDA')) {
      return 'bg-light-danger text-danger';
    }
    if (t.includes('DESACOPLE')) {
      return 'bg-light-warning text-warning';
    }
    if (t.includes('PÉRDIDA') || t.includes('PERDIDA') || t.includes('MERMA')) {
      return 'bg-light-secondary text-secondary';
    }
    return 'bg-light-primary text-primary';
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
    if (!dateStr) return '-';
    const normalized = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + (dateStr.endsWith('Z') ? '' : 'Z');
    const d = new Date(normalized);
    if (isNaN(d.getTime())) {
      return dateStr;
    }
    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
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
      // 1. Buscador de texto
      if (q) {
        const matchText = (m.tipo || '').toLowerCase().includes(q) ||
          (m.observacion || '').toLowerCase().includes(q) ||
          (m.producto?.nombre || '').toLowerCase().includes(q) ||
          (m.activo?.nombre || '').toLowerCase().includes(q);
        if (!matchText) return false;
      }

      // 2. Filtro de Tipo
      if (this.movTipoFiltro && this.movTipoFiltro !== 'TODOS') {
        if ((m.tipo || '').toUpperCase() !== this.movTipoFiltro.toUpperCase()) {
          return false;
        }
      }

      // 3. Filtro de Rango de Fechas (en hora local)
      if (m.createAt && (this.fromDate || this.toDate)) {
        const localFormatted = this.formatFechaLocal(m.createAt);
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
