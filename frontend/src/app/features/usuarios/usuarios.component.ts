import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RolUsuario } from '@sggi/shared';

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
}

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="usuarios-container">
      <div class="header-section glass-panel animate-in">
        <div>
          <h1>Equipo de Trabajo</h1>
          <p>Administración del personal de <strong>Peña Restaurant Tukuypaj</strong> y control de acceso (RBAC).</p>
        </div>
      </div>

      <div class="usuarios-panel glass-panel animate-in" style="animation-delay: 0.05s">
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
            @for (user of users(); track user.id) {
              <tr>
                <td class="name">{{ user.nombre }}</td>
                <td class="email">{{ user.email }}</td>
                <td>
                  <span class="role-badge" [ngClass]="getRoleBadgeClass(user.rol)">
                    {{ getRolLabel(user.rol) }}
                  </span>
                </td>
                <td>
                  <span class="status-badge" [class.activo]="user.activo">
                    {{ user.activo ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4" class="empty-msg">No hay usuarios registrados.</td>
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
      gap: 24px;
    }

    .header-section {
      padding: 24px 30px;
      background: var(--gradient-brand-subtle);
      border: 1px solid var(--border-warm);
      h1 { font-family: var(--font-display); font-size: 1.55rem; font-weight: 700; color: var(--text-warm); }
      p { color: var(--text-muted); font-size: 0.88rem; strong { color: var(--primary); } }
    }

    .usuarios-panel {
      padding: 10px 20px;
      overflow-x: auto;
      background: var(--bg-card);
      border-color: rgba(210, 170, 120, 0.05);
    }

    .usuarios-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.9rem;

      th {
        font-family: var(--font-title);
        padding: 16px 20px;
        color: var(--text-muted);
        font-weight: 600;
        border-bottom: 1px solid var(--border-glass);
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      td {
        padding: 16px 20px;
        border-bottom: 1px solid rgba(255,255,255,0.02);
        color: var(--text-warm);

        &.name { font-weight: 600; }
        &.email { color: var(--text-muted); }
        &.empty-msg { text-align: center; color: var(--text-muted); padding: 40px; }
      }
    }

    .role-badge {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: var(--radius-xs);
      text-transform: uppercase;
      letter-spacing: 0.4px;
      border: 1px solid transparent;

      &.badge-admin {
        background: rgba(201, 74, 74, 0.1);
        color: #e08a8a;
        border: 1px solid rgba(201, 74, 74, 0.2);
      }

      &.badge-chef {
        background: rgba(212, 148, 58, 0.1);
        color: #e8b76a;
        border: 1px solid rgba(212, 148, 58, 0.2);
      }

      &.badge-mesero {
        background: rgba(90, 158, 111, 0.1);
        color: #8bc9a0;
        border: 1px solid rgba(90, 158, 111, 0.2);
      }

      &.badge-cajero {
        background: rgba(124, 158, 184, 0.1);
        color: #a3c4db;
        border: 1px solid rgba(124, 158, 184, 0.2);
      }
    }

    .status-badge {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: var(--radius-xs);
      text-transform: uppercase;
      letter-spacing: 0.4px;
      border: 1px solid transparent;
      background: var(--danger-glow);
      color: #e88a8a;
      border-color: rgba(201, 74, 74, 0.2);

      &.activo {
        background: var(--success-glow);
        color: #8bc9a0;
        border-color: rgba(90, 158, 111, 0.2);
      }
    }
  `],
})
export class UsuariosComponent implements OnInit {
  private http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3000/api';

  users = signal<Usuario[]>([]);

  ngOnInit() {
    this.cargarUsuarios();
  }

  cargarUsuarios() {
    this.http.get<any>(`${this.baseUrl}/usuarios`).subscribe({
      next: (res) => {
        // En NestJS all responses are wrapped in ApiResponse envelope { data: ... }
        this.users.set(res.data || []);
      },
      error: (err) => console.error('Error cargando usuarios', err),
    });
  }

  getRolLabel(rol: RolUsuario): string {
    switch (rol) {
      case RolUsuario.ADMIN: return 'Administrador';
      case RolUsuario.CHEF: return 'Jefe de Cocina';
      case RolUsuario.MESERO: return 'Mesero';
      case RolUsuario.CAJERO: return 'Cajero';
      default: return rol;
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
