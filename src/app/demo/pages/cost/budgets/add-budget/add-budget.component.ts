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
import { Fixe } from '../../../../../core/models/Cost/fixe';
import { ClientService } from '../../../../../core/services/cost/client.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { calculateBudgetTotals } from '../../../../../core/utils/budget-calculator';
import {
  AssetCatalog,
  resolvePiezasDisplay,
  getNombreMaquina,
  getNombreMaterial,
  mapProductToPieces,
  buildBudgetPayload
} from '../../../../../core/utils/budget-mapper';
import { CatalogConfigService } from '../../../../../core/services/cost/catalog-config.service';
import { CatalogoSimple, MaterialCatalogo, TecnologiaCatalogo } from '../../../../../core/models/Cost/catalog-config';
import { esEquiposFabricacion } from '../../../../../core/constants/asset-categories';
import {
  calcularPrecioPorGramo,
  formatAssetOption,
  filtrarMaquinasPorTecnologia,
  armarFiltrosMaterialPieza,
  sumarGramosPiezas,
  evaluarDisponibilidadStock,
  StockDisponibilidad
} from '../../../../../core/utils/piece-builder.helper';
import { ComponentCanDeactivate } from '../../../../../core/guards/pending-changes.guard';
import { QuickClientModalComponent, QuickClientData } from '../../../../../theme/shared/components/quick-client-modal/quick-client-modal.component';
import { TASAS_FALLO, horasPorTecnologia, nombrePiezaAutomatico, sumarTiempoPiezas } from '../../../../../core/utils/family-rules';
import { tecnologiasDesdePiezas } from '../../../../../core/utils/catalog-sku';
import {
  BudgetLineItem,
  calculateMultiItemTotals,
  clasificacionCabecera,
  hidratarLineas,
  itemDesdeProducto,
  productosYaUsados,
  serializarLineas
} from '../../../../../core/utils/budget-items';

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
  private catalogConfigService = inject(CatalogConfigService);
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
  items: BudgetLineItem[] = [];
  itemActivoClave: string | null = null;
  piezaCounter = 1;
  minMargenGanancia = 0;

  totalFijoIndirecto = 0;
  capacidadHorasMaquina = 1;
  tasaCIF = 0;
  tasaDepreciacionMaquina = 0;

  allAssets: Asset[] = [];
  maquinasList: Asset[] = [];
  maquinasFiltradas: Asset[] = [];
  activosCirculantes: Asset[] = [];
  activosMateriales: Asset[] = [];
  assetsMobiliario: Asset[] = [];
  productosList: Product[] = [];
  filteredItemsList: Product[] = [];
  clientesList: { id: number; nombre: string; cedula: string; etiqueta: string }[] = [];
  readonly tasasFalloOpciones = TASAS_FALLO;
  materialesFiltradosCirculantes: Asset[] = [];
  tecnologias: TecnologiaCatalogo[] = [];
  materialesCatalogo: MaterialCatalogo[] = [];
  marcas: CatalogoSimple[] = [];
  colores: CatalogoSimple[] = [];
  polimerosPieza: string[] = [];
  marcasPieza: string[] = [];
  coloresPieza: string[] = [];

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

  armarClienteLista(c: Client | { id?: number; nombre?: string; apellido?: string; cedula?: string; rifCedula?: string }): { id: number; nombre: string; cedula: string; etiqueta: string } {
    const nombre = `${c.nombre || ''} ${('apellido' in c ? c.apellido : '') || ''}`.trim();
    const cedula = String(('cedula' in c ? c.cedula : '') || ('rifCedula' in c ? c.rifCedula : '') || '');
    return {
      id: Number(c.id) || 0,
      nombre,
      cedula,
      etiqueta: cedula ? `${nombre} — ${cedula}` : nombre
    };
  }

  buscarCliente = (term: string, item: { nombre: string; cedula: string; etiqueta: string }): boolean => {
    const t = (term || '').toLowerCase().trim();
    if (!t) return true;
    return (item.nombre || '').toLowerCase().includes(t)
      || (item.cedula || '').toLowerCase().includes(t)
      || (item.etiqueta || '').toLowerCase().includes(t);
  };

  get itemActivo(): BudgetLineItem | undefined {
    return this.items.find(i => i.clave === this.itemActivoClave);
  }

  get productosDisponibles(): Product[] {
    const usados = productosYaUsados(this.items);
    const clasif = String(this.form?.get('clasificacion')?.value || '').toLowerCase().trim();
    return this.productosList.filter(p => {
      if (usados.includes(Number(p.id))) return false;
      if (!clasif) return true;
      const pClasif = String(p.clasificacion || '').toLowerCase().trim();
      return (clasif === 'producto' || clasif === 'productos')
        ? (pClasif === 'producto' || pClasif === 'productos')
        : pClasif === clasif;
    });
  }

  get tecnologiasDePiezas(): string[] {
    return tecnologiasDesdePiezas(this.piezas);
  }

  get tecnologiasDisponiblesPieza() {
    const usadas = this.tecnologiasDePiezas;
    const actual = String(this.form?.get('piezaTecnologia')?.value || '').toUpperCase();
    if (!this.form?.get('multitecnologia')?.value) {
      if (usadas.length > 0) {
        return this.tecnologias.filter(t => (t.codigo || '').toUpperCase() === usadas[0]);
      }
      return this.tecnologias;
    }
    return this.tecnologias.filter(t => {
      const codigo = (t.codigo || '').toUpperCase();
      return codigo === actual || !usadas.includes(codigo);
    });
  }

  get resumenHoras() {
    return horasPorTecnologia(this.piezas);
  }

  get resumenHorasTexto(): string {
    const total = sumarTiempoPiezas(this.piezas);
    if (total.totalMinutos <= 0) return '0 h 0 min';
    return `${total.horas} h ${total.minutos} min`;
  }

  get siguienteNombrePieza(): string {
    return nombrePiezaAutomatico(this.piezas.filter(p => p.tipo === 'Fabricada').length);
  }

  ngOnInit(): void {
    forkJoin({
      configs: this.configService.getConfigs(),
      products: this.productService.getProducts(),
      assets: this.assetService.getAssets(),
      fixes: this.fixeService.getFixes(),
      clients: this.clientService.getClients(),
      tecnologias: this.catalogConfigService.getTecnologias().pipe(catchError(() => of([]))),
      materiales: this.catalogConfigService.getMateriales().pipe(catchError(() => of([]))),
      marcas: this.catalogConfigService.getMarcas().pipe(catchError(() => of([]))),
      colores: this.catalogConfigService.getColores().pipe(catchError(() => of([])))
    }).subscribe(data => {
      if (data.clients?.length) {
        this.clientesList = data.clients.map(c => this.armarClienteLista(c));
      }

      this.tecnologias = data.tecnologias?.length ? data.tecnologias : [
        { id: 1, codigo: 'FDM', nombre: 'Filamento' },
        { id: 2, codigo: 'SLA', nombre: 'Resina' }
      ];
      this.materialesCatalogo = data.materiales || [];
      this.marcas = data.marcas || [];
      this.colores = data.colores || [];

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
      this.allAssets = data.assets || [];
      this.maquinasList = (data.assets || []).filter((a: Asset) => {
        const t = (a.tipo || '').toLowerCase().trim();
        return t === 'fijo' && esEquiposFabricacion(a.categoria, a.subCategoria);
      });

      this.assetsMobiliario = (data.assets || []).filter((a: Asset) => (a.categoria || '').toLowerCase().trim() === 'mobiliario');

      this.activosCirculantes = (data.assets || []).filter((a: Asset) => {
        const t = (a.tipo || '').toLowerCase().trim();
        const c = (a.categoria || '').toLowerCase().trim();
        return t === 'circulante' && (c === 'producción' || c === 'produccion');
      });

      this.activosMateriales = (data.assets || []).filter((a: Asset) => {
        const t = (a.tipo || '').toLowerCase().trim();
        const c = (a.categoria || '').toLowerCase().trim();
        return t === 'material' || c === 'filamento' || c === 'resina' || c === 'filamentos' || c === 'resinas' || c === 'fdm' || c === 'sla' || c.includes('filamento') || c.includes('resina');
      });

      this.materialesFiltradosCirculantes = [...this.activosMateriales];
      this.aplicarFiltroTecnologiaPieza();

      this.actualizarCostoMaquina();
      this.actualizarMinMargenGanancia();

      const indirectos = (data.fixes || []).filter((item: Fixe) => item.clasificacion === 'Indirecto');
      this.totalFijoIndirecto = indirectos.reduce((total: number, item: Fixe) => total + (Number(item.precio) || 0), 0);
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
    this.form.get('clienteId')?.clearValidators();
    this.form.get('clienteId')?.setValue(null);
    this.form.get('clienteId')?.updateValueAndValidity();
    this.form.get('clienteNombreTexto')?.setValue(client.nombre);
    this.showClienteModal = false;
  }

  confirmClienteModal(): void {
    this.onClientConfirmed(this.tempClienteData);
  }

  clearClienteNuevo(): void {
    this.isCreandoClienteNuevo = false;
    this.form.get('clienteId')?.setValidators([Validators.required]);
    this.form.get('clienteId')?.updateValueAndValidity();
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

  get stockPiezaActual(): StockDisponibilidad {
    const matId = this.form.get('piezaMaterialId')?.value;
    if (!matId) {
      return {
        disponibleGramos: 0,
        requeridoGramos: 0,
        faltanteGramos: 0,
        estado: 'sin_seleccion',
        mensaje: ''
      };
    }
    const asset = this.activosMateriales.find(a => a.id == matId);
    const gramos = this.form.get('piezaGramos')?.value;
    const cantidad = this.form.get('piezaCantidad')?.value;
    return evaluarDisponibilidadStock(asset, gramos, cantidad);
  }

  actualizarItemsFiltrados(): void {
    this.filteredItemsList = this.productosDisponibles;
  }

  seleccionarItem(clave: string): void {
    this.persistirPiezasActivas();
    this.itemActivoClave = clave;
    this.piezas = [...(this.itemActivo?.piezas || [])];
    this.cdr.detectChanges();
  }

  persistirPiezasActivas(): void {
    const actual = this.items.find(i => i.clave === this.itemActivoClave);
    if (actual) {
      actual.piezas = [...this.piezas];
    }
  }

  agregarItem(): void {
    const prodId = Number(this.form.get('productoId')?.value);
    if (!prodId) {
      Swal.fire('Atención', 'Seleccione un producto o servicio para agregarlo al presupuesto.', 'info');
      return;
    }
    if (productosYaUsados(this.items).includes(prodId)) {
      Swal.fire('Atención', 'Ese producto o servicio ya está en este presupuesto.', 'info');
      return;
    }
    const product = this.productosList.find(p => p.id == prodId);
    if (!product) {
      Swal.fire('Atención', 'No se encontró el producto seleccionado.', 'warning');
      return;
    }
    this.persistirPiezasActivas();
    const nuevo = itemDesdeProducto(product, this.catalog, this.minMargenGanancia);
    if (nuevo.margenGanancia < this.minMargenGanancia) {
      nuevo.margenGanancia = this.minMargenGanancia;
    }
    this.items = [...this.items, nuevo];
    this.itemActivoClave = nuevo.clave;
    this.piezas = [...nuevo.piezas];
    if (!this.form.get('descripcion')?.value) {
      this.form.get('descripcion')?.setValue(this.items.map(i => i.nombre).join(' + '));
    }
    this.form.patchValue({ productoId: '', clasificacion: this.form.get('clasificacion')?.value }, { emitEvent: false });
    this.actualizarItemsFiltrados();
    this.cdr.detectChanges();
  }

  quitarItem(clave: string): void {
    this.items = this.items.filter(i => i.clave !== clave);
    if (this.itemActivoClave === clave) {
      this.itemActivoClave = this.items[0]?.clave || null;
      this.piezas = [...(this.itemActivo?.piezas || [])];
    }
    this.actualizarItemsFiltrados();
    this.cdr.detectChanges();
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
    if (!this.itemActivo) {
      Swal.fire('Atención', 'Agregue primero un producto o servicio al presupuesto.', 'info');
      return;
    }
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
      const foundAsset = this.activosCirculantes.find(a => a.id == asset) || this.assetsMobiliario.find(a => a.id == asset) || this.allAssets.find(a => a.id == asset);
      nombre = foundAsset?.nombre || 'Activo';
      activoId = Number(asset);
      precioMaterial = Number(foundAsset?.costoInicial || foundAsset?.valorUnitario) || 0;
      materialDisplayName = nombre;
    } else {
      const piezaTec = this.form.get('piezaTecnologia')?.value;
      if (!piezaTec) {
        Swal.fire('Atención', 'Seleccione el tipo de tecnología de la pieza.', 'warning');
        return;
      }
      nombre = this.form.get('piezaFabricada')?.value || this.siguienteNombrePieza;
      gramos = Number(this.form.get('piezaGramos')?.value) || 0;
      horas = Number(this.form.get('piezaHoras')?.value) || 0;
      minutos = Number(this.form.get('piezaMinutos')?.value) || 0;

      const maqVal = this.form.get('activoId')?.value;
      if (maqVal) {
        maquinaId = Number(maqVal);
        maquinaNombre = this.maquinasFiltradas.find(m => m.id == maqVal)?.nombre
          || this.maquinasList.find(m => m.id == maqVal)?.nombre;
      }

      const matId = this.form.get('piezaMaterialId')?.value;
      if (!matId) {
        Swal.fire('Por Favor', 'Debe seleccionar un material para la pieza fabricada', 'info');
        return;
      }
      activoId = Number(matId);
      precioMaterial = Number(this.form.get('piezaPrecioMaterial')?.value) || 0;

      const assetCirc = this.activosMateriales.find(a => a.id == matId) || this.activosCirculantes.find(a => a.id == matId);
      if (assetCirc) {
        materialDisplayName = assetCirc.nombre;
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
      tecnologia: tipo === 'Fabricada' ? this.form.get('piezaTecnologia')?.value : '',
      producto: this.itemActivo?.productoId || 0
    };

    this.piezaCounter++;
    this.piezas.push(newParts);
    this.persistirPiezasActivas();
    this.clearPieceForm();
    this.cdr.detectChanges();
  }

  clearPieceForm(): void {
    this.form.patchValue({
      piezaInventario: '',
      piezaFabricada: '',
      piezaCantidad: 1,
      piezaGramos: '',
      piezaHoras: 0,
      piezaMinutos: 0,
      piezaPolimero: '',
      piezaMarca: '',
      piezaColor: '',
      piezaMaterialId: null,
      piezaPrecioMaterial: '',
      activoId: null
    }, { emitEvent: false });
    this.form.get('nombre')?.setValue(this.siguienteNombrePieza);
  }

  onProductSelect(item: { id: number } | number | null): void {
    const prodId = typeof item === 'object' && item !== null ? item.id : item;
    if (prodId) {
      this.form.get('productoId')?.setValue(Number(prodId), { emitEvent: false });
    }
  }

  autoFillFromProduct(productId: number): void {
    this.form.get('productoId')?.setValue(productId, { emitEvent: false });
  }

  getTotales() {
    this.persistirPiezasActivas();
    if (this.items.length > 0) {
      return calculateMultiItemTotals(
        this.items,
        Number(this.form?.get('delivery')?.value) || 0,
        [...this.maquinasList, ...this.assetsMobiliario, ...this.activosCirculantes],
        this.totalFijoIndirecto,
        this.capacidadHorasMaquina
      );
    }
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
      piezaPolimero: '',
      piezaMarca: '',
      piezaColor: '',
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
        this.persistirPiezasActivas();
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
          this.clientesList.push({ id: parsedClienteId, nombre: nameStr, cedula: '', etiqueta: nameStr });
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
        tasaFalloGlobal: Number(dRec['tasaFalloGlobal'] ?? dRec['tasaFallo']) || 0,
        tiempoSetup: Number(dRec['tiempoSetup']) || 0,
        horasImpresion: Number(dRec['horasImpresion']) || 0,
        minutosImpresion: Number(dRec['minutosImpresion']) || 0,
        tiempoPostProcesado: Number(dRec['tiempoPostProcesado'] ?? dRec['postProcesado']) || 0,
        margenGanancia: Number(dRec['margenGanancia']) || this.minMargenGanancia
      }, { emitEvent: false });

      this.id = Number(dRec['id']) || 0;
      const piezasCargadas = resolvePiezasDisplay((dRec['piezas'] as Parts[]) || [], this.catalog);
      this.items = hidratarLineas(dRec, piezasCargadas, this.catalog);
      this.itemActivoClave = this.items[0]?.clave || null;
      this.piezas = [...(this.itemActivo?.piezas || piezasCargadas)];
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
      clienteId: [null, Validators.required],
      clienteNombreTexto: [''],
      guardarClienteEnBd: [false],

      nombre: [`PIEZA ${this.piezaCounter}`],
      piezaTipo: ['Del Inventario'],
      piezaInventario: [''],
      piezaFabricada: [''],
      piezaTecnologia: [''],
      piezaCantidad: [1],
      materialTipo: [''],
      subcategoria: [''],
      piezaPolimero: [''],
      piezaMarca: [''],
      piezaColor: [''],
      piezaMaterialId: [null],
      piezaPrecioMaterial: [''],
      piezaGramos: [''],
      piezaHoras: [0],
      piezaMinutos: [0],

      activoId: [null],
      tasaFalloGlobal: [TASAS_FALLO[0], [Validators.required, Validators.min(0), Validators.max(100)]],
      tiempoSetup: [0, [Validators.required, Validators.min(0)]],
      horasImpresion: [0, [Validators.min(0)]],
      minutosImpresion: [0, [Validators.min(0), Validators.max(59)]],
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
    ).subscribe(() => {
      this.actualizarItemsFiltrados();
    });

    this.form.get('activoId')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.actualizarCostoMaquina();
      this.actualizarMinMargenGanancia();
    });

    this.form.get('piezaPolimero')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.aplicarFiltroMaterialesPieza());

    this.form.get('piezaMarca')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.aplicarFiltroMaterialesPieza());

    this.form.get('piezaColor')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.aplicarFiltroMaterialesPieza());

    this.form.get('piezaMaterialId')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(materialId => {
      this.onPiezaMaterialChange(materialId);
    });

    this.form.get('piezaTecnologia')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.aplicarFiltroTecnologiaPieza());

    this.form.get('piezaTipo')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(tipo => {
      if (tipo === 'Fabricada' && !this.form.get('piezaTecnologia')?.value) {
        this.form.get('piezaTecnologia')?.setValue('FDM');
      }
    });
  }

  formatAssetOption(asset: Asset | unknown): string {
    return formatAssetOption(asset, this.allAssets);
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
    const maqActual = this.form.get('activoId')?.value;
    if (maqActual && !this.maquinasFiltradas.some(m => m.id == maqActual)) {
      this.form.get('activoId')?.setValue(null);
    }
    this.aplicarFiltroMaterialesPieza();
  }

  get totalGramosPiezas(): number {
    return sumarGramosPiezas(this.piezas);
  }

  aplicarFiltroMaterialesPieza() {
    const tec = (this.form.get('piezaTecnologia')?.value || '').toUpperCase().trim();
    const armado = armarFiltrosMaterialPieza(
      this.activosMateriales,
      this.materialesCatalogo,
      tec,
      this.form.get('piezaPolimero')?.value || '',
      this.form.get('piezaMarca')?.value || '',
      this.form.get('piezaColor')?.value || ''
    );

    this.polimerosPieza = armado.polimeros;
    this.marcasPieza = armado.marcas;
    this.coloresPieza = armado.colores;
    this.materialesFiltradosCirculantes = armado.materiales;

    if ((this.form.get('piezaPolimero')?.value || '') !== armado.polimero) {
      this.form.get('piezaPolimero')?.setValue(armado.polimero, { emitEvent: false });
    }
    if ((this.form.get('piezaMarca')?.value || '') !== armado.marca) {
      this.form.get('piezaMarca')?.setValue(armado.marca, { emitEvent: false });
    }
    if ((this.form.get('piezaColor')?.value || '') !== armado.color) {
      this.form.get('piezaColor')?.setValue(armado.color, { emitEvent: false });
    }

    const matActual = this.form.get('piezaMaterialId')?.value;
    if (matActual && !this.materialesFiltradosCirculantes.some(m => m.id == matActual)) {
      this.form.get('piezaMaterialId')?.setValue(null);
    }
  }

  onPiezaMaterialChange(materialId: number): void {
    if (materialId) {
      const selectedAsset = this.activosMateriales.find(a => a.id == materialId) || this.activosCirculantes.find(a => a.id == materialId);
      if (selectedAsset) {
        const rounded = calcularPrecioPorGramo(selectedAsset);
        this.form.get('piezaPrecioMaterial')?.setValue(rounded);
        return;
      }
    }
    this.form.get('piezaPrecioMaterial')?.setValue('');
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

    this.persistirPiezasActivas();
    if (this.items.length === 0) {
      Swal.fire({
        title: 'Sin productos',
        text: 'Debe agregar al menos un producto o servicio al presupuesto.',
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

    const prodVal = this.items[0]?.productoId;
    const cliVal = this.f['clienteId']?.value;
    const parsedProdId = (prodVal !== null && prodVal !== undefined && Number(prodVal) > 0) ? Number(prodVal) : undefined;
    const parsedCliId = (cliVal !== null && cliVal !== undefined && cliVal !== '') ? Number(cliVal) : undefined;
    const clienteTexto = String(this.f['clienteNombreTexto']?.value || '').trim();

    const executeSubmit = (effectiveCliId?: number) => {
      this.persistirPiezasActivas();
      const piezasTodas = this.items.flatMap(item => item.piezas);
      const primer = this.items[0];
      const tiempoPiezas = sumarTiempoPiezas(piezasTodas);
      const totales = this.getTotales();
      const budgetPayload = buildBudgetPayload({
        id: this.id,
        formValue: {
          ...this.form.value,
          clasificacion: clasificacionCabecera(this.items),
          tasaFalloGlobal: primer?.tasaFallo,
          tiempoSetup: primer?.tiempoSetup,
          tiempoPostProcesado: primer?.tiempoPostProcesado,
          margenGanancia: primer?.margenGanancia,
          cantidadGlobal: primer?.cantidad || 1,
          horasImpresion: tiempoPiezas.horas,
          minutosImpresion: tiempoPiezas.minutos,
          lineas: serializarLineas(this.items)
        },
        piezas: piezasTodas,
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
        error: (err) => {
          this.loading = false;
          if (err?.status === 401 || err?.status === 403 || err?.status === 0) {
            return;
          }
          Swal.fire('Error', err?.error?.msg || 'Ha ocurrido un error al guardar el presupuesto.', 'error');
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
