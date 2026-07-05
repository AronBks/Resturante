import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { RolUsuario } from '@sggi/shared';

export const roleGuard = (allowedRoles: RolUsuario[]): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.isAuthenticated() && authService.hasRole(allowedRoles)) {
      return true;
    }

    // Si no tiene permisos, redirigir a una ruta por defecto según su rol, o al login
    const user = authService.currentUserSignal();
    if (user) {
      if (user.rol === RolUsuario.MESERO) {
        router.navigate(['/dashboard/mesas']);
      } else if (user.rol === RolUsuario.CHEF) {
        router.navigate(['/dashboard/cocina']);
      } else {
        router.navigate(['/dashboard']);
      }
      return false;
    }

    router.navigate(['/login']);
    return false;
  };
};
