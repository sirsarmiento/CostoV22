import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { ProductService } from '../../../../../core/services/cost/product.service';
import { ConfigService } from '../../../../../core/services/cost/config.service';
import { AssetService } from '../../../../../core/services/cost/asset.service';
import { FixeService } from '../../../../../core/services/cost/fixe.service';
import { Product } from '../../../../../core/models/Cost/product';
import { Config } from '../../../../../core/models/Cost/config';
import { Asset } from '../../../../../core/models/Cost/asset';
import { Fixe } from '../../../../../core/models/Cost/fixe';
import Swal from 'sweetalert2';
import { Observable, forkJoin } from 'rxjs';
import { tap } from 'rxjs/operators';

@Component({
  selector: 'app-add-product',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, NgSelectModule],
  templateUrl: './add-product.component.html'
})
export class AddProductComponent implements OnInit {
  private formBuilder = inject(FormBuilder);
  private productService = inject(ProductService);
  private configService = inject(ConfigService);
  private assetService = inject(AssetService);
  private fixeService = inject(FixeService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  form!: FormGroup;
  submitted = false;
  loading = false;
  id = 0;
  minMargenGanancia = 0;

  configs: Config[] = [];
  activeTab: 'def' | 'costos' | 'piezas' = 'def';
  costosPendientes: Fixe[] = [];
  costosEliminados: number[] = [];

  // Parámetros de Presupuesto y Piezas
  piezasPendientes: Record<string, unknown>[] = [];
  assetsMobiliario: Asset[] = [];
  activosCirculantes: Asset[] = [];
  maquinasList: Asset[] = [];
  categoriasMaterial: string[] = [];
  subcategoriasMaterial: string[] = [];
  materialesPorCategoria: Asset[] = [];
  materialesFiltradosCirculantes: Asset[] = [];

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
    this.loadAssets();
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
          this.actualizarMinMargenGanancia();
        }
        setTimeout(() => this.cdr.detectChanges(), 50);
      }
    });
  }

  actualizarMinMargenGanancia() {
    const perfilId = this.form.get('perfil')?.value;
    if (perfilId) {
      const selectedConfig = this.configs.find(c => c.id == perfilId);
      if (selectedConfig) {
        this.minMargenGanancia = Number(selectedConfig.margenGanancia) || 0;
      }
    }

    const control = this.form.get('margenGanancia');
    if (control) {
      control.setValidators([Validators.min(this.minMargenGanancia), Validators.max(100)]);
      control.updateValueAndValidity();
      if (!control.value || control.value < this.minMargenGanancia) {
        control.setValue(this.minMargenGanancia);
      }
    }
  }

  loadAssets() {
    this.assetService.getAssets().subscribe({
      next: (assets) => {
        if (assets) {
          this.maquinasList = assets.filter((a: Asset) => 
            a.tipo?.toLowerCase().trim() === 'fijo' && 
            a.categoria?.toLowerCase().trim() === 'equipo'
          );
          this.assetsMobiliario = assets.filter((a: Asset) => 
            a.categoria?.toLowerCase().trim() === 'mobiliario'
          );
          this.activosCirculantes = assets.filter((a: Asset) => 
            a.tipo?.toLowerCase().trim() === 'circulante'
          );
          this.categoriasMaterial = [...new Set(
            this.activosCirculantes.map(a => a.categoria).filter(Boolean)
          )] as string[];
          this.cdr.detectChanges();
        }
      }
    });
  }

  onPiezaCategoriaChange(categoria: string) {
    if (categoria) {
      this.materialesPorCategoria = this.activosCirculantes.filter(a => a.categoria === categoria);
      this.subcategoriasMaterial = [...new Set(
        this.materialesPorCategoria.map(a => a.subcategoria || ((a as unknown as Record<string, string>)['subCategoria'])).filter(Boolean)
      )] as string[];
      this.materialesFiltradosCirculantes = [...this.materialesPorCategoria];
    } else {
      this.materialesPorCategoria = [];
      this.subcategoriasMaterial = [];
      this.materialesFiltradosCirculantes = [];
    }
    this.form.get('piezaMaterialSubcategoria')?.setValue('');
    this.form.get('piezaMaterialId')?.setValue(null);
  }

  onPiezaSubcategoriaChange(subcategoria: string) {
    if (subcategoria) {
      this.materialesFiltradosCirculantes = this.materialesPorCategoria.filter(a => 
        (a.subcategoria || ((a as unknown as Record<string, string>)['subCategoria'])) === subcategoria
      );
    } else {
      this.materialesFiltradosCirculantes = [...this.materialesPorCategoria];
    }
    this.form.get('piezaMaterialId')?.setValue(null);
  }

  onPiezaMaterialChange(materialId: number) {
    if (materialId) {
      const asset = this.activosCirculantes.find(a => a.id == materialId);
      if (asset) {
        const uMedida = asset.unidadMedida?.toLowerCase().trim();
        const valUnit = Number(asset.valorUnitario) || 0;
        let precioPorGramo = 0;
        if (uMedida === 'kg' || uMedida === 'kilo' || uMedida === 'kilogramo') {
          precioPorGramo = valUnit / 1000;
        } else if (uMedida === 'gramos' || uMedida === 'gramo') {
          precioPorGramo = valUnit;
        }
        this.form.get('piezaPrecioMaterial')?.setValue(precioPorGramo);
      }
    } else {
      this.form.get('piezaPrecioMaterial')?.setValue('');
    }
  }

  agregarPieza() {
    const tipo = this.form.get('piezaTipo')?.value;
    const cantidad = Number(this.form.get('piezaCantidad')?.value) || 1;
    let nombre: string;
    let assetId: number | null;
    let gramos: number | null = null;
    let horas: number | null = null;
    let minutos: number | null = null;
    let precioMaterial: number | null = null;
    let materialDisplayName = '';
    let maquinaId: number | undefined = undefined;
    let maquinaNombre: string | undefined = undefined;

    if (tipo === 'Del Inventario') {
      const asset = this.form.get('piezaInventario')?.value;
      if (!asset) {
        Swal.fire('Atención', 'Seleccione un activo del inventario.', 'warning');
        return;
      }
      nombre = this.assetsMobiliario.find(a => a.id == asset)?.nombre || 'Activo';
      assetId = Number(asset);
    } else {
      nombre = this.form.get('piezaFabricada')?.value;
      gramos = Number(this.form.get('piezaGramos')?.value);
      horas = Number(this.form.get('piezaHoras')?.value);
      minutos = Number(this.form.get('piezaMinutos')?.value);
      
      const maqVal = this.form.get('activoId')?.value;
      if (maqVal) {
        maquinaId = Number(maqVal);
        maquinaNombre = this.maquinasList.find(m => m.id == maqVal)?.nombre;
      }

      const matId = this.form.get('piezaMaterialId')?.value;
      if (!matId) {
        Swal.fire('Atención', 'Seleccione un material para la pieza fabricada.', 'warning');
        return;
      }
      assetId = Number(matId);
      precioMaterial = Number(this.form.get('piezaPrecioMaterial')?.value) || 0;
      
      const assetCirc = this.activosCirculantes.find(a => a.id == matId);
      if (assetCirc) {
        materialDisplayName = assetCirc.nombre;
      }

      if (!nombre) {
        Swal.fire('Atención', 'Ingrese el nombre de la pieza fabricada.', 'warning');
        return;
      }
      if (gramos === null || isNaN(gramos) || gramos < 0) {
        Swal.fire('Atención', 'Ingrese los gramos de la pieza.', 'warning');
        return;
      }
      if (horas === null || isNaN(horas) || horas < 0) {
        Swal.fire('Atención', 'Ingrese las horas de fabricación.', 'warning');
        return;
      }
      if (minutos === null || isNaN(minutos) || minutos < 0 || minutos > 59) {
        Swal.fire('Atención', 'Ingrese los minutos válidos (0-59).', 'warning');
        return;
      }
    }

    if (!cantidad || cantidad <= 0) {
      Swal.fire('Atención', 'Ingrese una cantidad válida.', 'warning');
      return;
    }

    this.piezasPendientes.push({ 
      tipo, nombre, cantidad, assetId, gramos, horas, minutos, precioMaterial, materialDisplayName, maquinaId, maquinaNombre
    });
    this.piezasPendientes = [...this.piezasPendientes];

    this.form.patchValue({
      piezaInventario: '',
      piezaFabricada: '',
      piezaCantidad: 1,
      piezaGramos: '',
      piezaHoras: '',
      piezaMinutos: '',
      piezaMaterialCategoria: '',
      piezaMaterialSubcategoria: '',
      piezaMaterialId: null,
      piezaPrecioMaterial: ''
    });
    this.cdr.detectChanges();
  }

  removerPieza(index: number) {
    this.piezasPendientes.splice(index, 1);
    this.piezasPendientes = [...this.piezasPendientes];
    this.cdr.detectChanges();
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
      costoPrecio: [''],
      // Parámetros de Presupuesto
      prepSlicing: [''],
      postProcesado: [0],
      tasaFallo: [0],
      margenGanancia: [0, [Validators.min(this.minMargenGanancia), Validators.max(100)]],
      piezaTipo: ['Del Inventario'],
      piezaInventario: [''],
      piezaFabricada: [''],
      piezaCantidad: [1],
      piezaGramos: [''],
      piezaHoras: [''],
      piezaMinutos: [''],
      piezaMaterialCategoria: [''],
      piezaMaterialSubcategoria: [''],
      piezaMaterialId: [{value: null, disabled: true}],
      piezaPrecioMaterial: ['']
    });

    this.form.get('piezaMaterialCategoria')?.valueChanges.subscribe(val => this.onPiezaCategoriaChange(val));
    this.form.get('piezaMaterialSubcategoria')?.valueChanges.subscribe(val => this.onPiezaSubcategoriaChange(val));
    this.form.get('piezaMaterialId')?.valueChanges.subscribe(val => this.onPiezaMaterialChange(val));
    this.form.get('perfil')?.valueChanges.subscribe(() => this.actualizarMinMargenGanancia());
  }

  back() {
    this.router.navigate(['/products']);
  }

  setValues() {
    const data: Product | undefined = history?.state?.edit_product;
    if (data && data.id && data.id > 0) {
      this.form.get('nombre')?.setValue(data.nombre);
      this.form.get('medida')?.setValue(data.medida);
      this.form.get('sku')?.setValue(data.sku);
      this.form.get('clasificacion')?.setValue(data.clasificacion);
      this.form.get('descripcion')?.setValue(data.descripcion);
      
      const perfilId = typeof data.perfil === 'object' ? (data.perfil as { id?: number })?.id : Number(data.perfil);
      this.form.get('perfil')?.setValue(perfilId || null);
      
      this.form.get('periodo')?.setValue(data.periodo);
      this.form.get('prepSlicing')?.setValue(data.prepSlicing || '');
      this.form.get('postProcesado')?.setValue(data.postProcesado || 0);
      this.form.get('tasaFallo')?.setValue(data.tasaFallo || 0);
      this.form.get('margenGanancia')?.setValue(data.margenGanancia || this.minMargenGanancia);
      
      this.piezasPendientes = data.piezasBase || [];
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
      periodo: this.form.get('periodo')?.value,
      prepSlicing: Number(this.form.get('prepSlicing')?.value) || 0,
      postProcesado: Number(this.form.get('postProcesado')?.value) || 0,
      tasaFallo: Number(this.form.get('tasaFallo')?.value) || 0,
      margenGanancia: Number(this.form.get('margenGanancia')?.value) || 0,
      piezasBase: this.piezasPendientes
    };

    let productReq$: Observable<Product>;

    if (this.id === 0) {
      productReq$ = this.productService.addWithReturn(product).pipe(
        tap((resp: Product) => {
          if (resp && resp.id) {
            this.id = resp.id;
          }
        })
      );
    } else {
      productReq$ = this.productService.updateProduct(this.id, product).pipe(
        tap(() => {})
      );
    }

    productReq$.subscribe({
      next: () => {
        this.syncCostosDirectos();
      },
      error: (err) => {
        console.error('Error saving product base:', err);
        this.loading = false;
        Swal.fire('Error', 'No se pudo guardar la información del producto.', 'error');
      }
    });
  }

  syncCostosDirectos() {
    const reqs: Observable<unknown>[] = [];

    this.costosEliminados.forEach(cId => {
      reqs.push(this.fixeService.deleteFixe(cId));
    });

    this.costosPendientes.forEach(c => {
      if (!c.id) {
        c.producto = this.id;
        reqs.push(this.fixeService.createFixe(c));
      }
    });

    if (reqs.length > 0) {
      forkJoin(reqs).subscribe({
        next: () => {
          this.loading = false;
          Swal.fire('¡Éxito!', 'Producto y costos guardados correctamente.', 'success').then(() => {
            this.back();
          });
        },
        error: (err) => {
          console.error('Error syncing costs:', err);
          this.loading = false;
          Swal.fire('Atención', 'El producto se guardó pero ocurrió un error con los costos vinculados.', 'warning').then(() => {
            this.back();
          });
        }
      });
    } else {
      this.loading = false;
      Swal.fire('¡Éxito!', 'Producto guardado correctamente.', 'success').then(() => {
        this.back();
      });
    }
  }
}
