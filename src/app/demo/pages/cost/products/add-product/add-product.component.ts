import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { Product } from '../../../../../core/models/Cost/product';
import { Config } from '../../../../../core/models/Cost/config';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-add-product',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, NgSelectModule],
  templateUrl: './add-product.component.html'
})
export class AddProductComponent implements OnInit {
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);

  form!: FormGroup;
  id: number = 0;
  loading = false;
  submitted = false;
  configs: Config[] = [];

  constructor() {
    this.myFormValues();
  }

  //eliminar la línea siguiente al colocar los servicios
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get f(): any { return this.form.controls; }

  ngOnInit() {
    this.loadConfigs();
    this.setValues();

    this.form.get('medida')?.valueChanges.subscribe(value => {
      this.onMedidaChange(value);
    });
  }

  shouldShowPeriodoField(): boolean {
    const medida = this.form.get('medida')?.value;
    return medida === 'Horas hombres' || medida === 'Horas máquina';
  }

  onMedidaChange(medida: string) {
    if (medida !== 'Horas hombres' && medida !== 'Horas máquina') {
      this.form.get('periodo')?.setValue('');
    }
  }

  loadConfigs() {
    // MOCK - LOCAL STORAGE: Eliminar y reemplazar con servicio real
    const stored = localStorage.getItem('cost_configs');
    this.configs = stored ? JSON.parse(stored) : [];
    if (this.configs.length > 0 && this.form?.get('perfil')) {
      if (!this.form.get('perfil')?.value) {
        this.form.get('perfil')?.setValue(this.configs[0].id);
      }
    }
  }

  back() {
    this.router.navigate(['/products']);
  }

  setValues() {
    // MOCK - LOCAL STORAGE: Eliminar y reemplazar con servicio real
    const stored = localStorage.getItem('cost_edit_product');
    if (stored) {
      const data: Product = JSON.parse(stored);
      if (data && data.id && data.id > 0) {
        this.form.get('nombre')?.setValue(data.nombre);
        this.form.get('medida')?.setValue(data.medida);
        this.form.get('sku')?.setValue(data.sku);
        this.form.get('clasificacion')?.setValue(data.clasificacion);
        this.form.get('descripcion')?.setValue(data.descripcion);
        this.form.get('perfil')?.setValue(data.perfil);
        this.form.get('periodo')?.setValue(data.periodo);
        this.id = data.id;
      }
    }
  }

  myFormValues() {
    this.form = this.formBuilder.group({
      nombre: ['', Validators.required],
      medida: ['', Validators.required],
      sku: [''],
      descripcion: ['', Validators.required],
      clasificacion: ['', Validators.required],
      perfil: [''],
      periodo: ['']
    });
  }

  onSubmit() {
    this.submitted = true;

    if (this.form.invalid) {
      Swal.fire('Error', 'Complete los datos obligatorios del producto.', 'error');
      return;
    }

    this.loading = true;

    const product: Product = {
      id: this.id > 0 ? this.id : 0,
      nombre: this.form.get('nombre')?.value,
      sku: this.form.get('sku')?.value,
      descripcion: this.form.get('descripcion')?.value,
      clasificacion: this.form.get('clasificacion')?.value,
      medida: this.form.get('medida')?.value,
      perfil: Number(this.form.get('perfil')?.value) || 0,
      periodo: this.form.get('periodo')?.value
    };

    // MOCK - LOCAL STORAGE: Eliminar y reemplazar con servicio real
    const stored = localStorage.getItem('cost_products');
    let productsList: Product[] = stored ? JSON.parse(stored) : [];

    if (this.id === 0) {
      const newId = productsList.length > 0 ? Math.max(...productsList.map(p => p.id || 0)) + 1 : 1;
      product.id = newId;
      productsList.push(product);
    } else {
      productsList = productsList.map(p => p.id === this.id ? product : p);
    }

    localStorage.setItem('cost_products', JSON.stringify(productsList));
    localStorage.removeItem('cost_edit_product');

    setTimeout(() => {
      this.loading = false;
      Swal.fire({
        title: '¡Guardado!',
        text: 'Producto guardado exitosamente.',
        icon: 'success',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#4680ff'
      }).then(() => {
        this.router.navigate(['/products']);
      });
    }, 800);
  }
}
