import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { forkJoin } from 'rxjs';
import { InventoryService } from '../../../../../core/services/cost/inventory.service';
import { AssetService } from '../../../../../core/services/cost/asset.service';
import { Asset } from '../../../../../core/models/Cost/asset';
import { Supplier } from '../../../../../core/models/Cost/inventory';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-add-purchase',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, NgSelectModule],
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

  ngOnInit(): void {
    this.form = this.fb.group({
      proveedor: [null, Validators.required],
      fecha: [new Date().toISOString().substring(0, 10), Validators.required],
      observacion: [''],
      lineas: this.fb.array([])
    });
    this.addLine();
    forkJoin({
      suppliers: this.inventory.getSuppliers(),
      assets: this.assets.getAssets()
    }).subscribe(({ suppliers, assets }) => {
      this.suppliers = suppliers;
      this.circulantes = assets.filter(a => {
        const t = (a.tipo || '').toLowerCase();
        return t === 'circulante' || t === 'material';
      });
    });
  }

  get lineas(): FormArray { return this.form.get('lineas') as FormArray; }

  addLine() {
    this.lineas.push(this.fb.group({
      activo: [null, Validators.required],
      cantidad: [1, [Validators.required, Validators.min(0.01)]],
      valorUnitario: [0, Validators.required]
    }));
  }

  removeLine(i: number) { this.lineas.removeAt(i); }

  onAssetChange(i: number) {
    const id = this.lineas.at(i).get('activo')?.value;
    const asset = this.circulantes.find(a => a.id == id);
    if (asset) {
      this.lineas.at(i).get('valorUnitario')?.setValue(Number(asset.valorUnitario) || 0);
    }
  }

  back() { this.router.navigate(['/purchases']); }

  save() {
    if (this.form.invalid || this.lineas.length === 0) {
      Swal.fire('Atención', 'Complete proveedor y al menos una línea.', 'info');
      return;
    }
    this.loading = true;
    this.inventory.createPurchase(this.form.value).subscribe({
      next: () => {
        this.loading = false;
        Swal.fire('Guardado', 'Compra aplicada. El stock de circulantes subió.', 'success').then(() => this.back());
      },
      error: (err) => {
        this.loading = false;
        Swal.fire('Error', err?.error?.msg || 'No se pudo registrar la compra.', 'error');
      }
    });
  }
}
