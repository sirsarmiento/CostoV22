import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Rol } from '../../../../core/models/rol';
import { RolesPermissionsService } from '../../../../core/services/roles-permissions.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-add-role',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './add-role.component.html'
})
export class AddRoleComponent implements OnInit {
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);
  private rolesService = inject(RolesPermissionsService);

  form!: FormGroup;
  id: number = 0;
  loading = false;
  submitted = false;

  constructor() {
    this.myFormValues();
  }

  get f() { return this.form.controls; }

  ngOnInit(): void {
    this.setValues();
  }

  myFormValues() {
    this.form = this.formBuilder.group({
      description: ['', Validators.required]
    });
  }

  setValues() {
    const stored = localStorage.getItem('security_edit_role');
    if (stored) {
      const data: Rol = JSON.parse(stored);
      if (data && data.id && data.id > 0) {
        this.f['description'].setValue(data.descripcion);
        this.id = data.id;
      }
    }
  }

  onSubmit() {
    this.submitted = true;

    if (this.form.invalid) {
      Swal.fire('Error', 'Complete los datos obligatorios del rol.', 'error');
      return;
    }

    this.loading = true;

    const rol: Rol = {
      id: this.id > 0 ? this.id : 0,
      descripcion: this.f['description'].value,
      statusId: 1
    };

    const request = this.id === 0 
      ? this.rolesService.createRole(rol)
      : this.rolesService.updateRole(this.id, rol);

    request.subscribe({
      next: () => {
        localStorage.removeItem('security_edit_role');
        this.loading = false;
        Swal.fire({
          title: '¡Guardado!',
          text: 'Rol guardado exitosamente.',
          icon: 'success',
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#4680ff'
        }).then(() => {
          this.router.navigate(['/roles']);
        });
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error: (error: any) => {
        this.loading = false;
        if (error.status == 409) {
          Swal.fire('Error', error.error?.msg || 'Conflicto al guardar el rol.', 'error');
        } else {
          Swal.fire('Error', 'Ha ocurrido un error al guardar el rol. Intente más tarde.', 'error');
        }
      }
    });
  }

  back() {
    localStorage.removeItem('security_edit_role');
    this.router.navigate(['/roles']);
  }
}
