import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

interface Ingrediente {
  id: string;
  nombre: string;
  unidadMedida: string;
  stockActual: number;
  umbralMinimo: number;
  umbralCritico: number;
  precioUnitario: number;
}

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="inventario-container">
      <div class="header-section glass-panel animate-in">
        <div>
          <h1>Almacén & Recetas</h1>
          <p>Control de materias primas críticas y stock en tiempo real para <strong>Peña Restaurant Tukuypaj</strong>.</p>
        </div>
      </div>

      <div class="inventario-panel glass-panel animate-in" style="animation-delay: 0.05s">
        <table class="inventario-table">
          <thead>
            <tr>
              <th>Ingrediente</th>
              <th>Stock Actual</th>
              <th>Unidad</th>
              <th>Costo Unitario</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            @for (ing of ingredientes(); track ing.id) {
              <tr>
                <td class="name">{{ ing.nombre }}</td>
                <td class="stock" [ngClass]="getStockStatus(ing)">
                  {{ ing.stockActual | number:'1.2-2' }}
                </td>
                <td class="unit">{{ ing.unidadMedida }}</td>
                <td class="price">Bs. {{ ing.precioUnitario | number:'1.2-2' }}</td>
                <td>
                  <span class="status-badge" [ngClass]="getStockStatus(ing)">
                    {{ getStockStatusLabel(ing) }}
                  </span>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="empty-msg">No hay ingredientes registrados.</td>
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
      gap: 24px;
    }

    .header-section {
      padding: 24px 30px;
      background: var(--gradient-brand-subtle);
      border: 1px solid var(--border-warm);
      h1 { font-family: var(--font-display); font-size: 1.55rem; font-weight: 700; color: var(--text-warm); }
      p { color: var(--text-muted); font-size: 0.88rem; strong { color: var(--primary); } }
    }

    .inventario-panel {
      padding: 10px 20px;
      overflow-x: auto;
      background: var(--bg-card);
      border-color: rgba(210, 170, 120, 0.05);
    }

    .inventario-table {
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
        &.stock {
          font-family: var(--font-title);
          font-weight: 700;
          
          &.ok { color: var(--success); }
          &.alerta { color: var(--warning); }
          &.critico { color: var(--danger); }
        }
        &.unit { color: var(--text-muted); font-size: 0.85rem; }
        &.price { color: var(--accent); font-weight: 500; }
        &.empty-msg { text-align: center; color: var(--text-muted); padding: 40px; }
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

      &.ok {
        background: var(--success-glow);
        color: #8bc9a0;
        border-color: rgba(90, 158, 111, 0.2);
      }

      &.alerta {
        background: var(--warning-glow);
        color: #e8b76a;
        border-color: rgba(212, 148, 58, 0.2);
      }

      &.critico {
        background: var(--danger-glow);
        color: #e88a8a;
        border-color: rgba(201, 74, 74, 0.2);
      }
    }
  `],
})
export class InventarioComponent implements OnInit {
  private http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3000/api';

  ingredientes = signal<Ingrediente[]>([]);

  ngOnInit() {
    this.cargarInventario();
  }

  cargarInventario() {
    this.http.get<any>(`${this.baseUrl}/carta/ingredientes`).subscribe({
      next: (res) => {
        // En NestJS all responses are wrapped in ApiResponse envelope { data: ... }
        this.ingredientes.set(res.data || []);
      },
      error: (err) => console.error('Error cargando inventario', err),
    });
  }

  getStockStatus(ing: Ingrediente): 'ok' | 'alerta' | 'critico' {
    const stock = Number(ing.stockActual);
    const critico = Number(ing.umbralCritico);
    const minimo = Number(ing.umbralMinimo);
    
    if (stock <= critico) return 'critico';
    if (stock <= minimo) return 'alerta';
    return 'ok';
  }

  getStockStatusLabel(ing: Ingrediente): string {
    const status = this.getStockStatus(ing);
    if (status === 'critico') return 'Crítico';
    if (status === 'alerta') return 'Bajo';
    return 'Suficiente';
  }
}
