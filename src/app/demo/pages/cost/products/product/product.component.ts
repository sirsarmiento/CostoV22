import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Product, PiezaProducto } from '../../../../../core/models/Cost/product';
import { ProductService } from '../../../../../core/services/cost/product.service';
import { ConfigService } from '../../../../../core/services/cost/config.service';
import { AssetService } from '../../../../../core/services/cost/asset.service';
import { Asset } from '../../../../../core/models/Cost/asset';
import { mapDbPiezasToView } from '../../../../../core/utils/product-form.helper';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';

export interface ProductWithProfile extends Product {
  perfilName?: string;
}

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './product.component.html'
})
export class ProductComponent implements OnInit {
  private router = inject(Router);
  private productService = inject(ProductService);
  private configService = inject(ConfigService);
  private assetService = inject(AssetService);

  private cdr = inject(ChangeDetectorRef);
  loading = true;
  allProducts: ProductWithProfile[] = [];
  filteredProducts: ProductWithProfile[] = [];
  selectedRow: ProductWithProfile | null = null;
  allAssets: Asset[] = [];

  // Modal de detalles
  showDetailsModal = false;
  selectedProductForModal: ProductWithProfile | null = null;
  loadingModalDetails = false;

  // Búsqueda y paginación
  searchTerm: string = '';
  currentPage: number = 1;
  pageSize: number = 10;
  totalPages: number = 1;
  totalPagesArray: number[] = [];
  paginatedProducts: ProductWithProfile[] = [];

  // Ordenación
  sortColumn = 'nombre';
  sortAscending: boolean = true;

  Math = Math; // Para usar en la plantilla

  ngOnInit(): void {
    this.getProducts();
  }

  getProducts() {
    this.loading = true;
    
    forkJoin({
      configs: this.configService.getConfigs(),
      products: this.productService.getProducts(),
      assets: this.assetService.getAssets()
    }).subscribe({
      next: (data) => {
        const configs = data.configs;
        const productsList = data.products;
        this.allAssets = data.assets || [];

        this.allProducts = productsList.map(p => {
          let perfilId: number | null = null;
          let rawName = '';

          if (typeof p.perfil === 'object' && p.perfil !== null) {
            const pObj = p.perfil as unknown as Record<string, unknown>;
            perfilId = Number(pObj['id']) || null;
            rawName = (pObj['nombre'] as string) || (pObj['descripcion'] as string) || '';
          } else if (p.perfil !== null && p.perfil !== undefined) {
            perfilId = Number(p.perfil) || null;
          }

          const config = configs.find(c => String(c.id) === String(perfilId));
          const finalName = rawName || (config ? config.nombre : (configs.length > 0 ? configs[0].nombre : 'Sin Empresa'));

          return {
            ...p,
            perfilName: finalName
          };
        });

        this.filteredProducts = [...this.allProducts];
        this.applyFilterAndPagination();
       
        this.loading = false;
        setTimeout(() => this.cdr.detectChanges(), 50);
      },
      error: () => {
        this.loading = false;
        Swal.fire('Error', 'No se pudieron cargar los productos.', 'error');
      }
    });
  }

  activeTab: 'Productos' | 'Proyectos' | 'Servicios' = 'Productos';

  onSearchChange() {
    this.currentPage = 1;
    this.applyFilterAndPagination();
  }

  setActiveTab(tab: 'Productos' | 'Proyectos' | 'Servicios') {
    this.activeTab = tab;
    this.currentPage = 1;
    this.applyFilterAndPagination();
  }

  applyFilterAndPagination() {
    // 1. Filtrar por pestaña activa
    let temp = this.allProducts.filter(item => {
      const cls = (item.clasificacion || '').toLowerCase().trim();
      if (this.activeTab === 'Productos') {
        return cls === 'producto' || cls === 'productos' || cls === 'producto/servicio' || !cls;
      }
      if (this.activeTab === 'Proyectos') {
        return cls === 'proyecto' || cls === 'proyectos';
      }
      if (this.activeTab === 'Servicios') {
        return cls === 'servicio' || cls === 'servicios';
      }
      return true;
    });

    // 2. Búsqueda
    const query = this.searchTerm.toLowerCase().trim();
    if (query) {
      temp = temp.filter(p => 
        (p.nombre && p.nombre.toLowerCase().includes(query)) || 
        (p.sku && p.sku.toLowerCase().includes(query)) ||
        (p.codigoCatalogo && p.codigoCatalogo.toLowerCase().includes(query)) ||
        (p.tecnologia && p.tecnologia.toLowerCase().includes(query)) ||
        (p.material && p.material.toLowerCase().includes(query)) ||
        (p.clasificacion && p.clasificacion.toLowerCase().includes(query)) ||
        (p.perfilName && p.perfilName.toLowerCase().includes(query))
      );
    }

    this.filteredProducts = temp;

    // Ordenamiento
    this.filteredProducts.sort((a: ProductWithProfile, b: ProductWithProfile) => {
      const prop = this.sortColumn as keyof ProductWithProfile;
      let valA: unknown = a[prop];
      let valB: unknown = b[prop];
      
      if (this.sortColumn === 'familia') {
        valA = this.familiaNombre(a);
        valB = this.familiaNombre(b);
      }

      if (valA && typeof valA === "string") valA = (valA as string).toLowerCase();
      if (valB && typeof valB === "string") valB = (valB as string).toLowerCase();

      if (valA === null || valA === undefined) return this.sortAscending ? 1 : -1;
      if (valB === null || valB === undefined) return this.sortAscending ? -1 : 1;

      if (valA < valB) return this.sortAscending ? -1 : 1;
      if (valA > valB) return this.sortAscending ? 1 : -1;
      return 0;
    });

    // Paginación
    this.totalPages = Math.ceil(this.filteredProducts.length / this.pageSize) || 1;
    this.totalPagesArray = Array.from({ length: this.totalPages }, (_, i) => i + 1);
    
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }

    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.paginatedProducts = this.filteredProducts.slice(startIndex, startIndex + this.pageSize);
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

  familiaNombre(row: ProductWithProfile): string {
    if (!row.familia) {
      return '-';
    }
    if (typeof row.familia === 'object') {
      return row.familia.codigo || row.familia.nombre || '-';
    }
    return String(row.familia);
  }

  getSortClass(column: string): string {
    if (this.sortColumn !== column) return 'ti-selector text-muted';
    return this.sortAscending ? 'ti-chevron-up text-primary' : 'ti-chevron-down text-primary';
  }

  onViewDetails(row: ProductWithProfile) {
    this.selectedProductForModal = { ...row };
    this.showDetailsModal = true;

    const dRec = row as unknown as Record<string, unknown>;
    const rawPiezas = dRec['piezasProducto'] ?? dRec['piezas_producto'] ?? dRec['piezas'] ?? row.piezasProducto;

    if (Array.isArray(rawPiezas) && rawPiezas.length > 0) {
      this.selectedProductForModal.piezasProducto = this.mapPiezas(rawPiezas);
    } else if (row.id) {
      this.loadingModalDetails = true;
      this.productService.getProduct(row.id).subscribe({
        next: (fullProd) => {
          if (fullProd) {
            const fRec = fullProd as unknown as Record<string, unknown>;
            const piezas = fRec['piezasProducto'] ?? fRec['piezas_producto'] ?? fRec['piezas'] ?? fullProd.piezasProducto ?? [];
            this.selectedProductForModal = {
              ...this.selectedProductForModal,
              ...fullProd,
              piezasProducto: this.mapPiezas(Array.isArray(piezas) ? piezas : [])
            };
          }
          this.loadingModalDetails = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.loadingModalDetails = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

  private mapPiezas(rawPiezas: unknown[]): PiezaProducto[] {
    const maquinas = this.allAssets.filter(a => (a.tipo || '').toLowerCase().includes('maquin'));
    const materiales = this.allAssets.filter(a => (a.tipo || '').toLowerCase().includes('mater'));
    const circulantes = this.allAssets.filter(a => (a.tipo || '').toLowerCase().includes('circulan'));
    return mapDbPiezasToView(rawPiezas, maquinas, materiales, circulantes, this.allAssets);
  }

  closeDetailsModal() {
    this.showDetailsModal = false;
    this.selectedProductForModal = null;
    this.loadingModalDetails = false;
  }

  onEditFromModal() {
    if (this.selectedProductForModal) {
      const prod = this.selectedProductForModal;
      this.closeDetailsModal();
      this.onEdit(prod);
    }
  }

  tienePiezas(row: ProductWithProfile): boolean {
    const dRec = row as unknown as Record<string, unknown>;
    const rawPiezas = dRec['piezasProducto'] ?? dRec['piezas_producto'] ?? dRec['piezas'] ?? row.piezasProducto;
    return Array.isArray(rawPiezas) && rawPiezas.length > 0;
  }

  onEdit(row: Product) {
    // Transferir datos al formulario a través del state del router
    this.router.navigate(['/products/add-product'], { state: { edit_product: row } });
  }

  openAdd() {
    // Navegar sin state (nuevo registro)
    this.router.navigate(['/products/add-product']);
  }

  onDelete(id: number | undefined, nombre: string) {
    if (id === undefined) return;
    Swal.fire({
      title: `¿Estás seguro que deseas eliminar ${nombre}?`,
      showDenyButton: true,
      confirmButtonText: `Eliminar`,
      denyButtonText: `Cancelar`
    }).then((result) => {
      if (result.isConfirmed) {
        this.productService.deleteProduct(id).subscribe({
          next: () => {
            this.allProducts = this.allProducts.filter(p => p.id !== id);
            this.applyFilterAndPagination();
            setTimeout(() => this.cdr.detectChanges(), 10);
          }
        });
      }
    });
  }
}
