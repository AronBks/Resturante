import { Routes } from '@angular/router';
import { LoginComponent } from './core/components/login/login.component';
import { LayoutComponent } from './core/components/layout/layout.component';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { RolUsuario } from '@sggi/shared';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: 'dashboard',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'overview',
        pathMatch: 'full',
      },
      {
        path: 'overview',
        loadComponent: () =>
          import('./features/overview/overview.component').then(
            (m) => m.DashboardOverviewComponent,
          ),
      },
      {
        path: 'mesas',
        canActivate: [roleGuard([RolUsuario.ADMIN, RolUsuario.MESERO, RolUsuario.CAJERO])],
        loadComponent: () =>
          import('./features/mesas/mesas.component').then((m) => m.MesasComponent),
      },
      {
        path: 'control-caja',
        canActivate: [roleGuard([RolUsuario.ADMIN, RolUsuario.CAJERO])],
        loadComponent: () =>
          import('./features/control-caja/control-caja.component').then(
            (m) => m.ControlCajaComponent,
          ),
      },

      {
        path: 'carta',
        canActivate: [roleGuard([RolUsuario.ADMIN, RolUsuario.CHEF, RolUsuario.MESERO])],
        loadComponent: () =>
          import('./features/carta/carta.component').then((m) => m.CartaComponent),
      },
      {
        path: 'usuarios',
        canActivate: [roleGuard([RolUsuario.ADMIN])],
        loadComponent: () =>
          import('./features/usuarios/usuarios.component').then((m) => m.UsuariosComponent),
      },
    ],
  },
  {
    path: '',
    redirectTo: '/dashboard/overview',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: '/dashboard/overview',
  },
];
