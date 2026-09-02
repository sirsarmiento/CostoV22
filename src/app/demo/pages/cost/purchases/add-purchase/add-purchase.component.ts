import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { forkJoin } from 'rxjs';
import { InventoryService } from '../../../../../core/services/cost/inventory.service';
import { AssetService } from '../../../../../core/services/cost/asset.service';
import { Asset } from '../../../../../core/models/Cost/asset';
import { Supplier, Purchase } from '../../../../../core/models/Cost/inventory';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-add-purchase',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, NgSelectModule],
  templateUrl: './add-purchase.component.html'
})
export class AddPurchaseComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private inventory = inject(InventoryService);
  private assets = inject(AssetService);

  form!: FormGroup;
  suppliers: Supplier[] = [];
  circulantes: Asset[] = [];
  loading = false;
  submitted = false;

  // Variables temporales para agregar insumos a la compra
  tempActivoId: number | null = null;
  tempCantidad: number | null = 1;
  tempValorUnitario: number | null = null;

  materialesCompra: {
    activoId: number;
    nombre: string;
    cantidad: number;
    valorUnitario: number;
    subtotal: number;
  }[] = [];

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
        this.circulantes = (assets || []).filter(a => {
          const t = (a.tipo || '').toLowerCase();
          return t === 'circulante' || t === 'material';
        });
      },
      error: () => {
        // Fallback cargado desde cache o local
      }
    });
  }

  get f() { return this.form.controls; }

  onTempAssetChange() {
    if (this.tempActivoId) {
      const asset = this.circulantes.find(a => a.id == this.tempActivoId);
      if (asset) {
        const val = Number(asset.valorUnitario) || Number(asset.costoInicial) || 0;
        this.tempValorUnitario = val;
      }
    } else {
      this.tempValorUnitario = null;
    }
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
    const asset = this.circulantes.find(a => a.id == this.tempActivoId);
    this.materialesCompra.push({
      activoId: this.tempActivoId,
      nombre: asset?.nombre || `Insumo #${this.tempActivoId}`,
      cantidad: cant,
      valorUnitario: val,
      subtotal: cant * val
    });
    this.tempActivoId = null;
    this.tempCantidad = 1;
    this.tempValorUnitario = null;
  }

  removerMaterialCompra(index: number) {
    this.materialesCompra.splice(index, 1);
  }

  get totalCompra(): number {
    return this.materialesCompra.reduce((acc, item) => acc + item.subtotal, 0);
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
    if (this.materialesCompra.length === 0) {
      Swal.fire('Sin Materiales', 'Agregue al menos un insumo o material a la compra con el botón (+).', 'info');
      return;
    }
    this.loading = true;
    const payload: Purchase = {
      proveedor: this.form.get('proveedor')?.value,
      fecha: this.form.get('fecha')?.value,
      observacion: this.form.get('observacion')?.value || '',
      total: this.totalCompra,
      lineas: this.materialesCompra.map(m => ({
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
