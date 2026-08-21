import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators, ValidatorFn } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { Asset } from '../../../../../core/models/Cost/asset';
import { AssetService } from '../../../../../core/services/cost/asset.service';
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
  form!: FormGroup;
  id: number = 0;
  loading = false;
  submitted = false;

  constructor() {
    this.myFormValues();
  }
  get f() { return this.form.controls; }

  ngOnInit() {
    this.setValues();
    this.setupLogicCalcularTotal();
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
        const catLimpia = rawCat ? (rawCat.charAt(0).toUpperCase() + rawCat.slice(1).toLowerCase()) : 'Mobiliario';

        this.form.patchValue({
          nombre: data.nombre,
          costoInicial: data.costoInicial,
          valorResidual: data.valorResidual,
          vidaUtil: data.vidaUtil,
          fechaCompra: dateVal,
          tipo: tipoLimpio,
          cantidad: data.cantidad,
          unidadMedida: data.unidadMedida,
          presentacion: data.presentacion,
          descripcion: data.descripcion,
          ubicacion: data.ubicacion,
          valorUnitario: data.valorUnitario,
          categoria: catLimpia,
          subcategoria: data.subcategoria || ((data as unknown as Record<string, unknown>)['subCategoria'] as string) || ((data as unknown as Record<string, unknown>)['Subcategoria'] as string) || '',
          consumoMaquina: data.consumoMaquina,
          tarifa: data.tarifa,
          costoMantenimiento: data.costoMantenimiento
        });

        this.id = data.id;
        this.actualizarValidaciones(tipoLimpio);
      }
  }

  isSwitchingType = false;

  myFormValues() {
    this.form = this.formBuilder.group({
      nombre: ['', Validators.required],
      costoInicial: [{ value: '', disabled: false }, Validators.required],
      tipo: ['Fijo', Validators.required],
      categoria: ['Mobiliario', Validators.required],
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

    this.form.get('tipo')?.valueChanges.subscribe(tipo => {
      this.isSwitchingType = true;
      if (tipo === 'Circulante' && this.form.get('categoria')?.value === 'Mobiliario') {
        this.form.get('categoria')?.setValue('');
      } else if (tipo === 'Fijo' && !this.form.get('categoria')?.value) {
        this.form.get('categoria')?.setValue('Mobiliario');
      }
      this.actualizarValidaciones(tipo);
      this.isSwitchingType = false;
    });

    this.form.get('categoria')?.valueChanges.subscribe(() => {
      this.actualizarValidaciones(this.form.get('tipo')?.value);
    });
  }

  private actualizarValidaciones(tipo: string) {
    const camposFijos = ['valorResidual', 'vidaUtil', 'fechaCompra', 'cantidad'];
    const camposCirculantes = ['cantidad', 'valorUnitario', 'ubicacion'];
    const camposEquipo = ['consumoMaquina', 'tarifa', 'costoMantenimiento'];

    if (tipo === 'Fijo') {
      this.setValidators(camposFijos, [Validators.required]);
      this.setValidators(['valorUnitario', 'ubicacion'], []);
      this.form.get('costoInicial')?.enable();

      const categoria = this.form.get('categoria')?.value;
      if (categoria === 'Equipo') {
        this.setValidators(camposEquipo, [Validators.required]);
      } else {
        this.setValidators(camposEquipo, []);
      }
    } else {
      this.setValidators(camposFijos, []);
      this.setValidators(camposCirculantes, [Validators.required]);
      this.setValidators(camposEquipo, []);
      this.form.get('costoInicial')?.disable(); 
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
      if (this.f['tipo'].value === 'Circulante') {
        const total = (this.f['cantidad'].value || 0) * (this.f['valorUnitario'].value || 0);
        this.form.get('costoInicial')?.setValue(total, { emitEvent: false });
      }
    };

    this.form.get('cantidad')?.valueChanges.subscribe(calcular);
    this.form.get('valorUnitario')?.valueChanges.subscribe(calcular);
    
    // El bolsillo siempre guarda lo último que se escribió manualmente en Fijo, ignorando falsos positivos
    this.form.get('costoInicial')?.valueChanges.subscribe(val => {
      if (this.form.get('tipo')?.value === 'Fijo' && !this.isSwitchingType) {
        this.originalCostoInicial = val;
      }
    });
    
    this.form.get('tipo')?.valueChanges.subscribe((tipo) => {
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

    if (this.form.invalid) {
      Swal.fire('Error', 'Complete los datos obligatorios del activo.', 'error');
      return;
    }
    
    this.loading = true;
    const formValues = this.form.getRawValue();

    const activo: Asset = {
      id: this.id > 0 ? this.id : 0,
      nombre: formValues.nombre,
      tipo: formValues.tipo,
      costoInicial: Number(formValues.costoInicial) || 0,
      categoria: formValues.categoria,
      subcategoria: formValues.subcategoria,
      subCategoria: formValues.subcategoria,
      
      valorResidual: formValues.tipo === 'Fijo' ? (Number(formValues.valorResidual) || 0) : 0,
      vidaUtil: formValues.tipo === 'Fijo' ? (Number(formValues.vidaUtil) || 0) : 0,
      fechaCompra: formValues.tipo === 'Fijo' ? new Date(formValues.fechaCompra) : new Date(),

      consumoMaquina: (formValues.tipo === 'Fijo' && formValues.categoria === 'Equipo') ? (Number(formValues.consumoMaquina) || 0) : 0,
      tarifa: (formValues.tipo === 'Fijo' && formValues.categoria === 'Equipo') ? (Number(formValues.tarifa) || 0) : 0,
      costoMantenimiento: (formValues.tipo === 'Fijo' && formValues.categoria === 'Equipo') ? (Number(formValues.costoMantenimiento) || 0) : 0,

      cantidad: Number(formValues.cantidad) || 1,
      valorUnitario: formValues.tipo === 'Circulante' ? (Number(formValues.valorUnitario) || 0) : 0,
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
