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
      <div class="header-section glass-panel">
        <div>
          <h1>Monitor de Cocina (KDS)</h1>
          <p>Gestión de comandas y estado de preparación de platos en tiempo real.</p>
        </div>
      </div>

      <div class="tickets-grid">
        @for (pedido of pedidos(); track pedido.id) {
          <div class="ticket-card glass-panel" [ngClass]="getTicketClass(pedido)">
            <div class="ticket-header">
              <span class="mesa-badge">Mesa {{ pedido.mesa.numero }}</span>
              <span class="time-badge">{{ getTiempoTranscurrido(pedido.createdAt) }} min</span>
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
                      
                      @if (item.notas) {
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
                <button class="btn-complete" (click)="marcarPedidoEntregado(pedido.id)">
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
      gap: 30px;
    }

    .header-section {
      padding: 24px 30px;
      h1 { font-family: var(--font-title); font-size: 1.6rem; font-weight: 700; }
      p { color: var(--text-muted); font-size: 0.9rem; }
    }

    .tickets-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
    }

    .ticket-card {
      display: flex;
      flex-direction: column;
      padding: 20px;
      border-top: 4px solid var(--text-muted);
      background: rgba(255, 255, 255, 0.02);
      border-radius: var(--radius-sm);

      &.abierto { border-top-color: #94a3b8; }
      &.en-cocina { border-top-color: var(--accent); }
      &.listo { border-top-color: var(--primary); }
    }

    .ticket-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;

      .mesa-badge {
        font-family: var(--font-title);
        font-weight: 800;
        font-size: 1.2rem;
        color: #ffffff;
      }

      .time-badge {
        font-size: 0.78rem;
        background: rgba(255,255,255,0.05);
        padding: 4px 8px;
        border-radius: var(--radius-sm);
        color: var(--text-muted);
        font-weight: 600;
      }
    }

    .ticket-meta {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-bottom: 15px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      padding-bottom: 10px;

      .ticket-notes {
        margin-top: 6px;
        padding: 6px 10px;
        background: rgba(245, 158, 11, 0.05);
        border: 1px dashed rgba(245, 158, 11, 0.2);
        border-radius: var(--radius-sm);
        color: #fcd34d;
      }
    }

    .ticket-body {
      flex: 1;
      margin-bottom: 20px;

      .items-list {
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 12px;

        li {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.9rem;
          padding: 8px;
          border-radius: var(--radius-sm);
          background: rgba(255,255,255,0.01);
          border: 1px solid rgba(255,255,255,0.03);

          &.preparando {
            background: rgba(245, 158, 11, 0.03);
            border-color: rgba(245, 158, 11, 0.1);
            .quantity { color: var(--accent); }
          }

          &.listo {
            background: rgba(16, 185, 129, 0.03);
            border-color: rgba(16, 185, 129, 0.1);
            opacity: 0.8;
            .name { text-decoration: line-through; color: var(--text-muted); }
            .quantity { color: var(--primary); }
          }

          .item-main {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
          }

          .quantity {
            font-weight: 800;
            color: #94a3b8;
          }

          .name {
            color: #ffffff;
            font-weight: 500;
          }

          .item-notes {
            font-size: 0.75rem;
            color: #fca5a5;
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
        border-radius: var(--radius-sm);
        cursor: pointer;
        border: none;
        transition: var(--transition-fast);
      }

      .preparar-btn {
        background: rgba(245, 158, 11, 0.15);
        color: var(--accent);
        border: 1px solid rgba(245, 158, 11, 0.3);
        &:hover { background: var(--accent); color: #000; }
      }

      .listo-btn {
        background: rgba(16, 185, 129, 0.15);
        color: var(--primary);
        border: 1px solid rgba(16, 185, 129, 0.3);
        &:hover { background: var(--primary); color: #102a1e; }
      }

      .ready-badge {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--primary);
        background: var(--primary-glow);
        padding: 2px 6px;
        border-radius: 4px;
      }
    }

    .ticket-footer {
      border-top: 1px solid rgba(255,255,255,0.05);
      padding-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;

      .estado-general {
        display: flex;
        justify-content: space-between;
        font-size: 0.85rem;
        color: var(--text-muted);

        .estado-label {
          font-weight: 700;
          text-transform: uppercase;
          font-size: 0.75rem;
          padding: 2px 6px;
          border-radius: 4px;

          &.abierto { background: rgba(148, 163, 184, 0.1); color: #cbd5e1; }
          &.en-cocina { background: rgba(245, 158, 11, 0.15); color: #fcd34d; }
          &.listo { background: rgba(16, 185, 129, 0.15); color: var(--primary); }
        }
      }
    }

    .btn-complete {
      width: 100%;
      background: var(--primary);
      border: none;
      color: #0c4a24;
      padding: 10px;
      border-radius: var(--radius-sm);
      font-weight: 700;
      cursor: pointer;
      font-size: 0.85rem;
      transition: var(--transition-fast);

      &:hover {
        background: var(--primary-hover);
        box-shadow: 0 0 15px var(--primary-glow);
      }
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
      border: 1px dashed rgba(255,255,255,0.08);

      svg {
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
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

  cargarPedidosActivos() {
    this.http.get<any>(`${this.baseUrl}/pedidos/activos`).subscribe({
      next: (res) => this.pedidos.set(res.data || []),
      error: (err) => console.error('Error cargando pedidos activos', err)
    });
  }

  suscribirAActualizaciones() {
    // Escuchar nuevas comandas entrantes
    const subNuevo = this.socketService
      .onEvent<Pedido>('pedido:creado')
      .subscribe((nuevoPedido) => {
        console.log('🔌 WebSocket Recibido - Nueva comanda creada:', nuevoPedido);
        this.pedidos.update((lista) => [nuevoPedido, ...lista]);
      });

    // Escuchar cambios de estado global de pedidos
    const subEstado = this.socketService
      .onEvent<{ pedidoId: string; estado: string }>('pedido:estado-actualizado')
      .subscribe((data) => {
        console.log(`🔌 WebSocket Recibido - Pedido ${data.pedidoId} cambió a: ${data.estado}`);
        
        // Si el pedido fue entregado o cancelado, lo quitamos de la cola de cocina
        if (data.estado === 'ENTREGADO' || data.estado === 'CANCELADO') {
          this.pedidos.update((lista) => lista.filter((p) => p.id !== data.pedidoId));
        } else {
          // Si no, actualizamos el estado en la lista
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

    // Escuchar cambios de estado de platos individuales en tiempo real
    const subItem = this.socketService
      .onEvent<{ pedidoId: string; itemId: string; estado: string }>('item:estado-actualizado')
      .subscribe((data) => {
        console.log(`🔌 WebSocket Recibido - Item ${data.itemId} del Pedido ${data.pedidoId} cambió a: ${data.estado}`);
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
    // Si todos los platos están LISTOS o CANCELADOS, y el pedido no se ha entregado
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
