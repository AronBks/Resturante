import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { SocketService } from '../../core/services/socket.service';
import { Subscription } from 'rxjs';

interface PlatoSimplificado {
  nombre: string;
}

interface DetallePedido {
  id: string;
  platoId: string;
  cantidad: number;
  precioUnitario: number;
  notas: string | null;
  estadoItem: 'PENDIENTE' | 'PREPARANDO' | 'LISTO' | 'ENTREGADO' | 'CANCELADO';
  plato: PlatoSimplificado;
}

interface MesaSimplificada {
  id: number;
  numero: string;
  estado: string;
}

interface MeseroSimplificado {
  nombre: string;
}

interface Pedido {
  id: string;
  subtotal: number;
  total: number;
  estado: 'ABIERTO' | 'EN_COCINA' | 'LISTO' | 'ENTREGADO' | 'CANCELADO';
  notas: string | null;
  createdAt: string;
  mesaId: number;
  mesa: MesaSimplificada;
  mesero: MeseroSimplificado;
  detalles: DetallePedido[];
}

@Component({
  selector: 'app-cocina',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cocina-container">
      <div class="header-section glass-panel animate-in">
        <div>
          <h1>Cocina en Vivo (KDS)</h1>
          <p>Monitoreo y avance de comandas para los cocineros de <strong>Peña Restaurant Tukuypaj</strong>.</p>
        </div>
      </div>

      <div class="tickets-grid">
        @for (pedido of pedidos(); track pedido.id) {
          <div class="ticket-card glass-panel animate-in" [ngClass]="getTicketClass(pedido)">
            <div class="ticket-header">
              <span class="mesa-badge">Mesa {{ pedido.mesa.numero }}</span>
              <span class="time-badge" [class.delayed]="getTiempoTranscurrido(pedido.createdAt) >= 15">
                {{ getTiempoTranscurrido(pedido.createdAt) }} min
              </span>
            </div>
            
            <div class="ticket-meta">
              <span>Mesero: {{ pedido.mesero.nombre }}</span>
              @if (pedido.notas) {
                <div class="ticket-notes">💡 {{ pedido.notas }}</div>
              }
            </div>

            <div class="ticket-body">
              <ul class="items-list">
                @for (item of pedido.detalles; track item.id) {
                  <li [ngClass]="item.estadoItem.toLowerCase()">
                    <div class="item-main">
                      <span class="quantity">{{ item.cantidad }}x</span>
                      <span class="name">{{ item.plato.nombre }}</span>
                      
                      @if (notesFormat(item.notas)) {
                        <span class="item-notes">({{ item.notas }})</span>
                      }
                    </div>

                    <!-- Botones interactivos de avance de estado -->
                    <div class="item-actions">
                      @if (item.estadoItem === 'PENDIENTE') {
                        <button class="action-btn preparar-btn" (click)="avanzarEstadoItem(pedido.id, item.id, 'PREPARANDO')">
                          Preparar
                        </button>
                      } @else if (item.estadoItem === 'PREPARANDO') {
                        <button class="action-btn listo-btn" (click)="avanzarEstadoItem(pedido.id, item.id, 'LISTO')">
                          Terminar
                        </button>
                      } @else if (item.estadoItem === 'LISTO') {
                        <span class="ready-badge">Listo</span>
                      }
                    </div>
                  </li>
                }
              </ul>
            </div>

            <div class="ticket-footer">
              <div class="estado-general">
                <span>Estado:</span>
                <span class="estado-label" [ngClass]="pedido.estado.toLowerCase()">{{ getEstadoPedidoLabel(pedido.estado) }}</span>
              </div>
              
              <!-- Botón para completar comanda completa si todos están listos -->
              @if (puedeEntregarComanda(pedido)) {
                <button class="btn-complete btn-primary" (click)="marcarPedidoEntregado(pedido.id)">
                  Marcar como Entregado
                </button>
              }
            </div>
          </div>
        } @empty {
          <div class="empty-tickets glass-panel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
            <p>No hay comandas activas pendientes en la cocina.</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .cocina-container {
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

    .tickets-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
    }

    .ticket-card {
      display: flex;
      flex-direction: column;
      padding: 22px;
      border-top: 4px solid var(--text-muted);
      background: var(--bg-card);
      border-radius: var(--radius-md);

      &.abierto { border-top-color: var(--info); }
      &.en-cocina { border-top-color: var(--warning); }
      &.listo { border-top-color: var(--success); }
    }

    .ticket-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;

      .mesa-badge {
        font-family: var(--font-title);
        font-weight: 800;
        font-size: 1.25rem;
        color: var(--text-warm);
      }

      .time-badge {
        font-size: 0.75rem;
        background: rgba(255,255,255,0.03);
        border: 1px solid var(--border-glass);
        padding: 4px 8px;
        border-radius: var(--radius-sm);
        color: var(--text-muted);
        font-weight: 600;

        &.delayed {
          background: var(--danger-glow);
          color: #e08a8a;
          border-color: rgba(201, 74, 74, 0.2);
          animation: pulse-dot 2s infinite;
        }
      }
    }

    .ticket-meta {
      font-size: 0.82rem;
      color: var(--text-muted);
      margin-bottom: 15px;
      border-bottom: 1px solid var(--border-glass);
      padding-bottom: 10px;

      .ticket-notes {
        margin-top: 8px;
        padding: 8px 12px;
        background: var(--warning-glow);
        border: 1px dashed rgba(212, 148, 58, 0.25);
        border-radius: var(--radius-sm);
        color: #e8b76a;
      }
    }

    .ticket-body {
      flex: 1;
      margin-bottom: 20px;

      .items-list {
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 10px;

        li {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.88rem;
          padding: 8px 12px;
          border-radius: var(--radius-sm);
          background: rgba(255,255,255,0.01);
          border: 1px solid rgba(255,255,255,0.02);

          &.preparando {
            background: var(--warning-glow);
            border-color: rgba(212, 148, 58, 0.12);
            .quantity { color: var(--warning); }
          }

          &.listo {
            background: var(--success-glow);
            border-color: rgba(90, 158, 111, 0.12);
            opacity: 0.75;
            .name { text-decoration: line-through; color: var(--text-muted); }
            .quantity { color: var(--success); }
          }

          .item-main {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
          }

          .quantity {
            font-weight: 800;
            color: var(--text-muted);
          }

          .name {
            color: var(--text-warm);
            font-weight: 500;
          }

          .item-notes {
            font-size: 0.75rem;
            color: #e08a8a;
            font-style: italic;
          }
        }
      }
    }

    .item-actions {
      .action-btn {
        padding: 4px 10px;
        font-size: 0.75rem;
        font-weight: 700;
        border-radius: var(--radius-xs);
        cursor: pointer;
        border: none;
        transition: var(--transition-fast);
      }

      .preparar-btn {
        background: var(--warning-glow);
        color: var(--warning);
        border: 1px solid rgba(212, 148, 58, 0.25);
        &:hover { background: var(--warning); color: #1a1410; }
      }

      .listo-btn {
        background: var(--success-glow);
        color: var(--success);
        border: 1px solid rgba(90, 158, 111, 0.25);
        &:hover { background: var(--success); color: #1a1410; }
      }

      .ready-badge {
        font-size: 0.72rem;
        font-weight: 700;
        color: var(--success);
        background: var(--success-glow);
        padding: 2px 6px;
        border-radius: var(--radius-xs);
        border: 1px solid rgba(90, 158, 111, 0.15);
      }
    }

    .ticket-footer {
      border-top: 1px solid var(--border-glass);
      padding-top: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;

      .estado-general {
        display: flex;
        justify-content: space-between;
        font-size: 0.85rem;
        color: var(--text-muted);
        align-items: center;

        .estado-label {
          font-weight: 700;
          text-transform: uppercase;
          font-size: 0.68rem;
          padding: 3px 8px;
          border-radius: var(--radius-xs);

          &.abierto { background: rgba(124, 158, 184, 0.1); color: #a3c4db; }
          &.en-cocina { background: var(--warning-glow); color: #e8b76a; }
          &.listo { background: var(--success-glow); color: var(--success); }
        }
      }
    }

    .btn-complete {
      width: 100%;
      height: 38px;
      padding: 0;
      font-size: 0.82rem;
    }

    .empty-tickets {
      grid-column: 1 / -1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      text-align: center;
      color: var(--text-muted);
      border: 1px dashed var(--border-glass);

      svg {
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
        opacity: 0.4;
        color: var(--primary);
      }
    }
  `],
})
export class CocinaComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private socketService = inject(SocketService);

  private readonly baseUrl = 'http://localhost:3000/api';

  pedidos = signal<Pedido[]>([]);
  private subs: Subscription[] = [];

  ngOnInit() {
    this.cargarPedidosActivos();
    this.suscribirAActualizaciones();
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }

  notesFormat(val: any): boolean {
    return val && String(val).trim().length > 0;
  }

  cargarPedidosActivos() {
    this.http.get<any>(`${this.baseUrl}/pedidos/activos`).subscribe({
      next: (res) => this.pedidos.set(res.data || []),
      error: (err) => console.error('Error cargando pedidos activos', err)
    });
  }

  suscribirAActualizaciones() {
    const subNuevo = this.socketService
      .onEvent<Pedido>('pedido:creado')
      .subscribe((nuevoPedido) => {
        this.pedidos.update((lista) => [nuevoPedido, ...lista]);
      });

    const subEstado = this.socketService
      .onEvent<{ pedidoId: string; estado: string }>('pedido:estado-actualizado')
      .subscribe((data) => {
        if (data.estado === 'ENTREGADO' || data.estado === 'CANCELADO') {
          this.pedidos.update((lista) => lista.filter((p) => p.id !== data.pedidoId));
        } else {
          this.pedidos.update((lista) => {
            return lista.map((p) => {
              if (p.id === data.pedidoId) {
                return { ...p, estado: data.estado as any };
              }
              return p;
            });
          });
        }
      });

    const subItem = this.socketService
      .onEvent<{ pedidoId: string; itemId: string; estado: string }>('item:estado-actualizado')
      .subscribe((data) => {
        this.pedidos.update((lista) => {
          return lista.map((pedido) => {
            if (pedido.id === data.pedidoId) {
              const nuevosDetalles = pedido.detalles.map((item) => {
                if (item.id === data.itemId) {
                  return { ...item, estadoItem: data.estado as any };
                }
                return item;
              });
              return { ...pedido, detalles: nuevosDetalles };
            }
            return pedido;
          });
        });
      });

    this.subs.push(subNuevo, subEstado, subItem);
  }

  avanzarEstadoItem(pedidoId: string, itemId: string, nuevoEstado: string) {
    this.http
      .patch(`${this.baseUrl}/pedidos/${pedidoId}/items/${itemId}/estado`, { estado: nuevoEstado })
      .subscribe({
        next: () => console.log(`Item ${itemId} actualizado a ${nuevoEstado}`),
        error: (err) => console.error('Error actualizando estado del item', err)
      });
  }

  puedeEntregarComanda(pedido: Pedido): boolean {
    return pedido.detalles.every(
      (i) => i.estadoItem === 'LISTO' || i.estadoItem === 'CANCELADO'
    );
  }

  marcarPedidoEntregado(pedidoId: string) {
    this.http
      .patch(`${this.baseUrl}/pedidos/${pedidoId}/estado`, { estado: 'ENTREGADO' })
      .subscribe({
        next: () => console.log(`Pedido ${pedidoId} entregado a la mesa`),
        error: (err) => console.error('Error entregando pedido', err)
      });
  }

  getTiempoTranscurrido(createdAt: string): number {
    const inicio = new Date(createdAt).getTime();
    const ahora = new Date().getTime();
    const diffMinutos = Math.floor((ahora - inicio) / 1000 / 60);
    return Math.max(0, diffMinutos);
  }

  getTicketClass(pedido: Pedido): string {
    return pedido.estado.toLowerCase().replace('_', '-');
  }

  getEstadoPedidoLabel(estado: string): string {
    switch (estado) {
      case 'ABIERTO': return 'Pendiente';
      case 'EN_COCINA': return 'En Cocina';
      case 'LISTO': return 'Listo';
      case 'ENTREGADO': return 'Entregado';
      default: return estado;
    }
  }
}
