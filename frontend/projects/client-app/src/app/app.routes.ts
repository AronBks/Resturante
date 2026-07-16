import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/landing-hero/landing-hero.component').then(
        (m) => m.LandingHeroComponent,
      ),
  },
  {
    path: 'carta',
    loadComponent: () =>
      import('./components/menu-digital/menu-digital.component').then(
        (m) => m.MenuDigitalComponent,
      ),
  },
  {
    path: 'pedido-ia',
    loadComponent: () =>
      import('./components/ia-comanda/ia-comanda.component').then(
        (m) => m.IaComandaComponent,
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];

