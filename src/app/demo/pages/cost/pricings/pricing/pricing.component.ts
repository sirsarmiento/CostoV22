import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { Fixe } from '../../../../../core/models/Cost/fixe';
import { Product } from '../../../../../core/models/Cost/product';
import { Asset } from '../../../../../core/models/Cost/asset';
import { forkJoin } from 'rxjs';
import { ConfigService } from '../../../../../core/services/cost/config.service';
import { ProductService } from '../../../../../core/services/cost/product.service';
import { AssetService } from '../../../../../core/services/cost/asset.service';
import { FixeService } from '../../../../../core/services/cost/fixe.service';
import Swal from 'sweetalert2';


@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NgSelectModule],
  templateUrl: './pricing.component.html'
})
export class PricingComponent implements OnInit {
  // MOCK - LOCAL STORAGE: Eliminar y reemplazar con servicio real
  productos: Product[] = [];
  allFixes: Fixe[] = [];
  costosFijosTotales = 0;

  // Calculadora de Precio (Izquierda)
  idProdPrecio: number | null = null;
  costoUnitarioPrecio = 0;
  minMargenGanancia = 0;
  margenDeseado = 0; // Se actualizará al cargar la configuración
  precioSugerido = 0;
  
  totalDirectoPrecio = 0;
  indirectoProrrateadoPrecio = 0;
  capacidadHorasMaquina = 160;
  tasaHorariaMaquina = 0;
  horasTotalesProducto = 0;

  // Punto de Equilibrio (Derecha)
  idProdEquilibrio: number | null = null;
  precioVentaManual = 0;
  costoVariableProd = 0;
  unidadesEquilibrio = 0;
  totalFijoIndirecto = 0;
  totalDepreciacionMensual = 0;

  costoFijoDirectoProd = 0;
  fijosIndirectosProrrateados = 0;
  costosFijosTotalesParaProd = 0;

  private configService = inject(ConfigService);
  private productService = inject(ProductService);
  private assetService = inject(AssetService);
  private fixeService = inject(FixeService);
  private cdr = inject(ChangeDetectorRef);

  constructor() { }

  ngOnInit(): void {
    this.cargarDatosIniciales();
  }

  cargarDatosIniciales() {
    forkJoin({
      configs: this.configService.getConfigs(),
      products: this.productService.getProducts(),
      assets: this.assetService.getAssets(),
      fixes: this.fixeService.getFixes()
    }).subscribe({
      next: (data) => {
        let capacidadTotal = 0;
        // Cargar Configuración
        if (data.configs && data.configs.length > 0) {
          const configObj = data.configs[0];
          const configRec = configObj as unknown as Record<string, unknown>;
          this.minMargenGanancia = Number(configRec['margenGanancia'] ?? configRec['minMargenGanancia'] ?? configRec['margen_ganancia']) || 0;
          if (!this.margenDeseado || this.margenDeseado < this.minMargenGanancia) {
            this.margenDeseado = this.minMargenGanancia;
          }

          if (configObj.parametros && Array.isArray(configObj.parametros)) {
            configObj.parametros.forEach((machine) => {
              const unidad = machine.unidad?.toLowerCase().trim() || '';
              if (unidad.includes('hora') || unidad.includes('hs') || unidad === '') {
                capacidadTotal += (Number(machine.horasUso) || 0) * (Number(machine.prodMaxHoras) || 0);
              }
            });
          }
        }

        this.capacidadHorasMaquina = capacidadTotal > 0 ? capacidadTotal : 160;

        this.productos = data.products;
        const activos = data.assets;
        this.allFixes = data.fixes;

        // Calcular Depreciación Mensual de Activos
        this.totalDepreciacionMensual = activos.reduce((sum: number, asset: Asset) => {
          const costo = parseFloat(String(asset.costoInicial)) || 0;
          const residual = parseFloat(String(asset.valorResidual)) || 0;
          const vida = parseInt(String(asset.vidaUtil)) || 0;
          return vida > 0 ? sum + ((costo - residual) / vida / 12) : sum;
        }, 0);

        // Calcular Costos Fijos Indirectos
        const indirectos = this.allFixes.filter(item => item.clasificacion === 'Indirecto');
        this.totalFijoIndirecto = indirectos.reduce((total, item) => total + (Number(item.precio) || 0), 0);

        // Costos Fijos Totales Operativos (Generales)
        this.costosFijosTotales = this.totalFijoIndirecto + this.totalDepreciacionMensual;
        this.tasaHorariaMaquina = this.costosFijosTotales / (this.capacidadHorasMaquina || 160);
        
        const numProductos = this.productos.length || 1;
        this.fijosIndirectosProrrateados = this.costosFijosTotales / numProductos;
        this.costosFijosTotalesParaProd = this.fijosIndirectosProrrateados;

        if (this.idProdPrecio) {
          this.onProductoPrecioChange();
        } else {
          this.calcularPrecioSugerido();
        }

        if (this.idProdEquilibrio) {
          this.onProductoEquilibrioChange();
        }
        
        this.cdr.detectChanges();
      },
      error: (error) => console.error('Error loading initial data for pricing:', error)
    });
  }

  onProductoPrecioChange() {
    const prod = this.productos.find(p => p.id == this.idProdPrecio);
    
    if (prod) {
      let costoPiezas = 0;
      let totalHorasImpresion = 0;

      if (prod.piezasBase && Array.isArray(prod.piezasBase)) {
        prod.piezasBase.forEach((p: Record<string, unknown>) => {
          const g = Number(p['gramos']) || 0;
          const precioMat = Number(p['precioMaterial']) || 0;
          costoPiezas += g * precioMat;

          const h = Number(p['horas']) || 0;
          const min = Number(p['minutos']) || 0;
          totalHorasImpresion += h + (min / 60);
        });
      }

      const prepMin = Number(prod.prepSlicing) || 0;
      const postMin = Number(prod.postProcesado) || 0;
      const totalHorasSetup = (prepMin + postMin) / 60;
      this.horasTotalesProducto = totalHorasImpresion + totalHorasSetup;

      if (this.horasTotalesProducto <= 0) {
        this.horasTotalesProducto = 1;
      }

      const costosDirectos = this.allFixes.filter(f => 
        f.producto == prod.id && (f.tipo === 'Variable' || f.tipo === 'Fijo')
      );
      const totalFixesDirectos = costosDirectos.reduce((sum, f) => sum + (Number(f.precio) || 0), 0);
      this.totalDirectoPrecio = totalFixesDirectos + costoPiezas;

      this.tasaHorariaMaquina = (this.totalFijoIndirecto + this.totalDepreciacionMensual) / (this.capacidadHorasMaquina || 160);
      this.indirectoProrrateadoPrecio = this.tasaHorariaMaquina * this.horasTotalesProducto;
      this.costoUnitarioPrecio = this.totalDirectoPrecio + this.indirectoProrrateadoPrecio;

      const prodMargin = Number(prod.margenGanancia);
      const defaultMargin = (!isNaN(prodMargin) && prodMargin > 0) ? prodMargin : this.minMargenGanancia;
      this.margenDeseado = defaultMargin < this.minMargenGanancia ? this.minMargenGanancia : defaultMargin;

      this.calcularPrecioSugerido();
      if (!this.idProdEquilibrio) {
        this.idProdEquilibrio = prod.id || null;
        this.precioVentaManual = Math.round(this.precioSugerido * 100) / 100;
        this.onProductoEquilibrioChange();
      }
    } else {
      this.totalDirectoPrecio = 0;
      this.indirectoProrrateadoPrecio = 0;
      this.costoUnitarioPrecio = 0;
      this.precioSugerido = 0;
      this.horasTotalesProducto = 0;
    }
  }

  onMargenBlur() {
    if (this.margenDeseado < this.minMargenGanancia) {
      this.margenDeseado = this.minMargenGanancia;
      this.calcularPrecioSugerido();
      Swal.fire({
        icon: 'info',
        title: 'Margen Mínimo Requerido',
        text: `El margen de ganancia no puede ser menor al mínimo configurado en Perfil (${this.minMargenGanancia}%). Se ha ajustado automáticamente.`,
        timer: 3000,
        showConfirmButton: false
      });
    }
  }

  calcularPrecioSugerido() {
    const costo = Number(this.costoUnitarioPrecio) || 0;
    const margen = Number(this.margenDeseado) || 0;

    const activeMargen = margen < this.minMargenGanancia ? this.minMargenGanancia : margen;
    const factorGanancia = activeMargen < 1 ? activeMargen : activeMargen / 100;

    if (factorGanancia >= 1) {
      this.precioSugerido = costo / 0.0001;
    } else {
      this.precioSugerido = costo / (1 - factorGanancia);
    }
  }

  onProductoEquilibrioChange() {
    const prod = this.productos.find(p => p.id == this.idProdEquilibrio);
    
    if (prod && this.allFixes.length > 0) {
      const variablesDirectos = this.allFixes.filter(f => 
        f.producto == prod.id && f.tipo === 'Variable'
      );
      this.costoVariableProd = variablesDirectos.reduce((sum, f) => sum + (Number(f.precio) || 0), 0);
      
      const fijosDirectos = this.allFixes.filter(f => 
        f.producto == prod.id && f.tipo === 'Fijo'
      );
      this.costoFijoDirectoProd = fijosDirectos.reduce((sum, f) => sum + (Number(f.precio) || 0), 0);

      const numProductos = this.productos.length || 1;
      this.fijosIndirectosProrrateados = this.costosFijosTotales / numProductos;
      this.costosFijosTotalesParaProd = this.fijosIndirectosProrrateados + this.costoFijoDirectoProd;

      this.calcularPuntoEquilibrio();
    } else {
      this.costoVariableProd = 0;
      this.costoFijoDirectoProd = 0;
      this.fijosIndirectosProrrateados = 0;
      this.costosFijosTotalesParaProd = 0;
      this.unidadesEquilibrio = 0;
    }
  }

  calcularPuntoEquilibrio() {
    const margenContribucion = this.precioVentaManual - this.costoVariableProd;

    if (margenContribucion > 0 && this.costosFijosTotalesParaProd > 0) {
      this.unidadesEquilibrio = Math.ceil(this.costosFijosTotalesParaProd / margenContribucion);
    } else {
      this.unidadesEquilibrio = 0;
    }
  }
}
