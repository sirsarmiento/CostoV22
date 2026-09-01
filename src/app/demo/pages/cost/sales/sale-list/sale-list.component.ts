import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { InventoryService } from '../../../../../core/services/cost/inventory.service';
import { Sale } from '../../../../../core/models/Cost/inventory';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-sale-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sale-list.component.html'
})
export class SaleListComponent implements OnInit {
  private service = inject(InventoryService);
  sales: Sale[] = [];
  loading = true;

  ngOnInit(): void {
    this.service.getSales().subscribe({
      next: (rows) => { this.sales = rows; this.loading = false; },
      error: () => { this.loading = false; Swal.fire('Error', 'No se pudieron cargar las ventas.', 'error'); }
    });
  }
}
