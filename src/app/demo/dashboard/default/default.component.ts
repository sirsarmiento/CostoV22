import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { forkJoin } from 'rxjs';

// project import (originales de la plantilla)
/* 
import { MonthlyBarChartComponent } from 'src/app/theme/shared/apexchart/monthly-bar-chart/monthly-bar-chart.component';
import { IncomeOverviewChartComponent } from 'src/app/theme/shared/apexchart/income-overview-chart/income-overview-chart.component';
import { AnalyticsChartComponent } from 'src/app/theme/shared/apexchart/analytics-chart/analytics-chart.component';
import { SalesReportChartComponent } from 'src/app/theme/shared/apexchart/sales-report-chart/sales-report-chart.component';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';
*/
import { IconService } from '@ant-design/icons-angular';
import { FallOutline, GiftOutline, MessageOutline, RiseOutline, SettingOutline } from '@ant-design/icons-angular/icons';

// Servicios del Calculador de Costos
import { ProductService } from 'src/app/core/services/cost/product.service';
import { FixeService } from 'src/app/core/services/cost/fixe.service';
import { AssetService } from 'src/app/core/services/cost/asset.service';
import { Asset } from 'src/app/core/models/Cost/asset';
import { Product } from 'src/app/core/models/Cost/product';
import { Fixe } from 'src/app/core/models/Cost/fixe';

@Component({
  selector: 'app-default',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    NgSelectModule
    /* COMPONENTES DE MANTIS COMENTADOS
    CardComponent,
    IconDirective,
    MonthlyBarChartComponent,
    IncomeOverviewChartComponent,
    AnalyticsChartComponent,
    SalesReportChartComponent
    */
  ],
  templateUrl: './default.component.html',
  styleUrls: ['./default.component.scss']
})
export class DefaultComponent implements OnInit {
  private iconService = inject(IconService);

  /* --- LÓGICA DE COSTOS (MIGRADA DE FRONTOST) --- */
  products: Product[] = [];          
  perfilesNames: string[] = [];       
  selectedPerfilName: string | null = null; 
  filteredProducts: Product[] = [];       
  costItems: Fixe[] = [];              
  filteredCostItems: Fixe[] = [];     
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selectedProductId: any = null;
  totalPrecio: number = 0;            // Gran Total del Producto (Directos + Indirectos Prorrateados)
  totalProducto: number = 0;          // Cantidad de productos en el perfil
  
  totalDepreciacionMensual: number = 0;
  totalFijoIndirecto: number = 0;

  private productService = inject(ProductService);
  private fixeService = inject(FixeService);
  private assetService = inject(AssetService);
  private cdr = inject(ChangeDetectorRef);

  constructor() {
    this.iconService.addIcon(...[RiseOutline, FallOutline, SettingOutline, GiftOutline, MessageOutline]);
  }

  ngOnInit(): void {
    this.loadAllData();
  }

  loadAllData(): void {
    forkJoin({
      products: this.productService.getProducts(),
      fixes: this.fixeService.getFixes(),
      assets: this.assetService.getAssets()
    }).subscribe(({ products, fixes, assets }) => {
      // 1. Cargar Costos Fijos
      this.costItems = fixes;
      this.filteredCostItems = [...this.costItems];
      const fijosIndirectos = this.costItems.filter(item => item.clasificacion === 'Indirecto');
      this.totalFijoIndirecto = fijosIndirectos.reduce((total, item) => total + Number(item.precio), 0);

      // 2. Cargar Activos
      const datosNormalizados = assets.map((item) => ({
        ...item,
        costoInicial: this.normalizarNumero(item.costoInicial),
        valorResidual: this.normalizarNumero(item.valorResidual),
        vidaUtil: this.normalizarNumero(item.vidaUtil)
      }));
      this.calcularTotales(datosNormalizados);

      // 3. Cargar Productos y Detonar Cálculos
      this.products = products;
      this.extractUniquePerfilNames();
      if (this.perfilesNames.length > 0) {
        this.selectedPerfilName = this.perfilesNames[0];
        this.onPerfilNameChange();
      }

      // Forzar a Angular a pintar el nombre del perfil inmediatamente
      this.cdr.detectChanges();
    });
  }

  calcularTotales(assets: Asset[]): void {
    this.totalDepreciacionMensual = 0;
    assets.forEach(asset => {
      this.totalDepreciacionMensual += this.calcularDepreciacionMensual(asset);
    });
  }

  calcularDepreciacionMensual(row: Asset): number {
    return this.calcularDepreciacionAnual(row) / 12;
  }

  calcularDepreciacionAnual(row: Asset): number {
    if (!row.costoInicial || row.valorResidual === undefined || !row.vidaUtil) {
      return 0;
    }
    const costoInicial = row.costoInicial;
    const valorResidual = row.valorResidual;
    const vidaUtil = row.vidaUtil;

    if (costoInicial <= 0 || vidaUtil <= 0 || valorResidual < 0) return 0;
    if (valorResidual > costoInicial) return 0;
    
    return (costoInicial - valorResidual) / vidaUtil;
  }

  private extractUniquePerfilNames(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const names = this.products.map(p => (p as any).perfilName);
    this.perfilesNames = [...new Set(names)];
  }

  onPerfilNameChange(): void {
    this.totalProducto = 0;
    if (this.selectedPerfilName) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.filteredProducts = this.products.filter(p => (p as any).perfilName === this.selectedPerfilName);
      this.totalProducto = this.filteredProducts.length;
    } else {
      this.filteredProducts = [];
    }
    
    // Limpia la selección de producto y obliga al usuario a elegir
    this.selectedProductId = null;
    this.totalPrecio = 0; // Reinicia el precio visual
  }

  onProductChange(): void {
    const id = Number(this.selectedProductId);
    this.filterCostsByProduct(id);
  }

  filterCostsByProduct(productId: number | null): void {
    if (productId === null || productId === 0) {
      this.filteredCostItems = [...this.costItems];
    } else {
      // Solo mostrar costos que pertenezcan explícitamente a este producto
      this.filteredCostItems = this.costItems.filter(
        (costo) => costo.producto === productId && (costo.tipo === 'Variable' || costo.tipo === 'Fijo')
      );
    }
    this.calcularTotal();
  }

  calcularTotal(): void {
    // 1. Sumar los costos directos de la tabla
    this.totalPrecio = this.filteredCostItems.reduce((sum, item) => {
      const precioNum = Number(item.precio);
      return sum + (isNaN(precioNum) ? 0 : precioNum);
    }, 0);

    // 2. Calcular la prorrata de gastos indirectos y depreciación
    let indirecto = 0;
    if (this.totalProducto > 0) {
      indirecto = (this.totalFijoIndirecto + this.totalDepreciacionMensual) / this.totalProducto;
    }

    // 3. Sumar el costo unitario real
    this.totalPrecio += indirecto;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  normalizarNumero(valor: any): number {
    if (valor === null || valor === undefined) return 0;
    if (typeof valor === 'number') return valor;
    if (typeof valor === 'string') {
      const numero = parseFloat(valor);
      return isNaN(numero) ? 0 : numero;
    }
    return 0;
  }

  /* CÓDIGO ORIGINAL MANTIS */
  /*
  recentOrder = tableData;

  AnalyticEcommerce = [
    { title: 'Total Page Views', amount: '4,42,236', background: 'bg-light-primary', border: 'border-primary', icon: 'rise', percentage: '59.3%', color: 'text-primary', number: '35,000' },
    { title: 'Total Users', amount: '78,250', background: 'bg-light-primary', border: 'border-primary', icon: 'rise', percentage: '70.5%', color: 'text-primary', number: '8,900' },
    { title: 'Total Order', amount: '18,800', background: 'bg-light-warning', border: 'border-warning', icon: 'fall', percentage: '27.4%', color: 'text-warning', number: '1,943' },
    { title: 'Total Sales', amount: '$35,078', background: 'bg-light-warning', border: 'border-warning', icon: 'fall', percentage: '27.4%', color: 'text-warning', number: '$20,395' }
  ];

  transaction = [
    { background: 'text-success bg-light-success', icon: 'gift', title: 'Order #002434', time: 'Today, 2:00 AM', amount: '+ $1,430', percentage: '78%' },
    { background: 'text-primary bg-light-primary', icon: 'message', title: 'Order #984947', time: '5 August, 1:45 PM', amount: '- $302', percentage: '8%' },
    { background: 'text-danger bg-light-danger', icon: 'setting', title: 'Order #988784', time: '7 hours ago', amount: '- $682', percentage: '16%' }
  ];
  */
}
