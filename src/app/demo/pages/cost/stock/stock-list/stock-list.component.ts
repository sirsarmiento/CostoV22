import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { forkJoin } from 'rxjs';
import { InventoryService } from '../../../../../core/services/cost/inventory.service';
import { AssetService } from '../../../../../core/services/cost/asset.service';
import { InventoryMovement, StockItem } from '../../../../../core/models/Cost/inventory';
import { Asset } from '../../../../../core/models/Cost/asset';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-stock-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, NgSelectModule],
  templateUrl: './stock-list.component.html'
})
export class StockListComponent implements OnInit {
  private inventory = inject(InventoryService);
  private assets = inject(AssetService);
  private fb = inject(FormBuilder);

  activeTab: 'stock' | 'movimientos' | 'desacople' = 'stock';
  stock: StockItem[] = [];
  movements: InventoryMovement[] = [];
  circulantes: Asset[] = [];
  loading = true;
  ingresoQty: Record<number, number> = {};

  decoupleForm!: FormGroup;

  ngOnInit(): void {
    this.decoupleForm = this.fb.group({
      producto: [null, Validators.required],
      cantidadProducto: [1, [Validators.required, Validators.min(0.01)]],
      observacion: [''],
      lineas: this.fb.array([])
    });
    this.addDecoupleLine();
    this.reload();
  }

  get decoupleLines(): FormArray { return this.decoupleForm.get('lineas') as FormArray; }

  addDecoupleLine() {
    this.decoupleLines.push(this.fb.group({
      activo: [null, Validators.required],
      recuperado: [0],
      merma: [0]
    }));
  }

  removeDecoupleLine(i: number) { this.decoupleLines.removeAt(i); }

  reload() {
    this.loading = true;
    forkJoin({
      stock: this.inventory.getStock(),
      movements: this.inventory.getMovements(),
      assets: this.assets.getAssets()
    }).subscribe({
      next: ({ stock, movements, assets }) => {
        this.stock = stock;
        this.movements = movements;
        this.circulantes = assets.filter(a => {
          const t = (a.tipo || '').toLowerCase();
          return t === 'circulante' || t === 'material';
        });
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  ingresar(item: StockItem) {
    const qty = Number(this.ingresoQty[item.id]) || 0;
    if (qty <= 0) {
      Swal.fire('Atención', 'Indique cuántas unidades producir e ingresar a stock.', 'info');
      return;
    }
    this.inventory.ingresarStock(item.id, qty).subscribe({
      next: () => {
        Swal.fire('Listo', 'Se descontaron materiales del BOM y subió el stock de producto terminado.', 'success');
        this.reload();
      },
      error: (err) => Swal.fire('Error', err?.error?.msg || 'No se pudo ingresar a stock.', 'error')
    });
  }

  saveDecouple() {
    if (this.decoupleForm.invalid) {
      Swal.fire('Atención', 'Seleccione producto y materiales recuperados o merma.', 'info');
      return;
    }
    this.inventory.createDecouple(this.decoupleForm.value).subscribe({
      next: () => {
        Swal.fire('Listo', 'Materiales reintegrados y merma registrada.', 'success');
        this.decoupleForm.reset({ cantidadProducto: 1 });
        this.decoupleLines.clear();
        this.addDecoupleLine();
        this.reload();
      },
      error: (err) => Swal.fire('Error', err?.error?.msg || 'No se pudo desacoplar.', 'error')
    });
  }
}
