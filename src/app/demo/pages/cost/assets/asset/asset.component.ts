import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Asset } from '../../../../../core/models/Cost/asset';

@Component({
  selector: 'app-asset',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './asset.component.html'
})
export class AssetComponent implements OnInit {
  private router = inject(Router);

  loading = true;
  selectedRow: Asset | null = null;
  activeTab = 'fijo'; // fijo or circulante

  allAssets: Asset[] = [];
  filteredAssets: Asset[] = [];
  paginatedAssets: Asset[] = [];

  totalFijos = 0;
  totalCirculantes = 0;

  searchTerm = '';
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalPagesArray: number[] = [];
  sortColumn = 'nombre';
  sortAscending = true;

  Math = Math;

  // MOCK - LOCAL STORAGE: Eliminar y reemplazar con servicio real
  private defaultAssets: Asset[] = [
    {
      id: 1,
      nombre: 'Impresora 3D Prusa MK4',
      costoInicial: 1200,
      valorResidual: 200,
      vidaUtil: 5,
      fechaCompra: new Date('2026-01-10'),
      tipo: 'Fijo',
      cantidad: 2,
      valorUnitario: 1200,
      unidadMedida: 'Unidades',
      presentacion: 'Caja',
      descripcion: 'Impresora 3D de filamento FDM de alta velocidad',
      ubicacion: 'Taller CNC',
      categoria: 'Maquinaria',
      consumoMaquina: 0.35,
      tarifa: 0.15,
      costoMantenimiento: 120,
      depMensual: 16.67,
      depAnual: 200
    },
    {
      id: 2,
      nombre: 'Compresor de Aire 50L',
      costoInicial: 450,
      valorResidual: 50,
      vidaUtil: 5,
      fechaCompra: new Date('2026-02-15'),
      tipo: 'Fijo',
      cantidad: 1,
      valorUnitario: 450,
      unidadMedida: 'Unidades',
      presentacion: 'Caja',
      descripcion: 'Compresor de aire para limpieza y herramientas neumáticas',
      ubicacion: 'Taller CNC',
      categoria: 'Maquinaria',
      consumoMaquina: 1.5,
      tarifa: 0.15,
      costoMantenimiento: 50,
      depMensual: 6.67,
      depAnual: 80
    },
    {
      id: 3,
      nombre: 'Filamento PLA Pro 1kg',
      costoInicial: 120,
      valorResidual: 0,
      vidaUtil: 0,
      fechaCompra: new Date('2026-06-01'),
      tipo: 'Circulante',
      cantidad: 5,
      valorUnitario: 24,
      unidadMedida: 'Kilogramos',
      presentacion: 'Bobina',
      descripcion: 'Materia prima para impresión 3D',
      ubicacion: 'Almacén de Materiales',
      categoria: 'Materiales',
      depMensual: 0,
      depAnual: 0
    }
  ];

  ngOnInit(): void {
    this.getAssets();
  }

  normalizarNumero(valor: string | number | null | undefined): number {
    if (valor === null || valor === undefined) return 0;
    if (typeof valor === 'number') return valor;
    const numero = parseFloat(valor);
    return isNaN(numero) ? 0 : numero;
  }

  getAssets() {
    this.loading = true;
    
    // MOCK - LOCAL STORAGE: Eliminar y reemplazar con servicio real
    const stored = localStorage.getItem('cost_assets');
    const assetsList: Asset[] = stored ? JSON.parse(stored) : [...this.defaultAssets];
    if (!stored) {
      localStorage.setItem('cost_assets', JSON.stringify(assetsList));
    }

    this.allAssets = assetsList.map((item: Asset) => {
      const asset = {
        ...item,
        costoInicial: this.normalizarNumero(item.costoInicial),
        valorResidual: this.normalizarNumero(item.valorResidual),
        vidaUtil: this.normalizarNumero(item.vidaUtil),
        cantidad: this.normalizarNumero(item.cantidad),
        valorUnitario: this.normalizarNumero(item.valorUnitario),
        nombre: item.nombre || '',
        descripcion: item.descripcion || '',
        ubicacion: item.ubicacion || '',
        unidadMedida: item.unidadMedida || '',
        presentacion: item.presentacion || '',
        depMensual: 0,
        depAnual: 0
      };
      asset.depMensual = this.calcularDepreciacionMensual(asset);
      asset.depAnual = this.calcularDepreciacionAnual(asset);
      return asset;
    });

    this.applyFilterAndPagination();
    this.loading = false;
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
    this.currentPage = 1;
    this.applyFilterAndPagination();
  }

  onSearchChange() {
    this.currentPage = 1;
    this.applyFilterAndPagination();
  }

  applyFilterAndPagination() {
    // Filtrar por tipo
    let temp = this.allAssets.filter(item => {
      const isFijoTab = this.activeTab === 'fijo';
      const isFijoItem = item.tipo?.toLowerCase().trim() === 'fijo' || (!item.tipo && item.vidaUtil > 0);
      return isFijoTab ? isFijoItem : !isFijoItem;
    });

    // Filtrar por búsqueda
    const query = this.searchTerm.toLowerCase().trim();
    if (query) {
      temp = temp.filter(item => 
        item.nombre.toLowerCase().includes(query) ||
        item.descripcion.toLowerCase().includes(query) ||
        item.ubicacion.toLowerCase().includes(query)
      );
    }

    // Ordenamiento
    temp.sort((a: Asset, b: Asset) => {
      const prop = this.sortColumn as keyof Asset;
      let valA = a[prop];
      let valB = b[prop];
      
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      // Handle Dates
      if (valA instanceof Date && valB instanceof Date) {
        return this.sortAscending ? valA.getTime() - valB.getTime() : valB.getTime() - valA.getTime();
      }

      if (valA === null || valA === undefined) return this.sortAscending ? 1 : -1;
      if (valB === null || valB === undefined) return this.sortAscending ? -1 : 1;

      if (valA < valB) return this.sortAscending ? -1 : 1;
      if (valA > valB) return this.sortAscending ? 1 : -1;
      return 0;
    });

    this.filteredAssets = temp;

    // Totales
    if (this.activeTab === 'fijo') {
      this.totalFijos = this.filteredAssets.reduce((sum, item) => sum + (item.depMensual || 0), 0);
    } else {
      this.totalCirculantes = this.filteredAssets.reduce((sum, item) => sum + (item.costoInicial || 0), 0);
    }

    // Paginación
    this.totalPages = Math.ceil(this.filteredAssets.length / this.pageSize) || 1;
    this.totalPagesArray = Array.from({ length: this.totalPages }, (_, i) => i + 1);
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;

    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.paginatedAssets = this.filteredAssets.slice(startIndex, startIndex + this.pageSize);
  }

  setPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.applyFilterAndPagination();
  }

  sortData(column: string) {
    if (this.sortColumn === column) {
      this.sortAscending = !this.sortAscending;
    } else {
      this.sortColumn = column;
      this.sortAscending = true;
    }
    this.applyFilterAndPagination();
  }

  getSortClass(column: string): string {
    if (this.sortColumn !== column) return 'ti-selector text-muted';
    return this.sortAscending ? 'ti-chevron-up text-primary' : 'ti-chevron-down text-primary';
  }

  calcularDepreciacionAnual(row: Asset): number {
    if (!row.costoInicial || !row.vidaUtil || row.valorResidual > row.costoInicial) {
      return 0;
    }
    return (row.costoInicial - row.valorResidual) / row.vidaUtil;
  }

  calcularDepreciacionMensual(row: Asset): number {
    return this.calcularDepreciacionAnual(row) / 12;
  }

  onEdit(row: Asset) {
    // MOCK - LOCAL STORAGE: Eliminar y reemplazar con servicio real
    localStorage.setItem('cost_edit_asset', JSON.stringify(row));
    this.router.navigate(['/assets/add-asset']);
  }

  openAdd() {
    // MOCK - LOCAL STORAGE: Eliminar y reemplazar con servicio real
    localStorage.removeItem('cost_edit_asset');
    this.router.navigate(['/assets/add-asset']);
  }
}
