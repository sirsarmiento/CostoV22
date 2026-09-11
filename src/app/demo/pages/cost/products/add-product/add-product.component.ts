import { Component, OnInit, inject, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { ProductService } from '../../../../../core/services/cost/product.service';
import { ConfigService } from '../../../../../core/services/cost/config.service';
import { AssetService } from '../../../../../core/services/cost/asset.service';
import { FixeService } from '../../../../../core/services/cost/fixe.service';
import { Product, PiezaProducto } from '../../../../../core/models/Cost/product';
import { Config } from '../../../../../core/models/Cost/config';
import { Asset } from '../../../../../core/models/Cost/asset';
import { Fixe } from '../../../../../core/models/Cost/fixe';
import Swal from 'sweetalert2';
import { Observable, forkJoin } from 'rxjs';
import { tap } from 'rxjs/operators';

import { ComponentCanDeactivate } from '../../../../../core/guards/pending-changes.guard';

@Component({
  selector: 'app-add-product',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, NgSelectModule],
  templateUrl: './add-product.component.html'
})
export class AddProductComponent implements OnInit, ComponentCanDeactivate {
  private formBuilder = inject(FormBuilder);
  private productService = inject(ProductService);
  private configService = inject(ConfigService);
  private assetService = inject(AssetService);
  private fixeService = inject(FixeService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

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

  allAssets: Asset[] = [];
  activosMateriales: Asset[] = [];

  loadAssets() {
    this.assetService.getAssets().subscribe({
      next: (assets) => {
        if (assets) {
          this.allAssets = assets;
          // 1. Máquinas: Activos Fijos de Categoría Equipo y Subcategoría Fabricación
          this.maquinasList = assets.filter((a: Asset) => {
            const t = (a.tipo || '').toLowerCase().trim();
            const c = (a.categoria || '').toLowerCase().trim();
            const s = (a.subCategoria || (a as unknown as Record<string, unknown>)['sub_categoria'] || (a as unknown as Record<string, unknown>)['subcategoria'] || '').toString().toLowerCase().trim();
            return t === 'fijo' && c === 'equipo' && (s === 'fabricación' || s === 'fabricacion' || s.includes('fabricac'));
          });

          if (this.maquinasList.length === 0) {
            this.maquinasList = assets.filter((a: Asset) => 
              (a.tipo || '').toLowerCase().trim() === 'fijo' && 
              (a.categoria || '').toLowerCase().trim() === 'equipo'
            );
          }

          this.assetsMobiliario = assets.filter((a: Asset) => 
            (a.categoria || '').toLowerCase().trim() === 'mobiliario'
          );

          // 2. Activos de Inventario: Activos Circulantes de Categoría Producción
          this.activosCirculantes = assets.filter((a: Asset) => {
            const t = (a.tipo || '').toLowerCase().trim();
            const c = (a.categoria || '').toLowerCase().trim();
            return t === 'circulante' && (c === 'producción' || c === 'produccion');
          });

          if (this.activosCirculantes.length === 0) {
            this.activosCirculantes = assets.filter((a: Asset) => 
              (a.tipo || '').toLowerCase().trim() === 'circulante'
            );
          }

          // 3. Activos Tipo Material: Materiales para impresión/fabricación
          this.activosMateriales = assets.filter((a: Asset) => {
            const t = (a.tipo || '').toLowerCase().trim();
            const c = (a.categoria || '').toLowerCase().trim();
            return t === 'material' || c === 'filamento' || c === 'resina' || c === 'filamentos' || c === 'resinas' || c.includes('filamento') || c.includes('resina');
          });

          this.categoriasMaterial = [...new Set(
            this.activosMateriales.map(a => a.categoria).filter((c): c is string => !!c)
          )];
          this.materialesFiltradosCirculantes = [...this.activosMateriales];
          this.form.get('piezaMaterialId')?.enable();

          this.actualizarNombresPiezas();
          this.cdr.detectChanges();
        }
      }
    });
  }

  actualizarNombresPiezas() {
    if (!this.piezasPendientes || this.piezasPendientes.length === 0) return;
    this.piezasPendientes = this.piezasPendientes.map(p => {
      const pObj = p as Record<string, unknown>;
      const maqName = this.getNombreMaquina(pObj);
      const matName = this.getNombreMaterial(pObj);

      const rawMaq = pObj['maquina'] ?? pObj['maquinaId'] ?? pObj['maquina_id'];
      const maqId = typeof rawMaq === 'object' && rawMaq !== null ? Number((rawMaq as Record<string, unknown>)['id']) : (Number(rawMaq) || undefined);

      const rawAct = pObj['activo'] ?? pObj['assetId'] ?? pObj['activo_id'];
      const actId = typeof rawAct === 'object' && rawAct !== null ? Number((rawAct as Record<string, unknown>)['id']) : (Number(rawAct) || undefined);

      return {
        ...pObj,
        maquinaId: maqId,
        maquinaNombre: maqName !== '-' ? maqName : (pObj['maquinaNombre'] || undefined),
        assetId: actId,
        materialDisplayName: matName !== '-' ? matName : (pObj['materialDisplayName'] || undefined)
      };
    });
  }

  getNombreMaquina(p: Record<string, unknown> | PiezaProducto | unknown): string {
    if (!p) return '-';
    const pObj = p as Record<string, unknown>;
    if (pObj['maquinaNombre'] && pObj['maquinaNombre'] !== '-') return String(pObj['maquinaNombre']);
    
    const rawMaq = pObj['maquina'] ?? pObj['maquinaId'] ?? pObj['maquina_id'];
    if (typeof rawMaq === 'object' && rawMaq !== null) {
      const nom = (rawMaq as Record<string, unknown>)['nombre'];
      if (nom) return String(nom);
    }
    const maqId = typeof rawMaq === 'object' && rawMaq !== null ? Number((rawMaq as Record<string, unknown>)['id']) : Number(rawMaq);
    if (maqId && !isNaN(maqId)) {
      const found = this.maquinasList.find(m => m.id == maqId) || this.allAssets.find(a => a.id == maqId);
      if (found?.nombre) return found.nombre;
    }
    return '-';
  }

  getNombreMaterial(p: Record<string, unknown> | PiezaProducto | unknown): string {
    if (!p) return '-';
    const pObj = p as Record<string, unknown>;
    if (pObj['materialDisplayName'] && pObj['materialDisplayName'] !== '-') return String(pObj['materialDisplayName']);
    if (pObj['materialTipo'] && pObj['materialTipo'] !== 'Sin material') return String(pObj['materialTipo']);
    
    const rawAct = pObj['activo'] ?? pObj['assetId'] ?? pObj['activo_id'];
    if (typeof rawAct === 'object' && rawAct !== null) {
      const nom = (rawAct as Record<string, unknown>)['nombre'];
      if (nom) return String(nom);
    }
    const actId = typeof rawAct === 'object' && rawAct !== null ? Number((rawAct as Record<string, unknown>)['id']) : Number(rawAct);
    if (actId && !isNaN(actId)) {
      const found = this.activosMateriales.find(a => a.id == actId) 
        || this.activosCirculantes.find(a => a.id == actId) 
        || this.allAssets.find(a => a.id == actId);
      if (found?.nombre) return found.nombre;
    }
    return '-';
  }

  onPiezaCategoriaChange(categoria: string) {
    if (categoria) {
      this.materialesPorCategoria = this.activosMateriales.filter(a => a.categoria === categoria);
      this.subcategoriasMaterial = [...new Set(
        this.materialesPorCategoria.map(a => a.subCategoria || ((a as unknown as Record<string, string>)['subcategoria'])).filter((s): s is string => !!s)
      )];
      this.materialesFiltradosCirculantes = [...this.materialesPorCategoria];
    } else {
      this.materialesPorCategoria = [];
      this.subcategoriasMaterial = [];
      this.materialesFiltradosCirculantes = [...this.activosMateriales];
    }
    this.form.get('piezaMaterialSubcategoria')?.setValue('');
    this.form.get('piezaMaterialId')?.setValue(null);
    this.form.get('piezaMaterialId')?.enable();
  }

  onPiezaSubcategoriaChange(subcategoria: string) {
    if (subcategoria) {
      this.materialesFiltradosCirculantes = this.materialesPorCategoria.filter(a => 
        (a.subCategoria || ((a as unknown as Record<string, string>)['subcategoria'])) === subcategoria
      );
    } else {
      this.materialesFiltradosCirculantes = this.materialesPorCategoria.length > 0 ? [...this.materialesPorCategoria] : [...this.activosMateriales];
    }
    this.form.get('piezaMaterialId')?.setValue(null);
  }

  onPiezaMaterialChange(materialId: number) {
    if (materialId) {
      const asset = this.activosMateriales.find(a => a.id == materialId) || this.activosCirculantes.find(a => a.id == materialId);
      if (asset) {
        const uMedida = (asset.unidadMedida || '').toLowerCase().trim();
        const valUnit = Number(asset.valorUnitario) || Number(asset.costoInicial) || 0;
        let precioPorGramo: number;
        if (uMedida === 'gramos' || uMedida === 'gramo') {
          precioPorGramo = valUnit;
        } else {
          precioPorGramo = valUnit > 0 ? (valUnit / 1000) : 0;
        }
        const rounded = Math.round(precioPorGramo * 10000) / 10000;
        this.form.get('piezaPrecioMaterial')?.setValue(rounded);
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

    this.form.get('piezaMaterialCategoria')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(val => this.onPiezaCategoriaChange(val));

    this.form.get('piezaMaterialSubcategoria')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(val => this.onPiezaSubcategoriaChange(val));

    this.form.get('piezaMaterialId')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(val => this.onPiezaMaterialChange(val));

    this.form.get('perfil')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.actualizarMinMargenGanancia());
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
      
      const rawPiezas = dRec['piezasProducto'] ?? dRec['piezas_producto'] ?? dRec['piezas'] ?? data.piezasProducto ?? [];
      const piezasArray = Array.isArray(rawPiezas) ? rawPiezas : [];
      this.piezasPendientes = piezasArray.map(p => {
        const pObj = p as unknown as Record<string, unknown>;
        const maqId = Number(pObj['maquina'] ?? pObj['maquinaId'] ?? pObj['maquina_id']) || undefined;
        let maqName = pObj['maquinaNombre'] as string | undefined;
        if (maqId && !maqName) {
          const found = this.maquinasList.find(m => m.id == maqId) || this.allAssets.find(a => a.id == maqId);
          if (found) maqName = found.nombre;
        }
        const actId = Number(pObj['activo'] ?? pObj['assetId'] ?? pObj['activo_id']) || undefined;
        let matName = pObj['materialDisplayName'] as string | undefined;
        if (actId && !matName) {
          const foundMat = this.activosMateriales.find(a => a.id == actId) 
            || this.activosCirculantes.find(a => a.id == actId) 
            || this.allAssets.find(a => a.id == actId);
          if (foundMat) matName = foundMat.nombre;
        }
        return {
          ...pObj,
          fromDb: true,
          maquinaId: maqId,
          maquinaNombre: maqName,
          assetId: actId,
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

    // Auto-agregar pieza si el usuario llenó los campos superiores pero olvidó hacer clic en [+]
    const tipoPieza = this.form.get('piezaTipo')?.value;
    if (tipoPieza === 'Del Inventario' && this.form.get('piezaInventario')?.value) {
      this.agregarPieza();
    } else if (tipoPieza === 'Fabricada' && (this.form.get('piezaFabricada')?.value || this.form.get('piezaGramos')?.value)) {
      this.agregarPieza();
    }

    if (this.form.invalid) {
      if (this.form.get('nombre')?.invalid || this.form.get('clasificacion')?.invalid || this.form.get('descripcion')?.invalid) {
        this.activeTab = 'def';
      }
      Swal.fire('Formulario Incompleto', 'Por favor complete todos los datos obligatorios del producto.', 'warning');
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
        precio_material: matPrice,
        tipo: tip,
        cantidad: cant,
        activo: numAct,
        activo_id: numAct,
        maquina: numMaq,
        maquina_id: numMaq
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
      nombre: this.form.get('nombre')?.value,
      sku: this.form.get('sku')?.value,
      descripcion: this.form.get('descripcion')?.value,
      clasificacion: this.form.get('clasificacion')?.value,
      medida: this.form.get('medida')?.value,
      perfil: Number(this.form.get('perfil')?.value) || 0,
      tasaFallo: tasaNum,
      tiempoSetup: prepNum,
      postProcesado: postNum,
      margenGanancia: margenNum,
      piezasProducto: mappedPiezas
    };

    if (this.id > 0) {
      productPayload['id'] = this.id;
    }
    if (this.form.get('periodo')?.value) {
      productPayload['periodo'] = this.form.get('periodo')?.value;
    }

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
          this.submitted = true;
          this.form?.markAsPristine();
          Swal.fire('¡Éxito!', 'Producto y costos guardados correctamente.', 'success').then(() => {
            this.back();
          });
        },
        error: (err) => {
          console.error('Error syncing costs:', err);
          this.loading = false;
          this.submitted = true;
          this.form?.markAsPristine();
          Swal.fire('Atención', 'El producto se guardó pero ocurrió un error con los costos vinculados.', 'warning').then(() => {
            this.back();
          });
        }
      });
    } else {
      this.loading = false;
      this.submitted = true;
      this.form?.markAsPristine();
      Swal.fire('¡Éxito!', 'Producto guardado correctamente.', 'success').then(() => {
        this.back();
      });
    }
  }

  canDeactivate(): boolean {
    if (this.submitted && !this.loading) {
      return true;
    }
    const isFormDirty = this.form?.dirty;
    const hasUnsavedPieces = !this.id && this.piezasPendientes && this.piezasPendientes.length > 0;
    const hasUnsavedCosts = !this.id && this.costosPendientes && this.costosPendientes.length > 0;
    return !isFormDirty && !hasUnsavedPieces && !hasUnsavedCosts;
  }
}
