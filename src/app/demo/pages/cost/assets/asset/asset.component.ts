import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Asset } from '../../../../../core/models/Cost/asset';
import { AssetService } from '../../../../../core/services/cost/asset.service';

@Component({
  selector: 'app-asset',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './asset.component.html'
})
export class AssetComponent implements OnInit {
  private router = inject(Router);
  private assetService = inject(AssetService);

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
    this.assetService.getAssets().subscribe({
      next: (assetsList) => {
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
      },
      error: (error) => {
        console.error('Error loading assets:', error);
        this.loading = false;
      }
    });
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
    // Transferir datos al formulario
    localStorage.setItem('cost_edit_asset', JSON.stringify(row));
    this.router.navigate(['/assets/add-asset']);
  }

  openAdd() {
    // Limpiar formulario para nuevo registro
    localStorage.removeItem('cost_edit_asset');
    this.router.navigate(['/assets/add-asset']);
  }
}
