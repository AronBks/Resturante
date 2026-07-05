import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="inventario-container">
      <div class="header-section glass-panel">
        <div>
          <h1>Control de Inventario & Recetas</h1>
          <p>Control de materias primas críticas con deducción automática basada en recetas.</p>
        </div>
      </div>

      <div class="inventario-panel glass-panel">
        <table class="inventario-table">
          <thead>
            <tr>
              <th>Ingrediente</th>
              <th>Stock Actual</th>
              <th>Unidad</th>
              <th>Precio Unitario</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            @for (ing of ingredientes; track ing.nombre) {
              <tr>
                <td class="name">{{ ing.nombre }}</td>
                <td class="stock">{{ ing.stock }}</td>
                <td class="unit">{{ ing.unidad }}</td>
                <td class="price">\${{ ing.precio.toFixed(2) }}</td>
                <td>
                  <span class="status-badge" [ngClass]="ing.estado">
                    {{ ing.estado.toUpperCase() }}
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
    .inventario-container {
      display: flex;
      flex-direction: column;
      gap: 30px;
    }

    .header-section {
      padding: 24px 30px;
      h1 { font-family: var(--font-title); font-size: 1.6rem; font-weight: 700; }
      p { color: var(--text-muted); font-size: 0.9rem; }
    }

    .inventario-panel {
      padding: 20px;
      overflow-x: auto;
    }

    .inventario-table {
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
        &.stock { font-family: var(--font-title); font-weight: 600; }
        &.unit { color: var(--text-muted); }
        &.price { color: var(--accent); }
      }
    }

    .status-badge {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid transparent;

      &.ok {
        background: var(--primary-glow);
        color: #a7f3d0;
        border-color: rgba(16, 185, 129, 0.2);
      }

      &.alerta {
        background: var(--accent-glow);
        color: #fcd34d;
        border-color: rgba(245, 158, 11, 0.2);
      }

      &.critico {
        background: var(--danger-glow);
        color: #fca5a5;
        border-color: rgba(239, 68, 68, 0.2);
      }
    }
  `],
})
export class InventarioComponent {
  ingredientes = [
    { nombre: 'Lomo de res', stock: 25, unidad: 'KG', precio: 45, estado: 'ok' },
    { nombre: 'Pechuga de pollo', stock: 30, unidad: 'KG', precio: 22, estado: 'ok' },
    { nombre: 'Aceite vegetal', stock: 4, unidad: 'L', precio: 8, estado: 'alerta' },
    { nombre: 'Cebolla', stock: 1.5, unidad: 'KG', precio: 3, estado: 'critico' },
  ];
}
