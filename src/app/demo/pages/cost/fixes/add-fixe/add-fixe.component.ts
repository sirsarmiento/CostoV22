import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
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
  private cdr = inject(ChangeDetectorRef);

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
      'Servicios básicos (parte fija)', 'Mantenimiento preventivo',
      'Otro'
    ],
    'Variable': [
      'Materia prima e insumos', 'Costos de envío y distribución', 
      'Comisiones de ventas', 'Empaquetado y embalaje', 
      'Servicios básicos (por uso)', 'Mantenimiento correctivo',
      'Otro'
    ]
  };

  conceptosMostrados: string[] = [];

  constructor() {
    this.myFormValues();
  }

  get f() { return this.form.controls; }

  ngOnInit(): void {
    // Inicializar con todos los conceptos combinados por defecto
    this.actualizarConceptosMostrados(this.form.get('tipo')?.value);

    // Conceptos dinámicos según el tipo de costo
    this.form.get('tipo')?.valueChanges.subscribe(valor => {
      this.actualizarConceptosMostrados(valor);
      const currentConcepto = this.form.get('concepto')?.value;
      if (currentConcepto && !this.conceptosMostrados.includes(currentConcepto)) {
        this.form.get('concepto')?.setValue(''); 
      }
    });

    // Escuchamos el cambio de 'clasificacion'
    this.form.get('clasificacion')?.valueChanges.subscribe(value => {
      this.onClasificacionChange(value);
    });

    this.loadProducts();
    this.loadConceptosExistentes();
  }

  actualizarConceptosMostrados(tipo?: string) {
    if (tipo && this.opcionesConceptos[tipo]) {
      this.conceptosMostrados = [...this.opcionesConceptos[tipo]];
    } else {
      const todos = new Set<string>([
        ...this.opcionesConceptos['Fijo'],
        ...this.opcionesConceptos['Variable']
      ]);
      this.conceptosMostrados = Array.from(todos);
    }
  }

  loadConceptosExistentes() {
    this.fixeService.getFixes().subscribe({
      next: (fixes) => {
        fixes.forEach(f => {
          const c = String(f.concepto || '').trim();
          if (c && c !== 'Otro') {
            const tipo = f.tipo === 'Fijo' || f.tipo === 'Variable' ? f.tipo : 'Fijo';
            if (this.opcionesConceptos[tipo] && !this.opcionesConceptos[tipo].includes(c)) {
              this.opcionesConceptos[tipo].unshift(c);
            }
          }
        });
        this.actualizarConceptosMostrados(this.form.get('tipo')?.value);
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  agregarConcepto = (term: string): string => {
    const formatted = term.trim();
    if (formatted && !this.conceptosMostrados.includes(formatted)) {
      this.conceptosMostrados = [formatted, ...this.conceptosMostrados];
      const tipo = this.form.get('tipo')?.value || 'Fijo';
      if (this.opcionesConceptos[tipo] && !this.opcionesConceptos[tipo].includes(formatted)) {
        this.opcionesConceptos[tipo].unshift(formatted);
      }
    }
    return formatted;
  };

  shouldShowTipoDirectoField(): boolean {
    return this.form.get('clasificacion')?.value === 'Directo';
  }

  shouldShowProductoField(): boolean {
    return this.form.get('clasificacion')?.value === 'Directo' && !!this.form.get('tipoDirecto')?.value;
  }

  onClasificacionChange(clasificacion: string) {
    if (clasificacion !== 'Directo') {
      this.form.get('producto')?.setValue('');
      this.form.get('tipoDirecto')?.setValue('');
    }
  }

  loadProducts() {
    this.productService.getProducts().subscribe({
      next: (products) => {
        this.products = products;
        this.filteredProducts = [...this.products];
        
        this.form.get('tipoDirecto')?.valueChanges.subscribe(() => {
          this.applyFilters('');
          if (!this.id || this.id === 0) {
            this.form.get('producto')?.setValue('');
          }
        });

        this.setValues();
      }
    });
  }

  applyFilters(searchValue: string) {
    const tipoDirecto = this.form.get('tipoDirecto')?.value;
    
    let preFiltered = this.products;
    if (tipoDirecto) {
      preFiltered = this.products.filter(p => {
        const c = p.clasificacion?.toLowerCase().trim() || '';
        if (tipoDirecto === 'Producto') return c === 'producto' || c === 'productos';
        if (tipoDirecto === 'Proyecto') return c === 'proyecto' || c === 'proyectos';
        if (tipoDirecto === 'Servicio') return c === 'servicio' || c === 'servicios';
        return true;
      });
    }

    if (searchValue) {
      this.filteredProducts = preFiltered.filter(product => 
        product.nombre.toLowerCase().includes(searchValue.toLowerCase())
      );
    } else {
      this.filteredProducts = preFiltered;
    }
    this.cdr.detectChanges();
  }

  back() {
    this.router.navigate(['/fixes']);
  }

  setValues() {
    const data: Fixe | undefined = history.state.edit_fixe;
    if (data && data.id && data.id > 0) {
      this.form.get('tipo')?.setValue(data.tipo, { emitEvent: false });
      this.conceptosMostrados = this.opcionesConceptos[data.tipo] || [];

      if (this.conceptosMostrados.includes(data.concepto)) {
        this.form.get('concepto')?.setValue(data.concepto, { emitEvent: false });
      } else {
        this.form.get('concepto')?.setValue('Otro', { emitEvent: false });
        this.form.get('otroConcepto')?.setValue(data.concepto, { emitEvent: false });
      }

      this.form.get('precio')?.setValue(data.precio, { emitEvent: false });
      this.form.get('clasificacion')?.setValue(data.clasificacion, { emitEvent: false });

      if (data.producto && this.products.length > 0) {
        const prod = this.products.find(p => p.id === data.producto);
        if (prod) {
          const c = prod.clasificacion?.toLowerCase().trim();
          if (c === 'producto' || c === 'productos') this.form.get('tipoDirecto')?.setValue('Producto', { emitEvent: false });
          else if (c === 'proyecto' || c === 'proyectos') this.form.get('tipoDirecto')?.setValue('Proyecto', { emitEvent: false });
          else if (c === 'servicio' || c === 'servicios') this.form.get('tipoDirecto')?.setValue('Servicio', { emitEvent: false });
          
          this.applyFilters('');
        }
      }

      this.form.get('producto')?.setValue(data.producto, { emitEvent: false });
      this.id = data.id;
      this.cdr.detectChanges();
    }
  }

  myFormValues() {
    this.form = this.formBuilder.group({
      tipo: ['', Validators.required],
      concepto: ['', Validators.required],
      otroConcepto: [''],
      precio: ['', Validators.required],
      clasificacion: ['', Validators.required],
      tipoDirecto: [''],
      producto: ['']
    });
  }

  onSubmit() {
    this.submitted = true;
    this.form.markAllAsTouched();

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
}
