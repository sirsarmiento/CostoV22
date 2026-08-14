import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
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
  private cdr = inject(ChangeDetectorRef);
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
        setTimeout(() => this.cdr.detectChanges(), 50);
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

  onEdit(row: Budget) {
    // Transferir datos al formulario a través del state del router
    this.router.navigate(['/budgets/add-budget'], { state: { edit_budget: row } });
  }

  openAdd() {
    // Navegar sin state (nuevo registro)
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
            setTimeout(() => this.cdr.detectChanges(), 10);
          }
        });
      }
    });
  }

  onFormule(row: Budget) {
    // Totales Físicos
    const totalGramos = (row.piezas || []).reduce((sum, p) => sum + (Number(p.gramos) || 0), 0);
    const totalHorasRaw = (row.piezas || []).reduce((sum, p) => sum + (Number(p.horas) || 0), 0);
    const totalMinutosRaw = (row.piezas || []).reduce((sum, p) => sum + (Number(p.minutos) || 0), 0);

    // Formatear tiempo
    const extraHours = Math.floor(totalMinutosRaw / 60);
    const finalHoras = totalHorasRaw + extraHours;
    const finalMinutos = totalMinutosRaw % 60;
    const totalTiempoHoras = finalHoras + (finalMinutos / 60);

    // Cálculos de costos base
    const rawMaterialCost = (row.piezas || []).reduce((sum, p) => sum + ((Number(p.gramos) || 0) * (Number(p.precioMaterial) || 0)), 0);
    const totalCostoMaterial = rawMaterialCost * (1 + ((Number(row.tasaFalloGlobal) || 0) / 100));
    const totalCostoMaquina = (Number(row.costoMaquina) || 0) * totalTiempoHoras;
    const totalCostoIndirecto = Number(row.costoOperador) || 0;

    const baseCost = totalCostoMaterial + totalCostoMaquina + totalCostoIndirecto;
    const margin = Number(row.margenGanancia) || 0;
    const factor = margin / 100;
    const suggestedPrice = factor >= 1 ? baseCost / 0.0001 : baseCost / (1 - factor);

    // Construir tabla de piezas
    const piezasRows = (row.piezas || []).map(p => {
      const g = Number(p.gramos) || 0;
      const h = Number(p.horas) || 0;
      const min = Number(p.minutos) || 0;
      const matCost = g * (Number(p.precioMaterial) || 0);
      const maqCost = (Number(row.costoMaquina) || 0) * (h + (min / 60));
      const pBase = matCost + maqCost; // Simplified individual base cost
      const pPrice = factor >= 1 ? pBase / 0.0001 : pBase / (1 - factor);

      return `
        <tr>
          <td class="text-start fw-medium">${p.nombre || 'Pieza'}</td>
          <td>${g.toFixed(2)}</td>
          <td>${h}</td>
          <td>${min}</td>
          <td>$${matCost.toFixed(2)}</td>
          <td>$${maqCost.toFixed(2)}</td>
          <td class="fw-bold text-primary">$${pPrice.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    // HTML del modal completo
    Swal.fire({
      title: `<div class="text-start text-primary fw-bold fs-5">Estudio de Presupuesto</div>`,
      html: `
        <div class="text-start" style="font-family: 'Inter', sans-serif; font-size: 0.85rem;">
          
          <div class="row g-3 mb-3">
            <!-- Datos Generales -->
            <div class="col-md-7">
              <div class="card border-0 shadow-sm h-100 bg-light">
                <div class="card-header bg-transparent border-bottom-0 pt-3 pb-1 text-start">
                  <h6 class="fw-bold text-dark mb-0 fs-6"><i class="ti ti-file-description me-2"></i>Datos del Presupuesto</h6>
                </div>
                <div class="card-body px-3 py-2 text-start">
                  <div class="d-flex justify-content-between border-bottom border-secondary border-opacity-10 py-1">
                    <span class="text-muted" style="font-size: 0.8rem;">Clasificación:</span>
                    <span class="fw-medium text-dark">${row.clasificacion || ''}</span>
                  </div>
                  <div class="d-flex justify-content-between border-bottom border-secondary border-opacity-10 py-1">
                    <span class="text-muted" style="font-size: 0.8rem;">Nro. de Orden:</span>
                    <span class="fw-medium text-dark">${row.numero || ''}</span>
                  </div>
                  <div class="d-flex justify-content-between border-bottom border-secondary border-opacity-10 py-1">
                    <span class="text-muted" style="font-size: 0.8rem;">Fecha:</span>
                    <span class="fw-medium text-dark">${row.fecha ? new Date(row.fecha).toLocaleDateString() : ''}</span>
                  </div>
                  <div class="d-flex justify-content-between border-bottom border-secondary border-opacity-10 py-1">
                    <span class="text-muted" style="font-size: 0.8rem;">Descripción:</span>
                    <span class="fw-medium text-dark">${row.descripcion || ''}</span>
                  </div>
                  <div class="d-flex justify-content-between border-bottom border-secondary border-opacity-10 py-1">
                    <span class="text-muted" style="font-size: 0.8rem;">Equipo de Impresión:</span>
                    <span class="fw-medium text-dark">N/A</span>
                  </div>
                  <div class="d-flex justify-content-between border-bottom border-secondary border-opacity-10 py-1">
                    <span class="text-muted" style="font-size: 0.8rem;">Tasa de Fallo (Merma):</span>
                    <span class="text-danger fw-medium">${row.tasaFalloGlobal || 0}%</span>
                  </div>
                  <div class="d-flex justify-content-between border-bottom border-secondary border-opacity-10 py-1">
                    <span class="text-muted" style="font-size: 0.8rem;">Prep/Slicing:</span>
                    <span class="fw-medium text-dark">${row.tiempoSetup || 0} min</span>
                  </div>
                  <div class="d-flex justify-content-between pt-1">
                    <span class="text-muted" style="font-size: 0.8rem;">Post-procesado:</span>
                    <span class="fw-medium text-dark">${row.tiempoPostProcesado || 0} min</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Panel Azul -->
            <div class="col-md-5">
              <div class="card h-100 border-0 text-white shadow-sm" style="background-color: #2b5fe8; border-radius: 8px;">
                <div class="card-body text-start p-3 d-flex flex-column">
                  <div class="d-flex justify-content-between align-items-center mb-3">
                    <span class="text-uppercase text-white-50 fw-bold" style="font-size: 0.7rem; letter-spacing: 1px;">Análisis de Costos</span>
                    <div class="bg-white bg-opacity-25 rounded-circle d-flex align-items-center justify-content-center" style="width: 24px; height: 24px;">
                      <i class="ti ti-currency-dollar fs-6 text-white"></i>
                    </div>
                  </div>
                  
                  <div class="d-flex justify-content-between mb-1" style="font-size: 0.8rem;">
                    <span class="text-white-50">Costo de Materiales (con merma):</span>
                    <span class="fw-medium">$${totalCostoMaterial.toFixed(2)}</span>
                  </div>
                  <div class="d-flex justify-content-between mb-1" style="font-size: 0.8rem;">
                    <span class="text-white-50">Costo Operativo Máquina:</span>
                    <span class="fw-medium">$${totalCostoMaquina.toFixed(2)}</span>
                  </div>
                  <div class="d-flex justify-content-between mb-2 border-bottom border-white border-opacity-25 pb-2" style="font-size: 0.8rem;">
                    <span class="text-white-50">Costo Indirecto Prorrateado:</span>
                    <span class="fw-medium">$${totalCostoIndirecto.toFixed(2)}</span>
                  </div>
                  <div class="d-flex justify-content-between mb-auto" style="font-size: 0.8rem;">
                    <span class="text-white-50">Costo Total Base:</span>
                    <span class="fw-bold">$${baseCost.toFixed(2)}</span>
                  </div>

                  <div class="mt-3 pt-2 border-top border-white border-opacity-25">
                    <div class="text-white-50 mb-1" style="font-size: 0.75rem;">Precio Sugerido (Margen ${margin}%)</div>
                    <div class="fs-3 fw-bold">$${suggestedPrice.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Especificaciones Físicas -->
          <div class="mb-3">
            <h6 class="fw-bold mb-2 text-dark fs-6"><i class="ti ti-layers-intersect me-2 text-muted"></i>Especificaciones Físicas Totales</h6>
            <div class="row g-2">
              <div class="col-md-4">
                <div class="card border border-light shadow-sm bg-white">
                  <div class="card-body p-2 d-flex align-items-center">
                    <div class="bg-primary bg-opacity-10 rounded-circle p-1 text-primary me-2">
                      <i class="ti ti-weight fs-5"></i>
                    </div>
                    <div>
                      <div class="text-muted mb-0" style="font-size: 0.7rem;">Gramos Totales</div>
                      <div class="fw-bold fs-6 text-dark">${totalGramos.toFixed(2)}g</div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="col-md-4">
                <div class="card border border-light shadow-sm bg-white">
                  <div class="card-body p-2 d-flex align-items-center">
                    <div class="bg-warning bg-opacity-10 rounded-circle p-1 text-warning me-2">
                      <i class="ti ti-clock fs-5"></i>
                    </div>
                    <div>
                      <div class="text-muted mb-0" style="font-size: 0.7rem;">Horas Totales</div>
                      <div class="fw-bold fs-6 text-dark">${finalHoras}h</div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="col-md-4">
                <div class="card border border-light shadow-sm bg-white">
                  <div class="card-body p-2 d-flex align-items-center">
                    <div class="bg-danger bg-opacity-10 rounded-circle p-1 text-danger me-2">
                      <i class="ti ti-timer fs-5"></i>
                    </div>
                    <div>
                      <div class="text-muted mb-0" style="font-size: 0.7rem;">Minutos Totales</div>
                      <div class="fw-bold fs-6 text-dark">${finalMinutos}m</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Tabla de Piezas -->
          <div>
            <h6 class="fw-bold mb-2 text-dark fs-6"><i class="ti ti-list-details me-2 text-muted"></i>Desglose por Pieza</h6>
            <div class="table-responsive rounded shadow-sm border border-light">
              <table class="table table-hover table-striped text-center align-middle mb-0 bg-white" style="font-size: 0.75rem;">
                <thead style="background-color: #0b3d91;">
                  <tr>
                    <th class="text-start fw-semibold border-0 text-white py-2 ps-2">Nombre</th>
                    <th class="fw-semibold border-0 text-white py-2">Gramos</th>
                    <th class="fw-semibold border-0 text-white py-2">Horas</th>
                    <th class="fw-semibold border-0 text-white py-2">Minutos</th>
                    <th class="fw-semibold border-0 text-white py-2">Costo Material</th>
                    <th class="fw-semibold border-0 text-white py-2">Costo Máquina</th>
                    <th class="fw-semibold border-0 text-white py-2 pe-2">Precio Sugerido</th>
                  </tr>
                </thead>
                <tbody>
                  ${piezasRows || '<tr><td colspan="7" class="text-muted py-2">No hay piezas en este presupuesto</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      `,
      customClass: {
        popup: 'rounded-4 bg-white',
        title: 'border-bottom pb-2 mb-0'
      },
      width: '950px',
      showCloseButton: true,
      showConfirmButton: false,
    });
  }
}
