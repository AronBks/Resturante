import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { RolUsuario } from '@sggi/shared';

interface SidebarItem {
  label: string;
  route: string;
  iconPath: string;
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

  // Menú lateral con nomenclatura adaptada a Peña Tukuypaj
  menuItems = computed<SidebarItem[]>(() => {
    const allItems: SidebarItem[] = [
      {
        label: 'Panel de Hoy',
        route: '/dashboard/overview',
        iconPath: 'home',
        roles: [RolUsuario.ADMIN, RolUsuario.MESERO, RolUsuario.CHEF, RolUsuario.CAJERO],
      },
      {
        label: 'Salón & Mesas',
        route: '/dashboard/mesas',
        iconPath: 'grid',
        roles: [RolUsuario.ADMIN, RolUsuario.MESERO, RolUsuario.CAJERO],
      },
      {
        label: 'Nuestra Carta',
        route: '/dashboard/carta',
        iconPath: 'book-open',
        roles: [RolUsuario.ADMIN, RolUsuario.CHEF, RolUsuario.MESERO],
      },
      {
        label: 'Equipo de Trabajo',
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

  getRolLabel(rol: RolUsuario): string {
    switch (rol) {
      case RolUsuario.ADMIN: return 'Administrador';
      case RolUsuario.CHEF: return 'Jefe de Cocina';
      case RolUsuario.MESERO: return 'Mesero';
      case RolUsuario.CAJERO: return 'Cajero';
      default: return '';
    }
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
