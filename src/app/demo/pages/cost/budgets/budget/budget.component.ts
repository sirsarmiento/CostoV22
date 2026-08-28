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
import { ClientService } from '../../../../../core/services/cost/client.service';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';
import { calculateBudgetTotals, normalizeBudget } from '../../../../../core/utils/budget-calculator';

import { AuthService } from '../../../../../core/services/auth.service';

import { NgSelectModule } from '@ng-select/ng-select';

@Component({
  selector: 'app-budget',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NgSelectModule],
  templateUrl: './budget.component.html'
})
export class BudgetComponent implements OnInit {
  private router = inject(Router);
  private budgetService = inject(BudgetService);
  private configService = inject(ConfigService);
  private fixeService = inject(FixeService);
  private assetService = inject(AssetService);
  private clientService = inject(ClientService);
  private cdr = inject(ChangeDetectorRef);
  public authService = inject(AuthService);
  loading = true;
  selectedRow: Budget | null = null;

  showClientModal = false;
  isClientRegistered = false;
  savingClient = false;
  currentBudgetForModal: Budget | null = null;

  selectedClientData = {
    nombre: '',
    rifCedula: '',
    nacionalidad: 'V',
    nroDocumento: '',
    categoria: '',
    telefono: '',
    email: '',
    direccion: ''
  };

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
      this.getBudgets();
    }, () => {
      this.getBudgets();
    });
  }

  getBudgets() {
    this.loading = true;
    this.budgetService.getBudgets().subscribe({
      next: (data) => {
        this.allBudgets = (data || []).map(b => {
          const norm = normalizeBudget(b);
          return {
            ...norm,
            costoTotalFinal: this.calcularTotalPresupuesto(norm)
          };
        });
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

  getRateMaquina(row: Budget): number {
    const rowRec = row as unknown as Record<string, unknown>;
    const rate = Number(row.costoMaquina ?? rowRec['costo_maquina'] ?? rowRec['costoMaquinaHora'] ?? rowRec['tasaMaquina']) || 0;
    if (rate > 0) return rate;

    if (row.piezas) {
      for (const p of row.piezas) {
        const pRec = p as unknown as Record<string, unknown>;
        const maqId = p.maquina ?? pRec['maquina_id'] ?? pRec['activo_id'];
        if (maqId) {
          const maq = this.allAssets.find(a => a.id == maqId);
          if (maq) {
            const consumo = Number(maq.consumoMaquina) || 0;
            const tarifa = Number(maq.tarifa) || 0;
            const mantenimiento = Number(maq.costoMantenimiento) || 0;
            const calc = (consumo / 1000 * tarifa) + mantenimiento;
            if (calc > 0) return calc;
          }
        }
      }
    }

    const firstMaq = this.allAssets.find(a => (a as unknown as Record<string, unknown>)['clasificacion'] === 'Maquinaria' || (a as unknown as Record<string, unknown>)['tipo'] === 'Maquinaria');
    if (firstMaq) {
      const consumo = Number(firstMaq.consumoMaquina) || 0;
      const tarifa = Number(firstMaq.tarifa) || 0;
      const mantenimiento = Number(firstMaq.costoMantenimiento) || 0;
      const calc = (consumo / 1000 * tarifa) + mantenimiento;
      if (calc > 0) return calc;
    }

    return 15.75;
  }

  calcularTotalPresupuesto(row: Budget): number {
    const rowRec = row as unknown as Record<string, unknown>;
    const storedTotal = Number(rowRec['total']);
    if (storedTotal && storedTotal > 0) {
      return storedTotal;
    }
    const res = calculateBudgetTotals(
      row,
      this.allAssets,
      this.totalFijoIndirecto,
      this.capacidadHorasMaquina
    );
    return res.costoTotalFinal;
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
    const norm = normalizeBudget(row);
    const res = calculateBudgetTotals(
      norm,
      this.allAssets,
      this.totalFijoIndirecto,
      this.capacidadHorasMaquina
    );

    const totalGramos = res.totalGramos;
    const finalHoras = res.totalHoras;
    const finalMinutos = res.totalMinutos;
    const totalCostoMaterial = res.totalCostoMaterial;
    const totalCostoMaquina = res.totalCostoMaquina;
    const totalCostoIndirecto = res.costoIndirectoAsignado;
    const depreciacionAsignada = res.depreciacionAsignada;
    const totalCostoInventario = res.totalCostoInventario;
    const baseCost = res.costoTotalUnitarioBase;
    const suggestedPrice = res.precioSugeridoUnitario;
    const deliveryCost = res.delivery;
    const totalBudgetFinal = res.costoTotalFinal;

    const piezasRows = (norm.piezas || []).map(p => {
      const pRec = p as unknown as Record<string, unknown>;
      const cant = Number(pRec['cantidad'] ?? p.cantidad) || 1;
      const g = (Number(pRec['gramos'] ?? p.gramos) || 0) * cant;
      const h = Number(pRec['horas'] ?? p.horas) || 0;
      const min = Number(pRec['minutos'] ?? p.minutos) || 0;
      const matCost = p.tipo === 'Del Inventario' ? 0 : g * (Number(pRec['precioMaterial'] ?? p.precioMaterial) || 0);
      const maqCost = res.costoMaquinaRate * ((h + (min / 60)) * cant);

      return `
        <tr>
          <td class="text-start fw-medium">${p.nombre || 'Pieza'} ${cant > 1 ? `(x${cant})` : ''}</td>
          <td>${g.toFixed(2)}</td>
          <td>${h * cant}</td>
          <td>${min * cant}</td>
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
                    <span class="fw-medium text-dark">${norm.clasificacion || ''}</span>
                  </div>
                  <div class="d-flex justify-content-between border-bottom border-secondary border-opacity-10 py-1">
                    <span class="text-muted" style="font-size: 0.8rem;">Nro. de Orden:</span>
                    <span class="fw-medium text-dark">${norm.numero || ''}</span>
                  </div>
                  <div class="d-flex justify-content-between border-bottom border-secondary border-opacity-10 py-1">
                    <span class="text-muted" style="font-size: 0.8rem;">Fecha:</span>
                    <span class="fw-medium text-dark">${norm.fecha ? new Date(norm.fecha).toLocaleDateString() : ''}</span>
                  </div>
                  <div class="d-flex justify-content-between border-bottom border-secondary border-opacity-10 py-1">
                    <span class="text-muted" style="font-size: 0.8rem;">Descripción:</span>
                    <span class="fw-medium text-dark">${norm.descripcion || ''}</span>
                  </div>
                  <div class="d-flex justify-content-between border-bottom border-secondary border-opacity-10 py-1">
                    <span class="text-muted" style="font-size: 0.8rem;">Tasa de Fallo (Merma):</span>
                    <span class="text-danger fw-medium">${norm.tasaFalloGlobal || 0}%</span>
                  </div>
                  <div class="d-flex justify-content-between border-bottom border-secondary border-opacity-10 py-1">
                    <span class="text-muted" style="font-size: 0.8rem;">Prep/Slicing:</span>
                    <span class="fw-medium text-dark">${res.tiempoSetupMin} min</span>
                  </div>
                  <div class="d-flex justify-content-between pt-1">
                    <span class="text-muted" style="font-size: 0.8rem;">Post-procesado:</span>
                    <span class="fw-medium text-dark">${res.tiempoPostProcesadoMin} min</span>
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
                  ${depreciacionAsignada > 0 ? `
                  <div class="d-flex justify-content-between mb-1" style="font-size: 0.8rem;">
                    <span class="text-white-50">Depreciación Prorrateada:</span>
                    <span class="fw-medium">$${depreciacionAsignada.toFixed(2)}</span>
                  </div>
                  ` : ''}
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

  parseCedula(rawCedula: string): { nac: string; num: string } {
    const clean = String(rawCedula || '').trim();
    if (!clean) return { nac: 'V', num: '' };
    const match = clean.match(/^([VEJGP])[-_ ]*(.*)$/i);
    if (match) {
      return { nac: match[1].toUpperCase(), num: match[2] };
    }
    return { nac: 'V', num: clean };
  }

  onOpenClientModal(row: Budget) {
    this.currentBudgetForModal = row;
    const rRec = row as unknown as Record<string, unknown>;
    const cliObj = rRec['cliente'] ?? rRec['clienteId'] ?? rRec['cliente_id'];

    if (cliObj && typeof cliObj === 'object') {
      const cRec = cliObj as Record<string, unknown>;
      this.isClientRegistered = true;
      const rawCed = String(cRec['cedula'] || cRec['rifCedula'] || cRec['rif_cedula'] || cRec['rif'] || '');
      const parsed = this.parseCedula(rawCed);
      this.selectedClientData = {
        nombre: `${cRec['nombre'] || ''} ${cRec['apellido'] || ''}`.trim() || String(cRec['nombre'] || ''),
        rifCedula: rawCed,
        nacionalidad: parsed.nac,
        nroDocumento: parsed.num,
        categoria: String(cRec['categoria'] || ''),
        telefono: String(cRec['telefono'] || ''),
        email: String(cRec['email'] || ''),
        direccion: String(cRec['direccion'] || '')
      };
    } else if (cliObj && (typeof cliObj === 'number' || typeof cliObj === 'string') && Number(cliObj) > 0) {
      this.isClientRegistered = true;
      const cId = Number(cliObj);
      this.clientService.getClients().subscribe(clients => {
        const found = clients.find(c => Number(c.id) === cId);
        if (found) {
          const rawCed = String(found.cedula || found.rifCedula || '');
          const parsed = this.parseCedula(rawCed);
          this.selectedClientData = {
            nombre: `${found.nombre} ${found.apellido || ''}`.trim(),
            rifCedula: rawCed,
            nacionalidad: parsed.nac,
            nroDocumento: parsed.num,
            categoria: found.categoria || '',
            telefono: found.telefono || '',
            email: found.email || '',
            direccion: found.direccion || ''
          };
        }
      });
    } else {
      this.isClientRegistered = false;
      const cliDetalle = (rRec['clienteDetalle'] ?? rRec['cliente_detalle'] ?? rRec['clienteInfo'] ?? rRec['tempClienteData']) as Record<string, unknown> | undefined;
      const cliNombre = String(rRec['clienteNombre'] || rRec['nombreCliente'] || rRec['cliente_nombre'] || cliDetalle?.['nombre'] || rRec['clienteNombreTexto'] || '').trim();
      const rawCed = String(cliDetalle?.['cedula'] || cliDetalle?.['rifCedula'] || cliDetalle?.['rif_cedula'] || rRec['cedula'] || rRec['rifCedula'] || rRec['rif_cedula'] || rRec['rif'] || '');
      const parsed = this.parseCedula(rawCed);

      this.selectedClientData = {
        nombre: cliDetalle ? String(cliDetalle['nombre'] || cliDetalle['nombreRazonSocial'] || cliNombre) : cliNombre,
        rifCedula: rawCed,
        nacionalidad: parsed.nac,
        nroDocumento: parsed.num,
        categoria: String(cliDetalle?.['categoria'] || rRec['clienteCategoria'] || rRec['categoria'] || ''),
        telefono: String(cliDetalle?.['telefono'] || rRec['telefono'] || ''),
        email: String(cliDetalle?.['email'] || rRec['email'] || ''),
        direccion: String(cliDetalle?.['direccion'] || rRec['direccion'] || '')
      };
    }

    this.showClientModal = true;
  }

  closeClientModal() {
    this.showClientModal = false;
    this.currentBudgetForModal = null;
  }

  registerClientFromModal() {
    if (!this.selectedClientData.nombre.trim()) {
      Swal.fire('Error', 'Ingrese el nombre del cliente.', 'warning');
      return;
    }

    this.savingClient = true;
    const parts = this.selectedClientData.nombre.trim().split(' ');
    const firstWord = parts[0] || this.selectedClientData.nombre.trim();
    const remainingWords = parts.slice(1).join(' ');

    const nac = this.selectedClientData.nacionalidad || 'V';
    const num = (this.selectedClientData.nroDocumento || '').trim();
    const fullCedula = num ? `${nac}-${num}` : (this.selectedClientData.rifCedula || '');

    const newClientPayload = {
      nombre: firstWord,
      apellido: remainingWords,
      cedula: fullCedula,
      rifCedula: fullCedula,
      categoria: this.selectedClientData.categoria,
      telefono: this.selectedClientData.telefono,
      email: this.selectedClientData.email,
      direccion: this.selectedClientData.direccion
    };

    this.clientService.createClient(newClientPayload).subscribe({
      next: (created: { id?: number | string }) => {
        this.savingClient = false;
        const newCliId = created && created.id ? Number(created.id) : undefined;

        if (this.currentBudgetForModal && newCliId) {
          const bId = Number(this.currentBudgetForModal.id);
          const updatePayload: Record<string, unknown> = {
            ...this.currentBudgetForModal,
            cliente: newCliId,
            clienteId: newCliId
          };

          this.budgetService.updateBudget(bId, updatePayload as unknown as Budget).subscribe({
            next: () => {
              Swal.fire('¡Registrado!', 'El cliente ha sido guardado oficialmente y vinculado al presupuesto.', 'success');
              if (this.currentBudgetForModal) {
                (this.currentBudgetForModal as unknown as Record<string, unknown>)['cliente'] = newCliId;
                (this.currentBudgetForModal as unknown as Record<string, unknown>)['clienteId'] = newCliId;
              }
              this.isClientRegistered = true;
              this.closeClientModal();
              this.getBudgets();
            },
            error: () => {
              Swal.fire('Error', 'Cliente registrado, pero ocurrió un error al actualizar el presupuesto.', 'warning');
              this.closeClientModal();
              this.getBudgets();
            }
          });
        } else {
          Swal.fire('¡Registrado!', 'El cliente ha sido guardado en el directorio.', 'success');
          this.closeClientModal();
        }
      },
      error: (err) => {
        this.savingClient = false;
        console.error(err);
        Swal.fire('Error', 'No se pudo registrar el cliente.', 'error');
      }
    });
  }
}
