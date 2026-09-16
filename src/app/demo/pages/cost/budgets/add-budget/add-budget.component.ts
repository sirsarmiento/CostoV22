import { Component, OnInit, inject, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { Budget, Parts } from '../../../../../core/models/Cost/budge';
import { Asset } from '../../../../../core/models/Cost/asset';
import { Product } from '../../../../../core/models/Cost/product';
import { Client } from '../../../../../core/models/Cost/client';
import { Machine } from '../../../../../core/models/Cost/config';
import { BudgetService } from '../../../../../core/services/cost/budget.service';
import { ConfigService } from '../../../../../core/services/cost/config.service';
import { ProductService } from '../../../../../core/services/cost/product.service';
import { AssetService } from '../../../../../core/services/cost/asset.service';
import { FixeService } from '../../../../../core/services/cost/fixe.service';
import { ClientService } from '../../../../../core/services/cost/client.service';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';
import { calculateBudgetTotals, getNumFromRecord } from '../../../../../core/utils/budget-calculator';
import {
  AssetCatalog,
  resolvePiezasDisplay,
  getNombreMaquina,
  getNombreMaterial,
  mapProductToPieces,
  buildBudgetPayload
} from '../../../../../core/utils/budget-mapper';
import { ComponentCanDeactivate } from '../../../../../core/guards/pending-changes.guard';
import { QuickClientModalComponent, QuickClientData } from '../../../../../theme/shared/components/quick-client-modal/quick-client-modal.component';

@Component({
  selector: 'app-add-budget',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, NgSelectModule, QuickClientModalComponent],
  templateUrl: './add-budget.component.html'
})
export class AddBudgetComponent implements OnInit, ComponentCanDeactivate {
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private budgetService = inject(BudgetService);
  private configService = inject(ConfigService);
  private productService = inject(ProductService);
  private assetService = inject(AssetService);
  private fixeService = inject(FixeService);
  private clientService = inject(ClientService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  form!: FormGroup;
  id = 0;
  loading = false;
  submitted = false;

  piezas: Parts[] = [];
  piezaCounter = 1;
  minMargenGanancia = 0;

  totalFijoIndirecto = 0;
  capacidadHorasMaquina = 1;
  tasaCIF = 0;
  tasaDepreciacionMaquina = 0;

  maquinasList: Asset[] = [];
  activosCirculantes: Asset[] = [];
  activosMateriales: Asset[] = [];
  assetsMobiliario: Asset[] = [];
  productosList: Product[] = [];
  filteredItemsList: Product[] = [];
  clientesList: { id: number; nombre: string }[] = [];
  materialesPorCategoria: Asset[] = [];
  materialesFiltrados: Asset[] = [];

  categoriasMaterial: string[] = [];
  subcategoriasMaterial: string[] = [];

  // Modal de Cliente / Prospecto (SRP)
  showClienteModal = false;
  isCreandoClienteNuevo = false;
  guardarEnCatalogo = true;
  tempClienteData: QuickClientData = {
    nombre: '',
    rifCedula: '',
    categoria: '',
    telefono: '',
    email: '',
    direccion: ''
  };

  constructor() {
    this.myFormValues();
  }

  get f() {
    return this.form.controls;
  }

  get catalog(): AssetCatalog {
    return {
      maquinas: this.maquinasList,
      materiales: this.activosMateriales,
      circulantes: this.activosCirculantes,
      mobiliario: this.assetsMobiliario
    };
  }

  ngOnInit(): void {
    forkJoin({
      configs: this.configService.getConfigs(),
      products: this.productService.getProducts(),
      assets: this.assetService.getAssets(),
      fixes: this.fixeService.getFixes(),
      clients: this.clientService.getClients()
    }).subscribe(data => {
      if (data.clients?.length) {
        this.clientesList = data.clients.map(c => ({
          id: Number(c.id) || 0,
          nombre: `${c.nombre} ${c.apellido || ''}`.trim()
        }));
      }

      if (data.configs?.length) {
        const configObj = data.configs[0];
        const configRec = configObj as unknown as Record<string, unknown>;
        const minVal = Number(configRec['margenGanancia'] ?? configRec['minMargenGanancia'] ?? configRec['margen_ganancia']) || 0;
        this.actualizarMinMargenGanancia(minVal);

        let capacidad = 0;
        if (configObj.parametros?.length) {
          configObj.parametros.forEach((machine: Machine) => {
            const unidad = machine.unidad?.toLowerCase().trim() || '';
            if (unidad.includes('hora') || unidad.includes('hs') || unidad === '') {
              const hUso = Number(machine.horasUso) || 0;
              const hMes = (hUso > 0 && hUso <= 24) ? (hUso * 22) : (hUso > 24 ? hUso : 176);
              capacidad += hMes;
            }
          });
        }
        if (capacidad <= 0) {
          const maquinasFijas = (data.assets || []).filter(a => (a.tipo || '').toLowerCase() === 'fijo' && (a.categoria || '').toLowerCase() === 'equipo');
          capacidad = maquinasFijas.length > 0 ? (maquinasFijas.length * 176) : 176;
        }
        this.capacidadHorasMaquina = capacidad > 0 ? capacidad : 176;
      }

      this.productosList = data.products || [];
      this.actualizarItemsFiltrados();

      // Clasificación de Activos
      this.maquinasList = data.assets.filter(a => {
        const t = (a.tipo || '').toLowerCase().trim();
        const c = (a.categoria || '').toLowerCase().trim();
        const s = (a.subCategoria || '').toLowerCase().trim();
        return t === 'fijo' && c === 'equipo' && (s === 'fabricación' || s === 'fabricacion');
      });

      if (this.maquinasList.length === 0) {
        this.maquinasList = data.assets.filter(a =>
          (a.tipo || '').toLowerCase().trim() === 'fijo' && (a.categoria || '').toLowerCase().trim() === 'equipo'
        );
      }

      this.assetsMobiliario = data.assets.filter(a => (a.categoria || '').toLowerCase().trim() === 'mobiliario');

      this.activosCirculantes = data.assets.filter(a => {
        const t = (a.tipo || '').toLowerCase().trim();
        const c = (a.categoria || '').toLowerCase().trim();
        return t === 'circulante' && (c === 'producción' || c === 'produccion');
      });

      if (this.activosCirculantes.length === 0) {
        this.activosCirculantes = data.assets.filter(a => (a.tipo || '').toLowerCase().trim() === 'circulante');
      }

      this.activosMateriales = data.assets.filter(a => {
        const t = (a.tipo || '').toLowerCase().trim();
        const c = (a.categoria || '').toLowerCase().trim();
        return t === 'material' || c === 'filamento' || c === 'resina' || c === 'filamentos' || c === 'resinas';
      });

      this.materialesFiltrados = [...this.activosMateriales];
      this.categoriasMaterial = [...new Set(
        this.activosMateriales.map(a => a.categoria).filter((c): c is string => !!c)
      )].sort();

      this.actualizarCostoMaquina();
      this.actualizarMinMargenGanancia();

      const indirectos = data.fixes.filter(item => item.clasificacion === 'Indirecto');
      this.totalFijoIndirecto = indirectos.reduce((total, item) => total + (Number(item.precio) || 0), 0);
      this.actualizarIndirectoProrrateado();

      this.setValues();
      this.piezas = resolvePiezasDisplay(this.piezas, this.catalog);
      this.cdr.detectChanges();
      setTimeout(() => this.cdr.detectChanges(), 50);
    });
  }

  back(): void {
    this.router.navigate(['/budgets']);
  }

  // --- Modal de Cliente ---
  openClienteModal(): void {
    if (!this.tempClienteData.nombre) {
      this.tempClienteData.nombre = String(this.form?.get('clienteNombreTexto')?.value || '');
    }
    this.showClienteModal = true;
  }

  closeClienteModal(): void {
    this.showClienteModal = false;
  }

  onClientConfirmed(client: QuickClientData): void {
    this.isCreandoClienteNuevo = true;
    this.tempClienteData = client;
    this.form.get('clienteId')?.setValue(null);
    this.form.get('clienteNombreTexto')?.setValue(client.nombre);
    this.showClienteModal = false;
  }

  confirmClienteModal(): void {
    this.onClientConfirmed(this.tempClienteData);
  }

  clearClienteNuevo(): void {
    this.isCreandoClienteNuevo = false;
    this.form.get('clienteNombreTexto')?.setValue('');
    this.tempClienteData = {
      nombre: '',
      rifCedula: '',
      categoria: '',
      telefono: '',
      email: '',
      direccion: ''
    };
  }

  // --- Helpers de visualización delegados al mapper ---
  getNombreMaquina(row: Parts | Record<string, unknown> | unknown): string {
    return getNombreMaquina(row, this.maquinasList);
  }

  getNombreMaterial(row: Parts | Record<string, unknown> | unknown): string {
    return getNombreMaterial(row, this.catalog);
  }

  actualizarItemsFiltrados(): void {
    const clasif = this.form?.get('clasificacion')?.value;
    const currentProdId = Number(this.form?.get('productoId')?.value);
    if (!clasif && !currentProdId) {
      this.filteredItemsList = [];
      return;
    }

    const cLower = String(clasif || '').toLowerCase().trim();
    this.filteredItemsList = this.productosList.filter(p => {
      if (currentProdId && Number(p.id) === currentProdId) return true;
      if (!clasif) return false;
      const pClasif = String(p.clasificacion || '').toLowerCase().trim();
      return (cLower === 'producto' || cLower === 'productos')
        ? (pClasif === 'producto' || pClasif === 'productos')
        : pClasif === cLower;
    });
  }

  actualizarCostoMaquina(): void {
    const activoId = this.form.get('activoId')?.value;
    if (activoId) {
      const machine = this.maquinasList.find(m => m.id == activoId);
      if (machine) {
        const consumo = Number(machine.consumoMaquina) || 0;
        const tarifa = Number(machine.tarifa) || 0;
        const mantenimiento = Number(machine.costoMantenimiento) || 0;
        const tasa = (consumo / 1000 * tarifa) + mantenimiento;
        this.form.get('costoMaquina')?.setValue(tasa);

        const costoInicial = Number(machine.costoInicial) || 0;
        const valorResidual = Number(machine.valorResidual) || 0;
        const vidaUtilAnos = Number(machine.vidaUtil) > 0 ? Number(machine.vidaUtil) : 1;
        const vidaUtilHoras = vidaUtilAnos * 1920;
        this.tasaDepreciacionMaquina = (costoInicial - valorResidual) / vidaUtilHoras;
        return;
      }
    }
    this.form.get('costoMaquina')?.setValue(0);
    this.tasaDepreciacionMaquina = 0;
  }

  actualizarMinMargenGanancia(minMarginValue?: number): void {
    if (minMarginValue !== undefined) {
      this.minMargenGanancia = Number(minMarginValue) || 0;
    }

    const control = this.form?.get('margenGanancia');
    if (control) {
      control.setValidators([Validators.required, Validators.min(this.minMargenGanancia), Validators.max(100)]);
      const currentVal = Number(control.value) || 0;
      if (!this.id || currentVal < this.minMargenGanancia) {
        control.setValue(this.minMargenGanancia);
      }
      control.updateValueAndValidity();
    }
  }

  onMargenBlur(): void {
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

  actualizarIndirectoProrrateado(): void {
    this.tasaCIF = this.totalFijoIndirecto / (this.capacidadHorasMaquina || 1);
  }

  addPart(): void {
    let nombre: string;
    const cantidad = Number(this.form.get('piezaCantidad')?.value) || 1;
    let activoId: number | undefined;
    let gramos = 0;
    let horas = 0;
    let minutos = 0;
    let precioMaterial: number;
    let materialDisplayName = '';
    const tipo = this.form.get('piezaTipo')?.value || 'Del Inventario';

    let maquinaId: number | undefined = undefined;
    let maquinaNombre: string | undefined = undefined;

    if (tipo === 'Del Inventario') {
      const asset = this.form.get('piezaInventario')?.value;
      if (!asset) {
        Swal.fire('Por Favor', 'Debe seleccionar un activo del inventario', 'info');
        return;
      }
      const foundAsset = this.activosCirculantes.find(a => a.id == asset) || this.assetsMobiliario.find(a => a.id == asset);
      nombre = foundAsset?.nombre || 'Activo';
      activoId = Number(asset);
      precioMaterial = Number(foundAsset?.costoInicial || foundAsset?.valorUnitario) || 0;
    } else {
      nombre = this.form.get('piezaFabricada')?.value;
      gramos = Number(this.form.get('piezaGramos')?.value) || 0;
      horas = Number(this.form.get('piezaHoras')?.value) || 0;
      minutos = Number(this.form.get('piezaMinutos')?.value) || 0;

      const maqVal = this.form.get('activoId')?.value;
      if (maqVal) {
        maquinaId = Number(maqVal);
        maquinaNombre = this.maquinasList.find(m => m.id == maqVal)?.nombre;
      }

      const matId = this.form.get('piezaMaterialId')?.value;
      if (!matId) {
        Swal.fire('Por Favor', 'Debe seleccionar un material para la pieza fabricada', 'info');
        return;
      }
      activoId = Number(matId);
      precioMaterial = Number(this.form.get('piezaPrecioMaterial')?.value) || 0;

      const assetCirc = this.activosCirculantes.find(a => a.id == matId);
      if (assetCirc) {
        materialDisplayName = assetCirc.nombre;
      }

      if (!nombre) {
        Swal.fire('Por Favor', 'Debe agregar el nombre de la pieza', 'info');
        return;
      }
      if (gramos < 0) {
        Swal.fire('Por Favor', 'Debe agregar los gramos válidos', 'info');
        return;
      }
    }

    if (!cantidad || cantidad <= 0) {
      Swal.fire('Por Favor', 'Debe ingresar una cantidad válida', 'info');
      return;
    }

    const newParts: Parts = {
      id: this.generateUniqueId(),
      tipo: tipo,
      nombre: nombre.toUpperCase(),
      cantidad: cantidad,
      materialTipo: materialDisplayName || 'Sin material',
      materialDisplayName: materialDisplayName,
      precioMaterial: precioMaterial,
      gramos: gramos,
      horas: horas,
      minutos: minutos,
      activo: activoId || undefined,
      maquina: maquinaId,
      maquinaNombre: maquinaNombre,
      producto: 0
    };

    this.piezaCounter++;
    this.piezas.push(newParts);
    this.clearForm();
    this.cdr.detectChanges();
  }

  onProductSelect(item: { id: number } | number | null): void {
    const prodId = typeof item === 'object' && item !== null ? item.id : item;
    if (prodId) {
      this.autoFillFromProduct(Number(prodId));
    }
  }

  autoFillFromProduct(productId: number): void {
    const product = this.productosList.find(p => p.id == productId);
    if (product) {
      const pRec = product as unknown as Record<string, unknown>;
      const prepValue = getNumFromRecord(pRec, ['prepSlicing', 'tiempoSetup', 'prep_slicing', 'tiempo_setup'], Number(product.prepSlicing) || 0);
      const postValue = getNumFromRecord(pRec, ['postProcesado', 'tiempoPostProcesado', 'post_procesado', 'tiempo_post_procesado'], Number(product.postProcesado) || 0);
      const tasaValue = getNumFromRecord(pRec, ['tasaFallo', 'tasaFalloGlobal', 'tasa_fallo', 'tasa_fallo_global'], Number(product.tasaFallo) || 0);
      const margenValue = getNumFromRecord(pRec, ['margenGanancia', 'margen_ganancia'], Number(product.margenGanancia) || this.minMargenGanancia);

      this.form.patchValue({
        descripcion: product.descripcion || product.nombre,
        tasaFalloGlobal: Number(tasaValue) || 0,
        tiempoSetup: Number(prepValue) || 0,
        tiempoPostProcesado: Number(postValue) || 0,
        margenGanancia: Number(margenValue) || this.minMargenGanancia
      });

      this.piezas = mapProductToPieces(product, this.catalog);
      this.piezaCounter = this.piezas.length + 1;
      this.cdr.detectChanges();
    }
  }

  getTotales() {
    const rawBudget = this.form ? { ...this.form.value, piezas: this.piezas } : { piezas: this.piezas };
    return calculateBudgetTotals(
      rawBudget,
      [...this.maquinasList, ...this.assetsMobiliario, ...this.activosCirculantes],
      this.totalFijoIndirecto,
      this.capacidadHorasMaquina,
      Number(this.form?.get('costoMaquina')?.value) || 0,
      this.tasaDepreciacionMaquina
    );
  }

  generateUniqueId(): number {
    return this.piezas.length > 0 ? Math.max(...this.piezas.map(m => m.id || 0)) + 1 : 1;
  }

  clearForm(): void {
    this.f['nombre'].setValue(`PIEZA ${this.piezaCounter}`);
    this.form.patchValue({
      piezaTipo: 'Del Inventario',
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
    this.form.get('piezaMaterialId')?.disable();
  }

  onDelete(row: Parts): void {
    Swal.fire({
      title: `¿Estás seguro que deseas eliminar de la lista ${row.nombre}?`,
      showDenyButton: true,
      confirmButtonText: `Eliminar`,
      denyButtonText: `Cancelar`
    }).then((result) => {
      if (result.isConfirmed) {
        this.piezas = this.piezas.filter(p => p.id !== row.id);
        this.piezaCounter = Math.max(1, this.piezaCounter - 1);
        this.f['nombre'].setValue(`PIEZA ${this.piezaCounter}`);
        this.cdr.detectChanges();
      }
    });
  }

  setValues(): void {
    const data: Budget | Record<string, unknown> | undefined = history.state?.edit_budget;
    if (data && ((data as Record<string, unknown>)['id'] !== undefined)) {
      const dRec = data as Record<string, unknown>;
      let dateStr = '';
      if (dRec['fecha']) {
        const rawDate = new Date(dRec['fecha'] as string);
        if (!isNaN(rawDate.getTime())) {
          dateStr = rawDate.toISOString().substring(0, 10);
        }
      }

      const rawProd = dRec['productoId'] ?? dRec['producto_id'] ?? dRec['producto'];
      const parsedProductoId = rawProd && typeof rawProd === 'object'
        ? Number((rawProd as Record<string, unknown>)['id']) || null
        : (rawProd !== null && rawProd !== undefined && rawProd !== '' ? Number(rawProd) || null : null);

      const rawCli = dRec['clienteId'] ?? dRec['cliente_id'] ?? dRec['cliente'];
      let parsedClienteId: number | null = null;
      if (rawCli && typeof rawCli === 'object') {
        parsedClienteId = Number((rawCli as Record<string, unknown>)['id']) || null;
        const nameStr = `${(rawCli as Record<string, unknown>)['nombre'] || ''} ${(rawCli as Record<string, unknown>)['apellido'] || ''}`.trim();
        if (parsedClienteId && nameStr && !this.clientesList.some(c => c.id === parsedClienteId)) {
          this.clientesList.push({ id: parsedClienteId, nombre: nameStr });
        }
      } else if (rawCli !== null && rawCli !== undefined && rawCli !== '') {
        parsedClienteId = Number(rawCli) || null;
      }

      const rawAct = dRec['activoId'] ?? dRec['activo_id'] ?? dRec['activo'];
      const parsedActivoId = rawAct && typeof rawAct === 'object'
        ? Number((rawAct as Record<string, unknown>)['id']) || null
        : (rawAct !== null && rawAct !== undefined && rawAct !== '' ? Number(rawAct) || null : null);

      const cliDet = (dRec['clienteDetalle'] ?? dRec['cliente_detalle'] ?? dRec['clienteInfo'] ?? dRec['tempClienteData']) as Record<string, string> | undefined;
      const cliNombreStr = String(dRec['clienteNombre'] || dRec['nombreCliente'] || dRec['cliente_nombre'] || cliDet?.['nombre'] || dRec['clienteNombreTexto'] || '').trim();

      if (!parsedClienteId && (cliNombreStr || cliDet)) {
        this.isCreandoClienteNuevo = true;
        this.tempClienteData = {
          nombre: String(cliDet?.['nombre'] || cliDet?.['nombreRazonSocial'] || cliNombreStr),
          rifCedula: String(cliDet?.['cedula'] || cliDet?.['rifCedula'] || cliDet?.['rif_cedula'] || dRec['cedula'] || dRec['rifCedula'] || dRec['rif_cedula'] || ''),
          categoria: String(cliDet?.['categoria'] || dRec['clienteCategoria'] || dRec['categoria'] || ''),
          telefono: String(cliDet?.['telefono'] || dRec['telefono'] || ''),
          email: String(cliDet?.['email'] || dRec['email'] || ''),
          direccion: String(cliDet?.['direccion'] || dRec['direccion'] || '')
        };
        this.form.get('clienteNombreTexto')?.setValue(this.tempClienteData.nombre);
      }

      const setupValue = getNumFromRecord(dRec, ['tiempoSetup', 'prepSlicing', 'tiempo_setup', 'prep_slicing'], 0);
      const postValue = getNumFromRecord(dRec, ['postProcesado', 'tiempoPostProcesado', 'tiempo_post_procesado', 'post_procesado'], 0);
      const tasaValue = getNumFromRecord(dRec, ['tasaFallo', 'tasaFalloGlobal', 'tasa_fallo_global', 'tasa_fallo'], 0);
      const margenValue = getNumFromRecord(dRec, ['margenGanancia', 'margen_ganancia'], this.minMargenGanancia);

      this.form.patchValue({
        clasificacion: dRec['clasificacion'],
        productoId: parsedProductoId,
        descripcion: dRec['descripcion'],
        numero: dRec['numero'],
        fecha: dateStr,
        activoId: parsedActivoId,
        cantidadGlobal: dRec['cantidadGlobal'] || 1,
        delivery: dRec['delivery'] || 0,
        clienteId: parsedClienteId,
        tasaFalloGlobal: tasaValue,
        tiempoSetup: setupValue,
        tiempoPostProcesado: postValue,
        margenGanancia: margenValue || this.minMargenGanancia
      }, { emitEvent: false });

      this.id = Number(dRec['id']) || 0;
      this.piezas = resolvePiezasDisplay((dRec['piezas'] as Parts[]) || [], this.catalog);
      this.f['nombre'].setValue(`PIEZA ${this.piezas.length + 1}`);
      this.actualizarCostoMaquina();
      this.actualizarMinMargenGanancia();
      this.actualizarItemsFiltrados();
      this.cdr.detectChanges();
      setTimeout(() => this.cdr.detectChanges(), 50);
    }
  }

  myFormValues(): void {
    this.form = this.formBuilder.group({
      clasificacion: [''],
      productoId: [''],
      descripcion: ['', Validators.required],
      numero: [''],
      fecha: ['', Validators.required],
      cantidadGlobal: [1, [Validators.required, Validators.min(1)]],
      delivery: [0, [Validators.min(0)]],
      clienteId: [null],
      clienteNombreTexto: [''],
      guardarClienteEnBd: [false],

      nombre: [`PIEZA ${this.piezaCounter}`],
      piezaTipo: ['Del Inventario'],
      piezaInventario: [''],
      piezaFabricada: [''],
      piezaCantidad: [1],
      materialTipo: [''],
      subcategoria: [''],
      piezaMaterialCategoria: [''],
      piezaMaterialSubcategoria: [''],
      piezaMaterialId: [null],
      piezaPrecioMaterial: [''],
      piezaGramos: [''],
      piezaHoras: [''],
      piezaMinutos: [''],

      activoId: [null],
      tasaFalloGlobal: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
      tiempoSetup: [0, [Validators.required, Validators.min(0)]],
      tiempoPostProcesado: [0, [Validators.required, Validators.min(0)]],
      margenGanancia: [0, [Validators.required, Validators.min(this.minMargenGanancia), Validators.max(100)]],
      costoMaquina: [0]
    });

    this.form.get('clasificacion')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(clasif => {
      const numeroControl = this.form.get('numero');
      numeroControl?.clearValidators();
      if (clasif === 'Producto') {
        numeroControl?.setValue('');
      }
      numeroControl?.updateValueAndValidity();
      this.actualizarItemsFiltrados();
    });

    this.form.get('productoId')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(prodId => {
      if (prodId) {
        this.autoFillFromProduct(Number(prodId));
      }
    });

    this.form.get('activoId')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.actualizarCostoMaquina();
      this.actualizarMinMargenGanancia();
    });

    this.form.get('piezaMaterialCategoria')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(categoria => {
      this.onCategoriaChange(categoria);
    });

    this.form.get('piezaMaterialSubcategoria')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(subcategoria => {
      this.onSubcategoriaChange(subcategoria);
    });

    this.form.get('piezaMaterialId')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(materialId => {
      this.onMaterialChange(materialId);
    });
  }

  formatAssetOption(asset: Asset): string {
    if (!asset) return '';
    const detalles: string[] = [];
    const desc = asset.descripcion?.trim();
    if (desc && !['n/a', 'null', '-', 'N/A'].includes(desc.toLowerCase())) {
      detalles.push(desc);
    }
    if (asset.cantidad !== undefined && asset.cantidad !== null) {
      const unidad = asset.unidadMedida ? ` ${asset.unidadMedida}` : '';
      detalles.push(`Cant: ${asset.cantidad}${unidad}`);
    }
    return detalles.length > 0 
      ? `${asset.nombre} (${detalles.join(' - ')})` 
      : asset.nombre;
  }

  filterMaterials(event: Event): void {
    const input = event.target as HTMLInputElement;
    const query = input.value.toLowerCase().trim();

    if (!query) {
      this.materialesFiltrados = [...this.materialesPorCategoria];
      return;
    }

    this.materialesFiltrados = this.materialesPorCategoria.filter(m =>
      m.nombre?.toLowerCase().includes(query)
    );
  }

  onCategoriaChange(categoria: string): void {
    if (categoria) {
      this.materialesPorCategoria = this.activosMateriales.filter(a => a.categoria === categoria);
      this.materialesFiltrados = [...this.materialesPorCategoria];
      this.subcategoriasMaterial = [...new Set(
        this.materialesPorCategoria.map(a => a.subCategoria).filter(Boolean)
      )] as string[];
      this.form.get('piezaMaterialId')?.enable();
    } else {
      this.materialesPorCategoria = [];
      this.materialesFiltrados = [];
      this.subcategoriasMaterial = [];
      this.form.get('piezaMaterialId')?.disable();
    }
    this.form.get('piezaMaterialId')?.setValue(null, { emitEvent: false });
    this.form.get('piezaPrecioMaterial')?.setValue('');
    this.form.get('piezaMaterialSubcategoria')?.setValue('', { emitEvent: false });
  }

  onSubcategoriaChange(subcategoria: string): void {
    if (subcategoria) {
      const subLower = subcategoria.toLowerCase().trim();
      this.materialesFiltrados = this.materialesPorCategoria.filter(a => (a.subCategoria || '').toLowerCase().trim() === subLower);
    } else {
      this.materialesFiltrados = [...this.materialesPorCategoria];
    }
    this.form.get('piezaMaterialId')?.setValue(null, { emitEvent: false });
    this.form.get('piezaPrecioMaterial')?.setValue('');
  }

  onMaterialChange(materialId: number): void {
    if (materialId) {
      const selectedAsset = this.activosMateriales.find(a => a.id == materialId) || this.activosCirculantes.find(a => a.id == materialId);
      if (selectedAsset) {
        const valUnit = Number(selectedAsset.valorUnitario) || Number(selectedAsset.costoInicial) || 0;
        const uMedida = (selectedAsset.unidadMedida || '').toLowerCase().trim();
        const precioPorGramo = (uMedida === 'gramos' || uMedida === 'gramo') ? valUnit : (valUnit > 0 ? valUnit / 1000 : 0);
        const rounded = Math.round(precioPorGramo * 10000) / 10000;
        this.form.get('piezaPrecioMaterial')?.setValue(rounded);
      }
    } else {
      this.form.get('piezaPrecioMaterial')?.setValue('');
    }
  }

  onSubmit(): void {
    this.submitted = true;
    this.form.markAllAsTouched();

    const tipoPieza = this.form.get('piezaTipo')?.value;
    if (tipoPieza === 'Del Inventario' && this.form.get('piezaInventario')?.value) {
      this.addPart();
    } else if (tipoPieza === 'Fabricada' && (this.form.get('piezaFabricada')?.value || this.form.get('piezaGramos')?.value)) {
      this.addPart();
    }

    if (this.piezas.length === 0) {
      Swal.fire({
        title: 'Sin Piezas',
        text: 'Debe agregar al menos una pieza al presupuesto antes de guardarlo.',
        icon: 'warning',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#4680ff'
      });
      return;
    }

    if (this.form.invalid) {
      Swal.fire('Error', 'Complete los datos obligatorios del presupuesto.', 'error');
      return;
    }

    this.loading = true;

    const prodVal = this.f['productoId']?.value;
    const cliVal = this.f['clienteId']?.value;
    const parsedProdId = (prodVal !== null && prodVal !== undefined && prodVal !== '') ? Number(prodVal) : undefined;
    const parsedCliId = (cliVal !== null && cliVal !== undefined && cliVal !== '') ? Number(cliVal) : undefined;
    const clienteTexto = String(this.f['clienteNombreTexto']?.value || '').trim();

    const executeSubmit = (effectiveCliId?: number) => {
      const totales = this.getTotales();
      const budgetPayload = buildBudgetPayload({
        id: this.id,
        formValue: this.form.value,
        piezas: this.piezas,
        totalCostoFinal: totales.costoTotalFinal,
        isCreandoClienteNuevo: this.isCreandoClienteNuevo,
        tempClienteData: this.tempClienteData,
        parsedCliId: effectiveCliId ?? parsedCliId,
        parsedProdId,
        clienteTexto
      });

      const budget = budgetPayload as unknown as Budget;
      const request = this.id === 0 ? this.budgetService.createBudget(budget) : this.budgetService.updateBudget(this.id, budget);

      request.subscribe({
        next: () => {
          this.loading = false;
          this.submitted = true;
          this.form?.markAsPristine();
          Swal.fire({
            title: '¡Guardado!',
            text: 'Presupuesto guardado exitosamente.',
            icon: 'success',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#4680ff'
          }).then(() => {
            this.router.navigate(['/budgets']);
          });
        },
        error: () => {
          this.loading = false;
          Swal.fire('Error', 'Ha ocurrido un error al guardar el presupuesto.', 'error');
        }
      });
    };

    if (this.isCreandoClienteNuevo && this.guardarEnCatalogo && !parsedCliId && this.tempClienteData.nombre.trim()) {
      const parts = this.tempClienteData.nombre.trim().split(' ');
      const firstWord = parts[0] || this.tempClienteData.nombre.trim();
      const remainingWords = parts.slice(1).join(' ');

      const newClientPayload = {
        nombre: firstWord,
        apellido: remainingWords,
        cedula: this.tempClienteData.rifCedula,
        categoria: this.tempClienteData.categoria,
        telefono: this.tempClienteData.telefono,
        email: this.tempClienteData.email,
        direccion: this.tempClienteData.direccion
      };

      this.clientService.createClient(newClientPayload as unknown as Client).subscribe({
        next: (resp) => {
          const newId = Number(resp?.id);
          executeSubmit(newId > 0 ? newId : undefined);
        },
        error: () => {
          executeSubmit(undefined);
        }
      });
    } else {
      executeSubmit(undefined);
    }
  }

  canDeactivate(): boolean {
    if (this.submitted && !this.loading) {
      return true;
    }
    const isFormDirty = this.form?.dirty;
    const hasUnsavedPieces = !this.id && this.piezas && this.piezas.length > 0;
    return !isFormDirty && !hasUnsavedPieces;
  }
}
