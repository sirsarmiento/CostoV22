import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { AssetService } from '../../../../core/services/cost/asset.service';
import { Asset } from '../../../../core/models/Cost/asset';
import Swal from 'sweetalert2';

export interface QuickAssetCreatedEvent {
  asset: Asset;
  cantidad: number;
  costo: number;
}

@Component({
  selector: 'app-quick-asset-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgSelectModule],
  templateUrl: './quick-asset-modal.component.html'
})
export class QuickAssetModalComponent implements OnInit, OnChanges {
  private fb = inject(FormBuilder);
  private assetService = inject(AssetService);
  private cdr = inject(ChangeDetectorRef);

  @Input() isOpen = false;
  @Input() defaultTipo: 'Material' | 'Circulante' = 'Material';
  @Input() allAssets: Asset[] = [];
  @Input() submitButtonText = 'Guardar y Agregar';
  @Input() initialCosto: number | null = null;
  @Input() initialCantidad: number | null = 1;

  @Output() assetCreated = new EventEmitter<QuickAssetCreatedEvent>();
  @Output() modalClosed = new EventEmitter<void>();

  assetForm!: FormGroup;
  guardando = false;
  modalCategoriasList: string[] = [];
  modalSubcategoriasList: string[] = [];
  unidadesMedidaList: string[] = ['Unidades', 'Gramos', 'Metros', 'Kilos', 'Litros', 'Pulgadas', 'Piezas', 'Rollos', 'Potes'];

  ngOnInit(): void {
    this.initForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.initForm();
      this.actualizarListasCategorias();
    }
    if (changes['allAssets'] && this.allAssets.length > 0 && this.assetForm) {
      this.actualizarListasCategorias();
    }
  }

  private initForm(): void {
    this.assetForm = this.fb.group({
      nombre: ['', Validators.required],
      tipo: [this.defaultTipo, Validators.required],
      categoria: [this.defaultTipo === 'Material' ? 'Material' : 'Producción', Validators.required],
      subCategoria: [''],
      costoInicial: [this.initialCosto ?? 0, [Validators.required, Validators.min(0)]],
      cantidad: [this.initialCantidad ?? 1, [Validators.required, Validators.min(0.01)]],
      unidadMedida: ['Unidades', Validators.required],
      presentacion: [''],
      ubicacion: [''],
      descripcion: ['']
    });
  }

  actualizarListasCategorias(): void {
    if (!this.assetForm) return;
    const tipo = (this.assetForm.get('tipo')?.value || '').toLowerCase().trim();

    const assetsDelTipo = this.allAssets.filter(a => (a.tipo || '').toLowerCase().trim() === tipo);
    const catsSet = new Set<string>();

    assetsDelTipo.forEach(a => {
      if (a.categoria && a.categoria.trim()) {
        catsSet.add(a.categoria.trim());
      }
    });

    if (tipo === 'material') {
      catsSet.add('Material');
      catsSet.add('Producción');
    } else if (tipo === 'circulante') {
      catsSet.add('Producción');
    }

    this.modalCategoriasList = Array.from(catsSet);

    const catActual = this.assetForm.get('categoria')?.value;
    if (!catActual || !this.modalCategoriasList.includes(catActual)) {
      const fallbackCat = tipo === 'material' ? 'Material' : 'Producción';
      this.assetForm.get('categoria')?.setValue(fallbackCat);
    }

    this.actualizarListasSubcategorias();
  }

  actualizarListasSubcategorias(): void {
    if (!this.assetForm) return;
    const tipo = (this.assetForm.get('tipo')?.value || '').toLowerCase().trim();
    const categoria = (this.assetForm.get('categoria')?.value || '').toLowerCase().trim();

    const subcatsSet = new Set<string>();
    this.allAssets
      .filter(a =>
        (a.tipo || '').toLowerCase().trim() === tipo &&
        (a.categoria || '').toLowerCase().trim() === categoria
      )
      .forEach(a => {
        const sub = a.subCategoria;
        if (sub && sub.trim()) {
          subcatsSet.add(sub.trim());
        }
      });

    if (tipo === 'material') {
      subcatsSet.add('Resina');
      subcatsSet.add('Filamento');
      subcatsSet.add('Pintura');
    } else if (tipo === 'circulante' && categoria === 'producción') {
      subcatsSet.add('Producción');
      subcatsSet.add('Consumible');
    }

    this.modalSubcategoriasList = Array.from(subcatsSet);
    this.cdr.markForCheck();
  }

  onTipoChange(): void {
    this.actualizarListasCategorias();
  }

  onCategoriaChange(): void {
    this.actualizarListasSubcategorias();
  }

  close(): void {
    this.modalClosed.emit();
  }

  save(): void {
    if (this.assetForm.invalid) {
      this.assetForm.markAllAsTouched();
      Swal.fire('Campos requeridos', 'Por favor complete todos los campos obligatorios (*).', 'warning');
      return;
    }

    const val = this.assetForm.value;
    const costo = Number(val.costoInicial) || 0;
    const cant = Number(val.cantidad) || 1;

    const payload: Asset = {
      nombre: val.nombre,
      tipo: val.tipo,
      categoria: val.categoria,
      subCategoria: val.subCategoria || val.categoria,
      costoInicial: costo,
      valorUnitario: costo,
      cantidad: cant,
      unidadMedida: val.unidadMedida,
      presentacion: val.presentacion || '',
      ubicacion: val.ubicacion || '',
      descripcion: val.descripcion || '',
      valorResidual: 0,
      vidaUtil: 1,
      consumoMaquina: 0,
      tarifa: 0,
      costoMantenimiento: 0,
      fechaCompra: new Date()
    };

    this.guardando = true;
    this.assetService.createAsset(payload).subscribe({
      next: (resp: unknown) => {
        this.guardando = false;
        const resObj = resp as { id?: number; data?: { id?: number }; activo?: { id?: number } } | null;
        const newId = resObj?.id || resObj?.data?.id || resObj?.activo?.id || Date.now();
        const createdAsset: Asset = {
          ...payload,
          id: newId
        };

        this.assetCreated.emit({
          asset: createdAsset,
          cantidad: cant,
          costo: costo
        });

        Swal.fire({
          icon: 'success',
          title: 'Activo creado con éxito',
          text: `"${createdAsset.nombre}" fue registrado correctamente.`,
          timer: 1800,
          showConfirmButton: false
        });

        this.close();
      },
      error: () => {
        this.guardando = false;
        // El interceptor global maneja el error
      }
    });
  }
}
