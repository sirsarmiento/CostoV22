import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { forkJoin } from 'rxjs';
import { InventoryService } from '../../../../../core/services/cost/inventory.service';
import { AssetService } from '../../../../../core/services/cost/asset.service';
import { Asset } from '../../../../../core/models/Cost/asset';
import { Supplier, Purchase } from '../../../../../core/models/Cost/inventory';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-add-purchase',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, NgSelectModule],
  templateUrl: './add-purchase.component.html'
})
export class AddPurchaseComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private inventory = inject(InventoryService);
  private assets = inject(AssetService);
  private cdr = inject(ChangeDetectorRef);

  form!: FormGroup;
  suppliers: Supplier[] = [];
  allAssets: Asset[] = [];
  circulantes: Asset[] = [];
  insumosFiltrados: Asset[] = [];
  loading = false;
  submitted = false;

  // Variables temporales para agregar insumos a la compra
  tempTipoInsumo: 'Material' | 'Circulante' = 'Material';
  tempActivoId: number | null = null;
  tempCantidad: number | null = 1;
  tempValorUnitario: number | null = null;

  // Modal de Creación Rápida de Activos
  showAssetModal = false;
  guardandoAsset = false;
  assetForm!: FormGroup;
  modalCategoriasList: string[] = [];
  modalSubcategoriasList: string[] = [];
  unidadesMedidaList: string[] = ['Unidades', 'Gramos', 'Metros', 'Kilos', 'Litros', 'Pulgadas', 'Piezas', 'Rollos', 'Potes'];

  materialesCompra: {
    activoId: number;
    nombre: string;
    tipo: string;
    cantidad: number;
    valorUnitario: number;
    subtotal: number;
  }[] = [];

  ngOnInit(): void {
    this.form = this.fb.group({
      proveedor: [null, Validators.required],
      fecha: [new Date().toISOString().substring(0, 10), Validators.required],
      observacion: ['']
    });
    this.loadData();
  }

  loadData() {
    forkJoin({
      suppliers: this.inventory.getSuppliers(),
      assets: this.assets.getAssets()
    }).subscribe({
      next: ({ suppliers, assets }) => {
        this.suppliers = suppliers || [];
        this.allAssets = assets || [];
        this.circulantes = (assets || []).filter(a => {
          const t = (a.tipo || '').toLowerCase();
          return t === 'circulante' || t === 'material';
        });
        this.filtrarInsumos();
      },
      error: () => {
        // Fallback cargado desde cache o local
      }
    });
  }

  actualizarListasCategoriasModal() {
    if (!this.assetForm) return;
    const tipo = (this.assetForm.get('tipo')?.value || '').toLowerCase().trim();

    // 1. Filtrar activos por Tipo para obtener únicamente las categorías relevantes de ese tipo
    const assetsDelTipo = this.allAssets.filter(a => (a.tipo || '').toLowerCase().trim() === tipo);
    const catsSet = new Set<string>();

    assetsDelTipo.forEach(a => {
      if (a.categoria && a.categoria.trim()) {
        catsSet.add(a.categoria.trim());
      }
    });

    // Defaults esenciales según el tipo si no existen en BD
    if (tipo === 'circulante') {
      catsSet.add('Producción');
    } else if (tipo === 'material') {
      catsSet.add('FILAMENTO');
      catsSet.add('RESINA');
    }

    this.modalCategoriasList = Array.from(catsSet).sort();

    // Validar si la categoría actual sigue siendo válida para el tipo
    const currentCat = this.assetForm.get('categoria')?.value;
    if (!currentCat || !this.modalCategoriasList.includes(currentCat)) {
      const defaultCat = tipo === 'circulante' ? 'Producción' : (this.modalCategoriasList[0] || 'FILAMENTO');
      this.assetForm.patchValue({ categoria: defaultCat }, { emitEvent: false });
    }

    // 2. Actualizar subcategorías en base a la categoría seleccionada
    this.actualizarSubcategoriasModal();
  }

  actualizarSubcategoriasModal() {
    if (!this.assetForm) return;
    const cat = (this.assetForm.get('categoria')?.value || '').toLowerCase().trim();
    const tipo = (this.assetForm.get('tipo')?.value || '').toLowerCase().trim();

    const subcatsSet = new Set<string>();

    // Filtrar activos que coincidan con la categoría (y tipo)
    this.allAssets.forEach(a => {
      const aCat = (a.categoria || '').toLowerCase().trim();
      const aTipo = (a.tipo || '').toLowerCase().trim();
      if (aCat === cat && (!tipo || aTipo === tipo)) {
        if (a.subCategoria && a.subCategoria.trim()) {
          subcatsSet.add(a.subCategoria.trim());
        }
      }
    });

    // Sugerencias predeterminadas comunes
    if (cat === 'filamento') {
      ['PLA', 'PLA+', 'PETG', 'ABS', 'TPU', 'ASA', 'NYLON', 'PVA', 'PC'].forEach(s => subcatsSet.add(s));
    } else if (cat === 'resina') {
      ['Estándar', 'Water Washable', 'ABS-Like', 'Plant-Based', 'Castable', 'Tough', 'Flexible'].forEach(s => subcatsSet.add(s));
    }

    this.modalSubcategoriasList = Array.from(subcatsSet).sort();

    // Si la subcategoría actual no pertenece a las de esta categoría, limpiarla
    const currentSub = this.assetForm.get('subCategoria')?.value;
    if (currentSub && !this.modalSubcategoriasList.includes(currentSub)) {
      this.assetForm.patchValue({ subCategoria: '' }, { emitEvent: false });
    }
  }

  get f() { return this.form.controls; }

  onTipoInsumoChange() {
    this.tempActivoId = null;
    this.tempValorUnitario = null;
    this.filtrarInsumos();
  }

  filtrarInsumos() {
    this.insumosFiltrados = this.allAssets.filter(a => {
      const t = (a.tipo || '').toLowerCase().trim();
      const cat = (a.categoria || '').toLowerCase().trim();
      if (this.tempTipoInsumo === 'Circulante') {
        return t === 'circulante' && (cat === 'producción' || cat === 'produccion');
      } else if (this.tempTipoInsumo === 'Material') {
        return t === 'material';
      }
      return (t === 'circulante' && (cat === 'producción' || cat === 'produccion')) || t === 'material';
    });
  }

  onTempAssetChange() {
    if (this.tempActivoId) {
      const asset = this.allAssets.find(a => a.id == this.tempActivoId);
      if (asset) {
        const val = Number(asset.valorUnitario) || Number(asset.costoInicial) || 0;
        this.tempValorUnitario = val;
      }
    } else {
      this.tempValorUnitario = null;
    }
  }

  // --- MÉTODOS DEL MODAL DE CREACIÓN RÁPIDA DE ACTIVO ---
  openAssetModal() {
    const isCirc = this.tempTipoInsumo === 'Circulante';
    const initialTipo = isCirc ? 'Circulante' : 'Material';
    const initialCat = isCirc ? 'Producción' : 'FILAMENTO';

    this.assetForm = this.fb.group({
      nombre: ['', Validators.required],
      tipo: [initialTipo, Validators.required],
      categoria: [initialCat, Validators.required],
      subCategoria: [''],
      unidadMedida: [isCirc ? 'Unidades' : 'Gramos', Validators.required],
      costoInicial: [this.tempValorUnitario || 0, [Validators.required, Validators.min(0)]],
      cantidad: [this.tempCantidad || 1, [Validators.required, Validators.min(0.01)]],
      presentacion: [''],
      ubicacion: [''],
      descripcion: ['']
    });

    this.actualizarListasCategoriasModal();
    this.showAssetModal = true;
  }

  closeAssetModal() {
    this.showAssetModal = false;
  }

  onModalTipoChange() {
    const tipo = this.assetForm.get('tipo')?.value;
    if (tipo === 'Circulante') {
      this.assetForm.patchValue({ 
        categoria: 'Producción',
        unidadMedida: 'Unidades'
      });
    } else if (tipo === 'Material') {
      this.assetForm.patchValue({ 
        categoria: 'FILAMENTO',
        unidadMedida: 'Gramos'
      });
    }
    this.actualizarListasCategoriasModal();
  }

  onModalCategoriaChange() {
    this.actualizarSubcategoriasModal();
  }

  saveAssetModal() {
    if (this.assetForm.invalid) {
      this.assetForm.markAllAsTouched();
      Swal.fire('Campos Requeridos', 'Por favor complete el nombre, tipo, categoría y costo unitario.', 'warning');
      return;
    }

    this.guardandoAsset = true;
    const formVal = this.assetForm.value;
    const cant = Number(formVal.cantidad) || 1;
    const val = Number(formVal.costoInicial) || 0;

    const newAsset: Asset = {
      nombre: formVal.nombre.trim(),
      tipo: formVal.tipo,
      categoria: formVal.categoria ? formVal.categoria.trim() : '',
      subCategoria: formVal.subCategoria ? formVal.subCategoria.trim() : '',
      costoInicial: val,
      valorResidual: 0,
      vidaUtil: 1,
      fechaCompra: new Date(),
      cantidad: 0, // El stock real se incrementa al procesar la orden de compra
      cantidadReservada: 0,
      unidadMedida: formVal.unidadMedida || 'Unidades',
      presentacion: formVal.presentacion || '',
      ubicacion: formVal.ubicacion || '',
      descripcion: formVal.descripcion || '',
      valorUnitario: val,
      consumoMaquina: 0,
      tarifa: 0,
      costoMantenimiento: 0
    };

    this.assets.createAsset(newAsset).subscribe({
      next: (created) => {
        this.guardandoAsset = false;
        const raw = created as unknown as Record<string, unknown>;
        const rawActivo = (raw && typeof raw === 'object' && 'activo' in raw) ? (raw['activo'] as Record<string, unknown>) : null;
        const rawData = (raw && typeof raw === 'object' && 'data' in raw) ? (raw['data'] as Record<string, unknown>) : null;
        const nuevoId = Number(rawActivo?.['id'] || rawData?.['id'] || raw?.['id'] || Date.now());

        const assetGuardado: Asset = {
          ...newAsset,
          id: nuevoId,
          nombre: newAsset.nombre,
          tipo: newAsset.tipo,
          categoria: newAsset.categoria,
          subCategoria: newAsset.subCategoria,
          valorUnitario: val,
          unidadMedida: newAsset.unidadMedida
        };

        // 1. Agregar a listas locales en memoria
        this.allAssets = [assetGuardado, ...this.allAssets];
        this.circulantes = [assetGuardado, ...this.circulantes];
        this.actualizarListasCategoriasModal();

        // 2. Ajustar el filtro activo según el tipo creado
        const tipoCreado = (assetGuardado.tipo || '').toLowerCase();
        this.tempTipoInsumo = tipoCreado === 'circulante' ? 'Circulante' : 'Material';
        this.filtrarInsumos();

        // 3. AUTO-INSERTAR DIRECTAMENTE EN LA TABLA DE LA COMPRA (1-Clic)
        const tipoLabel = tipoCreado === 'circulante' ? 'Del Inventario' : 'Material';
        this.materialesCompra.push({
          activoId: nuevoId,
          nombre: assetGuardado.nombre,
          tipo: tipoLabel,
          cantidad: cant,
          valorUnitario: val,
          subtotal: cant * val
        });

        // 4. Limpiar temporales y cerrar modal
        this.tempActivoId = null;
        this.tempCantidad = 1;
        this.tempValorUnitario = null;
        this.showAssetModal = false;
        this.cdr.detectChanges();

        Swal.fire({
          icon: 'success',
          title: '¡Insumo Agregado a la Compra!',
          text: `"${assetGuardado.nombre}" fue registrado en el catálogo e insertado en la orden (${cant} ${assetGuardado.unidadMedida} por $${val.toFixed(2)} c/u).`,
          timer: 2200,
          showConfirmButton: false
        });
      },
      error: (err) => {
        this.guardandoAsset = false;
        Swal.fire('Error', err?.error?.msg || 'No se pudo registrar el activo.', 'error');
      }
    });
  }

  agregarMaterialCompra() {
    if (!this.tempActivoId) {
      Swal.fire('Atención', 'Seleccione un material o insumo a comprar.', 'info');
      return;
    }
    const cant = Number(this.tempCantidad) || 0;
    const val = Number(this.tempValorUnitario) || 0;
    if (cant <= 0) {
      Swal.fire('Atención', 'Indique una cantidad válida mayor a 0.', 'info');
      return;
    }
    const asset = this.allAssets.find(a => a.id == this.tempActivoId);
    const aTipo = (asset?.tipo || '').toLowerCase();
    const tipoLabel = aTipo === 'circulante' ? 'Del Inventario' : 'Material';
    this.materialesCompra.push({
      activoId: this.tempActivoId,
      nombre: asset?.nombre || `Insumo #${this.tempActivoId}`,
      tipo: tipoLabel,
      cantidad: cant,
      valorUnitario: val,
      subtotal: cant * val
    });
    this.tempActivoId = null;
    this.tempCantidad = 1;
    this.tempValorUnitario = null;
  }

  removerMaterialCompra(index: number) {
    this.materialesCompra.splice(index, 1);
  }

  get totalCompra(): number {
    return this.materialesCompra.reduce((acc, item) => acc + item.subtotal, 0);
  }

  back() {
    this.router.navigate(['/purchases']);
  }

  save() {
    this.submitted = true;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      Swal.fire('Formulario Incompleto', 'Por favor seleccione el proveedor y la fecha de compra.', 'warning');
      return;
    }
    if (this.materialesCompra.length === 0) {
      Swal.fire('Sin Materiales', 'Agregue al menos un insumo o material a la compra con el botón (+).', 'info');
      return;
    }
    this.loading = true;
    const payload: Purchase = {
      proveedor: this.form.get('proveedor')?.value,
      fecha: this.form.get('fecha')?.value,
      observacion: this.form.get('observacion')?.value || '',
      total: this.totalCompra,
      lineas: this.materialesCompra.map(m => ({
        activo: m.activoId,
        cantidad: m.cantidad,
        valorUnitario: m.valorUnitario
      }))
    };

    this.inventory.createPurchase(payload).subscribe({
      next: () => {
        this.loading = false;
        Swal.fire({
          icon: 'success',
          title: '¡Compra Registrada!',
          text: 'Se ha registrado la orden de reposición y actualizado el stock de insumos.',
          timer: 2000,
          showConfirmButton: false
        }).then(() => this.back());
      },
      error: (err) => {
        this.loading = false;
        Swal.fire('Error', err?.error?.msg || 'No se pudo registrar la compra.', 'error');
      }
    });
  }
}
