import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import Swal from 'sweetalert2';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);
    const isOnBlackList = environment.endpoints.handle_error_blackList.some(path =>
        req.url.endsWith(path)
    );

    if (isOnBlackList) {
        return next(req);
    }

    return next(req).pipe(
        catchError((err: HttpErrorResponse) => {
            const rawMsg = err.error?.msg || err.error?.message || err.statusText || 'Ha ocurrido un error inesperado.';
            const rawDetail = err.error?.error || '';

            switch (err.status) {
                case 0:
                    Swal.fire({
                        title: 'Sin conexión',
                        text: 'No se pudo conectar con el servidor. Verifique su conexión a internet o el estado del servicio.',
                        icon: 'error',
                        confirmButtonText: 'Entendido'
                    });
                    break;

                case 400:
                case 422:
                    Swal.fire({
                        title: 'Datos Inválidos',
                        text: typeof rawMsg === 'string' ? rawMsg : 'Por favor verifique los datos ingresados.',
                        icon: 'warning',
                        confirmButtonText: 'Revisar'
                    });
                    break;

                case 401:
                    Swal.fire({
                        title: 'Sesión expirada',
                        text: 'Su sesión ha expirado o el token de acceso es inválido. Por favor, inicie sesión nuevamente.',
                        icon: 'warning',
                        confirmButtonText: 'Iniciar Sesión',
                        allowOutsideClick: false,
                        allowEscapeKey: false
                    }).then(() => {
                        authService.logout();
                    });
                    break;

                case 403:
                    Swal.fire({
                        title: 'Acceso Denegado',
                        text: 'No cuenta con los permisos necesarios para realizar esta acción.',
                        icon: 'error',
                        confirmButtonText: 'Entendido'
                    });
                    break;

                case 404:
                    Swal.fire({
                        title: 'No Encontrado (404)',
                        text: typeof rawMsg === 'string' ? rawMsg : 'El recurso solicitado no existe.',
                        icon: 'error',
                        confirmButtonText: 'Aceptar'
                    });
                    break;

                case 500:
                default: {
                    let displayDetail = '';
                    if (rawDetail && typeof rawDetail === 'string') {
                        // Si es error de base de datos o mensaje largo, extraer resumen legible
                        if (rawDetail.includes('Integrity constraint violation')) {
                            displayDetail = 'Violación de restricción en base de datos. Verifique que los campos obligatorios no estén vacíos.';
                        } else {
                            displayDetail = rawDetail.length > 120 ? `${rawDetail.substring(0, 120)}...` : rawDetail;
                        }
                    }

                    Swal.fire({
                        title: 'Error del Servidor (500)',
                        html: `<p>${rawMsg}</p>${displayDetail ? `<small class="text-muted">${displayDetail}</small>` : ''}`,
                        icon: 'error',
                        confirmButtonText: 'Aceptar'
                    });
                    break;
                }
            }

            return throwError(() => err);
        })
    );
};

