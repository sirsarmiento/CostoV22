import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
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
  assetsMobiliario: Asset[] = [];
  productosList: Product[] = [];
  filteredItemsList: Product[] = [];
  clientesList: { id: number; nombre: string }[] = [];
  materialesPorCategoria: Asset[] = [];
  materialesFiltrados: Asset[] = [];

  categoriasMaterial: string[] = [];
  subcategoriasMaterial: string[] = [];

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
      
      // Activos (Máquinas, Mobiliario y Circulantes)
      this.maquinasList = data.assets.filter(asset => 
        asset.tipo?.toLowerCase().trim() === 'fijo' && 
        asset.categoria?.toLowerCase().trim() === 'equipo'
      );
      this.assetsMobiliario = data.assets.filter(asset => 
        asset.categoria?.toLowerCase().trim() === 'mobiliario'
      );
      this.activosCirculantes = data.assets.filter(asset => 
        asset.tipo?.toLowerCase().trim() === 'circulante' ||
        asset.tipo?.toLowerCase().trim() === 'herramienta' ||
        asset.tipo === ''
      );
      this.categoriasMaterial = [...new Set(
        this.activosCirculantes.map(a => a.categoria).filter((c): c is string => !!c)
      )];
      
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
        const vidaUtil = Number(machine.vidaUtil) > 0 ? Number(machine.vidaUtil) : 1;
        this.tasaDepreciacionMaquina = (costoInicial - valorResidual) / vidaUtil;
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
    let assetId: number | null;
    let gramos = 0;
    let horas = 0;
    let minutos = 0;
    let precioMaterial = 0;
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
      nombre = this.assetsMobiliario.find(a => a.id == asset)?.nombre || 'Activo';
      assetId = Number(asset);
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
      assetId = Number(matId);
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
      assetId: assetId || undefined,
      materialTipo: materialDisplayName || 'Sin material',
      materialDisplayName: materialDisplayName,
      precioMaterial: precioMaterial,
      gramos: gramos,
      horas: horas,
      minutos: minutos,
      maquinaId: maquinaId,
      maquinaNombre: maquinaNombre
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
      this.form.patchValue({
        descripcion: product.descripcion || product.nombre,
        tasaFalloGlobal: product.tasaFallo || 0,
        tiempoSetup: product.prepSlicing || 0,
        tiempoPostProcesado: product.postProcesado || 0,
        margenGanancia: product.margenGanancia || this.minMargenGanancia
      });

      if (product.piezasBase && Array.isArray(product.piezasBase) && product.piezasBase.length > 0) {
        this.piezas = product.piezasBase.map((pb: Record<string, unknown>, index: number) => {
          return {
            id: index + 1,
            tipo: (pb['tipo'] as string) || 'Fabricada',
            nombre: (pb['nombre'] as string) || `PIEZA ${index + 1}`,
            cantidad: Number(pb['cantidad']) || 1,
            assetId: Number(pb['assetId']) || undefined,
            materialTipo: (pb['materialDisplayName'] as string) || 'Sin material',
            materialDisplayName: (pb['materialDisplayName'] as string) || '',
            precioMaterial: Number(pb['precioMaterial']) || 0,
            gramos: Number(pb['gramos']) || 0,
            horas: Number(pb['horas']) || 0,
            minutos: Number(pb['minutos']) || 0,
            maquinaId: Number(pb['maquinaId']) || undefined,
            maquinaNombre: (pb['maquinaNombre'] as string) || (pb['maquina'] as string) || undefined
          };
        });
        this.piezaCounter = this.piezas.length + 1;
      }
      this.cdr.detectChanges();
    }
  }

  getTotales() {
    let rawMaterialCost = 0;
    let totalCostoInventario = 0;
    let totalTiempoHoras = 0;

    const costoMaquinaRate = Number(this.form?.get('costoMaquina')?.value) || 0;

    this.piezas.forEach(pieza => {
      const cant = Number(pieza.cantidad) || 1;
      if (pieza.tipo === 'Del Inventario') {
        const foundCirc = this.activosCirculantes.find(a => a.id == pieza.assetId);
        const foundMob = this.assetsMobiliario.find(a => a.id == pieza.assetId);
        const asset = foundCirc || foundMob;
        if (asset) {
          const val = Number(asset.valorUnitario) || Number(asset.costoInicial) || 0;
          totalCostoInventario += val * cant;
        } else {
          totalCostoInventario += (Number(pieza.precioMaterial) || 0) * cant;
        }
      } else {
        rawMaterialCost += ((Number(pieza.gramos) || 0) * (Number(pieza.precioMaterial) || 0)) * cant;
        const tiempoPieza = (Number(pieza.horas) || 0) + ((Number(pieza.minutos) || 0) / 60);
        totalTiempoHoras += (tiempoPieza * cant);
      }
    });

    const tasaFallo = Number(this.form?.get('tasaFalloGlobal')?.value) || 0;
    const totalCostoMaterial = rawMaterialCost * (1 + (tasaFallo / 100));

    // Incluir tiempo extra de setup y post-procesado al tiempo de máquina
    const tiempoExtraHoras = ((Number(this.form?.get('tiempoSetup')?.value) || 0) + (Number(this.form?.get('tiempoPostProcesado')?.value) || 0)) / 60;
    totalTiempoHoras += tiempoExtraHoras;

    const totalCostoMaquina = costoMaquinaRate * totalTiempoHoras;

    const costoIndirectoAsignado = this.tasaCIF * totalTiempoHoras;
    const depreciacionAsignada = this.tasaDepreciacionMaquina * totalTiempoHoras;
    const costoTotalUnitarioBase = totalCostoMaterial + totalCostoMaquina + costoIndirectoAsignado + depreciacionAsignada + totalCostoInventario;

    const margen = Number(this.form?.get('margenGanancia')?.value) || 0;
    const factorGanancia = margen < 1 ? margen : margen / 100;
    const precioSugeridoUnitario = factorGanancia >= 1
      ? costoTotalUnitarioBase / 0.0001
      : costoTotalUnitarioBase / (1 - factorGanancia);

    const cantidadGlobal = Number(this.form?.get('cantidadGlobal')?.value) || 1;
    const delivery = Number(this.form?.get('delivery')?.value) || 0;
    const costoTotalFinal = (precioSugeridoUnitario * cantidadGlobal) + delivery;

    const totalGramos = this.piezas.reduce((sum, pieza) => sum + ((Number(pieza.gramos) || 0) * (Number(pieza.cantidad) || 1)), 0);
    const totalHoras = Math.floor(totalTiempoHoras);
    const totalMinutos = Math.round((totalTiempoHoras - totalHoras) * 60);

    return {
      totalGramos,
      totalHoras,
      totalMinutos,
      totalCostoMaterial,
      totalCostoMaquina,
      costoIndirectoAsignado,
      depreciacionAsignada,
      totalCostoInventario,
      costoTotalUnitarioBase,
      precioSugeridoUnitario,
      cantidadGlobal,
      delivery,
      costoTotalFinal
    };
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

      this.form.patchValue({
        clasificacion: (data as Record<string, unknown>)['clasificacion'],
        productoId: parsedProductoId,
        descripcion: (data as Record<string, unknown>)['descripcion'],
        numero: (data as Record<string, unknown>)['numero'],
        fecha: dateStr,
        activoId: parsedActivoId,
        cantidadGlobal: (data as Record<string, unknown>)['cantidadGlobal'] || 1,
        delivery: (data as Record<string, unknown>)['delivery'] || 0,
        clienteId: parsedClienteId,
        tasaFalloGlobal: (data as Record<string, unknown>)['tasaFalloGlobal'] || 0,
        tiempoSetup: (data as Record<string, unknown>)['tiempoSetup'] || 0,
        tiempoPostProcesado: (data as Record<string, unknown>)['tiempoPostProcesado'] || 0,
        margenGanancia: (data as Record<string, unknown>)['margenGanancia'] !== undefined ? (data as Record<string, unknown>)['margenGanancia'] : this.minMargenGanancia
      });

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
      
      const maqId = p.maquinaId ?? pObj['maquina_id'] ?? pObj['maquina'];
      if (maqId) {
        p.maquinaId = Number(maqId);
        const foundMaq = this.maquinasList.find(m => m.id == maqId);
        if (foundMaq) {
          p.maquinaNombre = foundMaq.nombre;
        }
      }

      const actId = p.assetId ?? pObj['activo_id'] ?? pObj['activo'] ?? pObj['material_id'] ?? pObj['materialId'];
      if (actId) {
        p.assetId = Number(actId);
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

      return p;
    });
  }

  myFormValues() {
    this.form = this.formBuilder.group({
      clasificacion: ['', Validators.required],
      productoId: [''],
      descripcion: ['', Validators.required],
      numero: [''],
      fecha: ['', Validators.required],
      cantidadGlobal: [1, [Validators.required, Validators.min(1)]],
      delivery: [0, [Validators.min(0)]],
      clienteId: [null],

      nombre: [`PIEZA ${this.piezaCounter}`],
      piezaTipo: ['Del Inventario'],
      piezaInventario: [''],
      piezaFabricada: [''],
      piezaCantidad: [1],
      materialTipo: [''],
      subcategoria: [''],
      piezaMaterialCategoria: [''],
      piezaMaterialSubcategoria: [''],
      piezaMaterialId: [{ value: null, disabled: true }],
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

    this.form.get('clasificacion')?.valueChanges.subscribe((clasif) => {
      const numeroControl = this.form.get('numero');
      if (clasif === 'Producto') {
        numeroControl?.clearValidators();
        numeroControl?.setValue('');
      } else {
        numeroControl?.setValidators([Validators.required]);
      }
      numeroControl?.updateValueAndValidity();
      this.actualizarItemsFiltrados();
    });

    this.form.get('productoId')?.valueChanges.subscribe(prodId => {
      if (prodId) {
        this.autoFillFromProduct(Number(prodId));
      }
    });

    this.form.get('activoId')?.valueChanges.subscribe(() => {
      this.actualizarCostoMaquina();
      this.actualizarMinMargenGanancia();
    });

    this.form.get('piezaMaterialCategoria')?.valueChanges.subscribe((categoria) => {
      this.onCategoriaChange(categoria);
    });

    this.form.get('piezaMaterialSubcategoria')?.valueChanges.subscribe((subcategoria) => {
      this.onSubcategoriaChange(subcategoria);
    });

    this.form.get('piezaMaterialId')?.valueChanges.subscribe((materialId) => {
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
      this.materialesPorCategoria = this.activosCirculantes.filter(
        a => a.categoria === categoria
      );
      this.materialesFiltrados = [...this.materialesPorCategoria];
      
      this.subcategoriasMaterial = [...new Set(
        this.materialesPorCategoria.map(a => a.subcategoria || ((a as unknown as Record<string, unknown>)['subCategoria'] as string) || ((a as unknown as Record<string, unknown>)['Subcategoria'] as string) || ((a as unknown as Record<string, unknown>)['SUBCATEGORIA'] as string)).filter(Boolean)
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
      this.materialesFiltrados = this.materialesPorCategoria.filter(
        a => (a.subcategoria || ((a as unknown as Record<string, unknown>)['subCategoria'] as string) || ((a as unknown as Record<string, unknown>)['Subcategoria'] as string) || ((a as unknown as Record<string, unknown>)['SUBCATEGORIA'] as string)) === subcategoria
      );
    } else {
      this.materialesFiltrados = [...this.materialesPorCategoria];
    }
    this.form.get('piezaMaterialId')?.setValue(null, { emitEvent: false });
    this.form.get('piezaPrecioMaterial')?.setValue('');
  }

  onMaterialChange(materialId: number) {
    if (materialId) {
      const selectedAsset = this.activosCirculantes.find(a => a.id == materialId);
      if (selectedAsset) {
        const valUnit = Number(selectedAsset.valorUnitario) || 0;
        const uMedida = selectedAsset.unidadMedida?.toLowerCase().trim() || '';
        
        let precioPorGramo = valUnit;
        if (uMedida === 'kilos' || uMedida === 'kilo') {
          precioPorGramo = valUnit / 1000;
        } else if (uMedida === 'gramos' || uMedida === 'gramo') {
          precioPorGramo = valUnit;
        }
        this.form.get('piezaPrecioMaterial')?.setValue(precioPorGramo);
      }
    } else {
      this.form.get('piezaPrecioMaterial')?.setValue('');
    }
  }

  onSubmit() {
    this.submitted = true;

    if (this.f['clasificacion'].value === 'Producto' && !this.f['productoId']?.value) {
      this.f['productoId']?.setErrors({ required: true });
    }

    if (this.form.invalid) {
      Swal.fire('Error', 'Complete los datos obligatorios del presupuesto.', 'error');
      return;
    }

    this.loading = true;

    const prodVal = this.f['productoId']?.value;
    const cliVal = this.f['clienteId']?.value;
    const actVal = this.f['activoId']?.value;

    const parsedProdId = prodVal !== null && prodVal !== undefined && prodVal !== '' ? Number(prodVal) : undefined;
    const parsedCliId = cliVal !== null && cliVal !== undefined && cliVal !== '' ? Number(cliVal) : undefined;
    const parsedActId = actVal !== null && actVal !== undefined && actVal !== '' ? Number(actVal) : undefined;

    const budget: Budget = {
      id: this.id > 0 ? this.id : 0,
      sku: this.id > 0 ? this.f['numero'].value : `B-${(this.f['clasificacion'].value || 'GEN').substring(0, 3).toUpperCase()}-${Math.floor(Math.random() * 900) + 100}`,
      clasificacion: this.f['clasificacion'].value,
      descripcion: this.f['descripcion'].value,
      numero: this.f['numero'].value || `ORD-${Date.now()}`,
      fecha: new Date(this.f['fecha'].value),
      piezas: this.piezas,
      productoId: parsedProdId,
      activoId: parsedActId,
      cantidadGlobal: Number(this.f['cantidadGlobal'].value) || 1,
      delivery: Number(this.f['delivery'].value) || 0,
      clienteId: parsedCliId,
      tasaFalloGlobal: Number(this.f['tasaFalloGlobal'].value) || 0,
      tiempoSetup: Number(this.f['tiempoSetup'].value) || 0,
      tiempoPostProcesado: Number(this.f['tiempoPostProcesado'].value) || 0,
      margenGanancia: Number(this.f['margenGanancia'].value) || 0,
      costoMaquina: Number(this.f['costoMaquina'].value) || 0,
      costoOperador: 0
    };

    (budget as unknown as Record<string, unknown>)['producto_id'] = parsedProdId ?? null;
    (budget as unknown as Record<string, unknown>)['cliente_id'] = parsedCliId ?? null;
    (budget as unknown as Record<string, unknown>)['activo_id'] = parsedActId ?? null;

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
  }
}
