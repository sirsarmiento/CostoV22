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
import { CodingService } from '../../../../../core/services/cost/coding.service';
import { CatalogConfigService } from '../../../../../core/services/cost/catalog-config.service';
import { Product, PiezaProducto } from '../../../../../core/models/Cost/product';
import { Family, Subfamily } from '../../../../../core/models/Cost/family';
import { MaterialCatalogo, TecnologiaCatalogo } from '../../../../../core/models/Cost/catalog-config';
import { previsualizarCodigo } from '../../../../../core/utils/catalog-sku';
import { esEquiposFabricacion, materialCompatibleConTecnologia } from '../../../../../core/constants/asset-categories';
import {
  calcularPrecioPorGramo,
  formatAssetOption,
  resolverNombreMaquina,
  resolverNombreMaterial,
  filtrarMaquinasPorTecnologia,
  obtenerCategoriasMaterialPorTecnologia,
  filtrarMaterialesPorCategoria
} from '../../../../../core/utils/piece-builder.helper';
import {
  extractCorrelativosUsadosDeFamilia,
  mapDbPiezasToView,
  mapPiezasToPayload
} from '../../../../../core/utils/product-form.helper';
import { Config } from '../../../../../core/models/Cost/config';
import { Asset } from '../../../../../core/models/Cost/asset';
import { Fixe } from '../../../../../core/models/Cost/fixe';
import Swal from 'sweetalert2';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
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
  private codingService = inject(CodingService);
  private catalogConfigService = inject(CatalogConfigService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  form!: FormGroup;
  submitted = false;
  loading = false;
  id = 0;
  minMargenGanancia = 0;

  configs: Config[] = [];
  familias: Family[] = [];
  tecnologias: TecnologiaCatalogo[] = [];
  materiales: MaterialCatalogo[] = [];
  materialesFiltrados: MaterialCatalogo[] = [];
  productosExistentes: Product[] = [];

  previewSku = '';
  previewCatalogo = '';
  previewCorrelativo = '';
  activeTab: 'def' | 'costos' | 'piezas' = 'def';
  costosPendientes: Fixe[] = [];
  costosEliminados: number[] = [];
  imagenSrc: string | null = null;

  // Parámetros de Presupuesto y Piezas
  piezasPendientes: Record<string, unknown>[] = [];
  allAssets: Asset[] = [];
  assetsMobiliario: Asset[] = [];
  activosCirculantes: Asset[] = [];
  activosMateriales: Asset[] = [];
  maquinasList: Asset[] = [];
  maquinasFiltradas: Asset[] = [];
  categoriasMaterial: string[] = [];
  subcategoriasMaterial: string[] = [];
  materialesPorCategoria: Asset[] = [];
  materialesFiltradosCirculantes: Asset[] = [];

  readonly opcionesConceptos: Record<string, string[]> = {
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
    this.loadCatalogo();
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

  loadCatalogo() {
    forkJoin({
      familias: this.codingService.getFamilies().pipe(catchError(() => of([]))),
      tecnologias: this.catalogConfigService.getTecnologias().pipe(catchError(() => of([]))),
      materiales: this.catalogConfigService.getMateriales().pipe(catchError(() => of([]))),
      productos: this.productService.getProducts().pipe(catchError(() => of([])))
    }).subscribe({
      next: (data) => {
        this.familias = data.familias || [];
        this.tecnologias = data.tecnologias?.length ? data.tecnologias : [
          { id: 1, codigo: 'FDM', nombre: 'Filamento' },
          { id: 2, codigo: 'SLA', nombre: 'Resina' }
        ];
        this.materiales = data.materiales?.length ? data.materiales : [
          { id: 1, codigo: 'PLA', nombre: 'Ácido Poliláctico', tecnologias: [{ id: 1, codigo: 'FDM', nombre: 'Filamento' }] },
          { id: 2, codigo: 'ABS', nombre: 'Acrilonitrilo Butadieno Estireno', tecnologias: [{ id: 1, codigo: 'FDM', nombre: 'Filamento' }] },
          { id: 3, codigo: 'PET', nombre: 'Polietileno Tereftalato', tecnologias: [{ id: 1, codigo: 'FDM', nombre: 'Filamento' }] },
          { id: 4, codigo: 'RES', nombre: 'Resina', tecnologias: [{ id: 2, codigo: 'SLA', nombre: 'Resina' }] }
        ];
        this.productosExistentes = data.productos || [];
        this.filtrarMateriales();
        this.actualizarPreviewCodigo();
        this.cdr.detectChanges();
      }
    });
  }

  filtrarMateriales() {
    const tec = (this.form.get('tecnologia')?.value || '').toUpperCase();
    this.materialesFiltrados = this.materiales.filter(m => {
      const codes = (m.tecnologias || []).map(t => (t.codigo || '').toUpperCase());
      return !tec || codes.length === 0 || codes.includes(tec);
    });
    const actual = this.form.get('material')?.value;
    if (actual && !this.materialesFiltrados.some(m => m.codigo === actual)) {
      this.form.get('material')?.setValue('');
    }
  }

  familiaSeleccionada(): Family | undefined {
    const id = Number(this.form.get('familiaId')?.value);
    return this.familias.find(f => Number(f.id) === id);
  }

  subfamiliasDeFamilia(): Subfamily[] {
    const fam = this.familiaSeleccionada();
    return (fam?.subFamilias || []).filter(s => !!s && !!s.codigo);
  }

  tieneSubfamilias(): boolean {
    return this.subfamiliasDeFamilia().length > 0;
  }

  esFamiliaLudico(): boolean {
    return (this.familiaSeleccionada()?.codigo || '').toUpperCase() === 'LUD';
  }

  actualizarPreviewCodigo() {
    const familia = this.familiaSeleccionada();
    const famCod = (familia?.codigo || '').toUpperCase().trim();
    const famId = familia?.id ? Number(familia.id) : null;

    const correlativosUsados = extractCorrelativosUsadosDeFamilia(
      this.productosExistentes,
      famId,
      famCod,
      this.id
    );

    const preview = previsualizarCodigo({
      nombre: this.form.get('nombre')?.value,
      clasificacion: this.form.get('clasificacion')?.value,
      tecnologia: this.form.get('tecnologia')?.value,
      material: this.form.get('material')?.value,
      familiaCodigo: familia?.codigo,
      serie: this.form.get('serie')?.value,
      correlativosUsados: correlativosUsados
    });

    this.previewSku = preview.sku;
    this.previewCatalogo = preview.codigoCatalogo;
    this.previewCorrelativo = preview.correlativo;
    this.form.get('sku')?.setValue(preview.sku, { emitEvent: false });
    this.form.get('codigoCatalogo')?.setValue(preview.codigoCatalogo, { emitEvent: false });
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
          this.allAssets = assets;
          this.maquinasList = assets.filter((a: Asset) => {
            const t = (a.tipo || '').toLowerCase().trim();
            return t === 'fijo' && esEquiposFabricacion(a.categoria, a.subCategoria);
          });

          this.assetsMobiliario = assets.filter((a: Asset) => 
            (a.categoria || '').toLowerCase().trim() === 'mobiliario'
          );

          this.activosCirculantes = assets.filter((a: Asset) => {
            const t = (a.tipo || '').toLowerCase().trim();
            const c = (a.categoria || '').toLowerCase().trim();
            return t === 'circulante' && (c === 'producción' || c === 'produccion');
          });

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
          this.aplicarFiltroTecnologiaPieza();

          this.actualizarNombresPiezas();
          this.cdr.detectChanges();
        }
      }
    });
  }

  actualizarNombresPiezas() {
    if (!this.piezasPendientes || this.piezasPendientes.length === 0) return;
    this.piezasPendientes = mapDbPiezasToView(
      this.piezasPendientes,
      this.maquinasList,
      this.activosMateriales,
      this.activosCirculantes,
      this.allAssets
    );
  }

  getNombreMaquina(p: Record<string, unknown> | PiezaProducto | unknown): string {
    return resolverNombreMaquina(p as Record<string, unknown>, this.maquinasList, this.allAssets);
  }

  getNombreMaterial(p: Record<string, unknown> | PiezaProducto | unknown): string {
    return resolverNombreMaterial(p as Record<string, unknown>, this.activosMateriales, this.activosCirculantes, this.allAssets);
  }

  onPiezaCategoriaChange(categoria: string) {
    if (categoria) {
      this.materialesPorCategoria = filtrarMaterialesPorCategoria(this.activosMateriales, categoria);
      this.subcategoriasMaterial = [...new Set(
        this.materialesPorCategoria.map(a => a.subCategoria || ((a as unknown as Record<string, string>)['subcategoria'])).filter((s): s is string => !!s)
      )].sort();
      this.materialesFiltradosCirculantes = [...this.materialesPorCategoria];
    } else {
      this.materialesPorCategoria = [];
      this.subcategoriasMaterial = [];
      this.materialesFiltradosCirculantes = [...this.activosMateriales];
    }
    const subActual = this.form.get('piezaMaterialSubcategoria')?.value;
    if (subActual && !this.subcategoriasMaterial.includes(subActual)) {
      this.form.get('piezaMaterialSubcategoria')?.setValue('');
    }
    const matActual = this.form.get('piezaMaterialId')?.value;
    if (matActual && !this.materialesFiltradosCirculantes.some(m => m.id == matActual)) {
      this.form.get('piezaMaterialId')?.setValue(null);
    }
  }

  aplicarFiltroTecnologiaPieza() {
    const tec = (this.form.get('piezaTecnologia')?.value || '').toUpperCase().trim();
    const maqCtrl = this.form.get('activoId');
    if (tec) {
      maqCtrl?.enable({ emitEvent: false });
    } else {
      maqCtrl?.disable({ emitEvent: false });
    }

    this.maquinasFiltradas = filtrarMaquinasPorTecnologia(this.maquinasList, tec);
    this.categoriasMaterial = obtenerCategoriasMaterialPorTecnologia(this.activosMateriales, tec);

    if (tec === 'FDM') {
      const curCat = (this.form.get('piezaMaterialCategoria')?.value || '').toLowerCase();
      if (!curCat || curCat.includes('resina')) {
        this.form.get('piezaMaterialCategoria')?.setValue('Filamento', { emitEvent: false });
      }
    } else if (tec === 'SLA') {
      const curCat = (this.form.get('piezaMaterialCategoria')?.value || '').toLowerCase();
      if (!curCat || curCat.includes('filam')) {
        this.form.get('piezaMaterialCategoria')?.setValue('Resina', { emitEvent: false });
      }
    }

    const catActual = this.form.get('piezaMaterialCategoria')?.value;
    if (catActual) {
      this.onPiezaCategoriaChange(catActual);
    } else {
      const materialesBase = this.materialesPorCategoria.length > 0
        ? this.materialesPorCategoria
        : this.activosMateriales;
      this.materialesFiltradosCirculantes = tec
        ? materialesBase.filter(m => materialCompatibleConTecnologia(m, tec))
        : [...materialesBase];
    }

    const maqActual = this.form.get('activoId')?.value;
    if (maqActual && !this.maquinasFiltradas.some(m => m.id == maqActual)) {
      this.form.get('activoId')?.setValue(null);
    }
    const matActual = this.form.get('piezaMaterialId')?.value;
    if (matActual && !this.materialesFiltradosCirculantes.some(m => m.id == matActual)) {
      this.form.get('piezaMaterialId')?.setValue(null);
    }
  }

  onPiezaSubcategoriaChange(subcategoria: string) {
    if (subcategoria) {
      this.materialesFiltradosCirculantes = this.materialesPorCategoria.filter(a => 
        (a.subCategoria || ((a as unknown as Record<string, string>)['subcategoria'])) === subcategoria
      );
    } else {
      this.materialesFiltradosCirculantes = this.materialesPorCategoria.length > 0 ? [...this.materialesPorCategoria] : [...this.activosMateriales];
    }
    const matActual = this.form.get('piezaMaterialId')?.value;
    if (matActual && !this.materialesFiltradosCirculantes.some(m => m.id == matActual)) {
      this.form.get('piezaMaterialId')?.setValue(null);
    }
  }

  onPiezaMaterialChange(materialId: number) {
    if (materialId) {
      const asset = this.activosMateriales.find(a => a.id == materialId) || this.activosCirculantes.find(a => a.id == materialId);
      if (asset) {
        const rounded = calcularPrecioPorGramo(asset);
        this.form.get('piezaPrecioMaterial')?.setValue(rounded);
        return;
      }
    }
    this.form.get('piezaPrecioMaterial')?.setValue('');
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
      const piezaTec = this.form.get('piezaTecnologia')?.value;
      if (!piezaTec) {
        Swal.fire('Atención', 'Seleccione el tipo de tecnología de la pieza.', 'warning');
        return;
      }
      nombre = this.form.get('piezaFabricada')?.value;
      gramos = Number(this.form.get('piezaGramos')?.value) || 0;
      horas = Number(this.form.get('piezaHoras')?.value);
      minutos = Number(this.form.get('piezaMinutos')?.value);
      
      const maqVal = this.form.get('activoId')?.value;
      if (maqVal) {
        maquinaId = Number(maqVal);
        maquinaNombre = this.maquinasFiltradas.find(m => m.id == maqVal)?.nombre
          || this.maquinasList.find(m => m.id == maqVal)?.nombre;
      }

      const matId = this.form.get('piezaMaterialId')?.value;
      if (!matId) {
        Swal.fire('Atención', 'Seleccione un material para la pieza fabricada.', 'warning');
        return;
      }
      assetId = Number(matId);
      precioMaterial = Number(this.form.get('piezaPrecioMaterial')?.value) || 0;
      
      const assetCirc = this.activosMateriales.find(a => a.id == matId)
        || this.activosCirculantes.find(a => a.id == matId);
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
      tipo, nombre, cantidad, assetId, gramos, horas, minutos, precioMaterial, materialDisplayName, maquinaId, maquinaNombre,
      tecnologia: tipo === 'Fabricada' ? this.form.get('piezaTecnologia')?.value : ''
    });
    this.piezasPendientes = [...this.piezasPendientes];

    this.form.patchValue({
      piezaInventario: '',
      piezaFabricada: '',
      piezaTecnologia: this.form.get('tecnologia')?.value || '',
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
      sku: [{ value: '', disabled: true }],
      codigoCatalogo: [{ value: '', disabled: true }],
      tecnologia: ['', Validators.required],
      material: ['', Validators.required],
      familiaId: [null as number | null, Validators.required],
      serie: [''],
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
      tiempoSetup: [''],
      postProcesado: [0],
      tasaFallo: [0],
      margenGanancia: [0, [Validators.min(this.minMargenGanancia), Validators.max(100)]],
      piezaTipo: ['Del Inventario'],
      piezaInventario: [''],
      piezaFabricada: [''],
      piezaTecnologia: [''],
      piezaCantidad: [1],
      piezaGramos: [''],
      piezaHoras: [''],
      piezaMinutos: [''],
      piezaMaterialCategoria: [''],
      piezaMaterialSubcategoria: [''],
      piezaMaterialId: [{value: null, disabled: false}],
      piezaPrecioMaterial: [''],
      activoId: [null],
      imagen: ['']
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

    this.form.get('piezaTecnologia')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.aplicarFiltroTecnologiaPieza());

    this.form.get('piezaTipo')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(tipo => {
      if (tipo === 'Fabricada' && !this.form.get('piezaTecnologia')?.value) {
        this.form.get('piezaTecnologia')?.setValue(this.form.get('tecnologia')?.value || '');
      }
    });

    this.form.get('perfil')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.actualizarMinMargenGanancia());

    ['nombre', 'clasificacion', 'tecnologia', 'material', 'familiaId', 'serie'].forEach(campo => {
      this.form.get(campo)?.valueChanges.pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe(() => {
        if (campo === 'tecnologia') {
          this.filtrarMateriales();
        }
        if (campo === 'familiaId') {
          const subs = this.subfamiliasDeFamilia();
          const currentVal = this.form.get('serie')?.value;
          const existe = subs.some(s => s.codigo === currentVal);
          if (!existe) {
            this.form.get('serie')?.setValue('', { emitEvent: false });
          }
        }
        this.actualizarPreviewCodigo();
      });
    });
  }

  onImageSelected(event: { base64?: string; [key: string]: unknown }) {
    this.imagenSrc = event.base64 || null;
    this.form.get('imagen')?.setValue(event.base64 || null);
    this.form.markAsDirty();
  }

  onImageRemoved() {
    this.imagenSrc = null;
    this.form.get('imagen')?.setValue(null);
    this.form.markAsDirty();
  }

  formatAssetOption(asset: Asset | unknown): string {
    return formatAssetOption(asset, this.allAssets);
  }

  back() {
    this.router.navigate(['/products']);
  }

  setValues() {
    const data: Product | undefined = history?.state?.edit_product;
    if (data && data.id && data.id > 0) {
      this.imagenSrc = data.imagen || ((data as unknown as Record<string, unknown>)['imagen'] as string) || null;
      this.form.get('imagen')?.setValue(this.imagenSrc);

      this.form.get('nombre')?.setValue(data.nombre);
      this.form.get('medida')?.setValue(data.medida);
      this.form.get('sku')?.setValue(data.sku);
      this.form.get('codigoCatalogo')?.setValue(data.codigoCatalogo || '');
      this.form.get('tecnologia')?.setValue(data.tecnologia || '');
      this.form.get('material')?.setValue(data.material || '');
      this.form.get('serie')?.setValue(data.serie || '');
      const familiaId = data.familiaId || (typeof data.familia === 'object' ? data.familia?.id : null);
      this.form.get('familiaId')?.setValue(familiaId || null);
      this.form.get('clasificacion')?.setValue(data.clasificacion);
      this.form.get('descripcion')?.setValue(data.descripcion);
      
      const perfilId = typeof data.perfil === 'object' ? (data.perfil as { id?: number })?.id : Number(data.perfil);
      this.form.get('perfil')?.setValue(perfilId || null);
      
      const dRec = data as unknown as Record<string, unknown>;
      const prepVal = data.tiempoSetup ?? dRec['tiempoSetup'] ?? '';
      const postVal = data.postProcesado ?? 0;
      const tasaVal = data.tasaFallo ?? 0;
      const rawMargen = Number(data.margenGanancia ?? dRec['margenGanancia'] ?? dRec['margen_ganancia'] ?? 0);
      const margenVal = rawMargen > 0 ? rawMargen : (this.minMargenGanancia || 20);

      this.form.get('tiempoSetup')?.setValue(prepVal);
      this.form.get('postProcesado')?.setValue(postVal);
      this.form.get('tasaFallo')?.setValue(tasaVal);
      this.form.get('margenGanancia')?.setValue(margenVal);
      
      const rawPiezas = dRec['piezasProducto'] ?? dRec['piezas_producto'] ?? dRec['piezas'] ?? data.piezasProducto ?? [];
      this.piezasPendientes = mapDbPiezasToView(
        Array.isArray(rawPiezas) ? rawPiezas : [],
        this.maquinasList,
        this.activosMateriales,
        this.activosCirculantes,
        this.allAssets
      );
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

    const tipoPieza = this.form.get('piezaTipo')?.value;
    if (tipoPieza === 'Del Inventario' && this.form.get('piezaInventario')?.value) {
      this.agregarPieza();
    } else if (tipoPieza === 'Fabricada' && (this.form.get('piezaFabricada')?.value || this.form.get('piezaGramos')?.value)) {
      this.agregarPieza();
    }

    if (this.form.invalid) {
      const invalidFields: string[] = [];
      if (this.form.get('nombre')?.invalid) invalidFields.push('Nombre del producto');
      if (this.form.get('clasificacion')?.invalid) invalidFields.push('Tipo');
      if (this.form.get('tecnologia')?.invalid) invalidFields.push('Tecnología');
      if (this.form.get('material')?.invalid) invalidFields.push('Material');
      if (this.form.get('familiaId')?.invalid) invalidFields.push('Familia');
      if (this.form.get('descripcion')?.invalid) invalidFields.push('Descripción');
      if (this.form.get('margenGanancia')?.invalid) invalidFields.push(`Margen de Ganancia (mínimo ${this.minMargenGanancia}%)`);

      if (this.form.get('nombre')?.invalid || this.form.get('clasificacion')?.invalid || this.form.get('descripcion')?.invalid || this.form.get('tecnologia')?.invalid || this.form.get('material')?.invalid || this.form.get('familiaId')?.invalid) {
        this.activeTab = 'def';
      } else if (this.form.get('margenGanancia')?.invalid) {
        this.activeTab = 'piezas';
      }

      const mensaje = invalidFields.length > 0
        ? `Por favor revise los siguientes campos obligatorios: ${invalidFields.join(', ')}.`
        : 'Por favor complete todos los datos obligatorios del producto.';

      Swal.fire('Formulario Incompleto', mensaje, 'warning');
      return;
    }

    this.loading = true;

    const mappedPiezas = mapPiezasToPayload(
      this.piezasPendientes,
      this.assetsMobiliario,
      this.activosCirculantes
    );

    const prepNum = Number(this.form.get('tiempoSetup')?.value) || 0;
    const postNum = Number(this.form.get('postProcesado')?.value) || 0;
    const tasaNum = Number(this.form.get('tasaFallo')?.value) || 0;
    const margenNum = Number(this.form.get('margenGanancia')?.value) || 0;

    const rawCorr = this.previewCorrelativo || (this.previewSku ? this.previewSku.split('-').pop() : '') || '001';
    const corrSoloNum = String(rawCorr).replace(/\D+/g, '') || '001';

    const productPayload: Record<string, unknown> = {
      nombre: this.form.get('nombre')?.value,
      sku: this.previewSku || this.form.get('sku')?.value,
      codigoCatalogo: this.previewCatalogo,
      tecnologia: this.form.get('tecnologia')?.value,
      material: this.form.get('material')?.value,
      familiaId: Number(this.form.get('familiaId')?.value) || null,
      serie: this.form.get('serie')?.value || '',
      correlativo: corrSoloNum,
      descripcion: this.form.get('descripcion')?.value,
      clasificacion: this.form.get('clasificacion')?.value,
      medida: this.form.get('medida')?.value,
      perfil: Number(this.form.get('perfil')?.value) || 0,
      tasaFallo: tasaNum,
      tiempoSetup: prepNum,
      postProcesado: postNum,
      margenGanancia: margenNum,
      piezasProducto: mappedPiezas,
      imagen: this.form.get('imagen')?.value || this.imagenSrc || undefined
    };

    if (this.id > 0) {
      productPayload['id'] = this.id;
    }
    if (this.form.get('periodo')?.value) {
      productPayload['periodo'] = this.form.get('periodo')?.value;
    }

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
        if (err?.status === 401 || err?.status === 403 || err?.status === 0) {
          return;
        }
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
