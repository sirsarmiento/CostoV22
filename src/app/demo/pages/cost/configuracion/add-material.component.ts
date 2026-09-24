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
  selector: 'app-add-material',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, NgSelectModule],
  templateUrl: './add-material.component.html'
})
export class AddMaterialComponent implements OnInit, ComponentCanDeactivate {
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private catalogConfigService = inject(CatalogConfigService);

  form!: FormGroup;
  id = 0;
  loading = false;
  submitted = false;
  tecnologias: TecnologiaCatalogo[] = [];

  constructor() {
    this.form = this.formBuilder.group({
      codigo: ['', [Validators.required, Validators.maxLength(3), Validators.pattern('^[a-zA-Z]{1,3}$')]],
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      tecnologias: [[]]
    });
  }

  get f() { return this.form.controls; }

  ngOnInit(): void {
    this.catalogConfigService.getTecnologias().subscribe(data => this.tecnologias = data || []);
    const data: MaterialCatalogo | undefined = history.state.edit_material;
    if (data?.id) {
      this.id = data.id;
      this.form.patchValue({
        codigo: data.codigo,
        nombre: data.nombre,
        tecnologias: (data.tecnologias || []).map(t => t.id)
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
    const selected = (this.form.value.tecnologias || []) as number[];
    const payload: MaterialCatalogo = {
      codigo: String(this.form.value.codigo).toUpperCase(),
      nombre: this.form.value.nombre,
      tecnologias: this.tecnologias.filter(t => selected.includes(Number(t.id)))
    };

    const request = this.id
      ? this.catalogConfigService.updateMaterial(this.id, payload)
      : this.catalogConfigService.createMaterial(payload);

    request.subscribe({
      next: () => {
        this.loading = false;
        this.form.markAsPristine();
        Swal.fire('Listo', 'Material guardado.', 'success').then(() => this.back());
      },
      error: () => {
        this.loading = false;
        Swal.fire('Error', 'No se pudo guardar el material.', 'error');
      }
    });
  }

  canDeactivate(): boolean {
    return this.submitted || !this.form?.dirty;
  }
}
