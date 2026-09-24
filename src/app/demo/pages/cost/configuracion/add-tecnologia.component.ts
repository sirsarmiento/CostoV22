import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { CatalogConfigService } from '../../../../core/services/cost/catalog-config.service';
import { MaterialCatalogo, TecnologiaCatalogo } from '../../../../core/models/Cost/catalog-config';
import { ComponentCanDeactivate } from '../../../../core/guards/pending-changes.guard';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-add-tecnologia',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, NgSelectModule],
  templateUrl: './add-tecnologia.component.html'
})
export class AddTecnologiaComponent implements OnInit, ComponentCanDeactivate {
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private catalogConfigService = inject(CatalogConfigService);

  form!: FormGroup;
  id = 0;
  loading = false;
  submitted = false;
  materiales: MaterialCatalogo[] = [];

  constructor() {
    this.form = this.formBuilder.group({
      codigo: ['', [Validators.required, Validators.maxLength(3), Validators.pattern('^[a-zA-Z]{1,3}$')]],
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      materiales: [[]]
    });
  }

  get f() { return this.form.controls; }

  ngOnInit(): void {
    this.catalogConfigService.getMateriales().subscribe(data => this.materiales = data || []);
    const data: TecnologiaCatalogo | undefined = history.state.edit_tecnologia;
    if (data?.id) {
      this.id = data.id;
      this.form.patchValue({
        codigo: data.codigo,
        nombre: data.nombre,
        materiales: (data.materiales || []).map(m => m.id)
      });
    }
  }

  back() {
    this.router.navigate(['/configuracion']);
  }

  onSubmit() {
    this.submitted = true;
    if (this.form.invalid) {
      return;
    }
    this.loading = true;
    const selected = (this.form.value.materiales || []) as number[];
    const payload: TecnologiaCatalogo = {
      codigo: String(this.form.value.codigo).toUpperCase(),
      nombre: this.form.value.nombre,
      materiales: this.materiales.filter(m => selected.includes(Number(m.id)))
    };

    const request = this.id
      ? this.catalogConfigService.updateTecnologia(this.id, payload)
      : this.catalogConfigService.createTecnologia(payload);

    request.subscribe({
      next: () => {
        this.loading = false;
        this.form.markAsPristine();
        Swal.fire('Listo', 'Tecnología guardada.', 'success').then(() => this.back());
      },
      error: () => {
        this.loading = false;
        Swal.fire('Error', 'No se pudo guardar la tecnología.', 'error');
      }
    });
  }

  canDeactivate(): boolean {
    return this.submitted || !this.form?.dirty;
  }
}
