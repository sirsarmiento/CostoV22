import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { InventoryService } from '../../../../../core/services/cost/inventory.service';
import { Supplier } from '../../../../../core/models/Cost/inventory';
import Swal from 'sweetalert2';
import { ComponentCanDeactivate } from '../../../../../core/guards/pending-changes.guard';

@Component({
  selector: 'app-add-supplier',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './add-supplier.component.html'
})
export class AddSupplierComponent implements OnInit, ComponentCanDeactivate {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private service = inject(InventoryService);

  form!: FormGroup;
  id = 0;
  loading = false;
  submitted = false;

  ngOnInit(): void {
    this.form = this.fb.group({
      nombre: ['', Validators.required],
      rif: [''],
      contacto: [''],
      email: ['', Validators.email],
      telefono: [''],
      direccion: ['']
    });
    const data: Supplier | undefined = history.state.edit_supplier;
    if (data?.id) {
      this.id = data.id;
      this.form.patchValue(data);
    }
  }

  get f() { return this.form.controls; }

  back() { this.router.navigate(['/suppliers']); }

  save() {
    this.submitted = true;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      Swal.fire('Formulario Incompleto', 'Por favor ingrese el nombre del proveedor.', 'warning');
      return;
    }
    this.loading = true;
    const payload: Supplier = this.form.value;
    const req = this.id ? this.service.updateSupplier(this.id, payload) : this.service.createSupplier(payload);
    req.subscribe({
      next: () => {
        this.loading = false;
        this.submitted = true;
        this.form?.markAsPristine();
        Swal.fire('Guardado', 'Proveedor registrado.', 'success').then(() => this.back());
      },
      error: () => {
        this.loading = false;
        Swal.fire('Error', 'No se pudo guardar el proveedor.', 'error');
      }
    });
  }

  canDeactivate(): boolean {
    if (this.submitted && !this.loading) {
      return true;
    }
    return !this.form?.dirty;
  }
}
