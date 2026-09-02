import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { InventoryService } from '../../../../../core/services/cost/inventory.service';
import { Supplier } from '../../../../../core/models/Cost/inventory';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-supplier-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './supplier-list.component.html'
})
export class SupplierListComponent implements OnInit {
  protected readonly Math = Math;

  private service = inject(InventoryService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  suppliers: Supplier[] = [];
  filtered: Supplier[] = [];
  searchTerm = '';
  loading = false;
  selectedRow: Supplier | null = null;

  // Paginación y ordenamiento
  sortColumn = 'nombre';
  sortAscending = true;
  currentPage = 1;
  pageSize = 10;

  ngOnInit(): void {
    this.loadSuppliers();
  }

  loadSuppliers() {
    this.loading = true;
    this.service.getSuppliers().subscribe({
      next: (rows) => {
        this.suppliers = (rows || []).map(r => ({
          id: r.id,
          nombre: r.nombre || (r as unknown as Record<string, unknown>)['name'] as string || 'Proveedor',
          rif: r.rif || (r as unknown as Record<string, unknown>)['documento'] as string || '',
          contacto: r.contacto || (r as unknown as Record<string, unknown>)['contact'] as string || '',
          email: r.email || '',
          telefono: r.telefono || (r as unknown as Record<string, unknown>)['phone'] as string || '',
          direccion: r.direccion || (r as unknown as Record<string, unknown>)['address'] as string || ''
        }));
        this.applyFilter();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
        Swal.fire('Error', 'No se pudieron cargar los proveedores.', 'error');
      }
    });
  }

  onSearchChange() {
    this.currentPage = 1;
    this.applyFilter();
  }

  applyFilter() {
    const q = this.searchTerm.toLowerCase().trim();
    if (!q) {
      this.filtered = [...this.suppliers];
    } else {
      this.filtered = this.suppliers.filter(s =>
        (s.nombre || '').toLowerCase().includes(q) ||
        (s.rif || '').toLowerCase().includes(q) ||
        (s.contacto || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.telefono || '').toLowerCase().includes(q)
      );
    }
    this.sortFilteredData();
    this.cdr.detectChanges();
  }

  sortData(column: string) {
    if (this.sortColumn === column) {
      this.sortAscending = !this.sortAscending;
    } else {
      this.sortColumn = column;
      this.sortAscending = true;
    }
    this.sortFilteredData();
  }

  private sortFilteredData() {
    this.filtered.sort((a, b) => {
      const aVal = (a as unknown as Record<string, unknown>)[this.sortColumn] ?? '';
      const bVal = (b as unknown as Record<string, unknown>)[this.sortColumn] ?? '';
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return this.sortAscending ? aVal - bVal : bVal - aVal;
      }
      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();
      return this.sortAscending ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
    this.cdr.detectChanges();
  }

  getSortClass(column: string): string {
    if (this.sortColumn !== column) return 'ti-selector text-muted';
    return this.sortAscending ? 'ti-chevron-up text-primary' : 'ti-chevron-down text-primary';
  }

  get paginatedSuppliers(): Supplier[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filtered.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.filtered.length / this.pageSize) || 1;
  }

  setPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.cdr.detectChanges();
    }
  }

  onPageSizeChange() {
    this.currentPage = 1;
    this.cdr.detectChanges();
  }

  openAdd() {
    this.router.navigate(['/suppliers/add']);
  }

  edit(s: Supplier) {
    this.router.navigate(['/suppliers/add'], { state: { edit_supplier: s } });
  }

  delete(s: Supplier) {
    Swal.fire({
      title: '¿Eliminar Proveedor?',
      text: `Se eliminará el proveedor "${s.nombre}".`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((res) => {
      if (res.isConfirmed && s.id) {
        this.service.deleteSupplier(s.id).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'Proveedor eliminado con éxito.', 'success');
            this.loadSuppliers();
          },
          error: () => Swal.fire('Error', 'No se pudo eliminar el proveedor.', 'error')
        });
      }
    });
  }
}
