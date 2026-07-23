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
    // MOCK - LOCAL STORAGE: Eliminar y reemplazar con servicio real
    const stored = localStorage.getItem('cost_edit_asset');
    if (stored) {
      const data: Asset = JSON.parse(stored);
      if (data && data.id && data.id > 0) {
        let dateVal = '';
        if (data.fechaCompra) {
          const rawDate = new Date(data.fechaCompra);
          if (!isNaN(rawDate.getTime())) {
            dateVal = rawDate.toISOString().substring(0, 10);
          }
        }

        this.form.patchValue({
          nombre: data.nombre,
          costoInicial: data.costoInicial,
          valorResidual: data.valorResidual,
          vidaUtil: data.vidaUtil,
          fechaCompra: dateVal,
          tipo: data.tipo,
          cantidad: data.cantidad,
          unidadMedida: data.unidadMedida,
          presentacion: data.presentacion,
          descripcion: data.descripcion,
          ubicacion: data.ubicacion,
          valorUnitario: data.valorUnitario,
          categoria: data.categoria,
          subcategoria: data.subcategoria,
          consumoMaquina: data.consumoMaquina,
          tarifa: data.tarifa,
          costoMantenimiento: data.costoMantenimiento
        });

        this.id = data.id;
        this.actualizarValidaciones(data.tipo);
      }
    }
  }

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
      // Campos de Circulantes
      cantidad: [''],
      unidadMedida: [''],
      presentacion: [''],
      descripcion: [''],
      ubicacion: [''],
      valorUnitario: ['']
    });

    this.form.get('tipo')?.valueChanges.subscribe(tipo => {
      if (tipo === 'Circulante' && this.form.get('categoria')?.value === 'Mobiliario') {
        this.form.get('categoria')?.setValue('');
      } else if (tipo === 'Fijo' && !this.form.get('categoria')?.value) {
        this.form.get('categoria')?.setValue('Mobiliario');
      }
      this.actualizarValidaciones(tipo);
    });

    this.form.get('categoria')?.valueChanges.subscribe(() => {
      this.actualizarValidaciones(this.form.get('tipo')?.value);
    });
  }

  private actualizarValidaciones(tipo: string) {
    const camposFijos = ['valorResidual', 'vidaUtil', 'fechaCompra'];
    const camposCirculantes = ['cantidad', 'valorUnitario', 'ubicacion'];
    const camposEquipo = ['consumoMaquina', 'tarifa', 'costoMantenimiento'];

    if (tipo === 'Fijo') {
      this.setValidators(camposFijos, [Validators.required]);
      this.setValidators(camposCirculantes, []);
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

  setupLogicCalcularTotal() {
    const calcular = () => {
      if (this.f['tipo'].value === 'Circulante') {
        const total = (this.f['cantidad'].value || 0) * (this.f['valorUnitario'].value || 0);
        this.form.get('costoInicial')?.setValue(total, { emitEvent: false });
      }
    };

    this.form.get('cantidad')?.valueChanges.subscribe(calcular);
    this.form.get('valorUnitario')?.valueChanges.subscribe(calcular);
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
      
      valorResidual: formValues.tipo === 'Fijo' ? (Number(formValues.valorResidual) || 0) : 0,
      vidaUtil: formValues.tipo === 'Fijo' ? (Number(formValues.vidaUtil) || 0) : 0,
      fechaCompra: formValues.tipo === 'Fijo' ? new Date(formValues.fechaCompra) : new Date(),

      consumoMaquina: (formValues.tipo === 'Fijo' && formValues.categoria === 'Equipo') ? (Number(formValues.consumoMaquina) || 0) : 0,
      tarifa: (formValues.tipo === 'Fijo' && formValues.categoria === 'Equipo') ? (Number(formValues.tarifa) || 0) : 0,
      costoMantenimiento: (formValues.tipo === 'Fijo' && formValues.categoria === 'Equipo') ? (Number(formValues.costoMantenimiento) || 0) : 0,

      cantidad: formValues.tipo === 'Circulante' ? (Number(formValues.cantidad) || 0) : 0,
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
        localStorage.removeItem('cost_edit_asset');
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
