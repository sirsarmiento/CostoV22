import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { Budget, Parts } from '../../../../../core/models/Cost/budge';
import { Asset } from '../../../../../core/models/Cost/asset';
import { Product } from '../../../../../core/models/Cost/product';
import { BudgetService } from '../../../../../core/services/cost/budget.service';
import { ConfigService } from '../../../../../core/services/cost/config.service';
import { ProductService } from '../../../../../core/services/cost/product.service';
import { AssetService } from '../../../../../core/services/cost/asset.service';
import { FixeService } from '../../../../../core/services/cost/fixe.service';
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
  form!: FormGroup;
  id: number = 0;
  loading = false;
  submitted = false;
  
  piezas: Parts[] = [];
  piezaCounter = 1;
  minMargenGanancia = 0;

  totalFijoIndirecto = 0;
  totalDepreciacionMensual = 0;
  costoIndirectoProrrateado = 0;
  depreciacionProrrateada = 0;

  maquinasList: Asset[] = [];
  activosCirculantes: Asset[] = [];
  productosList: Product[] = [];
  materialesPorCategoria: Asset[] = [];
  materialesFiltrados: Asset[] = [];

  categoriasMaterial: string[] = [];
  subcategoriasMaterial: string[] = [];

  constructor() {
    this.myFormValues();
  }

  get f() { return this.form.controls; }

  ngOnInit() {
    forkJoin({
      configs: this.configService.getConfigs(),
      products: this.productService.getProducts(),
      assets: this.assetService.getAssets(),
      fixes: this.fixeService.getFixes()
    }).subscribe(data => {
      // Configuración global
      if (data.configs.length > 0) {
        this.actualizarMinMargenGanancia(data.configs[0].margenGanancia || 0);
      }
      
      // Productos
      this.productosList = data.products;
      
      // Activos (Máquinas y Circulantes)
      this.maquinasList = data.assets.filter(asset => 
        asset.tipo?.toLowerCase().trim() === 'fijo' && 
        asset.categoria?.toLowerCase().trim() === 'maquinaria'
      );
      this.activosCirculantes = data.assets.filter(asset => 
        asset.tipo?.toLowerCase().trim() === 'herramienta' || 
        asset.tipo?.toLowerCase().trim() === 'circulante' ||
        asset.tipo === ''
      );
      this.categoriasMaterial = [...new Set(
        this.activosCirculantes.map(a => a.categoria).filter((c): c is string => !!c)
      )];
      
      this.actualizarCostoMaquina();
      this.actualizarMinMargenGanancia();
      
      // Costos y Depreciación
      this.totalDepreciacionMensual = data.assets.reduce((sum, asset) => {
        const costo = parseFloat(String(asset.costoInicial)) || 0;
        const residual = parseFloat(String(asset.valorResidual)) || 0;
        const vida = parseInt(String(asset.vidaUtil)) || 0;
        return vida > 0 ? sum + ((costo - residual) / vida / 12) : sum;
      }, 0);
      
      const indirectos = data.fixes.filter(item => item.clasificacion === 'Indirecto');
      this.totalFijoIndirecto = indirectos.reduce((total, item) => total + (Number(item.precio) || 0), 0);
      
      this.actualizarIndirectoProrrateado();
      
      // Inicializar formulario con datos de edición si existen
      this.setValues();
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
        return;
      }
    }
    this.form.get('costoMaquina')?.setValue(0);
  }

  actualizarMinMargenGanancia(minMarginValue?: number) {
    if (minMarginValue !== undefined) {
      this.minMargenGanancia = minMarginValue;
    }

    const control = this.form.get('margenGanancia');
    if (control) {
      control.setValidators([Validators.required, Validators.min(this.minMargenGanancia), Validators.max(100)]);
      control.updateValueAndValidity();
      
      if (!this.id || control.value < this.minMargenGanancia) {
        control.setValue(this.minMargenGanancia);
      }
    }
  }

  actualizarIndirectoProrrateado() {
    const numProductos = this.productosList.length || 1;
    this.costoIndirectoProrrateado = this.totalFijoIndirecto / numProductos;
    this.depreciacionProrrateada = this.totalDepreciacionMensual / numProductos;
  }

  addPart() {
    const requiredFields = [
      { field: this.f['nombre'], message: 'el nombre de la pieza' },
      { field: this.f['materialTipo'], message: 'la categoría de material' },
      { field: this.form.get('materialId'), message: 'el material (activo circulante)' },
      { field: this.f['precioMaterial'], message: 'el costo de material por gramo' },
      { field: this.f['gramos'], message: 'los gramos' },
      { field: this.f['metros'], message: 'los metros' },
      { field: this.f['horas'], message: 'las horas' },
      { field: this.f['minutos'], message: 'los minutos' }
    ];

    for (const { field, message } of requiredFields) {
      if (!field || field.value === null || field.value === undefined || field.value === '' || field.value.toString().trim() === '') {
        Swal.fire('Por Favor', `Debe agregar ${message}`, 'info');
        return;
      }
    }
    
    const nombre = this.f['nombre'].value.toString().trim();
    const exists = this.piezas.some(part => (part.nombre || '').toLowerCase() === nombre.toLowerCase());

    if (exists) {
      Swal.fire('', 'Esta pieza ya fue agregada', 'info');
      return;
    }

    this.onAddPart();
  }

  onAddPart() {
    const materialId = this.form.get('materialId')?.value;
    let materialDisplayName = this.f['materialTipo'].value;
    
    if (materialId) {
      const asset = this.activosCirculantes.find(a => a.id == materialId);
      if (asset) {
        materialDisplayName = asset.nombre;
      }
    }

    const newParts = {
      id: this.generateUniqueId(),
      nombre: this.f['nombre'].value.toString().trim().toUpperCase(),
      materialTipo: materialDisplayName,
      precioMaterial: Number(this.f['precioMaterial'].value) || 0,
      gramos: Number(this.f['gramos'].value) || 0,
      metros: Number(this.f['metros'].value) || 0, 
      horas: Number(this.f['horas'].value) || 0,
      minutos: Number(this.f['minutos'].value) || 0
    };

    this.piezaCounter++;
    this.piezas.push(newParts);
    this.clearForm();
  }

  getTotales() {
    const totalGramos = this.piezas.reduce((sum, pieza) => sum + (+pieza.gramos || 0), 0);
    const totalMetros = this.piezas.reduce((sum, pieza) => sum + (+pieza.metros || 0), 0);
    const totalHoras = this.piezas.reduce((sum, pieza) => sum + (+pieza.horas || 0), 0);
    const totalMinutos = this.piezas.reduce((sum, pieza) => sum + (+pieza.minutos || 0), 0);

    const tasaFallo = Number(this.form?.get('tasaFalloGlobal')?.value) || 0;
    const rawMaterialCost = this.piezas.reduce((sum, pieza) => sum + ((+pieza.gramos || 0) * (Number(pieza.precioMaterial || 0))), 0);
    const totalCostoMaterial = rawMaterialCost * (1 + (tasaFallo / 100));

    const costoMaquinaRate = Number(this.form?.get('costoMaquina')?.value) || 0;
    const totalTiempoHoras = totalHoras + (totalMinutos / 60);
    const totalCostoMaquina = costoMaquinaRate * totalTiempoHoras;

    const costoIndirectoAsignado = this.costoIndirectoProrrateado;
    const depreciacionAsignada = this.depreciacionProrrateada;
    const costoTotalBase = totalCostoMaterial + totalCostoMaquina + costoIndirectoAsignado + depreciacionAsignada;

    const margen = Number(this.form?.get('margenGanancia')?.value) || 0;
    const factorGanancia = margen < 1 ? margen : margen / 100;
    const precioSugerido = factorGanancia >= 1
      ? costoTotalBase / 0.0001
      : costoTotalBase / (1 - factorGanancia);

    return {
      totalGramos,
      totalMetros,
      totalHoras,
      totalMinutos,
      totalCostoMaterial,
      totalCostoMaquina,
      costoIndirectoAsignado,
      depreciacionAsignada,
      costoTotalBase,
      precioSugerido
    };
  }

  generateUniqueId(): number {
    return this.piezas.length > 0 
      ? Math.max(...this.piezas.map(m => m.id || 0)) + 1 
      : 1;
  }

  clearForm() {
    this.f['nombre'].setValue(`PIEZA ${this.piezaCounter}`);
    this.f['materialTipo'].setValue('');
    this.form.get('subcategoria')?.setValue('');
    this.form.get('materialId')?.setValue(null);
    this.form.get('materialId')?.disable();
    this.f['precioMaterial'].setValue('');
    this.f['gramos'].setValue('');
    this.f['metros'].setValue('');
    this.f['horas'].setValue('');
    this.f['minutos'].setValue('');
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
      }
    });
  }

  setValues() {
    // MOCK - LOCAL STORAGE: Eliminar y reemplazar con servicio real
    const stored = localStorage.getItem('cost_edit_budget');
    if (stored) {
      const data: Budget = JSON.parse(stored);
      if (data && data.id && data.id > 0) {
        let dateStr = '';
        if (data.fecha) {
          const rawDate = new Date(data.fecha);
          if (!isNaN(rawDate.getTime())) {
            dateStr = rawDate.toISOString().substring(0, 10);
          }
        }

        this.form.patchValue({
          clasificacion: data.clasificacion,
          descripcion: data.descripcion,
          numero: data.numero,
          fecha: dateStr,
          activoId: data.activoId,
          tasaFalloGlobal: data.tasaFalloGlobal || 0,
          tiempoSetup: data.tiempoSetup || 0,
          tiempoPostProcesado: data.tiempoPostProcesado || 0,
          margenGanancia: data.margenGanancia !== undefined ? data.margenGanancia : this.minMargenGanancia
        });

        this.id = data.id;
        this.piezas = data.piezas || [];
        this.f['nombre'].setValue(`PIEZA ${this.piezas.length + 1}`);
        this.actualizarCostoMaquina();
        this.actualizarMinMargenGanancia();
      }
    }
  }

  myFormValues() {
    this.form = this.formBuilder.group({
      clasificacion: ['', Validators.required],
      productoId: [''],
      descripcion: ['', Validators.required],
      numero: ['', Validators.required],
      fecha: ['', Validators.required],

      nombre: [`PIEZA ${this.piezaCounter}`],
      materialTipo: [''],
      subcategoria: [''],
      materialId: [{ value: null, disabled: true }],
      precioMaterial: [''],
      gramos: [],
      metros: [],
      horas: [],
      minutos: [],

      activoId: [null],
      tasaFalloGlobal: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
      tiempoSetup: [0, [Validators.required, Validators.min(0)]],
      tiempoPostProcesado: [0, [Validators.required, Validators.min(0)]],
      margenGanancia: [0, [Validators.required, Validators.min(this.minMargenGanancia), Validators.max(100)]],
      costoMaquina: [0]
    });

    this.form.get('activoId')?.valueChanges.subscribe(() => {
      this.actualizarCostoMaquina();
      this.actualizarMinMargenGanancia();
    });

    this.form.get('materialTipo')?.valueChanges.subscribe((categoria) => {
      this.onCategoriaChange(categoria);
    });

    this.form.get('subcategoria')?.valueChanges.subscribe((subcategoria) => {
      this.onSubcategoriaChange(subcategoria);
    });

    this.form.get('materialId')?.valueChanges.subscribe((materialId) => {
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
        this.materialesPorCategoria.map(a => a.subcategoria).filter(Boolean)
      )] as string[];

      this.form.get('materialId')?.enable();
    } else {
      this.materialesPorCategoria = [];
      this.materialesFiltrados = [];
      this.subcategoriasMaterial = [];
      this.form.get('materialId')?.disable();
    }
    this.form.get('materialId')?.setValue(null, { emitEvent: false });
    this.form.get('precioMaterial')?.setValue('');
    this.form.get('subcategoria')?.setValue('', { emitEvent: false });
  }

  onSubcategoriaChange(subcategoria: string) {
    if (subcategoria) {
      this.materialesFiltrados = this.materialesPorCategoria.filter(
        a => a.subcategoria === subcategoria
      );
    } else {
      this.materialesFiltrados = [...this.materialesPorCategoria];
    }
    this.form.get('materialId')?.setValue(null, { emitEvent: false });
    this.form.get('precioMaterial')?.setValue('');
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
        this.form.get('precioMaterial')?.setValue(precioPorGramo);
      }
    } else {
      this.form.get('precioMaterial')?.setValue('');
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

    const budget: Budget = {
      id: this.id > 0 ? this.id : 0,
      sku: this.id > 0 ? this.f['numero'].value : `B-${this.f['clasificacion'].value.substring(0, 3).toUpperCase()}-${Math.floor(Math.random() * 900) + 100}`,
      clasificacion: this.f['clasificacion'].value,
      descripcion: this.f['descripcion'].value,
      numero: this.f['numero'].value,
      fecha: new Date(this.f['fecha'].value),
      piezas: this.piezas,
      productoId: this.f['clasificacion'].value === 'Producto' ? Number(this.f['productoId'].value) : undefined,
      activoId: Number(this.f['activoId'].value) || undefined,
      tasaFalloGlobal: Number(this.f['tasaFalloGlobal'].value) || 0,
      tiempoSetup: Number(this.f['tiempoSetup'].value) || 0,
      tiempoPostProcesado: Number(this.f['tiempoPostProcesado'].value) || 0,
      margenGanancia: Number(this.f['margenGanancia'].value) || 0,
      costoMaquina: Number(this.f['costoMaquina'].value) || 0,
      costoOperador: 0
    };

    const request = this.id === 0
      ? this.budgetService.createBudget(budget)
      : this.budgetService.updateBudget(this.id, budget);

    request.subscribe({
      next: () => {
        localStorage.removeItem('cost_edit_budget');
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
