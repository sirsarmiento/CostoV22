import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Fixe } from '../../../../../core/models/Cost/fixe';
import { Product } from '../../../../../core/models/Cost/product';
import Swal from 'sweetalert2';

interface FixeWithProduct extends Fixe {
  productoName?: string;
}

@Component({
  selector: 'app-fixe',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './fixe.component.html'
})
export class FixeComponent implements OnInit {
  private router = inject(Router);

  loading = true;
  selectedRow: FixeWithProduct | null = null;
  activeTab = 'Fijo'; // Fijo or Variable

  allCosts: FixeWithProduct[] = [];
  filteredCosts: FixeWithProduct[] = [];
  paginatedCosts: FixeWithProduct[] = [];

  searchTerm = '';
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalPagesArray: number[] = [];
  sortColumn = 'concepto';
  sortAscending = true;

  Math = Math;

  // MOCK - LOCAL STORAGE: Eliminar y reemplazar con servicio real
  private defaultFixes: Fixe[] = [
    {
      id: 1,
      tipo: 'Fijo',
      concepto: 'Alquiler del Taller Mecánico',
      precio: 1500.0,
      clasificacion: 'Indirecto',
      producto: 0
    },
    {
      id: 2,
      tipo: 'Fijo',
      concepto: 'Salario Supervisor de Planta',
      precio: 2200.0,
      clasificacion: 'Indirecto',
      producto: 0
    },
    {
      id: 3,
      tipo: 'Fijo',
      concepto: 'Mantenimiento Preventivo CNC',
      precio: 450.0,
      clasificacion: 'Directo',
      producto: 1
    }
  ];

  ngOnInit(): void {
    this.getCosts();
  }

  getCosts() {
    this.loading = true;
    
    // MOCK - LOCAL STORAGE: Eliminar y reemplazar con servicio real
    const storedProds = localStorage.getItem('cost_products');
    const products: Product[] = storedProds ? JSON.parse(storedProds) : [];

    const storedFixes = localStorage.getItem('cost_fixes');
    const fixesList: Fixe[] = storedFixes ? JSON.parse(storedFixes) : [...this.defaultFixes];
    if (!storedFixes) {
      localStorage.setItem('cost_fixes', JSON.stringify(fixesList));
    }

    this.allCosts = fixesList.map(c => {
      const product = products.find(p => p.id === c.producto);
      return {
        ...c,
        productoName: product ? product.nombre : ''
      };
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
    // Filtrar por Tipo de Costo (Fijo/Variable)
    let temp = this.allCosts.filter(c => c.tipo === this.activeTab);

    // Filtrar por búsqueda
    const query = this.searchTerm.toLowerCase().trim();
    if (query) {
      temp = temp.filter(c => 
        c.concepto.toLowerCase().includes(query) ||
        c.clasificacion.toLowerCase().includes(query) ||
        (c.productoName && c.productoName.toLowerCase().includes(query))
      );
    }

    // Ordenamiento
    temp.sort((a: FixeWithProduct, b: FixeWithProduct) => {
      const prop = this.sortColumn as keyof FixeWithProduct;
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

    this.filteredCosts = temp;

    // Paginación
    this.totalPages = Math.ceil(this.filteredCosts.length / this.pageSize) || 1;
    this.totalPagesArray = Array.from({ length: this.totalPages }, (_, i) => i + 1);
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;

    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.paginatedCosts = this.filteredCosts.slice(startIndex, startIndex + this.pageSize);
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

  onEdit(row: Fixe) {
    // MOCK - LOCAL STORAGE: Eliminar y reemplazar con servicio real
    localStorage.setItem('cost_edit_fixe', JSON.stringify(row));
    this.router.navigate(['/fixes/add-fixe']);
  }

  openAdd() {
    // MOCK - LOCAL STORAGE: Eliminar y reemplazar con servicio real
    localStorage.removeItem('cost_edit_fixe');
    this.router.navigate(['/fixes/add-fixe']);
  }

  onDelete(id: number | undefined, concepto: string) {
    if (id === undefined) return;
    Swal.fire({
      title: `¿Estás seguro que deseas eliminar ${concepto}?`,
      showDenyButton: true,
      confirmButtonText: `Eliminar`,
      denyButtonText: `Cancelar`
    }).then((result) => {
      if (result.isConfirmed) {
        // MOCK - LOCAL STORAGE: Eliminar y reemplazar con servicio real
        const stored = localStorage.getItem('cost_fixes');
        if (stored) {
          let list: Fixe[] = JSON.parse(stored);
          list = list.filter(c => c.id !== id);
          localStorage.setItem('cost_fixes', JSON.stringify(list));
        }
        this.allCosts = this.allCosts.filter(c => c.id !== id);
        this.applyFilterAndPagination();
      }
    });
  }
}
