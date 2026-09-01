import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { InventoryService } from '../../../../../core/services/cost/inventory.service';
import { Purchase } from '../../../../../core/models/Cost/inventory';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-purchase-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './purchase-list.component.html'
})
export class PurchaseListComponent implements OnInit {
  private service = inject(InventoryService);
  private router = inject(Router);
  purchases: Purchase[] = [];
  loading = true;

  ngOnInit(): void {
    this.service.getPurchases().subscribe({
      next: (rows) => {
        this.purchases = (rows || []).map(r => {
          const rec = r as unknown as Record<string, unknown>;
          const prov = rec['proveedor'] as { nombre?: string } | undefined;
          return { ...r, proveedorNombre: prov?.nombre };
        });
        this.loading = false;
      },
      error: () => { this.loading = false; Swal.fire('Error', 'No se pudieron cargar las compras.', 'error'); }
    });
  }

  openAdd() { this.router.navigate(['/purchases/add']); }
}
