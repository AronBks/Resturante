import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../services/auth.service';
import { RolUsuario } from '@sggi/shared';

import { PermisosUsuario } from '../../services/auth.service';

interface SidebarItem {
  label: string;
  route: string;
  iconName: string;
  permiso?: keyof PermisosUsuario;
  roles?: RolUsuario[];
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, LucideAngularModule],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
})
export class LayoutComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  user = this.authService.currentUserSignal;

  tituloSeccion = computed(() => {
    const url = this.router.url;
    if (url.includes('/usuarios')) return 'Equipo de Trabajo';
    if (url.includes('/mesas')) return 'Salón & Mesas';
    if (url.includes('/control-caja')) return 'Control de Caja';
    if (url.includes('/cocina') || url.includes('/despacho')) return 'Pase & Despacho de Platos';
    if (url.includes('/carta')) return 'Nuestra Carta';
    if (url.includes('/overview')) return 'Panel de Hoy';
    return 'Panel de Control';
  });

  // Menú lateral adaptativo según rol y permisos granulares
  menuItems = computed<SidebarItem[]>(() => {
    const allItems: SidebarItem[] = [
      {
        label: 'Panel de Hoy',
        route: '/dashboard/overview',
        iconName: 'layout-dashboard',
        permiso: 'puedeVerFinanzas',
        roles: [RolUsuario.ADMIN],
      },
      {
        label: 'Salón & Mesas',
        route: '/dashboard/mesas',
        iconName: 'grid',
        permiso: 'puedeTomarPedidos',
        roles: [RolUsuario.ADMIN, RolUsuario.MESERO, RolUsuario.CAJERO],
      },
      {
        label: 'Pase & Despacho',
        route: '/dashboard/cocina',
        iconName: 'concierge-bell',
        permiso: 'puedeOperarCocina',
        roles: [RolUsuario.ADMIN, RolUsuario.CHEF],
      },
      {
        label: 'Control de Caja',
        route: '/dashboard/control-caja',
        iconName: 'landmark',
        permiso: 'puedeCobrarCaja',
        roles: [RolUsuario.ADMIN, RolUsuario.CAJERO],
      },
      {
        label: 'Carta y Platos del Día',
        route: '/dashboard/carta',
        iconName: 'utensils-crossed',
        roles: [RolUsuario.ADMIN, RolUsuario.CHEF, RolUsuario.MESERO],
      },
      {
        label: 'Equipo de Trabajo',
        route: '/dashboard/usuarios',
        iconName: 'users',
        permiso: 'puedeAdministrarUsuarios',
        roles: [RolUsuario.ADMIN],
      },
    ];

    const currentUser = this.user();
    if (!currentUser) return [];

    return allItems.filter((item) => {
      if (currentUser.rol === RolUsuario.ADMIN) return true;
      return item.roles?.includes(currentUser.rol) || false;
    });
  });

  logout(): void {
    this.authService.logout();
  }

  getRolLabel(rol: RolUsuario): string {
    switch (rol) {
      case RolUsuario.ADMIN: return 'Administrador';
      case RolUsuario.CHEF: return 'Cocina & Despacho';
      case RolUsuario.MESERO: return 'Mesero de Salón';
      case RolUsuario.CAJERO: return 'Cajero';
      default: return '';
    }
  }

  getRoleBadgeClass(rol: RolUsuario): string {
    switch (rol) {
      case RolUsuario.ADMIN: return 'badge-admin';
      case RolUsuario.CHEF: return 'badge-chef';
      case RolUsuario.MESERO: return 'badge-mesero';
      case RolUsuario.CAJERO: return 'badge-cajero';
      default: return '';
    }
  }
}
