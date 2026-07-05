import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-mesas',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mesas-container">
      <div class="header-section glass-panel">
        <div>
          <h1>Distribución de Mesas</h1>
          <p>Plano interactivo del salón en tiempo real.</p>
        </div>
        <div class="legend">
          <div class="legend-item"><span class="dot libre"></span> Libre</div>
          <div class="legend-item"><span class="dot ocupada"></span> Ocupada</div>
          <div class="legend-item"><span class="dot atendiendo"></span> Por Atender</div>
        </div>
      </div>

      <!-- Simulated Grid Map of tables -->
      <div class="tables-map glass-panel">
        <div class="map-grid">
          @for (mesa of mesas; track mesa.id) {
            <div class="table-card" [ngClass]="mesa.estado.toLowerCase()">
              <span class="table-number">{{ mesa.numero }}</span>
              <span class="table-cap">Cap. {{ mesa.capacidad }}</span>
              <span class="status-pill">{{ mesa.estado }}</span>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .mesas-container {
      display: flex;
      flex-direction: column;
      gap: 30px;
    }

    .header-section {
      padding: 24px 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 20px;

      h1 {
        font-family: var(--font-title);
        font-size: 1.6rem;
        font-weight: 700;
      }
      p {
        color: var(--text-muted);
        font-size: 0.9rem;
      }
    }

    .legend {
      display: flex;
      gap: 20px;
      font-size: 0.85rem;

      .legend-item {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;

        &.libre { background-color: var(--primary); }
        &.ocupada { background-color: var(--danger); }
        &.atendiendo { background-color: var(--accent); }
      }
    }

    .tables-map {
      padding: 40px;
      min-height: 400px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .map-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 30px;
      width: 100%;
      max-width: 900px;
    }

    .table-card {
      aspect-ratio: 1;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      cursor: pointer;
      transition: var(--transition-fast);
      box-shadow: 0 4px 15px rgba(0,0,0,0.25);
      border: 2px solid transparent;

      .table-number {
        font-family: var(--font-title);
        font-size: 1.4rem;
        font-weight: 800;
        color: #ffffff;
      }

      .table-cap {
        font-size: 0.72rem;
        color: rgba(255,255,255,0.7);
      }

      .status-pill {
        font-size: 0.6rem;
        font-weight: 700;
        text-transform: uppercase;
        padding: 2px 6px;
        border-radius: 4px;
        margin-top: 4px;
      }

      &.libre {
        background: rgba(16, 185, 129, 0.1);
        border-color: rgba(16, 185, 129, 0.3);
        .status-pill { background: var(--primary-glow); color: var(--primary); }
        &:hover {
          background: rgba(16, 185, 129, 0.2);
          box-shadow: 0 0 20px var(--primary-glow);
        }
      }

      &.ocupada {
        background: rgba(239, 68, 68, 0.1);
        border-color: rgba(239, 68, 68, 0.3);
        .status-pill { background: var(--danger-glow); color: #fca5a5; }
        &:hover {
          background: rgba(239, 68, 68, 0.2);
          box-shadow: 0 0 20px var(--danger-glow);
        }
      }

      &.atendiendo {
        background: rgba(245, 158, 11, 0.1);
        border-color: rgba(245, 158, 11, 0.3);
        .status-pill { background: var(--accent-glow); color: #fcd34d; }
        &:hover {
          background: rgba(245, 158, 11, 0.2);
          box-shadow: 0 0 20px var(--accent-glow);
        }
      }
    }
  `],
})
export class MesasComponent {
  mesas = [
    { id: 1, numero: 'M01', capacidad: 4, estado: 'LIBRE' },
    { id: 2, numero: 'M02', capacidad: 4, estado: 'OCUPADA' },
    { id: 3, numero: 'M03', capacidad: 2, estado: 'LIBRE' },
    { id: 4, numero: 'M04', capacidad: 6, estado: 'ATENDIENDO' },
    { id: 5, numero: 'M05', capacidad: 4, estado: 'LIBRE' },
    { id: 6, numero: 'M06', capacidad: 2, estado: 'OCUPADA' },
    { id: 7, numero: 'M07', capacidad: 8, estado: 'LIBRE' },
    { id: 8, numero: 'M08', capacidad: 4, estado: 'LIBRE' },
  ];
}
