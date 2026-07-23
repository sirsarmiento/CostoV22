import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { Fixe } from '../../../../../core/models/Cost/fixe';
import { Product } from '../../../../../core/models/Cost/product';
import { FixeService } from '../../../../../core/services/cost/fixe.service';
import { ProductService } from '../../../../../core/services/cost/product.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-add-fixe',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, NgSelectModule],
  templateUrl: './add-fixe.component.html'
})
export class AddFixeComponent implements OnInit {
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private fixeService = inject(FixeService);
  private productService = inject(ProductService);

  form!: FormGroup;
  id: number = 0;
  loading = false;
  submitted = false;
  products: Product[] = [];
  filteredProducts: Product[] = [];

  opcionesConceptos: Record<string, string[]> = {
    'Fijo': [
      'Alquiler', 'Salarios base', 'Seguros', 
      'Suscripciones y licencias', 'Impuestos', 
      'Servicios básicos (parte fija)',
      'Otro'
    ],
    'Variable': [
      'Materia prima e insumos', 'Costos de envío y distribución', 
      'Comisiones de ventas', 'Empaquetado y embalaje', 
      'Servicios básicos (por uso)',
      'Otro'
    ]
  };

  conceptosMostrados: string[] = [];

  constructor() {
    this.myFormValues();
  }

  get f() { return this.form.controls; }

  ngOnInit(): void {
    this.loadProducts();
    this.setValues();

    // Conceptos dinámicos según el tipo de costo
    this.form.get('tipo')?.valueChanges.subscribe(valor => {
      this.conceptosMostrados = this.opcionesConceptos[valor] || [];
      this.form.get('concepto')?.setValue(''); 
    });

    // Escuchamos el cambio de 'clasificacion'
    this.form.get('clasificacion')?.valueChanges.subscribe(value => {
      this.onClasificacionChange(value);
    });

    const tipoInicial = this.form.get('tipo')?.value;
    if (tipoInicial) {
      this.conceptosMostrados = this.opcionesConceptos[tipoInicial] || [];
    }
  }

  shouldShowProductoField(): boolean {
    return this.form.get('clasificacion')?.value === 'Directo';
  }

  onClasificacionChange(clasificacion: string) {
    if (clasificacion !== 'Directo') {
      this.form.get('producto')?.setValue('');
    }
  }

  loadProducts() {
    this.productService.getProducts().subscribe({
      next: (products) => {
        this.products = products;
        this.filteredProducts = [...this.products];
      }
    });
  }

  back() {
    this.router.navigate(['/fixes']);
  }

  setValues() {
    // MOCK - LOCAL STORAGE: Eliminar y reemplazar con servicio real
    const stored = localStorage.getItem('cost_edit_fixe');
    if (stored) {
      const data: Fixe = JSON.parse(stored);
      if (data && data.id && data.id > 0) {
        this.form.get('tipo')?.setValue(data.tipo);
        this.form.get('precio')?.setValue(data.precio);
        this.form.get('clasificacion')?.setValue(data.clasificacion);
        this.form.get('producto')?.setValue(data.producto);
        this.id = data.id;

        // Si el concepto cargado no está en las opciones por defecto, se considera "Otro"
        const opciones = this.opcionesConceptos[data.tipo] || [];
        if (opciones.includes(data.concepto)) {
          this.form.get('concepto')?.setValue(data.concepto);
        } else {
          this.form.get('concepto')?.setValue('Otro');
          this.form.get('otroConcepto')?.setValue(data.concepto);
        }
      }
    }
  }

  myFormValues() {
    this.form = this.formBuilder.group({
      tipo: ['', Validators.required],
      concepto: ['', Validators.required],
      otroConcepto: [''],
      precio: ['', Validators.required],
      clasificacion: ['', Validators.required],
      producto: ['']
    });
  }

  onSubmit() {
    this.submitted = true;

    const conceptoControl = this.form.get('concepto');
    const otroConceptoControl = this.form.get('otroConcepto');
    const tipoControl = this.form.get('tipo');
    const precioControl = this.form.get('precio');
    const clasificacionControl = this.form.get('clasificacion');
    const productoControl = this.form.get('producto');

    if (conceptoControl?.value === 'Otro' && !otroConceptoControl?.value) {
      otroConceptoControl?.setErrors({ required: true });
      Swal.fire('Error', 'Debe especificar el concepto alternativo.', 'error');
      return;
    }

    if (this.form.invalid) {
      Swal.fire('Error', 'Complete los datos obligatorios del costo.', 'error');
      return;
    }
    
    this.loading = true;

    const conceptoFinal = conceptoControl?.value === 'Otro' 
      ? otroConceptoControl?.value 
      : conceptoControl?.value;

    const costo: Fixe = {
      id: this.id > 0 ? this.id : 0,
      tipo: tipoControl?.value,
      concepto: conceptoFinal,
      precio: precioControl?.value,
      clasificacion: clasificacionControl?.value,
      producto: Number(productoControl?.value) || 0
    };

    const request = this.id === 0 
      ? this.fixeService.createFixe(costo)
      : this.fixeService.updateFixe(this.id, costo);

    request.subscribe({
      next: () => {
        localStorage.removeItem('cost_edit_fixe');
        this.loading = false;
        Swal.fire({
          title: '¡Guardado!',
          text: 'Costo guardado exitosamente.',
          icon: 'success',
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#4680ff'
        }).then(() => {
          this.router.navigate(['/fixes']);
        });
      },
      error: () => {
        this.loading = false;
        Swal.fire('Error', 'Ha ocurrido un error al guardar el costo.', 'error');
      }
    });
  }

  filterProducts(event: Event) {
    const input = event.target as HTMLInputElement;
    const query = input.value.toLowerCase().trim();

    if (!query) {
      this.filteredProducts = [...this.products];
      return;
    }

    this.filteredProducts = this.products.filter(p => 
      p.nombre.toLowerCase().includes(query)
    );
  }
}
