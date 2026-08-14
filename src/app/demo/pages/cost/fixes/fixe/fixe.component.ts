import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Fixe } from '../../../../../core/models/Cost/fixe';
import { FixeService } from '../../../../../core/services/cost/fixe.service';
import { ProductService } from '../../../../../core/services/cost/product.service';
import { forkJoin } from 'rxjs';
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
  private fixeService = inject(FixeService);
  private productService = inject(ProductService);

  private cdr = inject(ChangeDetectorRef);
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

  // Ya no necesitamos data por defecto aquí, viene del environment.local.ts vía servicio

  ngOnInit(): void {
    // Exponer funciones globales para SweetAlert
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).editVariable = (id: number) => {
      const row = this.allCosts.find(f => f.id === id);
      if (row) {
        Swal.close();
        this.onEdit(row);
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).deleteVariable = (id: number, concepto: string) => {
      Swal.close();
      this.onDelete(id, concepto);
    };

    this.getCosts();
  }

  getCosts() {
    this.loading = true;
    
    forkJoin({
      products: this.productService.getProducts(),
      fixes: this.fixeService.getFixes()
    }).subscribe({
      next: (data) => {
        const products = data.products;
        const fixesList = data.fixes;

        this.allCosts = fixesList.map(c => {
          const product = products.find(p => p.id === c.producto);
          return {
            ...c,
            productoName: product ? product.nombre : ''
          };
        });

        this.applyFilterAndPagination();
       
        this.loading = false;
        setTimeout(() => this.cdr.detectChanges(), 50);
      },
      error: () => {
        this.loading = false;
        Swal.fire('Error', 'No se pudieron cargar los costos fijos.', 'error');
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
    // Filtrar por Tipo de Costo (Fijo/Variable)
    let temp = this.allCosts.filter(c => c.tipo === this.activeTab);

    if (this.activeTab === 'Variable') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const varMap = new Map<string, any>();
      temp.forEach(v => {
        const pName = v.productoName || 'Sin producto';
        if (!varMap.has(pName)) {
          varMap.set(pName, {
            productoName: pName,
            tipo: 'Variable',
            clasificacion: v.clasificacion || 'Directo', 
            precio: 0,
            detalles: []
          });
        } else {
          const group = varMap.get(pName);
          if (group.clasificacion !== v.clasificacion) {
            group.clasificacion = 'Variada';
          }
        }
        
        const group = varMap.get(pName);
        group.precio += Number(v.precio || 0);
        group.detalles.push(v);
      });
      temp = Array.from(varMap.values());
    }

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
      
      if (valA && typeof valA === "string") valA = valA.toLowerCase();
      if (valB && typeof valB === "string") valB = valB.toLowerCase();

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  verDetalle(row: any) {
    let htmlContent = `
      <div style="overflow-x: auto;">
        <table class="table table-hover text-start align-middle mb-0" style="font-size: 14px; width: 100%;">
          <thead class="table-light">
            <tr>
              <th class="py-2">Concepto</th>
              <th class="py-2">Clasificación</th>
              <th class="py-2">Precio</th>
              <th class="text-end py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
    `;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    row.detalles.forEach((det: any) => {
      htmlContent += `
        <tr>
          <td class="fw-medium">${det.concepto}</td>
          <td>${det.clasificacion}</td>
          <td>$${Number(det.precio).toFixed(2)}</td>
          <td class="text-end">
            <div class="d-flex justify-content-end gap-1">
              <button class="btn btn-sm btn-icon btn-light-primary" onclick="window.editVariable(${det.id})" title="Editar">
                <i class="ti ti-pencil fs-5"></i>
              </button>
              <button class="btn btn-sm btn-icon btn-light-danger" onclick="window.deleteVariable(${det.id}, '${det.concepto}')" title="Eliminar">
                <i class="ti ti-trash fs-5"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    htmlContent += `</tbody></table></div>`;

    Swal.fire({
      title: `<div class="text-start fs-5 text-primary fw-bold">Detalle de Costos<br><span class="fs-6 text-muted fw-normal">${row.productoName}</span></div>`,
      html: htmlContent,
      width: '600px',
      showCloseButton: true,
      showConfirmButton: false,
      customClass: {
        popup: 'rounded-4'
      }
    });
  }

  onEdit(row: Fixe) {
    // Transferir datos al formulario a través del state del router
    this.router.navigate(['/fixes/add-fixe'], { state: { edit_fixe: row } });
  }

  openAdd() {
    // Navegar sin state (nuevo registro)
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
        this.fixeService.deleteFixe(id).subscribe({
          next: () => {
            this.allCosts = this.allCosts.filter(c => c.id !== id);
            this.applyFilterAndPagination();
            setTimeout(() => this.cdr.detectChanges(), 10);
          }
        });
      }
    });
  }
}
