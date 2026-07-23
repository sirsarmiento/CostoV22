import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { Product } from '../../../../../core/models/Cost/product';
import { Config } from '../../../../../core/models/Cost/config';
import { ProductService } from '../../../../../core/services/cost/product.service';
import { ConfigService } from '../../../../../core/services/cost/config.service';
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
  private productService = inject(ProductService);
  private configService = inject(ConfigService);

  form!: FormGroup;
  id: number = 0;
  loading = false;
  submitted = false;
  configs: Config[] = [];

  constructor() {
    this.myFormValues();
  }

  get f() { return this.form.controls; }

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
    this.configService.getConfigs().subscribe({
      next: (configs) => {
        this.configs = configs;
        if (this.configs.length > 0 && this.form?.get('perfil')) {
          if (!this.form.get('perfil')?.value) {
            this.form.get('perfil')?.setValue(this.configs[0].id);
          }
        }
      }
    });
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

    const request = this.id === 0 
      ? this.productService.createProduct(product)
      : this.productService.updateProduct(this.id, product);

    request.subscribe({
      next: () => {
        localStorage.removeItem('cost_edit_product');
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
      },
      error: (error) => {
        this.loading = false;
        console.error('Error saving product:', error);
        Swal.fire('Error', 'Ha ocurrido un error al guardar.', 'error');
      }
    });
  }
}
