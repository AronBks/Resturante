import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { RolUsuario } from '@sggi/shared';

interface SidebarItem {
  label: string;
  route: string;
  iconPath: string; // inline SVG path or simple helper name
  roles: RolUsuario[];
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
})
export class LayoutComponent {
  private authService = inject(AuthService);
  user = this.authService.currentUserSignal;

  // Filtramos los ítems del menú dinámicamente según el rol del usuario autenticado
  menuItems = computed<SidebarItem[]>(() => {
    const allItems: SidebarItem[] = [
      {
        label: 'Panel General',
        route: '/dashboard/overview',
        iconPath: 'home',
        roles: [RolUsuario.ADMIN, RolUsuario.MESERO, RolUsuario.CHEF, RolUsuario.CAJERO],
      },
      {
        label: 'Mesas & Salón',
        route: '/dashboard/mesas',
        iconPath: 'grid',
        roles: [RolUsuario.ADMIN, RolUsuario.MESERO, RolUsuario.CAJERO],
      },
      {
        label: 'Monitor de Cocina',
        route: '/dashboard/cocina',
        iconPath: 'flame',
        roles: [RolUsuario.ADMIN, RolUsuario.CHEF],
      },
      {
        label: 'Gestión de Carta',
        route: '/dashboard/carta',
        iconPath: 'book-open',
        roles: [RolUsuario.ADMIN, RolUsuario.CHEF, RolUsuario.MESERO],
      },
      {
        label: 'Inventario & Recetas',
        route: '/dashboard/inventario',
        iconPath: 'archive',
        roles: [RolUsuario.ADMIN, RolUsuario.CHEF],
      },
      {
        label: 'Usuarios & Personal',
        route: '/dashboard/usuarios',
        iconPath: 'users',
        roles: [RolUsuario.ADMIN],
      },
    ];

    const currentRol = this.user()?.rol;
    if (!currentRol) return [];
    return allItems.filter((item) => item.roles.includes(currentRol));
  });

  logout(): void {
    this.authService.logout();
  }

  getRoleBadgeClass(rol: RolUsuario): string {
    switch (rol) {
      case RolUsuario.ADMIN:
        return 'badge-admin';
      case RolUsuario.CHEF:
        return 'badge-chef';
      case RolUsuario.MESERO:
        return 'badge-mesero';
      case RolUsuario.CAJERO:
        return 'badge-cajero';
      default:
        return '';
    }
  }
}
