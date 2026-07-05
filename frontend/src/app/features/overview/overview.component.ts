import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="overview-container">
      <div class="welcome-banner glass-panel">
        <div class="welcome-text">
          <h1>¡Hola de nuevo, {{ user()?.nombre }}!</h1>
          <p>Bienvenido al Sistema de Gestión Gastronómica Inteligente. Aquí tienes el estado operativo de hoy.</p>
        </div>
        <div class="badge-role">
          Rol Activo: {{ user()?.rol }}
        </div>
      </div>

      <!-- KPI Cards -->
      <div class="kpi-grid">
        <div class="kpi-card glass-panel glass-panel-hover">
          <div class="kpi-icon orange">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
          </div>
          <div class="kpi-data">
            <h3>$1,240.00</h3>
            <p>Ventas del Día</p>
          </div>
        </div>

        <div class="kpi-card glass-panel glass-panel-hover">
          <div class="kpi-icon green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M8 12h8" /></svg>
          </div>
          <div class="kpi-data">
            <h3>4 / 10</h3>
            <p>Mesas Ocupadas</p>
          </div>
        </div>

        <div class="kpi-card glass-panel glass-panel-hover">
          <div class="kpi-icon blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
          </div>
          <div class="kpi-data">
            <h3>6 Pedidos</h3>
            <p>En Cocina</p>
          </div>
        </div>
      </div>

      <!-- Operational Status -->
      <div class="status-box glass-panel">
        <h2>Canal de Comunicación de Tiempo Real</h2>
        <p class="status-desc">El sistema SGGI mantiene una conexión bidireccional mediante WebSockets para sincronizar las comandas instantáneamente entre meseros, cocina y caja.</p>
        <div class="sync-status">
          <span class="pulse-dot green-dot"></span>
          <span>WebSocket Escuchando en puerto 3000...</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .overview-container {
      display: flex;
      flex-direction: column;
      gap: 30px;
    }

    .welcome-banner {
      padding: 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 20px;

      h1 {
        font-family: var(--font-title);
        font-size: 1.8rem;
        font-weight: 700;
        margin-bottom: 6px;
      }

      p {
        color: var(--text-muted);
        font-size: 0.95rem;
      }

      .badge-role {
        background: var(--primary-glow);
        border: 1px solid rgba(16, 185, 129, 0.25);
        color: var(--primary);
        font-family: var(--font-title);
        font-weight: 600;
        padding: 8px 16px;
        border-radius: var(--radius-sm);
        text-transform: uppercase;
        font-size: 0.8rem;
        letter-spacing: 0.5px;
      }
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
    }

    .kpi-card {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 24px;

      .kpi-icon {
        width: 50px;
        height: 50px;
        border-radius: var(--radius-md);
        display: flex;
        align-items: center;
        justify-content: center;

        svg {
          width: 24px;
          height: 24px;
        }

        &.orange {
          background: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.2);
          color: var(--accent);
        }

        &.green {
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.2);
          color: var(--primary);
        }

        &.blue {
          background: rgba(59, 130, 246, 0.08);
          border: 1px solid rgba(59, 130, 246, 0.2);
          color: var(--info);
        }
      }

      .kpi-data {
        h3 {
          font-family: var(--font-title);
          font-size: 1.5rem;
          font-weight: 700;
          color: #ffffff;
        }
        p {
          color: var(--text-muted);
          font-size: 0.85rem;
        }
      }
    }

    .status-box {
      padding: 30px;

      h2 {
        font-family: var(--font-title);
        font-size: 1.25rem;
        margin-bottom: 12px;
        font-weight: 600;
      }

      .status-desc {
        color: var(--text-muted);
        font-size: 0.92rem;
        line-height: 1.6;
        margin-bottom: 20px;
        max-width: 700px;
      }

      .sync-status {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 0.85rem;
        color: var(--primary);
        font-weight: 500;

        .pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: var(--primary);
          box-shadow: 0 0 10px var(--primary);
          animation: blink 2s infinite;
        }
      }
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
  `],
})
export class DashboardOverviewComponent {
  private authService = inject(AuthService);
  user = this.authService.currentUserSignal;
}
