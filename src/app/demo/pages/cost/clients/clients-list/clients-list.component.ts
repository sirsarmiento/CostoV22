import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ClientService } from '../../../../../core/services/cost/client.service';
import { Client } from '../../../../../core/models/Cost/client';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-clients-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './clients-list.component.html'
})
export class ClientsListComponent implements OnInit {
  private clientService = inject(ClientService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  clients: Client[] = [];
  filteredClients: Client[] = [];
  paginatedClients: Client[] = [];
  loading = true;

  searchTerm = '';
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;

  sortColumn = 'nombre';
  sortDirection: 'asc' | 'desc' = 'asc';
  selectedRow: Client | null = null;
  Math = Math;

  ngOnInit(): void {
    this.loadClients();
  }

  loadClients() {
    this.loading = true;
    this.clientService.getClients().subscribe({
      next: (data) => {
        this.clients = data || [];
        this.applyFilterAndPagination();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading clients:', err);
        this.loading = false;
        Swal.fire('Error', 'No se pudieron cargar los clientes', 'error');
      }
    });
  }

  onSearchChange() {
    this.currentPage = 1;
    this.applyFilterAndPagination();
  }

  sortData(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.applyFilterAndPagination();
  }

  getSortClass(column: string): string {
    if (this.sortColumn !== column) return 'ti-selector text-muted';
    return this.sortDirection === 'asc' ? 'ti-arrow-up text-primary' : 'ti-arrow-down text-primary';
  }

  applyFilterAndPagination() {
    let result = [...this.clients];

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      result = result.filter(c => 
        c.nombre?.toLowerCase().includes(term) ||
        c.apellido?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.telefono?.toLowerCase().includes(term) ||
        c.direccion?.toLowerCase().includes(term)
      );
    }

    result.sort((a, b) => {
      let valA: string | number = (a[this.sortColumn as keyof Client] as string | number) ?? '';
      let valB: string | number = (b[this.sortColumn as keyof Client] as string | number) ?? '';

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    this.filteredClients = result;
    this.totalPages = Math.ceil(this.filteredClients.length / this.pageSize) || 1;
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;

    const start = (this.currentPage - 1) * this.pageSize;
    this.paginatedClients = this.filteredClients.slice(start, start + this.pageSize);
  }

  onPageSizeChange() {
    this.currentPage = 1;
    this.applyFilterAndPagination();
  }

  setPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.applyFilterAndPagination();
    }
  }

  verPerfil(client: Client) {
    if (client.id) {
      this.router.navigate(['/clients/profile', client.id], { state: { client } });
    }
  }

  editarCliente(client: Client) {
    if (client.id) {
      this.router.navigate(['/clients/add-client'], { state: { edit_client: client } });
    }
  }

  openAddModal() {
    this.router.navigate(['/clients/add-client']);
  }

  onDelete(id?: number, nombre?: string) {
    if (!id) return;
    Swal.fire({
      title: '¿Está seguro?',
      text: `¿Desea eliminar al cliente "${nombre}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.clientService.deleteClient(id).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'El cliente ha sido eliminado.', 'success');
            this.loadClients();
          },
          error: (err) => {
            console.error('Error deleting client:', err);
            Swal.fire('Error', 'No se pudo eliminar el cliente.', 'error');
          }
        });
      }
    });
  }
}
