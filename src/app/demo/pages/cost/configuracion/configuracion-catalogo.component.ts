import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Family } from '../../../../core/models/Cost/family';
import { MaterialCatalogo, TecnologiaCatalogo } from '../../../../core/models/Cost/catalog-config';
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
  activeTab: 'familias' | 'tecnologias' | 'materiales' = 'familias';

  familias: Family[] = [];
  tecnologias: TecnologiaCatalogo[] = [];
  materiales: MaterialCatalogo[] = [];
  search = '';

  ngOnInit(): void {
    this.cargar();
  }

  setActiveTab(tab: 'familias' | 'tecnologias' | 'materiales') {
    this.activeTab = tab;
    this.search = '';
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
  }

  get familiasFiltradas(): Family[] {
    const q = this.search.toLowerCase().trim();
    if (!q) return this.familias;
    return this.familias.filter(f =>
      (f.codigo || '').toLowerCase().includes(q) || (f.nombre || '').toLowerCase().includes(q)
    );
  }

  get tecnologiasFiltradas(): TecnologiaCatalogo[] {
    const q = this.search.toLowerCase().trim();
    if (!q) return this.tecnologias;
    return this.tecnologias.filter(t =>
      (t.codigo || '').toLowerCase().includes(q) || (t.nombre || '').toLowerCase().includes(q)
    );
  }

  get materialesFiltrados(): MaterialCatalogo[] {
    const q = this.search.toLowerCase().trim();
    if (!q) return this.materiales;
    return this.materiales.filter(m =>
      (m.codigo || '').toLowerCase().includes(q) || (m.nombre || '').toLowerCase().includes(q)
    );
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

  tecnologiasDeMaterial(row: MaterialCatalogo): string {
    return (row.tecnologias || []).map(t => t.codigo).join(', ') || '-';
  }

  materialesDeTecnologia(row: TecnologiaCatalogo): string {
    return (row.materiales || []).map(m => m.codigo).join(', ') || '-';
  }
}
