import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { Family, Subfamily } from '../../../../../core/models/Cost/family';
import { Product } from '../../../../../core/models/Cost/product';
import { Budget } from '../../../../../core/models/Cost/budge';
import { CodingService } from '../../../../../core/services/cost/coding.service';
import { ProductService } from '../../../../../core/services/cost/product.service';
import { BudgetService } from '../../../../../core/services/cost/budget.service';
import Swal from 'sweetalert2';
import { SkuCoding } from '../../../../../core/models/Cost/coding';
import { ComponentCanDeactivate } from '../../../../../core/guards/pending-changes.guard';

@Component({
  selector: 'app-add-coding',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, NgSelectModule],
  templateUrl: './add-coding.component.html'
})
export class AddCodingComponent implements OnInit, ComponentCanDeactivate {
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private codingService = inject(CodingService);
  private productService = inject(ProductService);
  private budgetService = inject(BudgetService);

  form!: FormGroup;
  id: number = 0;
  loading = false;
  submitted = false;
  familias: Family[] = [];
  subfamilias: Subfamily[] = [];
  productos: Product[] = [];
  productosFiltrados: Product[] = [];
  presupuestosServicios: Budget[] = [];
  presupuestosProyectos: Budget[] = [];

  // Options
  opcionesCategorias = [
    { value: 'PF', label: 'Producto Fabricado (PF)' },
    { value: 'SR', label: 'Servicio (SR)' },
    { value: 'PP', label: 'Proyecto Personalizado (PP)' }
  ];

  opcionesTecnologias = [
    { value: 'FDM', label: 'FDM (Filamento)' },
    { value: 'SLA', label: 'SLA (Resina)' },
  ];

  opcionesMateriales = [
    { value: 'PLA', label: 'PLA (Ácido Poliláctico)' },
    { value: 'ABS', label: 'ABS (Acrilonitrilo Butadieno Estireno)' },
    { value: 'PET', label: 'PET (Polietileno Tereftalato)' },
    { value: 'RES', label: 'RES (Resina)' },
    { value: 'CHO', label: 'CHO (Chocolate)' }
  ];

  opcionesUnidades = [
    { value: 'g', label: 'Gramos (g)' },
    { value: 'kg', label: 'Kilogramos (kg)' },
    { value: 'ml', label: 'Mililitros (ml)' },
    { value: 'L', label: 'Litros (L)' },
    { value: 'm', label: 'Metros (m)' },
    { value: 'u', label: 'Unidades (u)' }
  ];

  // Preview propiedades
  previewCat = '??';
  previewTec = '???';
  previewMat = '???';
  previewFam = '???';
  previewSub = '';
  previewCorr = '001';

  constructor() {
    this.myFormValues();
  }

  //eliminar la línea siguiente al colocar los servicios
  get f() { return this.form.controls; }

  get materialesMolde(): FormArray {
    return this.form.get('materialesMolde') as FormArray;
  }

  editData: Partial<SkuCoding> | null = null;
  familiasCargadas = false;
  productosCargados = false;
  formInitialized = false;

  ngOnInit(): void {
    const data: SkuCoding | undefined = history.state.edit_coding;
    if (data && data.id && data.id > 0) {
      this.editData = data;
      this.id = this.editData.id || 0;
    }

    this.cargarFamilias();
    this.cargarProductos();
    this.cargarPresupuestos();
    this.setupPreviewListeners();
  }

  myFormValues() {
    this.form = this.formBuilder.group({
      categoria: ['PF', Validators.required],
      productoId: ['', Validators.required],
      nombreServicio: [''],
      tecnologia: ['', Validators.required],
      material: ['', Validators.required],
      familia: ['', Validators.required],
      subfamilia: [''],
      materialesMolde: this.formBuilder.array([])
    });
  }

  addMaterialMolde() {
    this.materialesMolde.push(this.formBuilder.group({
      material: ['', Validators.required],
      cantidad: ['', [Validators.required, Validators.min(0)]],
      unidad: ['', Validators.required]
    }));
  }

  removeMaterialMolde(index: number) {
    this.materialesMolde.removeAt(index);
  }

  cargarFamilias() {
    this.codingService.getFamilies().subscribe(fams => {
      this.familias = fams;
      this.familiasCargadas = true;
      this.checkAndSetValues();
    });
  }

  cargarProductos() {
    this.productService.getProducts().subscribe(prods => {
      this.productos = prods.filter(p => {
        // Preservar el producto que estamos editando actualmente, aunque ya tenga SKU
        if (this.editData && (Number(this.editData.productId) === p.id || Number(this.editData.producto?.id) === p.id)) {
          return true;
        }
        if (!p.sku) return true;
        const s = p.sku.trim().toLowerCase();
        return s === '' || s === 'null' || s === 'sin asignar' || s === 'n/a';
      });
      this.productosFiltrados = [...this.productos];
      this.productosCargados = true;
      this.checkAndSetValues();
    });
  }

  cargarPresupuestos() {
    this.budgetService.getBudgets().subscribe(budgets => {
      this.presupuestosServicios = budgets.filter(b => b.clasificacion === 'Servicio');
      this.presupuestosProyectos = budgets.filter(b => b.clasificacion === 'Proyecto');
    });
  }

  onCategoryChange() {
    const cat = this.form.get('categoria')?.value;
    if (cat === 'PF') {
      this.form.get('productoId')?.setValidators(Validators.required);
      this.form.get('nombreServicio')?.clearValidators();
      this.form.get('nombreServicio')?.setValue('');
    } else {
      this.form.get('nombreServicio')?.setValidators(Validators.required);
      this.form.get('productoId')?.clearValidators();
      this.form.get('productoId')?.setValue('');
    }
    this.form.get('productoId')?.updateValueAndValidity();
    this.form.get('nombreServicio')?.updateValueAndValidity();

    // Actualizar preview correlativo
    this.previewCat = cat || '??';
    this.previewCorr = cat === 'SR' ? 'S01' : (cat === 'PP' ? 'P01' : '001');
  }

  setupPreviewListeners() {
    this.form.get('familia')?.valueChanges.subscribe(famCode => {
      const fCodeStr = typeof famCode === 'string' ? famCode : famCode?.codigo;
      const chosenFamily = this.familias.find((f: Family) => f.codigo === fCodeStr);
      this.subfamilias = chosenFamily?.subFamilias || [];

      const subControl = this.form.get('subfamilia');
      if (this.subfamilias.length > 0) {
        subControl?.setValidators(Validators.required);
      } else {
        subControl?.clearValidators();
      }
      subControl?.setValue('', { emitEvent: false });
      subControl?.updateValueAndValidity({ emitEvent: false });

      // Manejar caso especial de Molde (MLD)
      const materialControl = this.form.get('material');
      if (famCode === 'MLD') {
        materialControl?.clearValidators();
        materialControl?.setValue('');
        if (this.materialesMolde.length === 0) {
          this.addMaterialMolde();
        }
      } else {
        materialControl?.setValidators(Validators.required);
        this.materialesMolde.clear();
      }
      materialControl?.updateValueAndValidity();

      this.previewSub = '';
    });

    this.form.valueChanges.subscribe(val => {
      this.previewCat = val.categoria || '??';
      this.previewTec = val.tecnologia || '???';

      if (val.familia === 'MLD' && val.materialesMolde && val.materialesMolde.length > 0) {
        const mats = val.materialesMolde.map((m: { material: string }) => m.material).filter((m: string) => !!m);
        this.previewMat = mats.length > 0 ? mats.join('-') : '???';
      } else {
        this.previewMat = val.material || '???';
      }

      const valFamCode = typeof val.familia === 'string' ? val.familia : val.familia?.codigo;
      const chosenFamily = this.familias.find((f: Family) => f.codigo === valFamCode);
      this.previewFam = chosenFamily ? chosenFamily.codigo : '???';
      this.previewSub = val.subfamilia || '';
      this.previewCorr = val.categoria === 'SR' ? 'S01' : (val.categoria === 'PP' ? 'P01' : '001');
    });

    this.onCategoryChange();
  }

  back() {
    this.router.navigate(['/codings']);
  }

  checkAndSetValues() {
    if (this.editData && this.familiasCargadas && this.productosCargados && !this.formInitialized) {
      this.formInitialized = true;
      this.setValues();
    }
  }

  setValues() {
    if (this.editData && this.editData.id && this.editData.id > 0) {
      const data = this.editData;
      this.form.get('categoria')?.setValue(data.categoria);
      this.form.get('tecnologia')?.setValue(data.tecnologia);
      this.form.get('material')?.setValue(data.material);
      
      this.onCategoryChange(); // Forzar actualización de validadores y vista
      
      // Buscar código de familia
      let famCode = '';
      if (typeof data.familia === 'string') {
        famCode = data.familia;
      } else if (typeof data.familia === 'object' && data.familia !== null) {
        const famObj = data.familia as { id: number; nombre: string; codigo?: string };
        famCode = famObj.codigo || '';
        if (!famCode && famObj.id) {
          const found = this.familias.find(f => f.id === famObj.id);
          if (found) famCode = found.codigo;
        }
      }
      
      // Buscar código de subfamilia
      let subCode = '';
      if (typeof data.subfamilia === 'string') {
        subCode = data.subfamilia;
      } else if (typeof data.subfamilia === 'object' && data.subfamilia !== null) {
        const subObj = data.subfamilia as { id: number; nombre: string; codigo?: string };
        subCode = subObj.codigo || '';
        if (!subCode && subObj.id) {
          const famFound = this.familias.find(f => f.codigo === famCode);
          if (famFound && famFound.subFamilias) {
             const subFound = famFound.subFamilias.find(s => s.id === subObj.id);
             if (subFound) subCode = subFound.codigo;
          }
        }
      }
      
      this.form.get('familia')?.setValue(famCode);
      this.form.get('subfamilia')?.setValue(subCode);

      if (data.categoria !== 'PF') {
        this.form.get('nombreServicio')?.setValue(data.productName || data.servicio?.nombre || data.proyecto?.nombre);
      } else {
        const pId = data.productId || data.producto?.id;
        const foundProd = this.productosFiltrados.find(p => p.id == pId);
        this.form.get('productoId')?.setValue(foundProd ? foundProd.id : null);
      }
    }
  }

  onSubmit() {
    this.submitted = true;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      Swal.fire('Error', 'Complete los datos obligatorios.', 'error');
      return;
    }

    this.loading = true;

    let pName = '';
    const cat = this.form.value.categoria;
    if (cat === 'PF') {
      const selectedProd = this.productos.find(p => p.id === Number(this.form.value.productoId));
      pName = selectedProd ? selectedProd.nombre : 'Producto';
    } else {
      pName = this.form.value.nombreServicio;
    }

    let matValue = this.form.value.material;
    let payloadMats: { material: string, cantidad: number, unidad: string }[] = [];
    if (this.form.value.familia === 'MLD') {
      matValue = this.form.value.materialesMolde.map((m: { material: string }) => m.material).join('-');
      payloadMats = this.form.value.materialesMolde;
    }

    let presupuestoId = null;
    if (cat !== 'PF') {
      const list = cat === 'SR' ? this.presupuestosServicios : this.presupuestosProyectos;
      const selectedBudget = list.find((b: Budget) => b.descripcion === pName);
      if (selectedBudget) {
        presupuestoId = selectedBudget.id || null;
      }
    }

    const valFamStr = typeof this.form.value.familia === 'string' ? this.form.value.familia : this.form.value.familia?.codigo;
    const valSubStr = typeof this.form.value.subfamilia === 'string' ? this.form.value.subfamilia : this.form.value.subfamilia?.codigo;
    const famObj = this.familias.find((f: Family) => f.codigo === valFamStr);
    const subObj = this.subfamilias.find((s: Subfamily) => s.codigo === valSubStr);

    // Obtener los SKUs para calcular el correlativo o simplemente editar
    this.codingService.getSKUs().subscribe({
      next: (skusList) => {
        let codingResult: SkuCoding;

        if (this.id) {
          // Editar
          const current = skusList.find(c => c.id === this.id);
          codingResult = {
            id: this.id,
            sku: current ? current.sku : '',
            codigo: current ? current.codigo : '',
            productId: Number(this.form.value.productoId) || null,
            presupuestoId: presupuestoId,
            productName: pName,
            categoria: cat,
            tecnologia: this.form.value.tecnologia,
            material: matValue,
            materialesMolde: payloadMats,
            familia: this.form.value.familia,
            subfamilia: this.form.value.subfamilia,
            familiaId: famObj ? (famObj.id || null) : null,
            subfamiliaId: subObj ? (subObj.id || null) : null
          };

          this.codingService.updateSKU(this.id, codingResult).subscribe({
            next: () => {
              this.loading = false;
              Swal.fire('Éxito', 'Código actualizado exitosamente.', 'success').then(() => {
                this.router.navigate(['/codings']);
              });
            }
          });

        } else {
          // Crear - SKU generation: CAT-TEC-MAT-FAM-SUB-CORRELATIVO
          const matchingCount = skusList.filter(c => 
            c.categoria === cat && 
            c.tecnologia === this.form.value.tecnologia && 
            c.material === matValue && 
            c.familia === this.form.value.familia && 
            c.subfamilia === this.form.value.subfamilia
          ).length;

          const corrStr = String(matchingCount + 1).padStart(3, '0');
          const generatedSku = `${cat}-${this.form.value.tecnologia}-${matValue}-${this.form.value.familia}${this.form.value.subfamilia ? '-' + this.form.value.subfamilia : ''}-${corrStr}`;
          
          codingResult = {
            id: 0,
            sku: generatedSku,
            codigo: generatedSku,
            productId: Number(this.form.value.productoId) || null,
            presupuestoId: presupuestoId,
            productName: pName,
            categoria: cat,
            tecnologia: this.form.value.tecnologia,
            material: matValue,
            materialesMolde: payloadMats,
            familia: this.form.value.familia,
            subfamilia: this.form.value.subfamilia,
            familiaId: famObj ? (famObj.id || null) : null,
            subfamiliaId: subObj ? (subObj.id || null) : null
          };

          // Update de producto si es PF (Para consistencia local)
          if (cat === 'PF' && codingResult.productId) {
            const prod = this.productos.find(p => p.id === codingResult.productId);
            if (prod) {
              this.productService.updateProduct(prod.id!, { ...prod, sku: generatedSku }).subscribe();
            }
          }

          this.codingService.createSKU(codingResult).subscribe({
            next: () => {
              this.loading = false;
              this.submitted = true;
              this.form?.markAsPristine();
              Swal.fire({
                title: 'Código Generado con Éxito',
                html: `Se ha registrado el SKU: <strong class="text-primary font-monospace">${generatedSku}</strong> para <strong>${pName}</strong>.`,
                icon: 'success',
                confirmButtonText: 'Aceptar'
              }).then(() => {
                this.router.navigate(['/codings']);
              });
            }
          });
        }
      },
      error: () => {
        this.loading = false;
        Swal.fire('Error', 'No se pudieron procesar los datos.', 'error');
      }
    });
  }

  canDeactivate(): boolean {
    if (this.submitted && !this.loading) {
      return true;
    }
    return !this.form?.dirty;
  }

  filterProducts(event: Event) {
    const input = event.target as HTMLInputElement;
    const query = input.value.toLowerCase().trim();

    if (!query) {
      this.productosFiltrados = [...this.productos];
      return;
    }

    this.productosFiltrados = this.productos.filter(p =>
      p.nombre.toLowerCase().includes(query)
    );
  }
}
