import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { User } from '../../../../core/models/user';
import { UserService } from '../../../../core/services/user.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './user.component.html'
})
export class UserComponent implements OnInit {
  private userService = inject(UserService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  allUsers: User[] = [];
  filteredUsers: User[] = [];
  paginatedUsers: User[] = [];
  
  Math = Math;
  selectedRow: User | null = null;
  searchTerm = '';
  
  // Sorting
  sortColumn = 'firstName';
  sortAscending = true;

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalPagesArray: number[] = [];

  ngOnInit(): void {
    this.getUsers();
  }

  async getUsers() {
    try {
      const filter = { page: 1, rowByPage: 9999, word: null };
      const response = await this.userService.getUsersPaginated(filter);
      console.log('getUsers API response:', response);
      this.allUsers = response.data || [];
      this.filteredUsers = [...this.allUsers];
      this.applyFilterAndPagination();
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error loading users', error);
      Swal.fire('Error', 'No se pudieron cargar los usuarios', 'error');
    }
  }

  onSearchChange() {
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
    if (this.sortColumn === column) {
      return this.sortAscending ? 'ti-arrow-up' : 'ti-arrow-down';
    }
    return 'ti-arrows-sort text-muted opacity-50';
  }

  applyFilterAndPagination() {
    const query = this.searchTerm.toLowerCase().trim();
    if (!query) {
      this.filteredUsers = [...this.allUsers];
    } else {
      this.filteredUsers = this.allUsers.filter(u => 
        (u.firstName && u.firstName.toLowerCase().includes(query)) ||
        (u.lastName && u.lastName.toLowerCase().includes(query)) ||
        (u.email && u.email.toLowerCase().includes(query)) ||
        (u.documentNumber && u.documentNumber.includes(query))
      );
    }

    // Ordenamiento
    this.filteredUsers.sort((a, b) => {
      let valA: unknown = a[this.sortColumn as keyof User];
      let valB: unknown = b[this.sortColumn as keyof User];
      
      if (this.sortColumn === 'fullName') {
        valA = a.firstName + ' ' + a.lastName;
        valB = b.firstName + ' ' + b.lastName;
      }
      if (this.sortColumn === 'position') {
        valA = a.position?.label || '';
        valB = b.position?.label || '';
      }
      
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA === undefined || valA === null) return this.sortAscending ? 1 : -1;
      if (valB === undefined || valB === null) return this.sortAscending ? -1 : 1;

      if (valA < valB) return this.sortAscending ? -1 : 1;
      if (valA > valB) return this.sortAscending ? 1 : -1;
      return 0;
    });

    // Paginación
    this.totalPages = Math.ceil(this.filteredUsers.length / this.pageSize) || 1;
    this.totalPagesArray = Array.from({ length: this.totalPages }, (_, i) => i + 1);
    
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }

    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.paginatedUsers = this.filteredUsers.slice(startIndex, startIndex + this.pageSize);
    this.cdr.detectChanges();
  }

  setPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.applyFilterAndPagination();
    }
  }

  onPageSizeChange() {
    this.currentPage = 1;
    this.applyFilterAndPagination();
  }

  openAdd() {
    this.router.navigate(['/users/add-user']);
  }

  onEdit(row: User) {
    localStorage.setItem('security_edit_user', JSON.stringify(row));
    this.router.navigate(['/users/add-user']);
  }

  onDelete(id: number, name: string) {
    Swal.fire({
      title: '¿Desactivar Usuario?',
      text: `¿Estás seguro de que deseas desactivar a "${name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, desactivar',
      cancelButtonText: 'Cancelar'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await this.userService.deleteUser(id);
          Swal.fire('¡Desactivado!', 'El usuario ha sido desactivado.', 'success');
          this.getUsers();
        } catch {
          Swal.fire('Error', 'No se pudo desactivar el usuario.', 'error');
        }
      }
    });
  }
}
