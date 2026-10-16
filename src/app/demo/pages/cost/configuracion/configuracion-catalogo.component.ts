import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Family } from '../../../../core/models/Cost/family';
import { MaterialCatalogo, TecnologiaCatalogo, CatalogoSimple } from '../../../../core/models/Cost/catalog-config';
import { CodingService } from '../../../../core/services/cost/coding.service';
import { CatalogConfigService } from '../../../../core/services/cost/catalog-config.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-configuracion-catalogo',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './configuracion-catalogo.component.html'
})
export class ConfiguracionCatalogoComponent implements OnInit {
  private router = inject(Router);
  private codingService = inject(CodingService);
  private catalogConfigService = inject(CatalogConfigService);
  private cdr = inject(ChangeDetectorRef);

  loading = true;
  activeTab: 'familias' | 'tecnologias' | 'materiales' | 'marcas' | 'colores' = 'familias';

  familias: Family[] = [];
  tecnologias: TecnologiaCatalogo[] = [];
  materiales: MaterialCatalogo[] = [];
  marcas: CatalogoSimple[] = [];
  colores: CatalogoSimple[] = [];
  search = '';

  // Paginación y ordenación
  currentPage: number = 1;
  pageSize: number = 10;
  sortColumn: string = '';
  sortAscending: boolean = true;
  Math = Math;

  ngOnInit(): void {
    this.cargar();
  }

  setActiveTab(tab: 'familias' | 'tecnologias' | 'materiales' | 'marcas' | 'colores') {
    this.activeTab = tab;
    this.search = '';
    this.currentPage = 1;
    this.sortColumn = '';
    this.sortAscending = true;
  }

  onSearchChange() {
    this.currentPage = 1;
  }

  onPageSizeChange() {
    this.currentPage = 1;
  }

  setPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  sortData(column: string) {
    if (this.sortColumn === column) {
      this.sortAscending = !this.sortAscending;
    } else {
      this.sortColumn = column;
      this.sortAscending = true;
    }
  }

  getSortClass(column: string): string {
    if (this.sortColumn !== column) return 'ti-selector text-muted';
    return this.sortAscending ? 'ti-chevron-up text-primary' : 'ti-chevron-down text-primary';
  }

  get totalItems(): number {
    switch (this.activeTab) {
      case 'familias': return this.familiasFiltradas.length;
      case 'tecnologias': return this.tecnologiasFiltradas.length;
      case 'materiales': return this.materialesFiltrados.length;
      case 'marcas': return this.marcasFiltradas.length;
      case 'colores': return this.coloresFiltrados.length;
      default: return 0;
    }
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.pageSize) || 1;
  }

  private ordenarItems<T>(items: T[], extractor: (item: T, col: string) => unknown): T[] {
    if (!this.sortColumn) return [...items];
    return [...items].sort((a, b) => {
      let valA = extractor(a, this.sortColumn);
      let valB = extractor(b, this.sortColumn);
      if (typeof valA === 'string') valA = (valA as string).toLowerCase();
      if (typeof valB === 'string') valB = (valB as string).toLowerCase();
      if (valA === null || valA === undefined) return this.sortAscending ? 1 : -1;
      if (valB === null || valB === undefined) return this.sortAscending ? -1 : 1;
      if (valA < valB) return this.sortAscending ? -1 : 1;
      if (valA > valB) return this.sortAscending ? 1 : -1;
      return 0;
    });
  }

  private paginar<T>(items: T[]): T[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return items.slice(start, start + this.pageSize);
  }

  cargar() {
    this.loading = true;
    this.codingService.getFamilies().subscribe({
      next: (data) => {
        this.familias = data || [];
        this.cdr.detectChanges();
      }
    });
    this.catalogConfigService.getTecnologias().subscribe({
      next: (data) => {
        this.tecnologias = data || [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; }
    });
    this.catalogConfigService.getMateriales().subscribe({
      next: (data) => {
        this.materiales = data || [];
        this.cdr.detectChanges();
      }
    });
    this.catalogConfigService.getMarcas().subscribe({
      next: (data) => {
        this.marcas = data || [];
        this.cdr.detectChanges();
      }
    });
    this.catalogConfigService.getColores().subscribe({
      next: (data) => {
        this.colores = data || [];
        this.cdr.detectChanges();
      }
    });
  }

  get familiasFiltradas(): Family[] {
    const q = this.search.toLowerCase().trim();
    let res = this.familias;
    if (q) {
      res = res.filter(f =>
        (f.codigo || '').toLowerCase().includes(q) || (f.nombre || '').toLowerCase().includes(q)
      );
    }
    return this.ordenarItems(res, (f, col) => col === 'codigo' ? f.codigo : f.nombre);
  }

  get familiasPaginadas(): Family[] {
    return this.paginar(this.familiasFiltradas);
  }

  get tecnologiasFiltradas(): TecnologiaCatalogo[] {
    const q = this.search.toLowerCase().trim();
    let res = this.tecnologias;
    if (q) {
      res = res.filter(t =>
        (t.codigo || '').toLowerCase().includes(q) || (t.nombre || '').toLowerCase().includes(q)
      );
    }
    return this.ordenarItems(res, (t, col) => col === 'codigo' ? t.codigo : t.nombre);
  }

  get tecnologiasPaginadas(): TecnologiaCatalogo[] {
    return this.paginar(this.tecnologiasFiltradas);
  }

  get materialesFiltrados(): MaterialCatalogo[] {
    const q = this.search.toLowerCase().trim();
    let res = this.materiales;
    if (q) {
      res = res.filter(m =>
        (m.codigo || '').toLowerCase().includes(q) || (m.nombre || '').toLowerCase().includes(q)
      );
    }
    return this.ordenarItems(res, (m, col) => col === 'codigo' ? m.codigo : m.nombre);
  }

  get materialesPaginados(): MaterialCatalogo[] {
    return this.paginar(this.materialesFiltrados);
  }

  get marcasFiltradas(): CatalogoSimple[] {
    const q = this.search.toLowerCase().trim();
    let res = this.marcas;
    if (q) {
      res = res.filter(m => (m.nombre || '').toLowerCase().includes(q));
    }
    return this.ordenarItems(res, m => m.nombre);
  }

  get marcasPaginadas(): CatalogoSimple[] {
    return this.paginar(this.marcasFiltradas);
  }

  get coloresFiltrados(): CatalogoSimple[] {
    const q = this.search.toLowerCase().trim();
    let res = this.colores;
    if (q) {
      res = res.filter(c => (c.nombre || '').toLowerCase().includes(q));
    }
    return this.ordenarItems(res, c => c.nombre);
  }

  get coloresPaginados(): CatalogoSimple[] {
    return this.paginar(this.coloresFiltrados);
  }

  openAddFamily() {
    this.router.navigate(['/configuracion/add-family']);
  }

  onViewSubfamilies(row: Family) {
    const subs = row.subFamilias || [];
    if (subs.length === 0) {
      Swal.fire({
        icon: 'info',
        title: `${row.nombre} (${row.codigo})`,
        html: `
          <div class="text-start p-2">
            <p class="text-muted mb-3">Esta familia no tiene subfamilias registradas. Los productos asociados usarán correlativos numéricos estándar (01, 02...).</p>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="ti ti-plus me-1"></i> Agregar Subfamilia',
        cancelButtonText: 'Cerrar',
        confirmButtonColor: '#4680ff',
        cancelButtonColor: '#6c757d'
      }).then(result => {
        if (result.isConfirmed) {
          this.onEditFamily(row);
        }
      });
      return;
    }

    const rowsHtml = subs.map(s => `
      <tr>
        <td class="font-monospace fw-bold text-primary">${s.codigo}</td>
        <td>${s.nombre}</td>
      </tr>
    `).join('');

    Swal.fire({
      title: `${row.nombre} (${row.codigo})`,
      html: `
        <div class="text-start mt-2">
          <p class="text-muted small mb-2">Subfamilias registradas que definen la serie del código:</p>
          <div class="table-responsive border rounded" style="max-height: 250px; overflow-y: auto;">
            <table class="table table-sm table-striped table-hover mb-0 text-start align-middle">
              <thead class="table-light sticky-top">
                <tr>
                  <th style="width: 100px;">Código</th>
                  <th>Subfamilia / Serie</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '<i class="ti ti-edit me-1"></i> Editar Familia',
      cancelButtonText: 'Cerrar',
      confirmButtonColor: '#4680ff',
      cancelButtonColor: '#6c757d',
      width: '520px'
    }).then(result => {
      if (result.isConfirmed) {
        this.onEditFamily(row);
      }
    });
  }

  onEditFamily(row: Family) {
    this.router.navigate(['/configuracion/add-family'], { state: { edit_family: row } });
  }

  onDeleteFamily(row: Family) {
    if (!row.id) return;
    Swal.fire({
      title: `¿Eliminar la familia ${row.nombre}?`,
      showDenyButton: true,
      confirmButtonText: 'Eliminar',
      denyButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.codingService.deleteFamily(row.id!).subscribe({
          next: () => this.cargar()
        });
      }
    });
  }

  openAddTecnologia() {
    this.router.navigate(['/configuracion/add-tecnologia']);
  }

  onEditTecnologia(row: TecnologiaCatalogo) {
    this.router.navigate(['/configuracion/add-tecnologia'], { state: { edit_tecnologia: row } });
  }

  onDeleteTecnologia(row: TecnologiaCatalogo) {
    if (!row.id) return;
    Swal.fire({
      title: `¿Eliminar la tecnología ${row.nombre}?`,
      showDenyButton: true,
      confirmButtonText: 'Eliminar',
      denyButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.catalogConfigService.deleteTecnologia(row.id!).subscribe({
          next: () => this.cargar()
        });
      }
    });
  }

  openAddMaterial() {
    this.router.navigate(['/configuracion/add-material']);
  }

  onEditMaterial(row: MaterialCatalogo) {
    this.router.navigate(['/configuracion/add-material'], { state: { edit_material: row } });
  }

  onDeleteMaterial(row: MaterialCatalogo) {
    if (!row.id) return;
    Swal.fire({
      title: `¿Eliminar el material ${row.nombre}?`,
      showDenyButton: true,
      confirmButtonText: 'Eliminar',
      denyButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.catalogConfigService.deleteMaterial(row.id!).subscribe({
          next: () => this.cargar()
        });
      }
    });
  }

  openAddMarca() {
    this.router.navigate(['/configuracion/add-marca']);
  }

  onEditMarca(row: CatalogoSimple) {
    this.router.navigate(['/configuracion/add-marca'], { state: { edit_marca: row } });
  }

  onDeleteMarca(row: CatalogoSimple) {
    if (!row.id) return;
    Swal.fire({
      title: `¿Eliminar la marca ${row.nombre}?`,
      showDenyButton: true,
      confirmButtonText: 'Eliminar',
      denyButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.catalogConfigService.deleteMarca(row.id!).subscribe({
          next: () => this.cargar()
        });
      }
    });
  }

  openAddColor() {
    this.router.navigate(['/configuracion/add-color']);
  }

  onEditColor(row: CatalogoSimple) {
    this.router.navigate(['/configuracion/add-color'], { state: { edit_color: row } });
  }

  onDeleteColor(row: CatalogoSimple) {
    if (!row.id) return;
    Swal.fire({
      title: `¿Eliminar el color ${row.nombre}?`,
      showDenyButton: true,
      confirmButtonText: 'Eliminar',
      denyButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.catalogConfigService.deleteColor(row.id!).subscribe({
          next: () => this.cargar()
        });
      }
    });
  }

  tecnologiasDeMaterial(row: MaterialCatalogo): string {
    return (row.tecnologias || []).map(t => t.codigo).join(', ') || '-';
  }

  materialesDeTecnologia(row: TecnologiaCatalogo): string {
    return (row.materiales || []).map(m => m.codigo).join(', ') || '-';
  }
}
