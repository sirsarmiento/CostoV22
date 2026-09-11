import { CanDeactivateFn } from '@angular/router';
import { Observable } from 'rxjs';
import Swal from 'sweetalert2';

export interface ComponentCanDeactivate {
  canDeactivate: () => boolean | Observable<boolean> | Promise<boolean>;
}

export const pendingChangesGuard: CanDeactivateFn<ComponentCanDeactivate> = (component) => {
  try {
    if (!component || typeof component.canDeactivate !== 'function' || component.canDeactivate()) {
      return true;
    }
  } catch (e) {
    console.error('Error in canDeactivate:', e);
    return true;
  }

  return Swal.fire({
    title: '¿Deseas salir sin guardar?',
    text: 'Tienes cambios sin guardar en este formulario. Si sales ahora, se perderán los datos ingresados.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, salir',
    cancelButtonText: 'No, quedarme',
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#4680ff',
    reverseButtons: true,
    allowOutsideClick: false,
    allowEscapeKey: true
  }).then((result) => {
    return !!result.isConfirmed;
  });
};
