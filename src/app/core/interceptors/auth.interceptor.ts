import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);
    const token = authService.currentUser?.token;

    const isOnWhiteList = environment.endpoints.handle_error_blackList.some(path =>
        req.url.endsWith(path)
    );

    if (isOnWhiteList) {
        return next(req);
    }

    const isApiUrl = req.url.startsWith(environment.apiUrl);
    if (token && isApiUrl) {
        req = req.clone({
            setHeaders: {
                Authorization: `Bearer ${token}`,
            },
        });
    }

    return next(req);
};
