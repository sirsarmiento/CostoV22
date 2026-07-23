import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Product } from '../../../../../core/models/Cost/product';
import { Config } from '../../../../../core/models/Cost/config';
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

  // MOCK - LOCAL STORAGE: Eliminar y reemplazar con servicio real
  private defaultProducts: Product[] = [
    {
      id: 1,
      nombre: 'Tornillo CNC Especial M8',
      sku: 'CNC-M8-001',
      medida: 'Unidades',
      clasificacion: 'Directo',
      descripcion: 'Tornillo mecanizado de precisión para ensambles de chasis',
      perfil: 1,
      periodo: '2026'
    },
    {
      id: 2,
      nombre: 'Eje de Transmisión Aluminio',
      sku: 'EJE-ALU-002',
      medida: 'Unidades',
      clasificacion: 'Directo',
      descripcion: 'Eje de aluminio de alta resistencia fresado',
      perfil: 1,
      periodo: '2026'
    }
  ];

  ngOnInit(): void {
    this.getProducts();
  }

  getProducts() {
    this.loading = true;
    
    // MOCK - LOCAL STORAGE: Eliminar y reemplazar con servicio real
    const storedConfigs = localStorage.getItem('cost_configs');
    const configs: Config[] = storedConfigs ? JSON.parse(storedConfigs) : [];

    const storedProducts = localStorage.getItem('cost_products');
    const productsList: Product[] = storedProducts ? JSON.parse(storedProducts) : [...this.defaultProducts];
    if (!storedProducts) {
      localStorage.setItem('cost_products', JSON.stringify(productsList));
    }

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
    // MOCK - LOCAL STORAGE: Eliminar y reemplazar con servicio real
    localStorage.setItem('cost_edit_product', JSON.stringify(row));
    this.router.navigate(['/products/add-product']);
  }

  openAdd() {
    // MOCK - LOCAL STORAGE: Eliminar y reemplazar con servicio real
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
        // MOCK - LOCAL STORAGE: Eliminar y reemplazar con servicio real
        const stored = localStorage.getItem('cost_products');
        if (stored) {
          let productsList: Product[] = JSON.parse(stored);
          productsList = productsList.filter(p => p.id !== id);
          localStorage.setItem('cost_products', JSON.stringify(productsList));
        }
        this.allProducts = this.allProducts.filter(p => p.id !== id);
        this.applyFilterAndPagination();
      }
    });
  }
}
