import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Config, Machine } from '../../../../../core/models/Cost/config';
import { ConfigService } from '../../../../../core/services/cost/config.service';

interface GroupedCapacity {
  medida: string;
  machines: Machine[];
  capacities: {
    installedCapacity: number;
    productionCapacity: number;
    idleCapacity: number;
    utilizationPercentage: string | number;
  };
}

@Component({
  selector: 'app-config',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './config.component.html'
})
export class ConfigComponent implements OnInit {
  private router = inject(Router);
  private configService = inject(ConfigService);

  loading = true;
  configs: Config[] = [];
  filteredConfigs: Config[] = [];
  selectedRow: Config | null = null;
  groupedCapacities: GroupedCapacity[] = [];

  // Paginación y búsqueda
  searchTerm: string = '';
  currentPage: number = 1;
  pageSize: number = 10;
  totalPages: number = 1;
  totalPagesArray: number[] = [];
  paginatedConfigs: Config[] = [];

  // Ordenación
  sortColumn: string = 'nombre';
  sortAscending: boolean = true;

  Math = Math; // Para usar en la plantilla

  ngOnInit(): void {
    this.getConfigs();
  }

  getConfigs() {
    this.loading = true;
    this.configService.getConfigs().subscribe({
      next: (data) => {
        this.configs = data;
        this.filteredConfigs = [...this.configs];
        this.applyFilterAndPagination();
        
        // Si hay al menos un perfil, lo seleccionamos por defecto
        if (this.configs.length > 0) {
          this.selectRow(this.configs[0]);
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading configs:', error);
        this.loading = false;
      }
    });
  }

  selectRow(row: Config) {
    this.selectedRow = row;
    this.calculateGroupedCapacities(row.parametros || []);
  }

  calculateGroupedCapacities(machines: Machine[]) {
    if (!machines || machines.length === 0) {
      this.groupedCapacities = [];
      return;
    }

    const grouped: { [key: string]: Machine[] } = machines.reduce((groups: { [key: string]: Machine[] }, machine) => {
      const medida = machine.unidad || 'Sin medida';
      if (!groups[medida]) groups[medida] = [];
      groups[medida].push(machine);
      return groups;
    }, {});

    this.groupedCapacities = Object.keys(grouped).map(medida => {
      const groupMachines = grouped[medida];
      const installed = groupMachines.reduce((sum, m) => sum + (m.horasMax * m.prodMaxHoras), 0);
      const production = groupMachines.reduce((sum, m) => sum + (m.horasUso * m.prodMaxHoras), 0);
      
      return {
        medida,
        machines: groupMachines,
        capacities: {
          installedCapacity: installed,
          productionCapacity: production,
          idleCapacity: installed - production,
          utilizationPercentage: installed > 0 ? ((production / installed) * 100).toFixed(2) : 0
        }
      };
    });
  }

  onSearchChange() {
    this.currentPage = 1;
    this.applyFilterAndPagination();
  }

  applyFilterAndPagination() {
    const query = this.searchTerm.toLowerCase().trim();
    if (!query) {
      this.filteredConfigs = [...this.configs];
    } else {
      this.filteredConfigs = this.configs.filter(c => 
        c.nombre.toLowerCase().includes(query) || 
        c.rif.toLowerCase().includes(query) ||
        c.tipo.toLowerCase().includes(query) ||
        c.sector.toLowerCase().includes(query)
      );
    }

    // Ordenamiento
    this.filteredConfigs.sort((a: Config, b: Config) => {
      const prop = this.sortColumn as keyof Config;
      let valA = a[prop];
      let valB = b[prop];
      
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA === null || valA === undefined) return this.sortAscending ? 1 : -1;
      if (valB === null || valB === undefined) return this.sortAscending ? -1 : 1;

      if (valA < valB) return this.sortAscending ? -1 : 1;
      if (valA > valB) return this.sortAscending ? 1 : -1;
      return 0;
    });

    // Paginación
    this.totalPages = Math.ceil(this.filteredConfigs.length / this.pageSize) || 1;
    this.totalPagesArray = Array.from({ length: this.totalPages }, (_, i) => i + 1);
    
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }

    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.paginatedConfigs = this.filteredConfigs.slice(startIndex, startIndex + this.pageSize);
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

  onEdit(row: Config) {
    // Transferir datos al formulario
    localStorage.setItem('cost_edit_config', JSON.stringify(row));
    this.router.navigate(['/configs/add-config']);
  }

  openAdd() {
    // Limpiar formulario para nuevo registro
    localStorage.removeItem('cost_edit_config');
    this.router.navigate(['/configs/add-config']);
  }
}
