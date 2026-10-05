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
import {
  parseCedula,
  resolveProductDescription,
  resolveRateMaquina,
  showBudgetStudyModal,
  ClientModalData
} from '../../../../../core/utils/budget-dialog.helper';
import { AuthService } from '../../../../../core/services/auth.service';
import { InventoryService } from '../../../../../core/services/cost/inventory.service';
import { NgSelectModule } from '@ng-select/ng-select';
import { Product } from '../../../../../core/models/Cost/product';
import { ProductService } from '../../../../../core/services/cost/product.service';

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
  private productService = inject(ProductService);
  private cdr = inject(ChangeDetectorRef);
  public authService = inject(AuthService);
  private inventoryService = inject(InventoryService);
  loading = true;
  selectedRow: Budget | null = null;

  showClientModal = false;
  isClientRegistered = false;
  savingClient = false;
  currentBudgetForModal: Budget | null = null;

  selectedClientData: ClientModalData = {
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
  allProducts: Product[] = [];
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
      assets: this.assetService.getAssets(),
      products: this.productService.getProducts()
    }).subscribe(data => {
      if (data.products) {
        this.allProducts = data.products;
      }
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

  getDescripcionOProducto(row: Budget): string {
    return resolveProductDescription(row, this.allProducts);
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
    return resolveRateMaquina(row, this.allAssets);
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
        this.getDescripcionOProducto(b).toLowerCase().includes(query) ||
        (b.numero || '').toLowerCase().includes(query)
      );
    }

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

  estadoDe(row: Budget): string {
    return (row.estado || 'borrador').toLowerCase();
  }

  onSell(row: Budget) {
    if (!row.id) return;
    if (this.estadoDe(row) === 'vendido') {
      Swal.fire('Atención', 'Este presupuesto ya fue vendido.', 'info');
      return;
    }
    Swal.fire({
      title: 'Convertir a venta',
      text: 'Se descontarán los activos circulantes del BOM y el presupuesto quedará como vendido.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Vender'
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.inventoryService.createSale(row.id as number, row.cantidadGlobal).subscribe({
        next: () => {
          row.estado = 'vendido';
          this.cdr.detectChanges();
          Swal.fire('Venta registrada', 'El inventario de circulantes se actualizó.', 'success');
        },
        error: (err) => Swal.fire('Error', err?.error?.msg || 'No se pudo concretar la venta.', 'error')
      });
    });
  }

  onAnular(row: Budget) {
    if (!row.id) return;
    if (this.estadoDe(row) === 'vendido') {
      Swal.fire('Atención', 'Una venta concretada no se anula desde aquí.', 'info');
      return;
    }
    this.budgetService.updateBudget(row.id, { ...row, estado: 'anulado' }).subscribe({
      next: () => {
        row.estado = 'anulado';
        this.cdr.detectChanges();
        Swal.fire('Anulado', 'El presupuesto se anuló y se liberó la reserva.', 'success');
      },
      error: () => Swal.fire('Error', 'No se pudo anular.', 'error')
    });
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
    showBudgetStudyModal(
      row,
      this.allAssets,
      this.totalFijoIndirecto,
      this.capacidadHorasMaquina
    );
  }

  parseCedula(rawCedula: string): { nac: string; num: string } {
    return parseCedula(rawCedula);
  }

  onOpenClientModal(row: Budget) {
    this.currentBudgetForModal = row;
    const rRec = row as unknown as Record<string, unknown>;
    const cliObj = rRec['cliente'] ?? rRec['clienteId'] ?? rRec['cliente_id'];

    if (cliObj && typeof cliObj === 'object') {
      const cRec = cliObj as Record<string, unknown>;
      this.isClientRegistered = true;
      const rawCed = String(cRec['cedula'] || cRec['rifCedula'] || cRec['rif_cedula'] || cRec['rif'] || '');
      const parsed = parseCedula(rawCed);
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
          const parsed = parseCedula(rawCed);
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
      const parsed = parseCedula(rawCed);

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
