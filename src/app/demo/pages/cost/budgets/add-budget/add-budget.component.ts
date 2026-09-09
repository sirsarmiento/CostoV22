import { Component, OnInit, inject, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { Budget, Parts } from '../../../../../core/models/Cost/budge';
import { Asset } from '../../../../../core/models/Cost/asset';
import { Product } from '../../../../../core/models/Cost/product';
import { BudgetService } from '../../../../../core/services/cost/budget.service';
import { ConfigService } from '../../../../../core/services/cost/config.service';
import { Machine } from '../../../../../core/models/Cost/config';
import { ProductService } from '../../../../../core/services/cost/product.service';
import { AssetService } from '../../../../../core/services/cost/asset.service';
import { FixeService } from '../../../../../core/services/cost/fixe.service';
import { ClientService } from '../../../../../core/services/cost/client.service';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';
import { calculateBudgetTotals, getNumFromRecord } from '../../../../../core/utils/budget-calculator';

@Component({
  selector: 'app-add-budget',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, NgSelectModule],
  templateUrl: './add-budget.component.html'
})
export class AddBudgetComponent implements OnInit {
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
  id: number = 0;
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

  isCreandoClienteNuevo = false;
  showClienteModal = false;
  guardarEnCatalogo = false;
  tempClienteData = {
    nombre: '',
    rifCedula: '',
    categoria: '',
    telefono: '',
    email: '',
    direccion: ''
  };

  openClienteModal() {
    if (!this.tempClienteData.nombre) {
      this.tempClienteData.nombre = String(this.form?.get('clienteNombreTexto')?.value || '');
    }
    this.showClienteModal = true;
  }

  closeClienteModal() {
    this.showClienteModal = false;
  }

  confirmClienteModal() {
    if (!this.tempClienteData.nombre.trim()) {
      Swal.fire('Error', 'Ingrese el nombre del cliente.', 'warning');
      return;
    }
    this.isCreandoClienteNuevo = true;
    this.form.get('clienteId')?.setValue(null);
    this.form.get('clienteNombreTexto')?.setValue(this.tempClienteData.nombre.trim());
    this.showClienteModal = false;
  }

  clearClienteNuevo() {
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

  constructor() {
    this.myFormValues();
  }

  get f() { return this.form.controls; }

  actualizarItemsFiltrados() {
    const clasif = this.form?.get('clasificacion')?.value;
    const currentProdId = Number(this.form?.get('productoId')?.value);
    if (!clasif && !currentProdId) {
      this.filteredItemsList = [];
      return;
    }

    const cLower = String(clasif || '').toLowerCase().trim();
    this.filteredItemsList = this.productosList.filter(p => {
      if (currentProdId && Number(p.id) === currentProdId) {
        return true;
      }
      if (!clasif) return false;
      const pClasif = String(p.clasificacion || '').toLowerCase().trim();
      if (cLower === 'producto' || cLower === 'productos') {
        return pClasif === 'producto' || pClasif === 'productos';
      }
      return pClasif === cLower;
    });
  }

  ngOnInit() {
    forkJoin({
      configs: this.configService.getConfigs(),
      products: this.productService.getProducts(),
      assets: this.assetService.getAssets(),
      fixes: this.fixeService.getFixes(),
      clients: this.clientService.getClients()
    }).subscribe(data => {
      if (data.clients && data.clients.length > 0) {
        this.clientesList = data.clients.map(c => ({
          id: Number(c.id) || 0,
          nombre: `${c.nombre} ${c.apellido}`.trim()
        }));
      }
      // Configuración global
      if (data.configs && data.configs.length > 0) {
        const configObj = data.configs[0];
        const configRec = configObj as unknown as Record<string, unknown>;
        const minVal = Number(configRec['margenGanancia'] ?? configRec['minMargenGanancia'] ?? configRec['margen_ganancia']) || 0;
        this.actualizarMinMargenGanancia(minVal);
        
        let capacidad = 0;
        if (configObj.parametros && configObj.parametros.length > 0) {
          configObj.parametros.forEach((machine: Machine) => {
            const unidad = machine.unidad?.toLowerCase().trim() || '';
            if (unidad.includes('hora') || unidad.includes('hs') || unidad === '') {
              capacidad += (Number(machine.horasUso) || 0) * (Number(machine.prodMaxHoras) || 0);
            }
          });
        }
        // Si no hay capacidad parametrizada en la empresa, usar 160 horas/mes (mes estándar) en lugar de 1 hora
        this.capacidadHorasMaquina = capacidad > 0 ? capacidad : 160;
      }
      
      // Productos
      this.productosList = (data.products || []).map(p => ({
        ...p,
        id: Number(p.id) || 0
      }));
      this.actualizarItemsFiltrados();
      
      // Activos (Máquinas, Mobiliario, Circulantes de Producción y Materiales)
      // 1. Máquinas: Activos Fijos de Categoría Equipo y Subcategoría Fabricación
      this.maquinasList = data.assets.filter(asset => {
        const t = (asset.tipo || '').toLowerCase().trim();
        const c = (asset.categoria || '').toLowerCase().trim();
        const s = (asset.subCategoria || (asset as unknown as Record<string, unknown>)['sub_categoria'] || '').toString().toLowerCase().trim();
        return t === 'fijo' && c === 'equipo' && (s === 'fabricación' || s === 'fabricacion');
      });

      // Si no hay máquinas con subcategoría específica, fallback a activos fijos de equipo
      if (this.maquinasList.length === 0) {
        this.maquinasList = data.assets.filter(asset => 
          (asset.tipo || '').toLowerCase().trim() === 'fijo' && 
          (asset.categoria || '').toLowerCase().trim() === 'equipo'
        );
      }

      this.assetsMobiliario = data.assets.filter(asset => 
        (asset.categoria || '').toLowerCase().trim() === 'mobiliario'
      );

      // 2. Activos de Inventario: Activos Circulantes de Categoría Producción
      this.activosCirculantes = data.assets.filter(asset => {
        const t = (asset.tipo || '').toLowerCase().trim();
        const c = (asset.categoria || '').toLowerCase().trim();
        return t === 'circulante' && (c === 'producción' || c === 'produccion');
      });

      // Si no hay circulantes marcados como producción, incluir todos los circulantes
      if (this.activosCirculantes.length === 0) {
        this.activosCirculantes = data.assets.filter(asset => 
          (asset.tipo || '').toLowerCase().trim() === 'circulante'
        );
      }

      // 3. Activos Tipo Material: Materiales para impresión/fabricación
      this.activosMateriales = data.assets.filter(asset => {
        const t = (asset.tipo || '').toLowerCase().trim();
        const c = (asset.categoria || '').toLowerCase().trim();
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
      this.piezas = this.resolvePiezasDisplay(this.piezas);
      this.cdr.detectChanges();
      setTimeout(() => this.cdr.detectChanges(), 50);
    });
  }

  back() {
    this.router.navigate(['/budgets']);
  }

  actualizarCostoMaquina() {
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

  actualizarMinMargenGanancia(minMarginValue?: number) {
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

  actualizarIndirectoProrrateado() {
    this.tasaCIF = this.totalFijoIndirecto / (this.capacidadHorasMaquina || 1);
  }

  addPart() {
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
      producto: 0,
    };

    this.piezaCounter++;
    this.piezas.push(newParts);
    this.clearForm();
    this.cdr.detectChanges();
  }

  onProductSelect(item: { id: number } | number | null) {
    const prodId = typeof item === 'object' && item !== null ? item.id : item;
    if (prodId) {
      this.autoFillFromProduct(Number(prodId));
    }
  }

  autoFillFromProduct(productId: number) {
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

      const rawPiezas = pRec['piezasProducto'] ?? pRec['piezas_producto'] ?? pRec['piezas'] ?? product.piezasProducto ?? [];
      const piezasList = Array.isArray(rawPiezas) ? rawPiezas : [];
      if (piezasList.length > 0) {
        this.piezas = piezasList.map((pb: Record<string, unknown>, index: number) => {
          const actId = Number(pb['activo'] ?? pb['activo_id'] ?? pb['assetId'] ?? pb['materialId']) || undefined;
          const foundAsset = actId ? this.activosCirculantes.find(a => a.id == actId) || this.assetsMobiliario.find(a => a.id == actId) : undefined;
          
          let tipo = (pb['tipo'] as string) || '';
          if (!tipo) {
            tipo = (foundAsset && !pb['maquinaId'] && !pb['maquina']) ? 'Del Inventario' : 'Fabricada';
          }
          
          const rawPrecio = Number(pb['precioMaterial'] ?? pb['precio_material']);
          const precioMaterial = (!isNaN(rawPrecio) && rawPrecio > 0)
            ? rawPrecio
            : (Number(foundAsset?.costoInicial || foundAsset?.valorUnitario) || 0);

          return {
            id: index + 1,
            tipo: tipo,
            nombre: (pb['nombre'] as string) || foundAsset?.nombre || `PIEZA ${index + 1}`,
            cantidad: Number(pb['cantidad']) || 1,
            activo: actId,
            assetId: actId,
            materialTipo: (pb['materialDisplayName'] as string) || (pb['materialTipo'] as string) || (foundAsset ? foundAsset.nombre : 'Sin material'),
            materialDisplayName: (pb['materialDisplayName'] as string) || (foundAsset ? foundAsset.nombre : ''),
            precioMaterial: precioMaterial,
            gramos: Number(pb['gramos']) || 0,
            horas: Number(pb['horas']) || 0,
            minutos: Number(pb['minutos']) || 0,
            maquinaId: Number(pb['maquinaId'] ?? pb['maquina']) || undefined,
            maquinaNombre: (pb['maquinaNombre'] as string) || (pb['maquina'] as string) || undefined
          };
        });
        this.piezaCounter = this.piezas.length + 1;
      }
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
    return this.piezas.length > 0 
      ? Math.max(...this.piezas.map(m => m.id || 0)) + 1 
      : 1;
  }

  clearForm() {
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

  onDelete(row: Parts) {
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

  setValues() {
    const data: Budget | Record<string, unknown> | undefined = history.state.edit_budget;
    if (data && ((data as Record<string, unknown>)['id'] || (data as Record<string, unknown>)['id'] === 0)) {
      let dateStr = '';
      if ((data as Record<string, unknown>)['fecha']) {
        const rawDate = new Date((data as Record<string, unknown>)['fecha'] as string);
        if (!isNaN(rawDate.getTime())) {
          dateStr = rawDate.toISOString().substring(0, 10);
        }
      }

      const rawProd = (data as Record<string, unknown>)['productoId'] ?? (data as Record<string, unknown>)['producto_id'] ?? (data as Record<string, unknown>)['producto'];
      let parsedProductoId: number | null = null;
      if (rawProd && typeof rawProd === 'object') {
        parsedProductoId = Number((rawProd as Record<string, unknown>)['id']) || null;
      } else if (rawProd !== null && rawProd !== undefined && rawProd !== '') {
        parsedProductoId = Number(rawProd) || null;
      }

      const rawCli = (data as Record<string, unknown>)['clienteId'] ?? (data as Record<string, unknown>)['cliente_id'] ?? (data as Record<string, unknown>)['cliente'];
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

      const rawAct = (data as Record<string, unknown>)['activoId'] ?? (data as Record<string, unknown>)['activo_id'] ?? (data as Record<string, unknown>)['activo'];
      let parsedActivoId: number | null = null;
      if (rawAct && typeof rawAct === 'object') {
        parsedActivoId = Number((rawAct as Record<string, unknown>)['id']) || null;
      } else if (rawAct !== null && rawAct !== undefined && rawAct !== '') {
        parsedActivoId = Number(rawAct) || null;
      }

      const dRec = data as Record<string, unknown>;
      const cliDet = (dRec['clienteDetalle'] ?? dRec['cliente_detalle'] ?? dRec['clienteInfo'] ?? dRec['tempClienteData']) as Record<string, string> | undefined;
      const cliNombreStr = String(dRec['clienteNombre'] || dRec['nombreCliente'] || dRec['cliente_nombre'] || cliDet?.['nombre'] || dRec['clienteNombreTexto'] || '').trim();

      if (!parsedClienteId && (cliNombreStr || cliDet)) {
        this.isCreandoClienteNuevo = true;
        this.tempClienteData = {
          nombre: String(cliDet?.['nombre'] || cliDet?.['nombreRazonSocial'] || cliNombreStr),
          rifCedula: String(cliDet?.['cedula'] || cliDet?.['rifCedula'] || cliDet?.['rif_cedula'] || dRec['cedula'] || dRec['rifCedula'] || dRec['rif_cedula'] || dRec['rif'] || ''),
          categoria: String(cliDet?.['categoria'] || dRec['clienteCategoria'] || dRec['categoria'] || ''),
          telefono: String(cliDet?.['telefono'] || dRec['telefono'] || ''),
          email: String(cliDet?.['email'] || dRec['email'] || ''),
          direccion: String(cliDet?.['direccion'] || dRec['direccion'] || '')
        };
        this.form.get('clienteNombreTexto')?.setValue(this.tempClienteData.nombre);
      }
      const getFirstNonZero = (obj: Record<string, unknown> | null | undefined, keys: string[]): number => {
        if (!obj) return 0;
        for (const k of keys) {
          if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
            const num = Number(obj[k]);
            if (!isNaN(num) && num > 0) return num;
          }
        }
        return 0;
      };

      let setupValue = getFirstNonZero(dRec, ['tiempoSetup', 'prepSlicing', 'tiempo_setup', 'prep_slicing']);
      let postValue = getFirstNonZero(dRec, ['postProcesado', 'tiempoPostProcesado', 'tiempo_post_procesado', 'post_procesado']);
      let tasaValue = getFirstNonZero(dRec, ['tasaFallo', 'tasaFalloGlobal', 'tasa_fallo_global', 'tasa_fallo']);
      let margenValue = getFirstNonZero(dRec, ['margenGanancia', 'margen_ganancia']);

      if (parsedProductoId) {
        const linkedProd = this.productosList.find(p => p.id == parsedProductoId);
        if (linkedProd) {
          const pRec = linkedProd as unknown as Record<string, unknown>;
          if (setupValue === 0) setupValue = getFirstNonZero(pRec, ['prepSlicing', 'tiempoSetup', 'prep_slicing', 'tiempo_setup']) || Number(linkedProd.prepSlicing) || 0;
          if (postValue === 0) postValue = getFirstNonZero(pRec, ['postProcesado', 'tiempoPostProcesado', 'post_procesado', 'tiempo_post_procesado']) || Number(linkedProd.postProcesado) || 0;
          if (tasaValue === 0) tasaValue = getFirstNonZero(pRec, ['tasaFallo', 'tasaFalloGlobal', 'tasa_fallo_global', 'tasa_fallo']) || Number(linkedProd.tasaFallo) || 0;
          if (margenValue === 0) margenValue = getFirstNonZero(pRec, ['margenGanancia', 'margen_ganancia']) || Number(linkedProd.margenGanancia) || this.minMargenGanancia;
        }
      }
      if (margenValue === 0) margenValue = this.minMargenGanancia;

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
        margenGanancia: margenValue
      }, { emitEvent: false });

      this.id = Number((data as Record<string, unknown>)['id']) || 0;
      this.piezas = this.resolvePiezasDisplay(((data as Record<string, unknown>)['piezas'] as Parts[]) || []);
      this.f['nombre'].setValue(`PIEZA ${this.piezas.length + 1}`);
      this.actualizarCostoMaquina();
      this.actualizarMinMargenGanancia();
      this.actualizarItemsFiltrados();
      this.cdr.detectChanges();
      setTimeout(() => this.cdr.detectChanges(), 50);
    }
  }

  resolvePiezasDisplay(piezasList: Parts[]): Parts[] {
    if (!piezasList || !Array.isArray(piezasList)) return [];

    return piezasList.map(p => {
      const pObj = p as unknown as Record<string, unknown>;
      
      const maqId = p.maquina ?? pObj['maquina_id'] ?? pObj['maquina'];
      if (maqId) {
        p.maquina = Number(maqId);
        const foundMaq = this.maquinasList.find(m => m.id == maqId);
        if (foundMaq) {
          p.maquinaNombre = foundMaq.nombre;
        }
      }

      const actId = p.activo ?? pObj['activo_id'] ?? pObj['activo'] ?? pObj['material_id'] ?? pObj['materialId'];
      if (actId) {
        p.activo = Number(actId);
        const foundCirc = this.activosCirculantes.find(a => a.id == actId);
        const foundMob = this.assetsMobiliario.find(a => a.id == actId);
        const assetObj = foundCirc || foundMob;
        if (assetObj) {
          p.materialDisplayName = assetObj.nombre;
        }
      }

      if (!p.materialDisplayName || p.materialDisplayName === 'Sin material') {
        if (p.materialTipo && p.materialTipo !== 'Sin material') {
          p.materialDisplayName = p.materialTipo;
        } else if (p.tipo === 'Del Inventario') {
          p.materialDisplayName = p.nombre;
        }
      }

      return { ...p, fromDb: true };
    });
  }

  myFormValues() {
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
    ).subscribe((clasif) => {
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
    ).subscribe((categoria) => {
      this.onCategoriaChange(categoria);
    });

    this.form.get('piezaMaterialSubcategoria')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((subcategoria) => {
      this.onSubcategoriaChange(subcategoria);
    });

    this.form.get('piezaMaterialId')?.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((materialId) => {
      this.onMaterialChange(materialId);
    });
  }

  filterMaterials(event: Event) {
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

  onCategoriaChange(categoria: string) {
    if (categoria) {
      this.materialesPorCategoria = this.activosMateriales.filter(
        a => a.categoria === categoria
      );
      this.materialesFiltrados = [...this.materialesPorCategoria];
      
      this.subcategoriasMaterial = [...new Set(
        this.materialesPorCategoria.map(a => a.subCategoria || ((a as unknown as Record<string, unknown>)['subcategoria'] as string) || ((a as unknown as Record<string, unknown>)['Subcategoria'] as string) || ((a as unknown as Record<string, unknown>)['SUBCATEGORIA'] as string)).filter(Boolean)
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

  onSubcategoriaChange(subcategoria: string) {
    if (subcategoria) {
      const subLower = subcategoria.toLowerCase().trim();
      this.materialesFiltrados = this.materialesPorCategoria.filter(a => {
        const itemSub = (a.subCategoria || (a as unknown as Record<string, string>)['subcategoria'] || (a as unknown as Record<string, string>)['Subcategoria'] || '').toLowerCase().trim();
        return itemSub === subLower;
      });
    } else {
      this.materialesFiltrados = [...this.materialesPorCategoria];
    }
    this.form.get('piezaMaterialId')?.setValue(null, { emitEvent: false });
    this.form.get('piezaPrecioMaterial')?.setValue('');
  }

  onMaterialChange(materialId: number) {
    if (materialId) {
      const selectedAsset = this.activosMateriales.find(a => a.id == materialId) || this.activosCirculantes.find(a => a.id == materialId);
      if (selectedAsset) {
        const valUnit = Number(selectedAsset.valorUnitario) || Number(selectedAsset.costoInicial) || 0;
        const uMedida = (selectedAsset.unidadMedida || '').toLowerCase().trim();
        
        let precioPorGramo: number;
        if (uMedida === 'gramos' || uMedida === 'gramo') {
          precioPorGramo = valUnit;
        } else {
          // Si el activo es Kilos, Bobinas, Rollos, Litros o tiene precio de compra de bobina completa
          precioPorGramo = valUnit > 0 ? (valUnit / 1000) : 0;
        }
        
        // Redondear a 4 decimales
        const rounded = Math.round(precioPorGramo * 10000) / 10000;
        this.form.get('piezaPrecioMaterial')?.setValue(rounded);
      }
    } else {
      this.form.get('piezaPrecioMaterial')?.setValue('');
    }
  }

  onSubmit() {
    this.submitted = true;
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      Swal.fire('Error', 'Complete los datos obligatorios del presupuesto.', 'error');
      return;
    }

    this.loading = true;

    const prodVal = this.f['productoId']?.value;
    const cliVal = this.f['clienteId']?.value;

    const parsedProdId = prodVal !== null && prodVal !== undefined && prodVal !== '' ? Number(prodVal) : undefined;
    const parsedCliId = cliVal !== null && cliVal !== undefined && cliVal !== '' ? Number(cliVal) : undefined;

    const clienteTexto = String(this.f['clienteNombreTexto']?.value || '').trim();

    const mappedPiezas = this.piezas.map((p, idx) => {
      const pObj = p as unknown as Record<string, unknown>;
      const actId = p.activo ?? pObj['activo_id'] ?? pObj['assetId'] ?? pObj['materialId'];
      const maqId = p.maquina ?? pObj['maquina_id'] ?? pObj['maquinaId'];
      const prodId = p.producto ?? pObj['producto_id'] ?? pObj['productoId'] ?? parsedProdId;
      const pieceObj: Record<string, unknown> = {
        nombre: String(p.nombre || `PIEZA ${idx + 1}`).trim(),
        gramos: Number(p.gramos) || 0,
        metros: Number(p.metros) || 0,
        horas: Number(p.horas) || 0,
        minutos: Number(p.minutos) || 0,
        precioMaterial: Number(p.precioMaterial ?? pObj['precio_material']) || 0,
        tipo: String(p.tipo || 'Producción').trim(),
        cantidad: Number(p.cantidad) || 1,
        producto: prodId ? Number(prodId) : null,
        activo: actId ? Number(actId) : null,
        maquina: maqId ? Number(maqId) : null
      };

      if (pObj['fromDb'] && p.id && Number(p.id) > 0) {
        pieceObj['id'] = Number(p.id);
      }

      return pieceObj;
    });

    const rawNum = String(this.f['numero']?.value || '').trim();
    const clasifCode = String(this.f['clasificacion']?.value || 'GEN').substring(0, 3).toUpperCase();
    const isProducto = this.f['clasificacion']?.value === 'Producto';
    const finalNumero = (isProducto || !rawNum) ? 'x' : rawNum;

    const executeSubmit = (effectiveCliId?: number) => {
      const totales = this.getTotales();
      const budgetPayload: Record<string, unknown> = {
        id: this.id > 0 ? this.id : 0,
        sku: this.id > 0 ? (finalNumero || `P-${this.id}`) : `B-${clasifCode}-${Math.floor(Math.random() * 900) + 100}`,
        clasificacion: this.f['clasificacion'].value || 'General',
        descripcion: this.f['descripcion'].value,
        numero: finalNumero,
        fecha: this.f['fecha'].value,
        costoOperador: Number(this.f['costoOperador']?.value) || 0,
        costoMaquina: Number(this.f['costoMaquina']?.value) || 0,
        tasaFalloGlobal: Number(this.f['tasaFalloGlobal']?.value) || 0,
        tiempoSetup: Number(this.f['tiempoSetup']?.value) || 0,
        margenGanancia: Number(this.f['margenGanancia']?.value) || 0,
        tiempoPostProcesado: Number(this.f['tiempoPostProcesado']?.value) || 0,
        cantidadGlobal: Number(this.f['cantidadGlobal']?.value) || 1,
        delivery: Number(this.f['delivery']?.value) || 0,
        cliente: effectiveCliId ?? parsedCliId,
        clienteNombre: clienteTexto || undefined,
        nombreCliente: clienteTexto || undefined,
        cliente_nombre: clienteTexto || undefined,
        clienteDetalle: this.isCreandoClienteNuevo ? { ...this.tempClienteData } : undefined,
        cliente_detalle: this.isCreandoClienteNuevo ? { ...this.tempClienteData } : undefined,
        rifCedula: this.isCreandoClienteNuevo ? this.tempClienteData.rifCedula : undefined,
        rif_cedula: this.isCreandoClienteNuevo ? this.tempClienteData.rifCedula : undefined,
        telefono: this.isCreandoClienteNuevo ? this.tempClienteData.telefono : undefined,
        email: this.isCreandoClienteNuevo ? this.tempClienteData.email : undefined,
        direccion: this.isCreandoClienteNuevo ? this.tempClienteData.direccion : undefined,
        clienteCategoria: this.isCreandoClienteNuevo ? this.tempClienteData.categoria : undefined,
        producto: parsedProdId,
        piezas: mappedPiezas,
        total: totales.costoTotalFinal
      };

      console.log('>>> PAYLOAD DE PRESUPUESTO A ENVIAR AL SERVIDOR:', JSON.stringify(budgetPayload, null, 2));

      const budget = budgetPayload as unknown as Budget;

      const request = this.id === 0
        ? this.budgetService.createBudget(budget)
        : this.budgetService.updateBudget(this.id, budget);

      request.subscribe({
        next: () => {
          this.loading = false;
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
        rifCedula: this.tempClienteData.rifCedula,
        cedula: this.tempClienteData.rifCedula,
        rif_cedula: this.tempClienteData.rifCedula,
        categoria: this.tempClienteData.categoria,
        telefono: this.tempClienteData.telefono,
        email: this.tempClienteData.email,
        direccion: this.tempClienteData.direccion
      };

      this.clientService.createClient(newClientPayload as unknown as import('../../../../../core/models/Cost/client').Client).subscribe({
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
}
