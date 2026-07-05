import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cocina',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cocina-container">
      <div class="header-section glass-panel">
        <div>
          <h1>Monitor de Cocina (KDS)</h1>
          <p>Tickets de preparación activos ordenados por prioridad.</p>
        </div>
      </div>

      <div class="tickets-grid">
        @for (ticket of tickets; track ticket.id) {
          <div class="ticket-card glass-panel" [ngClass]="ticket.prioridad">
            <div class="ticket-header">
              <span class="mesa-badge">Mesa {{ ticket.mesa }}</span>
              <span class="time-badge">{{ ticket.tiempo }} min</span>
            </div>
            <div class="ticket-body">
              <ul class="items-list">
                @for (item of ticket.items; track item.nombre) {
                  <li>
                    <span class="quantity">{{ item.cantidad }}x</span>
                    <span class="name">{{ item.nombre }}</span>
                  </li>
                }
              </ul>
            </div>
            <div class="ticket-footer">
              <button class="btn-complete">Listo</button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .cocina-container {
      display: flex;
      flex-direction: column;
      gap: 30px;
    }

    .header-section {
      padding: 24px 30px;
      h1 { font-family: var(--font-title); font-size: 1.6rem; font-weight: 700; }
      p { color: var(--text-muted); font-size: 0.9rem; }
    }

    .tickets-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
    }

    .ticket-card {
      display: flex;
      flex-direction: column;
      padding: 20px;
      border-top: 4px solid var(--info);

      &.alta { border-top-color: var(--danger); }
      &.media { border-top-color: var(--accent); }
    }

    .ticket-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      border-bottom: 1px solid var(--border-glass);
      padding-bottom: 8px;

      .mesa-badge {
        font-family: var(--font-title);
        font-weight: 700;
        font-size: 1.1rem;
      }

      .time-badge {
        font-size: 0.8rem;
        background: rgba(255,255,255,0.05);
        padding: 4px 8px;
        border-radius: var(--radius-sm);
        color: var(--text-muted);
      }
    }

    .ticket-body {
      flex: 1;
      margin-bottom: 16px;

      .items-list {
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 10px;

        li {
          display: flex;
          gap: 10px;
          font-size: 0.95rem;

          .quantity {
            font-weight: 700;
            color: var(--primary);
          }

          .name {
            color: #ffffff;
          }
        }
      }
    }

    .btn-complete {
      width: 100%;
      background: var(--primary);
      border: none;
      color: #ffffff;
      padding: 8px;
      border-radius: var(--radius-sm);
      font-weight: 600;
      cursor: pointer;
      transition: var(--transition-fast);

      &:hover {
        background: var(--primary-hover);
        box-shadow: 0 0 10px var(--primary-glow);
      }
    }
  `],
})
export class CocinaComponent {
  tickets = [
    {
      id: 1,
      mesa: 'M02',
      tiempo: 12,
      prioridad: 'alta',
      items: [
        { cantidad: 2, nombre: 'Lomo Saltado' },
        { cantidad: 1, nombre: 'Sopa de Fideo' },
      ],
    },
    {
      id: 2,
      mesa: 'M04',
      tiempo: 5,
      prioridad: 'media',
      items: [
        { cantidad: 1, nombre: 'Parrillada para 2' },
        { cantidad: 2, nombre: 'Limonada Natural' },
      ],
    },
  ];
}
