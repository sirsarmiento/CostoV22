import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Product } from '../../../../../core/models/Cost/product';
import { ProductService } from '../../../../../core/services/cost/product.service';
import { ConfigService } from '../../../../../core/services/cost/config.service';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';

interface ProductWithProfile extends Product {
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

  loading = true;
  allProducts: ProductWithProfile[] = [];
  filteredProducts: ProductWithProfile[] = [];
  selectedRow: ProductWithProfile | null = null;

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

  // Ya no necesitamos data por defecto aquí, viene del environment.local.ts vía servicio

  ngOnInit(): void {
    this.getProducts();
  }

  getProducts() {
    this.loading = true;
    
    forkJoin({
      configs: this.configService.getConfigs(),
      products: this.productService.getProducts()
    }).subscribe({
      next: (data) => {
        const configs = data.configs;
        const productsList = data.products;

        this.allProducts = productsList.map(p => {
          const config = configs.find(c => c.id === p.perfil);
          return {
            ...p,
            perfilName: config ? config.nombre : 'Sin Empresa'
          };
        });

        this.filteredProducts = [...this.allProducts];
        this.applyFilterAndPagination();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        Swal.fire('Error', 'No se pudieron cargar los productos.', 'error');
      }
    });
  }

  onSearchChange() {
    this.currentPage = 1;
    this.applyFilterAndPagination();
  }

  applyFilterAndPagination() {
    const query = this.searchTerm.toLowerCase().trim();
    if (!query) {
      this.filteredProducts = [...this.allProducts];
    } else {
      this.filteredProducts = this.allProducts.filter(p => 
        p.nombre.toLowerCase().includes(query) || 
        p.sku.toLowerCase().includes(query) ||
        p.clasificacion.toLowerCase().includes(query) ||
        (p.perfilName && p.perfilName.toLowerCase().includes(query))
      );
    }

    // Ordenamiento
    this.filteredProducts.sort((a: ProductWithProfile, b: ProductWithProfile) => {
      const prop = this.sortColumn as keyof ProductWithProfile;
      let valA = a[prop];
      let valB = b[prop];
      
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

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

  onEdit(row: Product) {
    // Transferir datos al formulario
    localStorage.setItem('cost_edit_product', JSON.stringify(row));
    this.router.navigate(['/products/add-product']);
  }

  openAdd() {
    // Limpiar formulario para nuevo registro
    localStorage.removeItem('cost_edit_product');
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
          }
        });
      }
    });
  }
}
