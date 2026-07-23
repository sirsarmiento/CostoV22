import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Budget } from '../../../../../core/models/Cost/budge';
import { BudgetService } from '../../../../../core/services/cost/budget.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-budget',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './budget.component.html'
})
export class BudgetComponent implements OnInit {
  private router = inject(Router);
  private budgetService = inject(BudgetService);
  loading = true;
  selectedRow: Budget | null = null;

  allBudgets: Budget[] = [];
  filteredBudgets: Budget[] = [];
  paginatedBudgets: Budget[] = [];

  searchTerm = '';
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalPagesArray: number[] = [];
  sortColumn = 'numero';
  sortAscending = true;

  Math = Math;


  ngOnInit(): void {
    this.getBudgets();
  }

  getBudgets() {
    this.loading = true;
    this.budgetService.getBudgets().subscribe({
      next: (data) => {
        this.allBudgets = data;
        this.filteredBudgets = [...this.allBudgets];
        this.applyFilterAndPagination();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading budgets:', error);
        this.loading = false;
      }
    });
  }

  onSearchChange() {
    this.currentPage = 1;
    this.applyFilterAndPagination();
  }

  applyFilterAndPagination() {
    let temp = [...this.allBudgets];
    const query = this.searchTerm.toLowerCase().trim();
    if (query) {
      temp = temp.filter(b => 
        (b.sku || '').toLowerCase().includes(query) ||
        (b.descripcion || '').toLowerCase().includes(query) ||
        (b.numero || '').toLowerCase().includes(query)
      );
    }

    // Ordenar
    temp.sort((a: Budget, b: Budget) => {
      const prop = this.sortColumn as keyof Budget;
      const valA = a[prop];
      const valB = b[prop];

      if (valA === null || valA === undefined) return this.sortAscending ? 1 : -1;
      if (valB === null || valB === undefined) return this.sortAscending ? -1 : 1;

      if (valA instanceof Date && valB instanceof Date) {
        return this.sortAscending ? valA.getTime() - valB.getTime() : valB.getTime() - valA.getTime();
      }

      let strA = String(valA);
      let strB = String(valB);
      if (typeof valA === 'string') strA = valA.toLowerCase();
      if (typeof valB === 'string') strB = valB.toLowerCase();

      if (strA < strB) return this.sortAscending ? -1 : 1;
      if (strA > strB) return this.sortAscending ? 1 : -1;
      return 0;
    });

    this.filteredBudgets = temp;

    // Paginación
    this.totalPages = Math.ceil(this.filteredBudgets.length / this.pageSize) || 1;
    this.totalPagesArray = Array.from({ length: this.totalPages }, (_, i) => i + 1);
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;

    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.paginatedBudgets = this.filteredBudgets.slice(startIndex, startIndex + this.pageSize);
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

  onEdit(row: Budget) {
    // Transferir datos al formulario
    localStorage.setItem('cost_edit_budget', JSON.stringify(row));
    this.router.navigate(['/budgets/add-budget']);
  }

  openAdd() {
    // Limpiar formulario para nuevo registro
    localStorage.removeItem('cost_edit_budget');
    this.router.navigate(['/budgets/add-budget']);
  }

  onDelete(id: number | undefined, descripcion: string) {
    if (id === undefined) return;
    Swal.fire({
      title: `¿Estás seguro que deseas eliminar el presupuesto de "${descripcion}"?`,
      showDenyButton: true,
      confirmButtonText: `Eliminar`,
      denyButtonText: `Cancelar`
    }).then((result) => {
      if (result.isConfirmed) {
        this.budgetService.deleteBudget(id).subscribe({
          next: () => {
            this.allBudgets = this.allBudgets.filter(b => b.id !== id);
            this.applyFilterAndPagination();
          }
        });
      }
    });
  }

  onFormule(row: Budget) {
    // Calcular costes base simulados para mostrar
    const totalGramos = (row.piezas || []).reduce((sum, p) => sum + (p.gramos || 0), 0);
    const rawMaterialCost = (row.piezas || []).reduce((sum, p) => sum + ((p.gramos || 0) * (p.precioMaterial || 0)), 0);
    const totalCostoMaterial = rawMaterialCost * (1 + ((row.tasaFalloGlobal || 0) / 100));

    const totalHoras = (row.piezas || []).reduce((sum, p) => sum + (p.horas || 0), 0);
    const totalMinutos = (row.piezas || []).reduce((sum, p) => sum + (p.minutos || 0), 0);
    const totalTiempoHoras = totalHoras + (totalMinutos / 60);
    const totalCostoMaquina = (row.costoMaquina || 0) * totalTiempoHoras;

    const baseCost = totalCostoMaterial + totalCostoMaquina;
    const margin = row.margenGanancia || 0;
    const factor = margin / 100;
    const suggestedPrice = factor >= 1 ? baseCost / 0.0001 : baseCost / (1 - factor);

    Swal.fire({
      title: `Estructura de Costes: ${row.descripcion}`,
      html: `
        <div class="text-start font-monospace text-sm p-2 bg-light rounded border border-light">
          <div class="d-flex justify-content-between mb-1">
            <span>Materiales (${totalGramos.toFixed(1)}g):</span>
            <span class="fw-bold">$${totalCostoMaterial.toFixed(2)}</span>
          </div>
          <div class="d-flex justify-content-between mb-1">
            <span>Tiempo Máquina (${totalTiempoHoras.toFixed(2)}h):</span>
            <span class="fw-bold">$${totalCostoMaquina.toFixed(2)}</span>
          </div>
          <hr class="my-2">
          <div class="d-flex justify-content-between mb-2 text-dark">
            <span class="fw-bold">Coste Base Total:</span>
            <span class="fw-bold">$${baseCost.toFixed(2)}</span>
          </div>
          <div class="d-flex justify-content-between mb-1 text-muted text-xs">
            <span>Margen Aplicado:</span>
            <span>${margin}%</span>
          </div>
          <div class="d-flex justify-content-between text-success">
            <span class="fw-bold">Precio Sugerido:</span>
            <span class="fw-bold">$${suggestedPrice.toFixed(2)}</span>
          </div>
        </div>
      `,
      icon: 'info',
      confirmButtonText: 'Cerrar'
    });
  }
}
