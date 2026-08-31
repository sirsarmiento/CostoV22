import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { Asset } from '../../../../../core/models/Cost/asset';
import { AssetService } from '../../../../../core/services/cost/asset.service';

@Component({
  selector: 'app-asset',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NgSelectModule],
  templateUrl: './asset.component.html'
})
export class AssetComponent implements OnInit {
  private router = inject(Router);
  private assetService = inject(AssetService);

  private cdr = inject(ChangeDetectorRef);
  loading = true;
  selectedRow: Asset | null = null;
  activeTab = 'fijo'; // fijo or circulante

  allAssets: Asset[] = [];
  filteredAssets: Asset[] = [];
  paginatedAssets: Asset[] = [];

  totalFijos = 0;
  totalCirculantes = 0;
  totalMateriales = 0;

  searchTerm = '';
  selectedCategory: string | null = null;
  categoriasList: string[] = [];
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

  actualizarCategorias() {
    const assetsInTab = this.allAssets.filter(item => {
      const tipoLower = item.tipo?.toLowerCase().trim() || '';
      const catLower = item.categoria?.toLowerCase().trim() || '';

      if (this.activeTab === 'fijo') {
        return tipoLower === 'fijo' || (!item.tipo && item.vidaUtil > 0);
      } else if (this.activeTab === 'material') {
        return tipoLower === 'material' || catLower.includes('material') || catLower.includes('insumo') || catLower.includes('filamento') || catLower.includes('resina');
      } else {
        return (tipoLower === 'circulante' || !item.tipo) && tipoLower !== 'fijo' && tipoLower !== 'material' && !catLower.includes('material') && !catLower.includes('insumo') && !catLower.includes('filamento') && !catLower.includes('resina');
      }
    });

    const uniqueMap = new Map<string, string>();
    assetsInTab.forEach(a => {
      const rawCat = (a.categoria || ((a as unknown as Record<string, unknown>)['Categoria'] as string) || '').trim();
      if (rawCat) {
        const key = rawCat.toLowerCase();
        if (!uniqueMap.has(key)) {
          const formatted = rawCat.charAt(0).toUpperCase() + rawCat.slice(1);
          uniqueMap.set(key, formatted);
        }
      }
    });

    this.categoriasList = Array.from(uniqueMap.values()).sort();
  }

  onCategoryChange() {
    this.currentPage = 1;
    this.applyFilterAndPagination();
  }

  clearFilters() {
    this.searchTerm = '';
    this.selectedCategory = null;
    this.currentPage = 1;
    this.applyFilterAndPagination();
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
            categoria: item.categoria || ((item as unknown as Record<string, unknown>)['Categoria'] as string) || '',
            subCategoria: item.subCategoria || ((item as unknown as Record<string, unknown>)['subcategoria'] as string) || ((item as unknown as Record<string, unknown>)['Subcategoria'] as string) || ((item as unknown as Record<string, unknown>)['SUBCATEGORIA'] as string) || '',
            depMensual: 0,
            depAnual: 0
          };
          asset.depMensual = this.calcularDepreciacionMensual(asset);
          asset.depAnual = this.calcularDepreciacionAnual(asset);
          return asset;
        });

        this.actualizarCategorias();
        this.applyFilterAndPagination();
       
        this.loading = false;
        setTimeout(() => this.cdr.detectChanges(), 50);
      },
      error: (error) => {
        console.error('Error loading assets:', error);
        this.loading = false;
      }
    });
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
    this.selectedCategory = null;
    this.currentPage = 1;
    this.actualizarCategorias();
    this.applyFilterAndPagination();
  }

  onSearchChange() {
    this.currentPage = 1;
    this.applyFilterAndPagination();
  }

  applyFilterAndPagination() {
    // Filtrar por tipo
    let temp = this.allAssets.filter(item => {
      const tipoLower = item.tipo?.toLowerCase().trim() || '';
      const catLower = item.categoria?.toLowerCase().trim() || '';

      if (this.activeTab === 'fijo') {
        return tipoLower === 'fijo' || (!item.tipo && item.vidaUtil > 0);
      } else if (this.activeTab === 'material') {
        return tipoLower === 'material' || catLower.includes('material') || catLower.includes('insumo') || catLower.includes('filamento') || catLower.includes('resina');
      } else {
        return (tipoLower === 'circulante' || !item.tipo) && tipoLower !== 'fijo' && tipoLower !== 'material' && !catLower.includes('material') && !catLower.includes('insumo') && !catLower.includes('filamento') && !catLower.includes('resina');
      }
    });

    // Filtrar por categoría
    if (this.selectedCategory) {
      const selCat = this.selectedCategory.toLowerCase().trim();
      temp = temp.filter(item => {
        const cat = item.categoria || ((item as unknown as Record<string, unknown>)['Categoria'] as string) || '';
        return cat.toLowerCase().trim() === selCat;
      });
    }

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
      
      if (valA && typeof valA === "string") valA = valA.toLowerCase();
      if (valB && typeof valB === "string") valB = valB.toLowerCase();

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
    } else if (this.activeTab === 'material') {
      this.totalMateriales = this.filteredAssets.reduce((sum, item) => sum + (item.costoInicial || 0), 0);
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

  onPageSizeChange() {
    this.currentPage = 1;
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
    // Transferir datos al formulario a través del state del router
    this.router.navigate(['/assets/add-asset'], { state: { edit_asset: row } });
  }

  openAdd() {
    // Navegar sin state (nuevo registro)
    this.router.navigate(['/assets/add-asset']);
  }
}
