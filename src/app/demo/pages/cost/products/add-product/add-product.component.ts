import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { Product } from '../../../../../core/models/Cost/product';
import { Config } from '../../../../../core/models/Cost/config';
import { Fixe } from '../../../../../core/models/Cost/fixe';
import { ProductService } from '../../../../../core/services/cost/product.service';
import { ConfigService } from '../../../../../core/services/cost/config.service';
import { FixeService } from '../../../../../core/services/cost/fixe.service';
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
  private fixeService = inject(FixeService);
  private cdr = inject(ChangeDetectorRef);

  form!: FormGroup;
  id: number = 0;
  loading = false;
  submitted = false;
  configs: Config[] = [];

  activeTab: 'def' | 'costos' = 'def';
  costosPendientes: Fixe[] = [];
  costosEliminados: number[] = [];

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

  ngOnInit() {
    this.loadConfigs();
    this.setValues();

    this.form.get('medida')?.valueChanges.subscribe(value => {
      this.onMedidaChange(value);
    });

    this.form.get('costoTipo')?.valueChanges.subscribe(valor => {
      this.conceptosMostrados = this.opcionesConceptos[valor] || [];
      this.form.get('costoConcepto')?.setValue('');
    });
    this.conceptosMostrados = this.opcionesConceptos['Variable'];
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
        setTimeout(() => this.cdr.detectChanges(), 50);
      }
    });
  }

  back() {
    this.router.navigate(['/products']);
  }

  setValues() {
    const data: Product | undefined = history.state.edit_product;
    if (data && data.id && data.id > 0) {
      this.form.get('nombre')?.setValue(data.nombre);
      this.form.get('medida')?.setValue(data.medida);
      this.form.get('sku')?.setValue(data.sku);
      this.form.get('clasificacion')?.setValue(data.clasificacion);
      this.form.get('descripcion')?.setValue(data.descripcion);
      
      const perfilId = typeof data.perfil === 'object' ? (data.perfil as { id?: number })?.id : Number(data.perfil);
      this.form.get('perfil')?.setValue(perfilId || null);
      
      this.form.get('periodo')?.setValue(data.periodo);
      this.id = data.id;

      this.loadCostosAsociados(data.id);
    }
  }

  loadCostosAsociados(productoId: number) {
    this.fixeService.getFixes().subscribe((fixes) => {
      if (fixes) {
        this.costosPendientes = fixes.filter((c: Fixe) => c.producto === productoId && c.clasificacion === 'Directo');
        this.cdr.detectChanges();
      }
    });
  }

  agregarCosto() {
    const tipo = this.form.get('costoTipo')?.value;
    let concepto = this.form.get('costoConcepto')?.value;
    if (concepto === 'Otro') {
      concepto = this.form.get('costoOtroConcepto')?.value;
    }
    const precio = Number(this.form.get('costoPrecio')?.value) || 0;

    if (!tipo || !concepto || precio <= 0) {
      Swal.fire('Atención', 'Debe indicar Tipo, Concepto y Precio válido para agregar el costo.', 'warning');
      return;
    }

    const nuevoCosto: Fixe = {
      tipo: tipo,
      concepto: concepto,
      precio: precio,
      clasificacion: 'Directo',
      producto: this.id > 0 ? this.id : undefined
    };

    this.costosPendientes = [...this.costosPendientes, nuevoCosto];
    
    this.form.patchValue({
      costoConcepto: '',
      costoOtroConcepto: '',
      costoPrecio: ''
    });
    this.cdr.detectChanges();
  }

  removerCosto(index: number) {
    const costo = this.costosPendientes[index];
    if (costo.id) {
      this.costosEliminados.push(costo.id);
    }
    this.costosPendientes.splice(index, 1);
    this.costosPendientes = [...this.costosPendientes];
    this.cdr.detectChanges();
  }

  myFormValues() {
    this.form = this.formBuilder.group({
      nombre: ['', Validators.required],
      medida: ['Unidades'],
      sku: [''],
      descripcion: ['', Validators.required],
      clasificacion: ['', Validators.required],
      perfil: [''],
      periodo: [''],
      // Costos directos
      costoTipo: ['Variable'],
      costoConcepto: [''],
      costoOtroConcepto: [''],
      costoPrecio: ['']
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

    // Lógica Maestro-Detalle usando RxJS
    let productReq$: Observable<Product>;

    if (this.id === 0) {
      productReq$ = this.productService.addWithReturn(product).pipe(
        tap((resp: Product) => {
          const newId = resp.id;
          if (newId) this.id = newId;
        })
      );
    } else {
      productReq$ = this.productService.updateWithReturn(this.id, product).pipe(
        tap(() => console.log('Product updated'))
      );
    }

    productReq$.pipe(
      switchMap(() => {
        const requests: Observable<unknown>[] = [];
        
        // Costos nuevos a crear (no tienen ID)
        const nuevos = this.costosPendientes.filter(c => !c.id);
        for (const c of nuevos) {
          c.producto = this.id;
          requests.push(this.fixeService.addWithReturn(c));
        }

        // Costos a eliminar
        for (const id of this.costosEliminados) {
          requests.push(this.fixeService.deleteWithReturn(id));
        }

        if (requests.length === 0) {
          return of(true);
        }

        return forkJoin(requests);
      }),
      catchError(error => {
        this.loading = false;
        console.error(error);
        Swal.fire('Atención', 'Se guardó el producto, pero ocurrió un problema guardando sus costos vinculados.', 'warning');
        return of(null);
      })
    ).subscribe((res) => {
      this.loading = false;
      if (res !== null) {
        Swal.fire({
          title: '¡Guardado!',
          text: 'Producto y costos guardados exitosamente.',
          icon: 'success',
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#4680ff'
        }).then(() => {
          this.router.navigate(['/products']);
        });
      }
    });
  }
}
