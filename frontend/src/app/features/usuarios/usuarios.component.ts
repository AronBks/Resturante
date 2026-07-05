import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="usuarios-container">
      <div class="header-section glass-panel">
        <div>
          <h1>Control de Usuarios & Personal</h1>
          <p>Administración de cuentas con control de acceso basado en roles (RBAC).</p>
        </div>
      </div>

      <div class="usuarios-panel glass-panel">
        <table class="usuarios-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo Electrónico</th>
              <th>Rol del Sistema</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            @for (user of users; track user.email) {
              <tr>
                <td class="name">{{ user.nombre }}</td>
                <td class="email">{{ user.email }}</td>
                <td>
                  <span class="role-badge" [ngClass]="user.rol.toLowerCase()">
                    {{ user.rol }}
                  </span>
                </td>
                <td>
                  <span class="status-badge" [ngClass]="{ activo: user.activo }">
                    {{ user.activo ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .usuarios-container {
      display: flex;
      flex-direction: column;
      gap: 30px;
    }

    .header-section {
      padding: 24px 30px;
      h1 { font-family: var(--font-title); font-size: 1.6rem; font-weight: 700; }
      p { color: var(--text-muted); font-size: 0.9rem; }
    }

    .usuarios-panel {
      padding: 20px;
      overflow-x: auto;
    }

    .usuarios-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.9rem;

      th {
        font-family: var(--font-title);
        padding: 14px 20px;
        color: var(--text-muted);
        font-weight: 600;
        border-bottom: 1px solid var(--border-glass);
      }

      td {
        padding: 16px 20px;
        border-bottom: 1px solid rgba(255,255,255,0.03);
        color: #ffffff;

        &.name { font-weight: 500; }
        &.email { color: var(--text-muted); }
      }
    }

    .role-badge {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.3px;

      &.admin { background: rgba(239, 68, 68, 0.15); color: #fca5a5; }
      &.chef { background: rgba(245, 158, 11, 0.15); color: #fcd34d; }
      &.mesero { background: rgba(16, 185, 129, 0.15); color: #a7f3d0; }
      &.cajero { background: rgba(59, 130, 246, 0.15); color: #bfdbfe; }
    }

    .status-badge {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 4px;
      background: var(--danger-glow);
      color: #fca5a5;
      border: 1px solid rgba(239, 68, 68, 0.2);

      &.activo {
        background: var(--primary-glow);
        color: #a7f3d0;
        border-color: rgba(16, 185, 129, 0.2);
      }
    }
  `],
})
export class UsuariosComponent {
  users = [
    { nombre: 'Administrador', email: 'admin@sggi.com', rol: 'ADMIN', activo: true },
    { nombre: 'Carlos Mendoza', email: 'carlos.mesero@sggi.com', rol: 'MESERO', activo: true },
    { nombre: 'Miguel Ángel Torres', email: 'chef.miguel@sggi.com', rol: 'CHEF', activo: true },
  ];
}
