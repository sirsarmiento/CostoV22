// project import
import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/services/auth.service';
import { UserService } from '../../../../core/services/user.service';
import { User } from '../../../../core/models/user';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-auth-login',
  imports: [RouterModule, ReactiveFormsModule],
  templateUrl: './auth-login.component.html',
  styleUrl: './auth-login.component.scss'
})
export class AuthLoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);

  loginForm!: FormGroup;
  returnUrl!: string;
  isLoading = false;

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });

    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard/default';
  }

  async onLoggedin(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const { email, password } = this.loginForm.value;

    try {
      const resp = await this.authService.login(email, password);
      if (resp instanceof User) {
        try {
          await this.userService.getInfoUser();
        } catch (infoError) {
          console.warn('Could not fetch extra user info upon login:', infoError);
        }
        this.toastr.success('¡Bienvenido!', 'Sesión iniciada');
        await this.router.navigate([this.returnUrl]);
      } else {
        this.toastr.error(resp || 'Usuario o Contraseña inválidos', 'Error de Autenticación');
      }
    } catch (error: unknown) {
      console.error('Login error:', error);
      this.toastr.error('Ha ocurrido un error. Intente más tarde.', 'Error');
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }
}
