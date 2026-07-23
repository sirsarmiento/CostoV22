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
      email: ['ssarmiento@gmail.com', [Validators.required, Validators.email]],
      password: ['Tucson*50*', [Validators.required]]
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
          await this.userService.getInfoUser(); // No se cual es el uso y me esta dando un error. Comentare y mas adelante de que trata y si es necesario para solucionarlo
          this.toastr.success('¡Bienvenido!', 'Sesión iniciada');
          await this.router.navigate([this.returnUrl]);
        } catch (infoError) {
          console.error('Error fetching user info:', infoError);
          // Let the user know the info fetch failed, but keep them logged in or log the error
          this.toastr.error('Error al obtener los datos del usuario.', 'Error');
        }
      } else {
        this.toastr.error(resp || 'Usuario o Contraseña inválidos', 'Error de Autenticación');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      this.toastr.error('Ha ocurrido un error. Intente más tarde.', 'Error');
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }
}
