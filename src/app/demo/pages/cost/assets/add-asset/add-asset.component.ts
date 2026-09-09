import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators, ValidatorFn } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { Asset } from '../../../../../core/models/Cost/asset';
import { AssetService } from '../../../../../core/services/cost/asset.service';
import { CATALOGO_MATERIALES } from '../../../../../core/constants/material-catalog';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-add-asset',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, NgSelectModule],
  templateUrl: './add-asset.component.html'
})
export class AddAssetComponent implements OnInit {
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private assetService = inject(AssetService);
  private destroyRef = inject(DestroyRef);
  form!: FormGroup;
  id: number = 0;
  loading = false;
  submitted = false;

  allFijoSubcategoriasMap = new Map<string, Set<string>>();
  allCirculanteSubcategoriasMap = new Map<string, Set<string>>();

  categoriasFijoList: string[] = [];
  subcategoriasFijoList: string[] = [];

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
    this.setupLogicCalcularTotal();
    this.cargarListasSugerencias();
  }

  cargarListasSugerencias() {
    this.assetService.getAssets().subscribe({
      next: (assets) => {
        const catFijoMap = new Map<string, string>();
        const subFijoMap = new Map<string, string>();
        const catCircMap = new Map<string, string>();
        const subCircMap = new Map<string, string>();

        this.allFijoSubcategoriasMap.clear();
        this.allCirculanteSubcategoriasMap.clear();

        assets.forEach(a => {
          const rawRec = a as unknown as Record<string, unknown>;
          const tipo = String(a.tipo || rawRec['tipo'] || '').toLowerCase().trim();
          const cat = this.formatTitleCase(String(a.categoria || rawRec['Categoria'] || '').trim());
          const sub = this.formatTitleCase(String(a.subCategoria || rawRec['subcategoria'] || rawRec['Subcategoria'] || rawRec['sub_categoria'] || '').trim());

          if (tipo === 'fijo' || (!tipo && a.vidaUtil && a.vidaUtil > 0)) {
            if (cat) {
              catFijoMap.set(cat.toLowerCase(), cat);
              if (!this.allFijoSubcategoriasMap.has(cat.toLowerCase())) {
                this.allFijoSubcategoriasMap.set(cat.toLowerCase(), new Set<string>());
              }
              if (sub) {
                this.allFijoSubcategoriasMap.get(cat.toLowerCase())!.add(sub);
              }
            }
            if (sub) subFijoMap.set(sub.toLowerCase(), sub);
          } else if (tipo === 'circulante' || (!tipo && (!a.vidaUtil || a.vidaUtil === 0))) {
            if (cat) {
              catCircMap.set(cat.toLowerCase(), cat);
              if (!this.allCirculanteSubcategoriasMap.has(cat.toLowerCase())) {
                this.allCirculanteSubcategoriasMap.set(cat.toLowerCase(), new Set<string>());
              }
              if (sub) {
                this.allCirculanteSubcategoriasMap.get(cat.toLowerCase())!.add(sub);
              }
            }
            if (sub) subCircMap.set(sub.toLowerCase(), sub);
          }
        });

        this.categoriasFijoList = Array.from(catFijoMap.values()).sort();
        this.categoriasCirculanteList = Array.from(catCircMap.values()).sort();

        // Filtrar subcategorías según la categoría seleccionada actualmente
        const catActual = this.form.get('categoria')?.value;
        const tipoActual = this.form.get('tipo')?.value;
        if (tipoActual === 'Fijo') {
          this.filtrarSubcategoriasFijo(catActual);
        } else if (tipoActual === 'Circulante') {
          this.filtrarSubcategoriasCirculante(catActual);
        }
      }
    });
  }

  filtrarSubcategoriasFijo(categoria?: string) {
    if (!categoria) {
      this.subcategoriasFijoList = [];
      return;
    }
    const catClean = categoria.toLowerCase().trim();
    const setSub = this.allFijoSubcategoriasMap.get(catClean);
    if (setSub && setSub.size > 0) {
      this.subcategoriasFijoList = Array.from(setSub)
        .filter(s => s.toLowerCase().trim() !== catClean && s.toLowerCase().trim() !== catClean + 's')
        .sort();
      return;
    }
    this.subcategoriasFijoList = [];
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
    const formatted = this.formatTitleCase(term);
    if (formatted && !this.categoriasFijoList.some(c => c.toLowerCase() === formatted.toLowerCase())) {
      this.categoriasFijoList = [...this.categoriasFijoList, formatted].sort();
    }
    return formatted;
  };

  agregarSubcategoriaFijo = (term: string): string => {
    const formatted = this.formatTitleCase(term);
    if (formatted && !this.subcategoriasFijoList.some(c => c.toLowerCase() === formatted.toLowerCase())) {
      this.subcategoriasFijoList = [...this.subcategoriasFijoList, formatted].sort();
      const catActual = this.form.get('categoria')?.value;
      if (catActual) {
        if (!this.allFijoSubcategoriasMap.has(catActual.toLowerCase())) {
          this.allFijoSubcategoriasMap.set(catActual.toLowerCase(), new Set<string>());
        }
        this.allFijoSubcategoriasMap.get(catActual.toLowerCase())!.add(formatted);
      }
    }
    return formatted;
  };

  agregarCategoriaCirculante = (term: string): string => {
    const formatted = this.formatTitleCase(term);
    if (formatted && !this.categoriasCirculanteList.some(c => c.toLowerCase() === formatted.toLowerCase())) {
      this.categoriasCirculanteList = [...this.categoriasCirculanteList, formatted].sort();
    }
    return formatted;
  };

  agregarSubcategoriaCirculante = (term: string): string => {
    const formatted = this.formatTitleCase(term);
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
    if (!text) return '';
    const clean = text.trim().replace(/\s+/g, ' ');
    return clean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  back() {
    this.router.navigate(['/assets']);
  }

  setValues() {
    // Recuperar datos desde el historial de navegación (Router State)
    const data: Asset | undefined = history.state.edit_asset;
    
    if (data && data.id && data.id > 0) {
        let dateVal = '';
        if (data.fechaCompra) {
          const rawDate = new Date(data.fechaCompra);
          if (!isNaN(rawDate.getTime())) {
            dateVal = rawDate.toISOString().substring(0, 10);
          }
        }

        // Limpiar tipo y categoría para que coincidan con los selectores estrictos
        const rawTipo = (data.tipo || '').toString().trim();
        const tipoLimpio = rawTipo ? (rawTipo.charAt(0).toUpperCase() + rawTipo.slice(1).toLowerCase()) : 'Fijo';
        
        const rawCat = (data.categoria || '').toString().trim();
        const catLimpia = rawCat;

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
          subcategoria: data.subCategoria || ((data as unknown as Record<string, unknown>)['subcategoria'] as string) || ((data as unknown as Record<string, unknown>)['Subcategoria'] as string) || '',
          consumoMaquina: data.consumoMaquina,
          tarifa: data.tarifa,
          costoMantenimiento: data.costoMantenimiento
        });

        this.actualizarSubcategoriasMaterial(catLimpia);
        this.id = data.id;
        this.actualizarValidaciones(tipoLimpio);
      }
  }

  isSwitchingType = false;

  actualizarSubcategoriasMaterial(categoria: string) {
    if (!categoria) {
      this.subcategoriasMaterialList = [];
      return;
    }
    const catKey = Object.keys(CATALOGO_MATERIALES).find(k => k.toLowerCase() === categoria.toLowerCase().trim());
    if (catKey) {
      this.subcategoriasMaterialList = CATALOGO_MATERIALES[catKey];
    } else {
      this.subcategoriasMaterialList = [];
    }
  }

  myFormValues() {
    this.form = this.formBuilder.group({
      nombre: ['', Validators.required],
      costoInicial: [{ value: '', disabled: false }, Validators.required],
      tipo: ['Fijo', Validators.required],
      categoria: [''],
      subcategoria: [''],
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
        this.form.get('categoria')?.setValue('Filamento');
      }
      const cat = this.form.get('categoria')?.value;
      if (tipo === 'Fijo') {
        this.filtrarSubcategoriasFijo(cat);
      } else if (tipo === 'Circulante') {
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
      } else if (tipo === 'Fijo') {
        this.filtrarSubcategoriasFijo(cat);
      } else if (tipo === 'Circulante') {
        this.filtrarSubcategoriasCirculante(cat);
      }
      this.actualizarValidaciones(tipo);
    });
  }

  get isEquipoCategory(): boolean {
    const cat = String(this.form?.get('categoria')?.value || '').toLowerCase().trim();
    return cat === 'equipo' || cat.includes('equipo') || cat.includes('máquina') || cat.includes('maquina') || cat.includes('cnc') || cat.includes('impresora') || cat.includes('herramienta');
  }

  private actualizarValidaciones(tipo: string) {
    const camposFijos = ['valorResidual', 'vidaUtil', 'fechaCompra', 'cantidad'];
    const camposCirculantes = ['cantidad', 'costoInicial'];
    const camposEquipo = ['consumoMaquina', 'tarifa', 'costoMantenimiento'];

    // Asegurarnos de que ubicación nunca sea requerida
    this.setValidators(['ubicacion'], []);

    if (tipo === 'Fijo') {
      this.setValidators(camposFijos, [Validators.required]);

      if (this.isEquipoCategory) {
        this.setValidators(camposEquipo, []);
      } else {
        this.setValidators(camposEquipo, []);
      }
    } else {
      this.setValidators(camposFijos, []);
      this.setValidators(camposCirculantes, [Validators.required]);
      this.setValidators(camposEquipo, []);
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

  private originalCostoInicial: number | null = null;

  setupLogicCalcularTotal() {
    // Inicializar bolsillo con el valor actual si es Fijo
    if (this.form.get('tipo')?.value === 'Fijo') {
      this.originalCostoInicial = this.form.get('costoInicial')?.value;
    }

    const calcular = () => {
    };

    this.form.get('cantidad')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(calcular);

    this.form.get('valorUnitario')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(calcular);
    
    // El bolsillo siempre guarda lo último que se escribió manualmente en Fijo, ignorando falsos positivos
    this.form.get('costoInicial')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(val => {
      if (this.form.get('tipo')?.value === 'Fijo' && !this.isSwitchingType) {
        this.originalCostoInicial = val;
      }
    });
    
    this.form.get('tipo')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((tipo) => {
      if (tipo === 'Circulante') {
        calcular();
      } else if (tipo === 'Fijo') {
        // Devolver el valor del bolsillo a la vista
        if (this.originalCostoInicial !== null && this.originalCostoInicial !== undefined) {
          this.form.get('costoInicial')?.setValue(this.originalCostoInicial, { emitEvent: false });
        }
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

    const cleanCat = this.formatTitleCase(formValues.categoria);
    const cleanSub = this.formatTitleCase(formValues.subcategoria);

    const activo: Asset = {
      id: this.id > 0 ? this.id : 0,
      nombre: formValues.nombre,
      tipo: formValues.tipo,
      costoInicial: Number(formValues.costoInicial) || 0,
      categoria: cleanCat,
      subCategoria: cleanSub,
      
      valorResidual: formValues.tipo === 'Fijo' ? (Number(formValues.valorResidual) || 0) : 0,
      vidaUtil: formValues.tipo === 'Fijo' ? (Number(formValues.vidaUtil) || 0) : 0,
      fechaCompra: formValues.tipo === 'Fijo' ? new Date(formValues.fechaCompra) : new Date(),

      consumoMaquina: (formValues.tipo === 'Fijo' && formValues.categoria === 'Equipo') ? (Number(formValues.consumoMaquina) || 0) : 0,
      tarifa: (formValues.tipo === 'Fijo' && formValues.categoria === 'Equipo') ? (Number(formValues.tarifa) || 0) : 0,
      costoMantenimiento: (formValues.tipo === 'Fijo' && formValues.categoria === 'Equipo') ? (Number(formValues.costoMantenimiento) || 0) : 0,

      cantidad: Number(formValues.cantidad) || 1,
      valorUnitario: formValues.tipo === 'Circulante' ? (Number(formValues.costoInicial) || Number(formValues.valorUnitario) || 0) : 0,
      unidadMedida: formValues.tipo === 'Circulante' ? formValues.unidadMedida : '',
      presentacion: formValues.tipo === 'Circulante' ? formValues.presentacion : '',
      descripcion: formValues.tipo === 'Circulante' ? formValues.descripcion : '',
      ubicacion: formValues.tipo === 'Circulante' ? formValues.ubicacion : ''
    };

    const request = this.id === 0 
      ? this.assetService.createAsset(activo)
      : this.assetService.updateAsset(this.id, activo);

    request.subscribe({
      next: () => {
        this.loading = false;
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
      error: () => {
        this.loading = false;
        Swal.fire('Error', 'Ha ocurrido un error al guardar el activo.', 'error');
      }
    });
  }
}
