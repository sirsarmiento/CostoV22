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

interface SkuCoding {
  id: number;
  sku: string;
  codigo: string;
  productName: string;
  categoria: string;
  tecnologia: string;
  material: string;
  familia: string;
  subfamilia: string;
  productId: number | null;
  presupuestoId: number | null;
  familiaId: number | null;
  subfamiliaId: number | null;
  materialesMolde?: unknown[];
}

@Component({
  selector: 'app-add-coding',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, NgSelectModule],
  templateUrl: './add-coding.component.html'
})
export class AddCodingComponent implements OnInit {
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
    { value: 'PLS', label: 'PLS (Plástico)' }
  ];

  opcionesMateriales = [
    { value: 'PLA', label: 'PLA (Ácido Poliláctico)' },
    { value: 'ABS', label: 'ABS' },
    { value: 'PET', label: 'PETG' },
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

  ngOnInit(): void {
    this.cargarFamilias();
    this.cargarProductos();
    this.cargarPresupuestos();
    this.setupPreviewListeners();
    this.setValues();
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
    });
  }

  cargarProductos() {
    this.productService.getProducts().subscribe(prods => {
      this.productos = prods.filter(p => {
        if (!p.sku) return true;
        const s = p.sku.trim().toLowerCase();
        return s === '' || s === 'null' || s === 'sin asignar' || s === 'n/a';
      });
      this.productosFiltrados = [...this.productos];
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
      const chosenFamily = this.familias.find(f => f.codigo === famCode);
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

      const chosenFamily = this.familias.find(f => f.codigo === val.familia);
      this.previewFam = chosenFamily ? chosenFamily.codigo : '???';
      this.previewSub = val.subfamilia || '';
      this.previewCorr = val.categoria === 'SR' ? 'S01' : (val.categoria === 'PP' ? 'P01' : '001');
    });

    this.onCategoryChange();
  }

  back() {
    this.router.navigate(['/codings']);
  }

  setValues() {
    // MOCK - LOCAL STORAGE: Eliminar y reemplazar con servicio real
    const stored = localStorage.getItem('cost_edit_coding');
    if (stored) {
      const data = JSON.parse(stored);
      if (data && data.id && data.id > 0) {
        this.id = data.id;
        this.form.get('categoria')?.setValue(data.categoria);
        this.form.get('tecnologia')?.setValue(data.tecnologia);
        this.form.get('material')?.setValue(data.material);
        
        let famCode = typeof data.familia === 'string' ? data.familia : '';
        if (typeof data.familia === 'object' && data.familia) {
          famCode = data.familia.codigo;
        }

        let subCode = typeof data.subfamilia === 'string' ? data.subfamilia : '';
        if (typeof data.subfamilia === 'object' && data.subfamilia) {
          subCode = data.subfamilia.codigo;
        }
        
        this.form.get('familia')?.setValue(famCode);
        this.form.get('subfamilia')?.setValue(subCode);

        if (data.categoria !== 'PF') {
          this.form.get('nombreServicio')?.setValue(data.productName);
        } else {
          this.form.get('productoId')?.setValue(data.productId || data.producto);
        }
      }
    }
  }

  onSubmit() {
    this.submitted = true;
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
    let payloadMats = [];
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

    const famObj = this.familias.find(f => f.codigo === this.form.value.familia);
    const subObj = this.subfamilias.find(s => s.codigo === this.form.value.subfamilia);

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
              localStorage.removeItem('cost_edit_coding');
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
