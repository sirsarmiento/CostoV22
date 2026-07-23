import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import Swal from 'sweetalert2';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
    const isOnBlackList = environment.endpoints.handle_error_blackList.some(path =>
        req.url.endsWith(path)
    );

    if (isOnBlackList) {
        return next(req);
    }

    return next(req).pipe(
        catchError(err => {
            const errorMsg = err.error?.msg || err.error?.message || err.statusText;

            if (err.status === 401) {
                Swal.fire('Error 401', `${errorMsg}`, 'error');
            } else if (err.status === 404) {
                Swal.fire('Error 404', `${errorMsg}`, 'error');
            } else if (err.status === 500) {
                Swal.fire('Error 500', `${errorMsg}`, 'error');
            }

            return throwError(() => errorMsg);
        })
    );
};
