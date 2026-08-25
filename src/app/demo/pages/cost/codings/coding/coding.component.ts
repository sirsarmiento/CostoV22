import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Family } from '../../../../../core/models/Cost/family';
import { SkuCoding } from '../../../../../core/models/Cost/coding';
import { CodingService } from '../../../../../core/services/cost/coding.service';
import Swal from 'sweetalert2';


@Component({
  selector: 'app-coding',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './coding.component.html'
})
export class CodingComponent implements OnInit {
  private router = inject(Router);
  private codingService = inject(CodingService);

  private cdr = inject(ChangeDetectorRef);
  loading = true;
  selectedRow: SkuCoding | null = null;
  activeTab = 0;

  // Datos SKU
  allSKUs: SkuCoding[] = [];
  filteredSKUs: SkuCoding[] = [];
  paginatedSKUs: SkuCoding[] = [];
  searchSKU = '';
  currentPageSKU = 1;
  pageSizeSKU = 10;
  totalPagesSKU = 1;
  totalPagesArraySKU: number[] = [];
  sortColumnSKU = 'sku';
  sortAscendingSKU = true;

  // Datos Familias
  allFamilies: Family[] = [];
  filteredFamilies: Family[] = [];
  paginatedFamilies: Family[] = [];
  searchFamily = '';
  currentPageFamily = 1;
  pageSizeFamily = 10;
  totalPagesFamily = 1;
  totalPagesArrayFamily: number[] = [];
  sortColumnFamily = 'codigo';
  sortAscendingFamily = true;

  Math = Math;

  ngOnInit(): void {
    this.getSKUs();
    this.getFamilies();
  }

  setActiveTab(tabIndex: number) {
    this.activeTab = tabIndex;
  }

  getSKUs() {
    this.loading = true;
    this.codingService.getSKUs().subscribe({
      next: (data) => {
        this.allSKUs = data;
        this.filteredSKUs = [...this.allSKUs];
        this.applyFilterAndPaginationSKU();
        this.loading = false;
        setTimeout(() => this.cdr.detectChanges(), 50);
      },
      error: (error) => {
        console.error('Error loading SKUs:', error);
        this.loading = false;
      }
    });
  }

  getFamilies() {
    this.loading = true;
    this.codingService.getFamilies().subscribe({
      next: (data) => {
        this.allFamilies = data;
        this.filteredFamilies = [...this.allFamilies];
        this.applyFilterAndPaginationFamily();
        this.loading = false;
        setTimeout(() => this.cdr.detectChanges(), 50);
      },
      error: (error) => {
        console.error('Error loading families:', error);
        this.loading = false;
      }
    });
  }

  onSearchSKUChange() {
    this.currentPageSKU = 1;
    this.applyFilterAndPaginationSKU();
  }

  applyFilterAndPaginationSKU() {
    const query = this.searchSKU.toLowerCase().trim();
    if (!query) {
      this.filteredSKUs = [...this.allSKUs];
    } else {
      this.filteredSKUs = this.allSKUs.filter(p => 
        (p.sku && p.sku.toLowerCase().includes(query)) ||
        (p.codigo && p.codigo.toLowerCase().includes(query)) ||
        (p.productName && p.productName.toLowerCase().includes(query)) ||
        (p.producto?.nombre && p.producto.nombre.toLowerCase().includes(query)) ||
        (p.servicio?.nombre && p.servicio.nombre.toLowerCase().includes(query)) ||
        (p.proyecto?.nombre && p.proyecto.nombre.toLowerCase().includes(query)) ||
        (p.categoria && p.categoria.toLowerCase().includes(query)) ||
        (p.tecnologia && p.tecnologia.toLowerCase().includes(query)) ||
        (p.material && p.material.toLowerCase().includes(query))
      );
    }

    // Ordenamiento
    this.filteredSKUs.sort((a: SkuCoding, b: SkuCoding) => {
      const prop = this.sortColumnSKU as keyof SkuCoding;
      let valA: string | number | null | undefined = a[prop] as string | number | null | undefined;
      let valB: string | number | null | undefined = b[prop] as string | number | null | undefined;

      if (prop === 'productName') {
         valA = a.producto?.nombre || a.servicio?.nombre || a.proyecto?.nombre || a.productName || '';
         valB = b.producto?.nombre || b.servicio?.nombre || b.proyecto?.nombre || b.productName || '';
      }
      
      if (valA && typeof valA === "string") valA = valA.toLowerCase();
      if (valB && typeof valB === "string") valB = valB.toLowerCase();

      if (valA === null || valA === undefined) return this.sortAscendingSKU ? 1 : -1;
      if (valB === null || valB === undefined) return this.sortAscendingSKU ? -1 : 1;

      if (valA < valB) return this.sortAscendingSKU ? -1 : 1;
      if (valA > valB) return this.sortAscendingSKU ? 1 : -1;
      return 0;
    });

    // Paginación
    this.totalPagesSKU = Math.ceil(this.filteredSKUs.length / this.pageSizeSKU) || 1;
    this.totalPagesArraySKU = Array.from({ length: this.totalPagesSKU }, (_, i) => i + 1);
    
    if (this.currentPageSKU > this.totalPagesSKU) {
      this.currentPageSKU = this.totalPagesSKU;
    }

    const startIndex = (this.currentPageSKU - 1) * this.pageSizeSKU;
    this.paginatedSKUs = this.filteredSKUs.slice(startIndex, startIndex + this.pageSizeSKU);
  }

  setPageSKU(page: number) {
    if (page < 1 || page > this.totalPagesSKU) return;
    this.currentPageSKU = page;
    this.applyFilterAndPaginationSKU();
  }

  onPageSizeChangeSKU() {
    this.currentPageSKU = 1;
    this.applyFilterAndPaginationSKU();
  }

  sortSKUData(column: string) {
    if (this.sortColumnSKU === column) {
      this.sortAscendingSKU = !this.sortAscendingSKU;
    } else {
      this.sortColumnSKU = column;
      this.sortAscendingSKU = true;
    }
    this.applyFilterAndPaginationSKU();
  }

  getSortClassSKU(column: string): string {
    if (this.sortColumnSKU !== column) return 'ti-selector text-muted';
    return this.sortAscendingSKU ? 'ti-chevron-up text-primary' : 'ti-chevron-down text-primary';
  }

  // --- Familias filter, sort, page ---
  onSearchFamilyChange() {
    this.currentPageFamily = 1;
    this.applyFilterAndPaginationFamily();
  }

  applyFilterAndPaginationFamily() {
    const query = this.searchFamily.toLowerCase().trim();
    if (!query) {
      this.filteredFamilies = [...this.allFamilies];
    } else {
      this.filteredFamilies = this.allFamilies.filter(f => 
        f.codigo.toLowerCase().includes(query) ||
        f.nombre.toLowerCase().includes(query)
      );
    }

    // Ordenamiento
    this.filteredFamilies.sort((a: Family, b: Family) => {
      const prop = this.sortColumnFamily as keyof Family;
      let valA = a[prop];
      let valB = b[prop];
      
      if (valA && typeof valA === "string") valA = valA.toLowerCase();
      if (valB && typeof valB === "string") valB = valB.toLowerCase();

      if (valA === null || valA === undefined) return this.sortAscendingFamily ? 1 : -1;
      if (valB === null || valB === undefined) return this.sortAscendingFamily ? -1 : 1;

      if (valA < valB) return this.sortAscendingFamily ? -1 : 1;
      if (valA > valB) return this.sortAscendingFamily ? 1 : -1;
      return 0;
    });

    // Paginación
    this.totalPagesFamily = Math.ceil(this.filteredFamilies.length / this.pageSizeFamily) || 1;
    this.totalPagesArrayFamily = Array.from({ length: this.totalPagesFamily }, (_, i) => i + 1);
    
    if (this.currentPageFamily > this.totalPagesFamily) {
      this.currentPageFamily = this.totalPagesFamily;
    }

    const startIndex = (this.currentPageFamily - 1) * this.pageSizeFamily;
    this.paginatedFamilies = this.filteredFamilies.slice(startIndex, startIndex + this.pageSizeFamily);
  }

  setPageFamily(page: number) {
    if (page < 1 || page > this.totalPagesFamily) return;
    this.currentPageFamily = page;
    this.applyFilterAndPaginationFamily();
  }

  onPageSizeChangeFamily() {
    this.currentPageFamily = 1;
    this.applyFilterAndPaginationFamily();
  }

  sortFamilyData(column: string) {
    if (this.sortColumnFamily === column) {
      this.sortAscendingFamily = !this.sortAscendingFamily;
    } else {
      this.sortColumnFamily = column;
      this.sortAscendingFamily = true;
    }
    this.applyFilterAndPaginationFamily();
  }

  getSortClassFamily(column: string): string {
    if (this.sortColumnFamily !== column) return 'ti-selector text-muted';
    return this.sortAscendingFamily ? 'ti-chevron-up text-primary' : 'ti-chevron-down text-primary';
  }

  // --- Acciones SKU ---
  openAddSKU() {
    // Navegar sin state (nuevo registro)
    this.router.navigate(['/codings/add-coding']);
  }

  onPreviewSKU(row: SkuCoding) {
    const skuCode = row.sku || row.codigo || 'N/A';
    const prodName = row.producto?.nombre || row.servicio?.nombre || row.proyecto?.nombre || row.productName || 'Producto / Servicio';
    
    let catalogCode: string;
    const parts = skuCode.split('-');
    if (parts.length >= 4) {
      catalogCode = parts.slice(3).join('-');
    } else {
      const famStr = typeof row.familia === 'string' ? row.familia : row.familia?.codigo || '???';
      const subStr = typeof row.subfamilia === 'string' ? row.subfamilia : row.subfamilia?.codigo || '';
      catalogCode = `${famStr}${subStr ? '-' + subStr : ''}-001`;
    }

    Swal.fire({
      title: `<span style="font-size: 1.15rem; color: #4680ff;" class="fw-bold"><i class="ti ti-eye me-1"></i> Previsualización de Código</span>`,
      html: `
        <div class="p-3 text-center" style="background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); border-radius: 12px;">
          <h6 class="fw-bold text-dark mb-3">${prodName}</h6>
          
          <div class="mb-3 bg-white p-3 rounded-3 border shadow-sm position-relative mt-2">
            <span class="position-absolute top-0 start-50 translate-middle badge bg-primary px-3 text-xs fw-bold rounded-pill" style="letter-spacing: 0.5px;">
              CÓDIGO ASIGNADO (SKU)
            </span>
            <span class="fs-4 fw-bold text-primary font-monospace d-block pt-2" style="letter-spacing: 1.2px;">
              ${skuCode}
            </span>
          </div>

          <div class="bg-white p-3 rounded-3 border shadow-sm position-relative mt-3">
            <span class="position-absolute top-0 start-50 translate-middle badge bg-success px-3 text-xs fw-bold rounded-pill" style="letter-spacing: 0.5px;">
              CÓDIGO CATÁLOGO
            </span>
            <span class="fs-4 fw-bold text-success font-monospace d-block pt-2" style="letter-spacing: 1.2px;">
              ${catalogCode}
            </span>
          </div>

          <div class="mt-3 pt-2 text-muted small border-top border-dashed">
            <i class="ti ti-barcode me-1"></i> SISTEMA AUTOMÁTICO DE CODIFICACIÓN
          </div>
        </div>
      `,
      showConfirmButton: true,
      confirmButtonText: 'Cerrar',
      confirmButtonColor: '#4680ff'
    });
  }

  onEditSKU(row: SkuCoding) {
    // Transferir datos al formulario a través del state del router
    this.router.navigate(['/codings/add-coding'], { state: { edit_coding: row } });
  }

  // --- Acciones Familia ---
  openAddFamily() {
    // Navegar sin state (nuevo registro)
    this.router.navigate(['/codings/add-family']);
  }

  onEditFamily(row: Family) {
    // Transferir datos al formulario a través del state del router
    this.router.navigate(['/codings/add-family'], { state: { edit_family: row } });
  }

  onDeleteFamily(row: Family) {
    Swal.fire({
      title: `¿Estás seguro que deseas eliminar la familia "${row.nombre}" (${row.codigo})?`,
      showDenyButton: true,
      confirmButtonText: `Eliminar`,
      denyButtonText: `Cancelar`
    }).then((result) => {
      if (result.isConfirmed) {
        // MOCK - LOCAL STORAGE: Eliminar y reemplazar con servicio real
        const stored = localStorage.getItem('cost_families');
        if (stored) {
          let list: Family[] = JSON.parse(stored);
          list = list.filter(f => f.id !== row.id);
          localStorage.setItem('cost_families', JSON.stringify(list));
        }
        Swal.fire('Eliminado', 'La familia ha sido eliminada.', 'success');
        this.getFamilies();
      }
    });
  }

  // --- Métodos de Traducción/Mapeo ---
  getTecnologiaName(code: string): string {
    const map: Record<string, string> = { 'FDM': 'Filamento', 'SLA': 'Resina' };
    return map[code] ? `${map[code]} (${code})` : code;
  }

  getMaterialName(code: string): string {
    const map: Record<string, string> = { 'PLA': 'Ácido Poliláctico', 'ABS': 'ABS', 'PET': 'PETG', 'RES': 'Resina' };
    return map[code] ? `${map[code]} (${code})` : code;
  }

  getFamiliaName(familiaObjOrCode: string | { codigo?: string, nombre?: string } | null | undefined): string {
    if (!familiaObjOrCode) return '';
    // Si el backend ya nos mandó el nombre, lo usamos directo
    if (typeof familiaObjOrCode === 'object' && familiaObjOrCode.nombre) {
      return familiaObjOrCode.nombre;
    }
    // Lógica de respaldo por si acaso manda un código
    const code = typeof familiaObjOrCode === 'string' ? familiaObjOrCode : familiaObjOrCode.codigo;
    const family = this.allFamilies.find(f => f.codigo === code);
    return family ? `${family.nombre} (${code})` : (code || '');
  }

  getSubfamiliaName(
    familiaObjOrCode: string | { codigo?: string, nombre?: string } | null | undefined, 
    subfamiliaObjOrCode: string | { codigo?: string, nombre?: string } | null | undefined
  ): string {
    if (!subfamiliaObjOrCode) return 'N/A';
    // Si el backend ya nos mandó el nombre, lo usamos directo
    if (typeof subfamiliaObjOrCode === 'object' && subfamiliaObjOrCode.nombre) {
      return subfamiliaObjOrCode.nombre;
    }
    // Lógica de respaldo
    const famCode = typeof familiaObjOrCode === 'string' ? familiaObjOrCode : familiaObjOrCode?.codigo;
    const subCode = typeof subfamiliaObjOrCode === 'string' ? subfamiliaObjOrCode : subfamiliaObjOrCode?.codigo;

    const family = this.allFamilies.find(f => f.codigo === famCode);
    if (!family) return subCode || '';
    const subs = family.subFamilias || [];
    const sub = subs.find((s) => s.codigo === subCode);
    return sub ? `${sub.nombre} (${subCode})` : subCode || '';
  }
}
