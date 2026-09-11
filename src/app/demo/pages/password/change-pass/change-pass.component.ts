import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import Swal from 'sweetalert2';
import { ComponentCanDeactivate } from '../../../../core/guards/pending-changes.guard';

@Component({
  selector: 'app-change-pass',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './change-pass.component.html'
})
export class ChangePassComponent implements ComponentCanDeactivate {
  private authService = inject(AuthService);
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);

  form!: FormGroup;
  loading = false;
  submitted = false;

  constructor() {
    this.myFormValues();
  }

  get f() { return this.form.controls; }

  async onSubmit() {
    this.submitted = true;
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    this.loading = true;

    const result = await this.authService.resetPass({ password: this.form.value.password });

    this.loading = false;
    if (result) {
      this.submitted = true;
      this.form?.markAsPristine();
      Swal.fire({
        title: '¡Contraseña Actualizada!',
        text: 'Su contraseña ha sido modificada con éxito.',
        icon: 'success',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#4680ff'
      }).then(() => {
        this.router.navigate(['/dashboard/default']);
      });
    } else {
      this.form.reset();
    }
  }

  canDeactivate(): boolean {
    if (this.submitted && !this.loading) {
      return true;
    }
    return !this.form?.dirty;
  }

  myFormValues() {
    this.form = this.formBuilder.group(
      {
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]]
      },
      { validators: this.passwordMatchValidator() }
    );
  }

  passwordMatchValidator(): ValidatorFn {
    return (control: AbstractControl): { [key: string]: boolean } | null => {
      const password = control.get('password');
      const confirmPassword = control.get('confirmPassword');

      if (password && confirmPassword && password.value !== confirmPassword.value) {
        return { passwordsMismatch: true };
      }
      return null;
    };
  }

  back() {
    this.router.navigate(['/dashboard/default']);
  }
}
