import { Component, OnInit, inject } from '@angular/core';
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
  private service = inject(InventoryService);
  private router = inject(Router);

  suppliers: Supplier[] = [];
  filtered: Supplier[] = [];
  searchTerm = '';
  loading = true;

  ngOnInit(): void {
    this.service.getSuppliers().subscribe({
      next: (rows) => {
        this.suppliers = rows;
        this.filtered = rows;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        Swal.fire('Error', 'No se pudieron cargar los proveedores.', 'error');
      }
    });
  }

  onSearch() {
    const q = this.searchTerm.toLowerCase().trim();
    this.filtered = !q ? [...this.suppliers] : this.suppliers.filter(s =>
      (s.nombre || '').toLowerCase().includes(q) ||
      (s.rif || '').toLowerCase().includes(q) ||
      (s.contacto || '').toLowerCase().includes(q)
    );
  }

  openAdd() {
    this.router.navigate(['/suppliers/add']);
  }

  onEdit(row: Supplier) {
    this.router.navigate(['/suppliers/add'], { state: { edit_supplier: row } });
  }
}
