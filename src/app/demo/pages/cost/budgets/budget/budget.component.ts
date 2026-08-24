import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Budget } from '../../../../../core/models/Cost/budge';
import { BudgetService } from '../../../../../core/services/cost/budget.service';
import { ConfigService } from '../../../../../core/services/cost/config.service';
import { FixeService } from '../../../../../core/services/cost/fixe.service';
import { AssetService } from '../../../../../core/services/cost/asset.service';
import { Asset } from '../../../../../core/models/Cost/asset';
import { forkJoin } from 'rxjs';
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
  private configService = inject(ConfigService);
  private fixeService = inject(FixeService);
  private assetService = inject(AssetService);
  private cdr = inject(ChangeDetectorRef);
  loading = true;
  selectedRow: Budget | null = null;

  allBudgets: Budget[] = [];
  filteredBudgets: Budget[] = [];
  paginatedBudgets: Budget[] = [];
  allAssets: Asset[] = [];
  capacidadHorasMaquina = 160;
  totalFijoIndirecto = 0;

  searchTerm = '';
  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalPagesArray: number[] = [];
  sortColumn = 'numero';
  sortAscending = true;

  Math = Math;

  ngOnInit(): void {
    forkJoin({
      configs: this.configService.getConfigs(),
      fixes: this.fixeService.getFixes(),
      assets: this.assetService.getAssets()
    }).subscribe(data => {
      if (data.configs && data.configs.length > 0) {
        const configObj = data.configs[0];
        let capacidad = 0;
        if (configObj.parametros && Array.isArray(configObj.parametros)) {
          configObj.parametros.forEach((machine) => {
            const unidad = machine.unidad?.toLowerCase().trim() || '';
            if (unidad.includes('hora') || unidad.includes('hs') || unidad === '') {
              capacidad += (Number(machine.horasUso) || 0) * (Number(machine.prodMaxHoras) || 0);
            }
          });
        }
        this.capacidadHorasMaquina = capacidad > 0 ? capacidad : 160;
      }

      if (data.fixes && data.fixes.length > 0) {
        const indirectos = data.fixes.filter(item => item.clasificacion === 'Indirecto');
        this.totalFijoIndirecto = indirectos.reduce((total, item) => total + (Number(item.precio) || 0), 0);
      }

      if (data.assets) {
        this.allAssets = data.assets;
      }
    });

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

    this.totalPages = Math.ceil(temp.length / this.pageSize) || 1;
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
    
    this.totalPagesArray = Array.from({ length: this.totalPages }, (_, i) => i + 1);

    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedBudgets = temp.slice(startIndex, endIndex);
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
    this.router.navigate(['/budgets/add-budget'], { state: { edit_budget: row } });
  }

  openAdd() {
    this.router.navigate(['/budgets/add-budget']);
  }

  onDelete(id: number | undefined, descripcion: string) {
    if (!id) return;
    Swal.fire({
      title: '¿Eliminar Presupuesto?',
      text: `¿Está seguro de eliminar el presupuesto "${descripcion}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
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
    const rowRec = row as unknown as Record<string, unknown>;

    // Totales Físicos
    let totalGramos = 0;
    let totalHorasRaw = 0;
    let totalMinutosRaw = 0;

    (row.piezas || []).forEach(p => {
      totalGramos += Number(p.gramos) || 0;
      totalHorasRaw += Number(p.horas) || 0;
      totalMinutosRaw += Number(p.minutos) || 0;
    });

    const prepMin = Number(row.tiempoSetup) || 0;
    const postMin = Number(row.tiempoPostProcesado) || 0;

    const totalMinutosCompleto = totalMinutosRaw + prepMin + postMin;
    const extraHours = Math.floor(totalMinutosCompleto / 60);
    const finalHoras = totalHorasRaw + extraHours;
    const finalMinutos = totalMinutosCompleto % 60;
    const totalTiempoHoras = finalHoras + (finalMinutos / 60);

    // 1. Costo Materiales con Merma
    let rawMaterialCost = 0;
    let totalCostoInventario = 0;

    (row.piezas || []).forEach(p => {
      const pRec = p as unknown as Record<string, unknown>;
      if (p.tipo === 'Del Inventario') {
        const actId = p.activo ?? pRec['activo_id'] ?? pRec['activo'] ?? pRec['id'];
        let val = 0;
        if (actId) {
          const foundAsset = this.allAssets.find(a => a.id == actId);
          if (foundAsset) {
            val = Number(foundAsset.valorUnitario) || Number(foundAsset.costoInicial) || Number((foundAsset as unknown as Record<string, unknown>)['precio']) || 0;
          }
        }
        if (val <= 0) {
          val = Number(pRec['costoInicial'] ?? pRec['valorUnitario'] ?? pRec['precio'] ?? p.precioMaterial) || 0;
        }
        const cant = Number(p.cantidad) || 1;
        totalCostoInventario += val * cant;
      } else {
        const g = Number(p.gramos) || 0;
        const pm = Number(p.precioMaterial) || 0;
        rawMaterialCost += g * pm;
      }
    });

    const totalCostoMaterial = rawMaterialCost * (1 + ((Number(row.tasaFalloGlobal) || 0) / 100));

    // 2. Costo Operativo Máquina
    const totalCostoMaquina = (Number(row.costoMaquina) || 0) * totalTiempoHoras;

    // 3. Costo Indirecto Prorrateado (CIF)
    const tasaCIFHora = this.totalFijoIndirecto / (this.capacidadHorasMaquina || 160);
    const totalCostoIndirecto = Number(rowRec['costoIndirectoProrrateado']) || Number(rowRec['costoIndirecto']) || (tasaCIFHora * totalTiempoHoras);

    // 4. Costo Total Base
    const baseCost = totalCostoMaterial + totalCostoMaquina + totalCostoIndirecto + totalCostoInventario;

    const margin = Number(row.margenGanancia) || 0;
    const factor = margin / 100;
    const suggestedPrice = factor >= 1 ? baseCost / 0.0001 : baseCost / (1 - factor);

    const deliveryCost = Number(row.delivery) || Number(rowRec['delivery']) || 0;
    const cantidadGlobal = Number(row.cantidadGlobal) || Number(rowRec['cantidadGlobal']) || 1;
    const totalBudgetFinal = (suggestedPrice * cantidadGlobal) + deliveryCost;

    // Construir tabla de piezas
    const piezasRows = (row.piezas || []).map(p => {
      const g = Number(p.gramos) || 0;
      const h = Number(p.horas) || 0;
      const min = Number(p.minutos) || 0;
      const matCost = p.tipo === 'Del Inventario' ? 0 : g * (Number(p.precioMaterial) || 0);
      const maqCost = (Number(row.costoMaquina) || 0) * (h + (min / 60));

      return `
        <tr>
          <td class="text-start fw-medium">${p.nombre || 'Pieza'}</td>
          <td>${g.toFixed(2)}</td>
          <td>${h}</td>
          <td>${min}</td>
          <td>$${matCost.toFixed(2)}</td>
          <td class="fw-bold text-primary">$${maqCost.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    Swal.fire({
      title: `<div class="text-start text-primary fw-bold fs-5">Estudio de Presupuesto</div>`,
      html: `
        <div class="text-start" style="font-family: 'Inter', sans-serif; font-size: 0.85rem;">
          <div class="row g-3 mb-3">
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
                  <div class="d-flex justify-content-between mb-1" style="font-size: 0.8rem;">
                    <span class="text-white-50">Costo Indirecto Prorrateado:</span>
                    <span class="fw-medium">$${totalCostoIndirecto.toFixed(2)}</span>
                  </div>
                  ${totalCostoInventario > 0 ? `
                  <div class="d-flex justify-content-between mb-1" style="font-size: 0.8rem;">
                    <span class="text-white-50">Costo Piezas Inventario:</span>
                    <span class="fw-medium">$${totalCostoInventario.toFixed(2)}</span>
                  </div>
                  ` : ''}
                  <div class="d-flex justify-content-between mb-2 border-bottom border-white border-opacity-25 pb-2" style="font-size: 0.8rem;">
                    <span class="text-white-50">Costo Unitario Base:</span>
                    <span class="fw-bold">$${baseCost.toFixed(2)}</span>
                  </div>
                  <div class="mt-2 pt-2 border-top border-white border-opacity-25">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                      <span class="text-white-50" style="font-size: 0.75rem;">Precio Sugerido Unitario:</span>
                      <span class="fw-bold text-white fs-5">$${suggestedPrice.toFixed(2)}</span>
                    </div>
                    ${deliveryCost > 0 ? `
                    <div class="d-flex justify-content-between align-items-center mb-1" style="font-size: 0.75rem;">
                      <span class="text-white-50">Costo de Delivery:</span>
                      <span class="fw-medium text-white">$${deliveryCost.toFixed(2)}</span>
                    </div>
                    ` : ''}
                    <div class="pt-2 border-top border-white border-opacity-25 mt-2">
                      <div class="text-white-50 mb-1" style="font-size: 0.7rem;">Presupuesto Total Final</div>
                      <div class="fs-4 fw-bold text-warning">$${totalBudgetFinal.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
                    <th class="fw-semibold border-0 text-white py-2 pe-2">Costo Máquina</th>
                  </tr>
                </thead>
                <tbody>
                  ${piezasRows || '<tr><td colspan="6" class="text-muted py-2">No hay piezas en este presupuesto</td></tr>'}
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
