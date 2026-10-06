import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators, ValidatorFn } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { Asset } from '../../../../../core/models/Cost/asset';
import { AssetService } from '../../../../../core/services/cost/asset.service';
import { CatalogConfigService } from '../../../../../core/services/cost/catalog-config.service';
import { CatalogoSimple, MaterialCatalogo, TecnologiaCatalogo } from '../../../../../core/models/Cost/catalog-config';
import { CATALOGO_MATERIALES } from '../../../../../core/constants/material-catalog';
import {
  CATEGORIAS_ACTIVO_FIJO,
  mapearCategoriaFijo,
  esEquiposFabricacion
} from '../../../../../core/constants/asset-categories';
import {
  formatTitleCase,
  extractAssetSuggestions,
  getSubcategoriasMaterial,
  buildAssetPayload
} from '../../../../../core/utils/asset-form.helper';
import { listarPolimeros } from '../../../../../core/utils/piece-builder.helper';
import { ComponentCanDeactivate } from '../../../../../core/guards/pending-changes.guard';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-add-asset',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, NgSelectModule],
  templateUrl: './add-asset.component.html'
})
export class AddAssetComponent implements OnInit, ComponentCanDeactivate {
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private assetService = inject(AssetService);
  private catalogConfigService = inject(CatalogConfigService);
  private destroyRef = inject(DestroyRef);

  form!: FormGroup;
  id = 0;
  loading = false;
  submitted = false;
  isSwitchingType = false;

  allCirculanteSubcategoriasMap = new Map<string, Set<string>>();
  categoriasFijoList: string[] = [...CATEGORIAS_ACTIVO_FIJO];
  tecnologias: TecnologiaCatalogo[] = [];
  materialesCatalogo: MaterialCatalogo[] = [];
  marcas: CatalogoSimple[] = [];
  colores: CatalogoSimple[] = [];
  categoriasCirculanteList: string[] = [];
  subcategoriasCirculanteList: string[] = [];
  categoriasMaterialList: string[] = Object.keys(CATALOGO_MATERIALES);
  subcategoriasMaterialList: string[] = [];

  constructor() {
    this.myFormValues();
  }

  get f() { return this.form.controls; }

  ngOnInit() {
    this.setValues();
    this.cargarListasSugerencias();
    this.catalogConfigService.getTecnologias().subscribe({
      next: (data) => {
        this.tecnologias = data?.length ? data : [
          { id: 1, codigo: 'FDM', nombre: 'Filamento' },
          { id: 2, codigo: 'SLA', nombre: 'Resina' }
        ];
        this.categoriasMaterialList = this.tecnologias.map(t => t.codigo);
      },
      error: () => {
        this.tecnologias = [
          { id: 1, codigo: 'FDM', nombre: 'Filamento' },
          { id: 2, codigo: 'SLA', nombre: 'Resina' }
        ];
        this.categoriasMaterialList = this.tecnologias.map(t => t.codigo);
      }
    });
    this.catalogConfigService.getMateriales().subscribe({
      next: (data) => {
        this.materialesCatalogo = data || [];
        this.actualizarSubcategoriasMaterial(this.form?.get('categoria')?.value);
      }
    });
    this.catalogConfigService.getMarcas().subscribe({
      next: (data) => { this.marcas = data || []; }
    });
    this.catalogConfigService.getColores().subscribe({
      next: (data) => { this.colores = data || []; }
    });
  }

  cargarListasSugerencias() {
    this.assetService.getAssets().subscribe({
      next: (assets) => {
        const sugerencias = extractAssetSuggestions(assets || []);
        this.allCirculanteSubcategoriasMap = sugerencias.subcategoriasMap;
        this.categoriasFijoList = sugerencias.categoriasFijo;
        this.categoriasCirculanteList = sugerencias.categoriasCirculante;

        const tipoActual = this.form.get('tipo')?.value;
        const catActual = this.form.get('categoria')?.value;
        if (tipoActual === 'Circulante') {
          this.filtrarSubcategoriasCirculante(catActual);
        }
      }
    });
  }

  filtrarSubcategoriasCirculante(categoria?: string) {
    if (!categoria) {
      this.subcategoriasCirculanteList = [];
      return;
    }
    const catClean = categoria.toLowerCase().trim();
    const setSub = this.allCirculanteSubcategoriasMap.get(catClean);
    if (setSub && setSub.size > 0) {
      this.subcategoriasCirculanteList = Array.from(setSub)
        .filter(s => s.toLowerCase().trim() !== catClean && s.toLowerCase().trim() !== catClean + 's')
        .sort();
      return;
    }
    this.subcategoriasCirculanteList = [];
  }

  agregarCategoriaFijo = (term: string): string => {
    const formatted = formatTitleCase(term);
    if (formatted && !this.categoriasFijoList.some(c => c.toLowerCase() === formatted.toLowerCase())) {
      this.categoriasFijoList = [...this.categoriasFijoList, formatted].sort();
    }
    return formatted;
  };

  agregarCategoriaCirculante = (term: string): string => {
    const formatted = formatTitleCase(term);
    if (formatted && !this.categoriasCirculanteList.some(c => c.toLowerCase() === formatted.toLowerCase())) {
      this.categoriasCirculanteList = [...this.categoriasCirculanteList, formatted].sort();
    }
    return formatted;
  };

  agregarSubcategoriaCirculante = (term: string): string => {
    const formatted = formatTitleCase(term);
    if (formatted && !this.subcategoriasCirculanteList.some(c => c.toLowerCase() === formatted.toLowerCase())) {
      this.subcategoriasCirculanteList = [...this.subcategoriasCirculanteList, formatted].sort();
      const catActual = this.form.get('categoria')?.value;
      if (catActual) {
        if (!this.allCirculanteSubcategoriasMap.has(catActual.toLowerCase())) {
          this.allCirculanteSubcategoriasMap.set(catActual.toLowerCase(), new Set<string>());
        }
        this.allCirculanteSubcategoriasMap.get(catActual.toLowerCase())!.add(formatted);
      }
    }
    return formatted;
  };

  formatTitleCase(text: string): string {
    return formatTitleCase(text);
  }

  back() {
    this.router.navigate(['/assets']);
  }

  setValues() {
    const data: Asset | undefined = history.state.edit_asset;
    if (data && data.id && data.id > 0) {
      let dateVal = '';
      if (data.fechaCompra) {
        const rawDate = new Date(data.fechaCompra);
        if (!isNaN(rawDate.getTime())) {
          dateVal = rawDate.toISOString().substring(0, 10);
        }
      }

      const rawTipo = (data.tipo || '').toString().trim();
      const tipoLimpio = rawTipo ? (rawTipo.charAt(0).toUpperCase() + rawTipo.slice(1).toLowerCase()) : 'Fijo';
      
      const rawCat = (data.categoria || '').toString().trim();
      let catLimpia = tipoLimpio === 'Fijo'
        ? mapearCategoriaFijo(rawCat, data.subCategoria || '')
        : rawCat;
      if (tipoLimpio === 'Material') {
        const catLow = catLimpia.toLowerCase();
        if (catLow.includes('filam') || catLow === 'fdm') catLimpia = 'FDM';
        else if (catLow.includes('resin') || catLow === 'sla') catLimpia = 'SLA';
        else if (data.tecnologia) catLimpia = String(data.tecnologia).toUpperCase();
      }

      this.form.patchValue({
        nombre: data.nombre,
        costoInicial: data.costoInicial || data.valorUnitario || 0,
        valorResidual: data.valorResidual,
        vidaUtil: data.vidaUtil,
        fechaCompra: dateVal,
        tipo: tipoLimpio,
        cantidad: data.cantidad,
        unidadMedida: data.unidadMedida,
        presentacion: data.presentacion,
        descripcion: data.descripcion,
        ubicacion: data.ubicacion,
        valorUnitario: data.valorUnitario || data.costoInicial || 0,
        categoria: catLimpia,
        subcategoria: tipoLimpio === 'Fijo' ? '' : (data.subCategoria || ((data as unknown as Record<string, unknown>)['subcategoria'] as string) || ((data as unknown as Record<string, unknown>)['Subcategoria'] as string) || ''),
        tecnologia: data.tecnologia || (tipoLimpio === 'Material' ? catLimpia : ''),
        marca: data.marca || '',
        color: data.color || '',
        consumoMaquina: data.consumoMaquina,
        tarifa: data.tarifa,
        costoMantenimiento: data.costoMantenimiento
      });

      this.actualizarSubcategoriasMaterial(catLimpia);
      this.id = data.id;
      this.actualizarValidaciones(tipoLimpio);
    }
  }

  actualizarSubcategoriasMaterial(categoria: string) {
    const fromCatalog = listarPolimeros(this.materialesCatalogo, [], categoria);
    this.subcategoriasMaterialList = fromCatalog.length > 0 ? fromCatalog : getSubcategoriasMaterial(categoria);
  }

  myFormValues() {
    this.form = this.formBuilder.group({
      nombre: ['', Validators.required],
      costoInicial: [{ value: '', disabled: false }, Validators.required],
      tipo: ['Fijo', Validators.required],
      categoria: [''],
      subcategoria: [''],
      tecnologia: [''],
      marca: [''],
      color: [''],
      // Campos de Fijos
      valorResidual: [''],
      vidaUtil: [''],
      fechaCompra: [''],
      consumoMaquina: [''],
      tarifa: [''],
      costoMantenimiento: [''],
      // Campos de Circulantes / Comunes
      cantidad: [1, [Validators.required, Validators.min(1)]],
      unidadMedida: [''],
      presentacion: [''],
      descripcion: [''],
      ubicacion: [''],
      valorUnitario: ['']
    });

    this.form.get('tipo')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(tipo => {
      this.isSwitchingType = true;
      if (tipo === 'Material' && !this.form.get('categoria')?.value) {
        this.form.get('categoria')?.setValue('FDM');
      }
      const cat = this.form.get('categoria')?.value;
      if (tipo === 'Circulante') {
        this.filtrarSubcategoriasCirculante(cat);
      }
      this.actualizarValidaciones(tipo);
      this.isSwitchingType = false;
    });

    this.form.get('categoria')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((cat) => {
      const tipo = this.form.get('tipo')?.value;
      if (tipo === 'Material') {
        this.actualizarSubcategoriasMaterial(cat);
      } else if (tipo === 'Circulante') {
        this.filtrarSubcategoriasCirculante(cat);
      }
      if (tipo === 'Fijo' && !this.isFabricacionCategory) {
        this.form.get('tecnologia')?.setValue('', { emitEvent: false });
      }
      this.actualizarValidaciones(tipo);
    });
  }

  get isFabricacionCategory(): boolean {
    return esEquiposFabricacion(this.form?.get('categoria')?.value);
  }

  get isEquipoCategory(): boolean {
    return this.isFabricacionCategory;
  }

  private actualizarValidaciones(tipo: string) {
    const camposFijos = ['valorResidual', 'vidaUtil', 'fechaCompra', 'cantidad'];
    const camposCirculantes = ['cantidad', 'costoInicial'];
    const camposEquipo = ['consumoMaquina', 'tarifa', 'costoMantenimiento'];

    this.setValidators(['ubicacion'], []);

    if (tipo === 'Fijo') {
      this.setValidators(camposFijos, [Validators.required]);
      this.setValidators(['categoria'], [Validators.required]);
      this.setValidators(['subcategoria', 'marca', 'color'], []);
      if (this.isFabricacionCategory) {
        this.setValidators(['tecnologia'], [Validators.required]);
      } else {
        this.setValidators(['tecnologia'], []);
      }
    } else {
      this.setValidators(camposFijos, []);
      this.setValidators(camposCirculantes, [Validators.required]);
      this.setValidators(camposEquipo, []);
      this.setValidators(['tecnologia'], []);
      if (tipo === 'Material') {
        this.setValidators(['categoria', 'subcategoria'], [Validators.required]);
      } else {
        this.setValidators(['subcategoria'], []);
      }
    }
  }

  private setValidators(campos: string[], validators: ValidatorFn[]) {
    campos.forEach(nombre => {
      const control = this.form.get(nombre);
      if (control) {
        control.setValidators(validators);
        control.updateValueAndValidity();
      }
    });
  }

  onSubmit() {
    this.submitted = true;
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      Swal.fire('Error', 'Complete los datos obligatorios del activo.', 'error');
      return;
    }
    
    this.loading = true;
    const formValues = this.form.getRawValue();
    const activo = buildAssetPayload(formValues, this.id);

    const request = this.id === 0 
      ? this.assetService.createAsset(activo)
      : this.assetService.updateAsset(this.id, activo);

    request.subscribe({
      next: () => {
        this.loading = false;
        this.submitted = true;
        this.form?.markAsPristine();
        Swal.fire({
          title: '¡Guardado!',
          text: 'Activo guardado exitosamente.',
          icon: 'success',
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#4680ff'
        }).then(() => {
          this.router.navigate(['/assets']);
        });
      },
      error: (err) => {
        this.loading = false;
        if (err?.status === 401 || err?.status === 403 || err?.status === 0) {
          return;
        }
        Swal.fire('Error', err?.error?.msg || 'Ha ocurrido un error al guardar el activo.', 'error');
      }
    });
  }

  canDeactivate(): boolean {
    if (this.submitted && !this.loading) {
      return true;
    }
    return !this.form?.dirty;
  }
}
