import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CatalogConfigService } from '../../../../core/services/cost/catalog-config.service';
import { CatalogoSimple } from '../../../../core/models/Cost/catalog-config';
import { ComponentCanDeactivate } from '../../../../core/guards/pending-changes.guard';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-add-catalogo-simple',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './add-catalogo-simple.component.html'
})
export class AddCatalogoSimpleComponent implements OnInit, ComponentCanDeactivate {
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private catalogConfigService = inject(CatalogConfigService);

  form!: FormGroup;
  id = 0;
  loading = false;
  submitted = false;
  tipo: 'marca' | 'color' = 'marca';

  constructor() {
    this.form = this.formBuilder.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]]
    });
  }

  get f() { return this.form.controls; }

  get titulo(): string {
    return this.tipo === 'marca' ? 'marca' : 'color';
  }

  ngOnInit(): void {
    const path = this.route.snapshot.routeConfig?.path || '';
    this.tipo = path.includes('color') ? 'color' : 'marca';
    const data: CatalogoSimple | undefined = this.tipo === 'marca'
      ? history.state.edit_marca
      : history.state.edit_color;
    if (data?.id) {
      this.id = data.id;
      this.form.patchValue({ nombre: data.nombre });
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
    const payload: CatalogoSimple = { nombre: this.form.value.nombre };
    const request = this.tipo === 'marca'
      ? (this.id ? this.catalogConfigService.updateMarca(this.id, payload) : this.catalogConfigService.createMarca(payload))
      : (this.id ? this.catalogConfigService.updateColor(this.id, payload) : this.catalogConfigService.createColor(payload));

    request.subscribe({
      next: () => {
        this.loading = false;
        this.form.markAsPristine();
        Swal.fire('Listo', `${this.tipo === 'marca' ? 'Marca' : 'Color'} guardado.`, 'success').then(() => this.back());
      },
      error: () => {
        this.loading = false;
        Swal.fire('Error', `No se pudo guardar ${this.tipo === 'marca' ? 'la marca' : 'el color'}.`, 'error');
      }
    });
  }

  canDeactivate(): boolean {
    return this.submitted || !this.form?.dirty;
  }
}
