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
    const cfg = (perfilId ? this.configs.find(c => c.id == perfilId) : this.configs[0]) as unknown as Record<string, unknown> | undefined;
    if (cfg) {
      this.minMargenGanancia = Number(cfg['margenGanancia'] ?? cfg['minMargenGanancia'] ?? cfg['margen_ganancia']) || 0;
    }

    const control = this.form.get('margenGanancia');
    if (control) {
      control.setValidators([Validators.min(this.minMargenGanancia), Validators.max(100)]);
      control.updateValueAndValidity();
      const valNum = Number(control.value) || 0;
      if (!control.value || valNum < this.minMargenGanancia) {
        control.setValue(this.minMargenGanancia);
      }
    }
  }

  onMargenBlur() {
    const control = this.form?.get('margenGanancia');
    if (control) {
      const val = Number(control.value) || 0;
      if (val < this.minMargenGanancia) {
        control.setValue(this.minMargenGanancia);
        Swal.fire({
          icon: 'info',
          title: 'Margen Mínimo Requerido',
          text: `El margen de ganancia no puede ser menor al mínimo configurado en Perfil (${this.minMargenGanancia}%). Se ha ajustado automáticamente.`,
          timer: 3000,
          showConfirmButton: false
        });
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
            a.tipo?.toLowerCase().trim() === 'material'
          );
          this.categoriasMaterial = [...new Set(
            this.activosCirculantes.map(a => a.categoria).filter((c): c is string => !!c)
          )];
          this.materialesFiltradosCirculantes = [...this.activosCirculantes];
          this.form.get('piezaMaterialId')?.enable();
          this.cdr.detectChanges();
        }
      }
    });
  }

  onPiezaCategoriaChange(categoria: string) {
    if (categoria) {
      this.materialesPorCategoria = this.activosCirculantes.filter(a => a.categoria === categoria);
      this.subcategoriasMaterial = [...new Set(
        this.materialesPorCategoria.map(a => a.subcategoria || ((a as unknown as Record<string, string>)['subCategoria'])).filter((s): s is string => !!s)
      )];
      this.materialesFiltradosCirculantes = [...this.materialesPorCategoria];
    } else {
      this.materialesPorCategoria = [];
      this.subcategoriasMaterial = [];
      this.materialesFiltradosCirculantes = [...this.activosCirculantes];
    }
    this.form.get('piezaMaterialSubcategoria')?.setValue('');
    this.form.get('piezaMaterialId')?.setValue(null);
    this.form.get('piezaMaterialId')?.enable();
  }

  onPiezaSubcategoriaChange(subcategoria: string) {
    if (subcategoria) {
      this.materialesFiltradosCirculantes = this.materialesPorCategoria.filter(a => 
        (a.subcategoria || ((a as unknown as Record<string, string>)['subCategoria'])) === subcategoria
      );
    } else {
      this.materialesFiltradosCirculantes = this.materialesPorCategoria.length > 0 ? [...this.materialesPorCategoria] : [...this.activosCirculantes];
    }
    this.form.get('piezaMaterialId')?.setValue(null);
  }

  onPiezaMaterialChange(materialId: number) {
    if (materialId) {
      const asset = this.activosCirculantes.find(a => a.id == materialId);
      if (asset) {
        const uMedida = asset.unidadMedida?.toLowerCase().trim();
        const valUnit = Number(asset.valorUnitario) || 0;
        let precioPorGramo: number;
        if (uMedida === 'kg' || uMedida === 'kilo' || uMedida === 'kilogramo') {
          precioPorGramo = valUnit / 1000;
        } else {
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
    let gramos: number;
    let horas: number;
    let minutos: number;
    let precioMaterial: number;
    let materialDisplayName = '';
    let maquinaId: number | undefined = undefined;
    let maquinaNombre: string | undefined = undefined;

    if (tipo === 'Del Inventario') {
      const asset = this.form.get('piezaInventario')?.value;
      if (!asset) {
        Swal.fire('Atención', 'Seleccione un activo del inventario.', 'warning');
        return;
      }
      const foundMob = this.assetsMobiliario.find(a => a.id == asset);
      const foundCirc = this.activosCirculantes.find(a => a.id == asset);
      const foundAsset = foundMob || foundCirc;
      nombre = foundAsset?.nombre || 'Activo Inventario';
      assetId = Number(asset);
      gramos = 0;
      horas = 0;
      minutos = 0;
      precioMaterial = Number(foundAsset?.valorUnitario) || Number(foundAsset?.costoInicial) || 0;
      materialDisplayName = nombre;
    } else {
      nombre = this.form.get('piezaFabricada')?.value;
      gramos = Number(this.form.get('piezaGramos')?.value) || 0;
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
      piezaMaterialId: [{value: null, disabled: false}],
      piezaPrecioMaterial: [''],
      activoId: [null]
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
      
      const dRec = data as unknown as Record<string, unknown>;
      const prepVal = dRec['tiempoSetup'] ?? dRec['prepSlicing'] ?? dRec['tiempo_setup'] ?? dRec['prep_slicing'] ?? '';
      const postVal = dRec['postProcesado'] ?? dRec['post_procesado'] ?? dRec['tiempo_post_procesado'] ?? dRec['tiempoPostProcesado'] ?? 0;
      const tasaVal = dRec['tasaFallo'] ?? dRec['tasa_fallo'] ?? dRec['tasaFalloGlobal'] ?? 0;
      const margenVal = dRec['margenGanancia'] ?? dRec['margen_ganancia'] ?? this.minMargenGanancia;

      this.form.get('prepSlicing')?.setValue(prepVal);
      this.form.get('postProcesado')?.setValue(postVal);
      this.form.get('tasaFallo')?.setValue(tasaVal);
      this.form.get('margenGanancia')?.setValue(margenVal);
      
      const rawPiezas = dRec['piezasProducto'] ?? dRec['piezas'] ?? dRec['piezasBase'] ?? dRec['piezas_base'] ?? data.piezasBase ?? [];
      const piezasArray = Array.isArray(rawPiezas) ? rawPiezas : [];
      this.piezasPendientes = piezasArray.map(p => {
        const pObj = p as unknown as Record<string, unknown>;
        const maqId = pObj['maquina'] ?? pObj['maquinaId'] ?? pObj['maquina_id'];
        let maqName = pObj['maquinaNombre'] as string | undefined;
        if (maqId && !maqName) {
          const found = this.maquinasList.find(m => m.id == maqId);
          if (found) maqName = found.nombre;
        }
        const actId = pObj['activo'] ?? pObj['assetId'] ?? pObj['activo_id'];
        let matName = pObj['materialDisplayName'] as string | undefined;
        if (actId && !matName) {
          const foundMat = this.activosCirculantes.find(a => a.id == actId);
          if (foundMat) matName = foundMat.nombre;
        }
        return {
          ...pObj,
          fromDb: true,
          maquinaId: maqId ? Number(maqId) : undefined,
          maquinaNombre: maqName,
          assetId: actId ? Number(actId) : undefined,
          materialDisplayName: matName
        };
      });
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
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      Swal.fire('Error', 'Complete los datos obligatorios del producto.', 'error');
      return;
    }

    this.loading = true;

    const mappedPiezas = this.piezasPendientes.map((p, idx) => {
      const pObj = p as Record<string, unknown>;
      const actId = pObj['activo'] ?? pObj['assetId'] ?? pObj['activo_id'];
      const maqId = pObj['maquina'] ?? pObj['maquinaId'] ?? pObj['maquina_id'];
      const numAct = (actId !== null && actId !== undefined && actId !== '') ? Number(actId) : null;
      const numMaq = (maqId !== null && maqId !== undefined && maqId !== '') ? Number(maqId) : null;
      
      let nom = String(pObj['nombre'] || '').trim();
      if (!nom || nom === 'null' || nom === 'undefined') {
        if (numAct) {
          const foundMob = this.assetsMobiliario.find(a => a.id == numAct);
          const foundCirc = this.activosCirculantes.find(a => a.id == numAct);
          nom = (foundMob || foundCirc)?.nombre || `PIEZA ${idx + 1}`;
        } else {
          nom = `PIEZA ${idx + 1}`;
        }
      }

      let tip = String(pObj['tipo'] || '').trim();
      if (!tip || tip === 'null' || tip === 'undefined') {
        tip = numAct && !numMaq ? 'Del Inventario' : 'Producción';
      }

      const gVal = Number(pObj['gramos']) || 0;
      const mVal = Number(pObj['metros'] ?? pObj['metro']) || 0;
      const hVal = Number(pObj['horas']) || 0;
      const minVal = Number(pObj['minutos']) || 0;
      const matPrice = Number(pObj['precioMaterial'] ?? pObj['precio_material']) || 0;
      const cant = Number(pObj['cantidad']) || 1;

      const piece: Record<string, unknown> = {
        nombre: nom,
        gramos: gVal,
        metros: mVal,
        horas: hVal,
        minutos: minVal,
        precioMaterial: matPrice,
        tipo: tip,
        cantidad: cant,
        activo: numAct,
        maquina: numMaq
      };

      if (pObj['fromDb'] && pObj['id'] && Number(pObj['id']) > 0) {
        piece['id'] = Number(pObj['id']);
      }

      return piece;
    });

    const prepNum = Number(this.form.get('prepSlicing')?.value) || 0;
    const postNum = Number(this.form.get('postProcesado')?.value) || 0;
    const tasaNum = Number(this.form.get('tasaFallo')?.value) || 0;
    const margenNum = Number(this.form.get('margenGanancia')?.value) || 0;

    const productPayload: Record<string, unknown> = {
      id: this.id > 0 ? this.id : 0,
      nombre: this.form.get('nombre')?.value,
      sku: this.form.get('sku')?.value,
      descripcion: this.form.get('descripcion')?.value,
      clasificacion: this.form.get('clasificacion')?.value,
      medida: this.form.get('medida')?.value,
      perfil: Number(this.form.get('perfil')?.value) || 0,
      periodo: this.form.get('periodo')?.value,
      tasaFallo: tasaNum,
      tiempoSetup: prepNum,
      postProcesado: postNum,
      margenGanancia: margenNum,
      piezasProducto: mappedPiezas
    };

    console.log('>>> PAYLOAD DE PRODUCTO A ENVIAR AL SERVIDOR:', JSON.stringify(productPayload, null, 2));

    const product = productPayload as unknown as Product;

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
        const serverErr = err?.error?.error || err?.error?.message || err?.message;
        const detailMsg = typeof serverErr === 'string' ? serverErr : JSON.stringify(serverErr || 'No se pudo guardar la información del producto.');
        Swal.fire('Error al Guardar', detailMsg, 'error');
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
