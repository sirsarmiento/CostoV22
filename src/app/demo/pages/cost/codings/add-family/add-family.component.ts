import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Family, Subfamily } from '../../../../../core/models/Cost/family';
import { CodingService } from '../../../../../core/services/cost/coding.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-add-family',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './add-family.component.html'
})
export class AddFamilyComponent implements OnInit {
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private codingService = inject(CodingService);

  form!: FormGroup;
  id: number = 0;
  loading = false;
  submitted = false;

  // Subfamily management fields
  subfamiliesList: Subfamily[] = [];
  subCode = '';
  subDesc = '';
  subSubmitted = false;
  subError = '';

  constructor() {
    this.myFormValues();
  }

  get f() { return this.form.controls; }

  ngOnInit(): void {
    this.setValues();
  }

  myFormValues() {
    this.form = this.formBuilder.group({
      codigo: ['', [Validators.required, Validators.maxLength(3), Validators.pattern('^[a-zA-Z]{1,3}$')]],
      nombre: ['', [Validators.required, Validators.minLength(3)]]
    });
  }

  setValues() {
    // MOCK - LOCAL STORAGE: Eliminar y reemplazar con servicio real
    const stored = localStorage.getItem('cost_edit_family');
    if (stored) {
      const data: Family = JSON.parse(stored);
      if (data && data.id && data.id > 0) {
        this.form.patchValue({
          codigo: data.codigo,
          nombre: data.nombre
        });
        this.id = data.id;
        this.subfamiliesList = data.subFamilias ? [...data.subFamilias] : [];
      }
    }
  }

  addSubfamily() {
    this.subSubmitted = true;
    this.subError = '';

    const code = this.subCode.trim().toUpperCase();
    const desc = this.subDesc.trim();

    if (!code || code.length > 3 || !/^[A-Z]{1,3}$/.test(code)) {
      this.subError = 'El código debe tener máximo 3 letras de la A a la Z.';
      return;
    }

    if (!desc || desc.length < 3) {
      this.subError = 'La descripción debe tener al menos 3 caracteres.';
      return;
    }

    if (this.subfamiliesList.some(s => s.codigo === code)) {
      this.subError = 'Ya existe una subfamilia con este código.';
      return;
    }

    this.subfamiliesList.push({
      id: this.subfamiliesList.length + 1,
      codigo: code,
      nombre: desc
    });

    this.subCode = '';
    this.subDesc = '';
    this.subSubmitted = false;
  }

  removeSubfamily(index: number) {
    this.subfamiliesList.splice(index, 1);
  }

  back() {
    this.router.navigate(['/codings']);
  }

  onSubmit() {
    this.submitted = true;
    if (this.form.invalid) {
      Swal.fire('Error', 'Complete los datos obligatorios.', 'error');
      return;
    }

    this.loading = true;
    const familyData: Family = {
      id: this.id > 0 ? this.id : 0,
      codigo: this.form.value.codigo.toUpperCase(),
      nombre: this.form.value.nombre,
      subFamilias: this.subfamiliesList
    };

    const request = this.id > 0 
      ? this.codingService.updateFamily(this.id, familyData)
      : this.codingService.createFamily(familyData);

    request.subscribe({
      next: () => {
        if (this.id > 0) localStorage.removeItem('cost_edit_family');
        this.loading = false;
        const msg = this.id > 0 ? 'Familia actualizada correctamente.' : 'Familia registrada correctamente.';
        Swal.fire('Éxito', msg, 'success').then(() => {
          this.router.navigate(['/codings']);
        });
      },
      error: () => {
        this.loading = false;
        Swal.fire('Error', 'Ha ocurrido un error al guardar.', 'error');
      }
    });
  }
}
