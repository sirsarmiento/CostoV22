import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route, _state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const currentUser = authService.currentUser;

  if (!currentUser) {
    router.navigate(['/login']);
    return false;
  }

  const expectedRoles = route.data?.['roles'] as Array<string> | undefined;

  if (!expectedRoles || expectedRoles.length === 0) {
    return true; // Si no hay roles requeridos en la ruta, permitir acceso
  }

  const userRoles = currentUser.roles || [];
  const hasAccess = expectedRoles.some(role => userRoles.includes(role));

  if (!hasAccess) {
    router.navigate(['/dashboard/default']);
    return false;
  }

  return true;
};
