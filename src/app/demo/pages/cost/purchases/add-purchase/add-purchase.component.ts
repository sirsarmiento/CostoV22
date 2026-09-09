import { Component, OnInit, inject, ChangeDetectorRef, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { forkJoin } from 'rxjs';
import { InventoryService } from '../../../../../core/services/cost/inventory.service';
import { AssetService } from '../../../../../core/services/cost/asset.service';
import { Asset } from '../../../../../core/models/Cost/asset';
import { Supplier, Purchase } from '../../../../../core/models/Cost/inventory';
import { QuickAssetModalComponent, QuickAssetCreatedEvent } from '../../../../../theme/shared/components/quick-asset-modal/quick-asset-modal.component';
import Swal from 'sweetalert2';

export interface MaterialCompraItem {
  activoId: number;
  nombre: string;
  tipo: string;
  cantidad: number;
  valorUnitario: number;
  subtotal: number;
}

@Component({
  selector: 'app-add-purchase',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, NgSelectModule, QuickAssetModalComponent],
  templateUrl: './add-purchase.component.html'
})
export class AddPurchaseComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private inventory = inject(InventoryService);
  private assets = inject(AssetService);
  private cdr = inject(ChangeDetectorRef);

  form!: FormGroup;
  suppliers: Supplier[] = [];
  allAssets: Asset[] = [];
  circulantes: Asset[] = [];
  insumosFiltrados: Asset[] = [];
  loading = false;
  submitted = false;

  // Variables temporales para agregar insumos a la compra
  tempTipoInsumo: 'Material' | 'Circulante' = 'Material';
  tempActivoId: number | null = null;
  tempCantidad: number | null = 1;
  tempValorUnitario: number | null = null;

  // Modal de Creación Rápida de Activos
  showAssetModal = false;

  // Reactividad con Signals
  readonly materialesCompra = signal<MaterialCompraItem[]>([]);
  readonly totalCompra = computed(() =>
    this.materialesCompra().reduce((acc, item) => acc + item.subtotal, 0)
  );

  ngOnInit(): void {
    this.form = this.fb.group({
      proveedor: [null, Validators.required],
      fecha: [new Date().toISOString().substring(0, 10), Validators.required],
      observacion: ['']
    });
    this.loadData();
  }

  loadData() {
    forkJoin({
      suppliers: this.inventory.getSuppliers(),
      assets: this.assets.getAssets()
    }).subscribe({
      next: ({ suppliers, assets }) => {
        this.suppliers = suppliers || [];
        this.allAssets = assets || [];
        this.circulantes = (assets || []).filter(a => {
          const t = (a.tipo || '').toLowerCase();
          return t === 'circulante' || t === 'material';
        });
        this.filtrarInsumos();
      },
      error: () => {
        // Fallback cargado desde cache o local
      }
    });
  }

  get f() { return this.form.controls; }

  filtrarInsumos() {
    const tipo = this.tempTipoInsumo.toLowerCase();
    this.insumosFiltrados = this.allAssets.filter(a => {
      const aTipo = (a.tipo || '').toLowerCase();
      if (tipo === 'material') {
        return aTipo === 'material';
      }
      return aTipo === 'circulante';
    });

    if (this.tempActivoId && !this.insumosFiltrados.some(a => a.id === this.tempActivoId)) {
      this.tempActivoId = null;
      this.tempValorUnitario = null;
    }
  }

  onTipoInsumoChange(tipo?: 'Material' | 'Circulante') {
    if (tipo) {
      this.tempTipoInsumo = tipo;
    }
    this.tempActivoId = null;
    this.tempValorUnitario = null;
    this.filtrarInsumos();
  }

  onTempAssetChange() {
    this.onActivoSelected(this.tempActivoId);
  }

  onActivoSelected(activoId: number | null) {
    if (!activoId) {
      this.tempValorUnitario = null;
      return;
    }
    const asset = this.allAssets.find(a => a.id === activoId);
    if (asset) {
      this.tempValorUnitario = asset.valorUnitario || asset.costoInicial || null;
    }
  }

  openAssetModal() {
    this.showAssetModal = true;
  }

  closeAssetModal() {
    this.showAssetModal = false;
  }

  onAssetCreated(event: QuickAssetCreatedEvent) {
    const created = event.asset;
    const cant = event.cantidad || 1;
    const val = event.costo || 0;

    // 1. Agregar a listas locales en memoria
    this.allAssets = [created, ...this.allAssets];
    this.circulantes = [created, ...this.circulantes];

    // 2. Ajustar el filtro activo según el tipo creado
    const tipoCreado = (created.tipo || '').toLowerCase();
    this.tempTipoInsumo = tipoCreado === 'circulante' ? 'Circulante' : 'Material';
    this.filtrarInsumos();

    // 3. AUTO-INSERTAR DIRECTAMENTE EN LA TABLA DE LA COMPRA (1-Clic)
    const tipoLabel = tipoCreado === 'circulante' ? 'Del Inventario' : 'Material';
    this.materialesCompra.update(items => [
      ...items,
      {
        activoId: created.id || Date.now(),
        nombre: created.nombre || '',
        tipo: tipoLabel,
        cantidad: cant,
        valorUnitario: val,
        subtotal: cant * val
      }
    ]);

    // 4. Limpiar temporales y cerrar modal
    this.tempActivoId = null;
    this.tempCantidad = 1;
    this.tempValorUnitario = null;
    this.showAssetModal = false;
    this.cdr.detectChanges();
  }

  agregarMaterialCompra() {
    if (!this.tempActivoId) {
      Swal.fire('Atención', 'Seleccione un material o insumo a comprar.', 'info');
      return;
    }
    const cant = Number(this.tempCantidad) || 0;
    const val = Number(this.tempValorUnitario) || 0;
    if (cant <= 0) {
      Swal.fire('Atención', 'Indique una cantidad válida mayor a 0.', 'info');
      return;
    }
    const asset = this.allAssets.find(a => a.id == this.tempActivoId);
    const aTipo = (asset?.tipo || '').toLowerCase();
    const tipoLabel = aTipo === 'circulante' ? 'Del Inventario' : 'Material';
    this.materialesCompra.update(items => [
      ...items,
      {
        activoId: this.tempActivoId!,
        nombre: asset?.nombre || `Insumo #${this.tempActivoId}`,
        tipo: tipoLabel,
        cantidad: cant,
        valorUnitario: val,
        subtotal: cant * val
      }
    ]);
    this.tempActivoId = null;
    this.tempCantidad = 1;
    this.tempValorUnitario = null;
  }

  removerMaterialCompra(index: number) {
    this.materialesCompra.update(items => items.filter((_, i) => i !== index));
  }

  back() {
    this.router.navigate(['/purchases']);
  }

  save() {
    this.submitted = true;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      Swal.fire('Formulario Incompleto', 'Por favor seleccione el proveedor y la fecha de compra.', 'warning');
      return;
    }
    if (this.materialesCompra().length === 0) {
      Swal.fire('Sin Materiales', 'Agregue al menos un insumo o material a la compra con el botón (+).', 'info');
      return;
    }
    this.loading = true;
    const payload: Purchase = {
      proveedor: this.form.get('proveedor')?.value,
      fecha: this.form.get('fecha')?.value,
      observacion: this.form.get('observacion')?.value || '',
      total: this.totalCompra(),
      lineas: this.materialesCompra().map(m => ({
        activo: m.activoId,
        cantidad: m.cantidad,
        valorUnitario: m.valorUnitario
      }))
    };

    this.inventory.createPurchase(payload).subscribe({
      next: () => {
        this.loading = false;
        Swal.fire({
          icon: 'success',
          title: '¡Compra Registrada!',
          text: 'Se ha registrado la orden de reposición y actualizado el stock de insumos.',
          timer: 2000,
          showConfirmButton: false
        }).then(() => this.back());
      },
      error: (err) => {
        this.loading = false;
        Swal.fire('Error', err?.error?.msg || 'No se pudo registrar la compra.', 'error');
      }
    });
  }
}
