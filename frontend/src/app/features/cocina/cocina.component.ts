import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { SocketService } from '../../core/services/socket.service';
import { LucideAngularModule } from 'lucide-angular';
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
  canalOrigen?: 'MESERO_POS' | 'CLIENTE_DIGITAL' | 'IA_DON_BETO';
  notas: string | null;
  createdAt: string;
  updatedAt?: string;
  mesaId: number;
  mesa: MesaSimplificada;
  mesero: MeseroSimplificado;
  detalles: DetallePedido[];
  animandoSalida?: boolean;
}

@Component({
  selector: 'app-cocina',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="despacho-container animate-in">
      <!-- ── Encabezado Principal ── -->
      <div class="despacho-header">
        <div class="top-nav-bar">
          <div class="breadcrumb">
            <span class="brand">Tukuypaj</span>
            <span class="sep">/</span>
            <span class="current">Pase & Despacho de Cocina</span>
          </div>
          <div class="live-status-pill">
            <span class="pulse-dot"></span>
            <span>Despacho en Vivo</span>
          </div>
        </div>

        <div class="header-main-row">
          <div>
            <h1 class="page-title">Pase de Platos & Despacho</h1>
            <p class="page-subtitle">
              Diseñado para horas pico: Control claro de platos que salen del fogón a la barra y confirmación de entrega a mesa.
            </p>
          </div>

          <!-- Herramientas superiores -->
          <div class="header-tools">
            <button 
              type="button" 
              class="btn-audio-toggle" 
              [class.active]="sonidoHabilitado()" 
              (click)="toggleSonido()"
              title="Aviso sonoro al entrar pedidos o salir comida"
            >
              <lucide-icon [name]="sonidoHabilitado() ? 'bell' : 'bell-ring'" class="icon-sm"></lucide-icon>
              <span>{{ sonidoHabilitado() ? 'Timbre: Activo' : 'Timbre: Silenciado' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- ── Pestañas Principales (Activas vs Despachadas Recientes) ── -->
      <div class="main-tabs-bar no-print">
        <button 
          type="button" 
          class="tab-main-btn" 
          [class.active]="tabActiva() === 'activas'"
          (click)="tabActiva.set('activas')"
        >
          <lucide-icon name="flame" class="icon-sm"></lucide-icon>
          <span>En Cocina & Barra</span>
          <span class="tab-badge-count">{{ totalComandas() }}</span>
        </button>

        <button 
          type="button" 
          class="tab-main-btn" 
          [class.active]="tabActiva() === 'despachadas'"
          (click)="tabActiva.set('despachadas')"
        >
          <lucide-icon name="check-circle-2" class="icon-sm"></lucide-icon>
          <span>Recién Despachadas (Últimas)</span>
          <span class="tab-badge-count success">{{ despachadosRecientes().length }}</span>
        </button>
      </div>

      <!-- ═══════════════════════════════════════════
           VISTA 1: COMANDAS EN COCINA & BARRA
           ═══════════════════════════════════════════ -->
      <div *ngIf="tabActiva() === 'activas'">
        <!-- Barra de Métricas y Filtros Rápidos -->
        <div class="stats-filters-bar glass-panel">
          <div class="stats-row">
            <div class="stat-pill" [class.highlight]="totalComandas() > 0">
              <span class="stat-num">{{ totalComandas() }}</span>
              <span class="stat-lbl">Mesas en Espera</span>
            </div>
            <div class="stat-pill warning" [class.highlight]="platosEnPreparacion() > 0">
              <span class="stat-num">{{ platosEnPreparacion() }}</span>
              <span class="stat-lbl">En Fogón / Olla</span>
            </div>
            <div class="stat-pill success pulse-glow" [class.highlight]="platosListosEnMostrador() > 0">
              <span class="stat-num">{{ platosListosEnMostrador() }}</span>
              <span class="stat-lbl">¡Listos en Barra!</span>
            </div>
          </div>

          <!-- Filtros visuales para hora pico -->
          <div class="filter-chips">
            <button 
              type="button" 
              class="filter-chip" 
              [class.active]="filtroSeleccionado() === 'todos'" 
              (click)="filtroSeleccionado.set('todos')"
            >
              Todos ({{ totalComandas() }})
            </button>
            <button 
              type="button" 
              class="filter-chip chip-ready" 
              [class.active]="filtroSeleccionado() === 'listos'" 
              (click)="filtroSeleccionado.set('listos')"
            >
              <lucide-icon name="check-circle-2" class="icon-xs"></lucide-icon>
              <span>Listos en Barra ({{ comandasConPlatosListos() }})</span>
            </button>
            <button 
              type="button" 
              class="filter-chip chip-demora" 
              [class.active]="filtroSeleccionado() === 'demora'" 
              (click)="filtroSeleccionado.set('demora')"
            >
              <lucide-icon name="clock" class="icon-xs"></lucide-icon>
              <span>Demorados +15 min ({{ comandasDemoradas() }})</span>
            </button>
          </div>
        </div>

        <!-- Grilla de Comandas -->
        <div class="tickets-grid">
          @for (pedido of pedidosFiltrados(); track pedido.id) {
            <div 
              class="ticket-card glass-panel" 
              [class.card-en-barra]="todosPlatosListos(pedido)"
              [class.card-demorada]="!todosPlatosListos(pedido) && getTiempoTranscurrido(pedido.createdAt) >= 15"
              [class.anim-exit]="pedido.animandoSalida"
            >
              <!-- Cabecera del Ticket -->
              <div class="ticket-header">
                <div class="mesa-badge-wrap">
                  <span class="mesa-title">MESA {{ pedido.mesa.numero }}</span>
                  <span class="origen-tag" [ngClass]="getOrigenClass(pedido.canalOrigen)">
                    {{ getOrigenLabel(pedido.canalOrigen) }}
                  </span>
                </div>
                <div class="time-badge" [class.time-danger]="getTiempoTranscurrido(pedido.createdAt) >= 15">
                  <lucide-icon name="clock" class="icon-xs"></lucide-icon>
                  <span>Hace {{ getTiempoTranscurrido(pedido.createdAt) }} min</span>
                </div>
              </div>

              <!-- Banner de Estado de Comanda (Claridad Visual Inmediata) -->
              <div class="comanda-status-banner" [class.banner-ready]="todosPlatosListos(pedido)">
                @if (todosPlatosListos(pedido)) {
                  <lucide-icon name="check-circle-2" class="icon-xs"></lucide-icon>
                  <span>COMIDA LISTA EN BARRA — Esperando retiro por garzón</span>
                } @else {
                  <lucide-icon name="flame" class="icon-xs"></lucide-icon>
                  <span>En Cocina — Preparando comanda</span>
                }
              </div>

              <div class="ticket-meta">
                <div class="mesero-info">
                  <lucide-icon name="user" class="icon-xs text-muted"></lucide-icon>
                  <span>Garzón: <strong>{{ pedido.mesero.nombre }}</strong></span>
                </div>
                @if (pedido.notas) {
                  <div class="ticket-notes">
                    <lucide-icon name="alert-circle" class="icon-xs"></lucide-icon>
                    <span>Nota: {{ pedido.notas }}</span>
                  </div>
                }
              </div>

              <!-- Lista de Platos de la Mesa -->
              <div class="ticket-body">
                <ul class="items-list">
                  @for (item of pedido.detalles; track item.id) {
                    <li [class.item-listo]="item.estadoItem === 'LISTO'">
                      <div class="item-info-col">
                        <div class="item-name-row">
                          <span class="qty-pill">{{ item.cantidad }}x</span>
                          <span class="plato-name">{{ item.plato.nombre }}</span>
                        </div>
                        @if (notesFormat(item.notas)) {
                          <div class="item-especial-note">
                            <lucide-icon name="info" class="icon-xs"></lucide-icon>
                            <span>{{ item.notas }}</span>
                          </div>
                        }
                      </div>

                      <!-- Botón de 1 toque individual por plato -->
                      <div class="item-action-wrap">
                        @if (item.estadoItem !== 'LISTO') {
                          <button 
                            type="button" 
                            class="btn-item-touch" 
                            (click)="marcarPlatoEnBarra(pedido.id, item.id)"
                            title="Tocar si este plato ya salió a la barra caliente"
                          >
                            <span>Pase a Barra</span>
                            <lucide-icon name="chevron-right" class="icon-xs"></lucide-icon>
                          </button>
                        } @else {
                          <span class="badge-item-ready" (click)="revertirPlatoAFogon(pedido.id, item.id)" title="Click para devolver a fogón si hubo error">
                            <lucide-icon name="check-circle-2" class="icon-xs"></lucide-icon>
                            <span>En Barra</span>
                          </span>
                        }
                      </div>
                    </li>
                  }
                </ul>
              </div>

              <!-- ── Pie del Ticket: FLUJO INTUITIVO DE ACCIÓN ── -->
              <div class="ticket-footer">
                @if (!todosPlatosListos(pedido)) {
                  <!-- PASO 1: Aún faltan platos por salir de cocina -->
                  <div class="footer-step-1">
                    <button 
                      type="button" 
                      class="btn-step-action btn-poner-barra" 
                      (click)="ponerTodaLaComidaEnBarra(pedido.id)"
                      title="Pasa todos los platos a la barra caliente de un solo toque"
                    >
                      <lucide-icon name="concierge-bell" class="icon-sm"></lucide-icon>
                      <div class="btn-text-block">
                        <span class="main-txt">1. Comida en Barra</span>
                        <span class="sub-txt">Avisar comanda completa en mostrador</span>
                      </div>
                    </button>

                    <!-- Atajo rápido opcional para cuando el mesero saca directo a mesa sin pasar por barra -->
                    <button 
                      type="button" 
                      class="btn-shortcut-direct" 
                      (click)="confirmarEntregaDirecta(pedido)"
                      title="Atajo de hora pico: El garzón sacó la comida volando directo a la mesa"
                    >
                      <lucide-icon name="send" class="icon-xs"></lucide-icon>
                      <span>Servicio Directo</span>
                    </button>
                  </div>
                } @else {
                  <!-- PASO 2: Todo listo en barra esperando que el mesero se lo lleve -->
                  <div class="footer-step-2">
                    <button 
                      type="button" 
                      class="btn-step-action btn-entregar-mesa-ready pulse-green-btn" 
                      (click)="marcarPedidoEntregado(pedido)"
                      title="Tocar cuando el mesero levanta la bandeja y la lleva al salón"
                    >
                      <lucide-icon name="check-circle-2" class="icon-md"></lucide-icon>
                      <div class="btn-text-block">
                        <span class="main-txt">2. Entregar a Mesa (Servido)</span>
                        <span class="sub-txt">Confirmar comanda retirada por garzón</span>
                      </div>
                    </button>
                  </div>
                }
              </div>
            </div>
          } @empty {
            <div class="empty-state-panel glass-panel">
              <div class="empty-icon-box">
                <lucide-icon name="concierge-bell" class="icon-xl text-gold"></lucide-icon>
              </div>
              <h2>Mostrador al Día</h2>
              <p>No hay comandas pendientes de cocina ni platos esperando en barra.</p>
              <span class="empty-sub">Nuevos pedidos de salón o QR entrarán automáticamente en vivo.</span>
            </div>
          }
        </div>
      </div>

      <!-- ═══════════════════════════════════════════
           VISTA 2: RECIÉN DESPACHADAS (HISTORIAL + SALVAVIDAS DESHACER)
           ═══════════════════════════════════════════ -->
      <div *ngIf="tabActiva() === 'despachadas'" class="despachadas-view">
        <div class="despachadas-header-card glass-panel">
          <div class="info-block">
            <h3><lucide-icon name="history" class="icon-sm text-gold"></lucide-icon> Historial Inmediato de Despacho</h3>
            <p>Aquí quedan guardados los últimos pedidos entregados. Si alguien tocó una mesa por error, puedes devolverla a cocina con un clic:</p>
          </div>
          <button type="button" class="btn-refresh" (click)="cargarDespachadosRecientes()">
            <lucide-icon name="refresh-cw" class="icon-xs"></lucide-icon>
            <span>Actualizar</span>
          </button>
        </div>

        <div class="despachadas-grid">
          @for (pedido of despachadosRecientes(); track pedido.id) {
            <div class="ticket-card despachado-card glass-panel">
              <div class="ticket-header">
                <div class="mesa-badge-wrap">
                  <span class="mesa-title">MESA {{ pedido.mesa.numero }}</span>
                  <span class="badge-despachado-pill">
                    <lucide-icon name="check" class="icon-xs"></lucide-icon> Servido
                  </span>
                </div>
                <span class="time-despacho-lbl">
                  {{ pedido.updatedAt || pedido.createdAt | date:'shortTime' }}
                </span>
              </div>

              <div class="ticket-meta">
                <div class="mesero-info">
                  <lucide-icon name="user" class="icon-xs text-muted"></lucide-icon>
                  <span>Garzón: <strong>{{ pedido.mesero.nombre }}</strong></span>
                </div>
              </div>

              <div class="ticket-body">
                <ul class="items-list-compact">
                  @for (item of pedido.detalles; track item.id) {
                    <li>
                      <span class="qty-pill">{{ item.cantidad }}x</span>
                      <span class="name">{{ item.plato.nombre }}</span>
                    </li>
                  }
                </ul>
              </div>

              <!-- BOTÓN SALVAVIDAS: DESHACER ERROR -->
              <div class="ticket-footer">
                <button 
                  type="button" 
                  class="btn-deshacer-error" 
                  (click)="recuperarPedidoACocina(pedido)"
                  title="¿Se marcó por error? Toca aquí para regresar la comanda a la barra/cocina"
                >
                  <lucide-icon name="rotate-ccw" class="icon-xs"></lucide-icon>
                  <span>Devolver a Barra (Deshacer)</span>
                </button>
              </div>
            </div>
          } @empty {
            <div class="empty-state-panel glass-panel">
              <p>No hay pedidos despachados recientemente en este turno.</p>
            </div>
          }
        </div>
      </div>

      <!-- ── Toast Flotante de Deshacer Rápido (8 segundos) ── -->
      <div class="floating-undo-toast" *ngIf="ultimoPedidoDespachado()">
        <div class="toast-content">
          <lucide-icon name="check-circle-2" class="icon-sm text-success"></lucide-icon>
          <span>Mesa <strong>{{ ultimoPedidoDespachado()?.mesa?.numero }}</strong> marcada como entregada.</span>
        </div>
        <button type="button" class="btn-toast-undo" (click)="deshacerUltimaEntrega()">
          <lucide-icon name="rotate-ccw" class="icon-xs"></lucide-icon>
          <span>Deshacer</span>
        </button>
        <button type="button" class="btn-toast-close" (click)="ultimoPedidoDespachado.set(null)">✕</button>
      </div>

    </div>
  `,
  styles: [`
    /* ═══════════════════════════════════════════
       PASE & DESPACHO — Estilos Obsidian & Gold Pro
       ═══════════════════════════════════════════ */
    .despacho-container {
      display: flex;
      flex-direction: column;
      gap: 18px;
      padding-bottom: 40px;
    }

    .top-nav-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;

      .breadcrumb {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.82rem;

        .brand { color: #c0a678; font-weight: 700; }
        .sep { color: rgba(255, 255, 255, 0.2); }
        .current { color: #e3dad0; font-weight: 500; }
      }

      .live-status-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 4px 14px;
        background: rgba(34, 197, 94, 0.08);
        border: 1px solid rgba(34, 197, 94, 0.22);
        color: #4ade80;
        font-size: 0.78rem;
        font-weight: 600;
        border-radius: 20px;

        .pulse-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #4ade80;
          box-shadow: 0 0 8px #4ade80;
          animation: statusPulse 2s infinite ease-in-out;
        }
      }
    }

    @keyframes statusPulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.15); }
    }

    .header-main-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;

      .page-title {
        font-family: 'Playfair Display', Georgia, serif;
        font-size: 1.85rem;
        font-weight: 700;
        color: #f5ede4;
        margin: 0 0 4px;
      }

      .page-subtitle {
        color: #9c9285;
        font-size: 0.88rem;
        margin: 0;
        max-width: 720px;
      }

      .btn-audio-toggle {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #a89f92;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #f5ede4;
        }

        &.active {
          background: rgba(229, 185, 76, 0.12);
          border-color: rgba(229, 185, 76, 0.35);
          color: #f2c75e;
        }
      }
    }

    /* ── Pestañas Principales ── */
    .main-tabs-bar {
      display: flex;
      gap: 10px;
      margin-top: 6px;

      .tab-main-btn {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: #b0a597;
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;

        .tab-badge-count {
          padding: 2px 8px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          font-size: 0.78rem;
          color: #f5ede4;

          &.success {
            background: rgba(34, 197, 94, 0.2);
            color: #4ade80;
          }
        }

        &:hover {
          background: rgba(255, 255, 255, 0.07);
          color: #ffffff;
        }

        &.active {
          background: #e5b94c;
          border-color: #e5b94c;
          color: #120e07;

          .tab-badge-count {
            background: rgba(18, 14, 7, 0.25);
            color: #120e07;
            font-weight: 800;
          }
        }
      }
    }

    /* ── Barra de Métricas y Filtros ── */
    .stats-filters-bar {
      background: rgba(22, 19, 15, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 14px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      margin-top: 4px;

      .stats-row {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;

        .stat-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;

          .stat-num {
            font-family: 'Inter', sans-serif;
            font-size: 1.15rem;
            font-weight: 800;
            color: #f5ede4;
          }

          .stat-lbl {
            font-size: 0.78rem;
            color: #8c8276;
            font-weight: 600;
          }

          &.warning {
            border-color: rgba(234, 179, 8, 0.25);
            .stat-num { color: #facc15; }
          }

          &.success {
            border-color: rgba(34, 197, 94, 0.35);
            background: rgba(34, 197, 94, 0.08);
            .stat-num { color: #4ade80; }
          }
        }
      }

      .filter-chips {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;

        .filter-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #9c9285;
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;

          &:hover {
            color: #f5ede4;
            background: rgba(255, 255, 255, 0.06);
          }

          &.active {
            background: rgba(229, 185, 76, 0.2);
            border-color: #e5b94c;
            color: #fcd34d;
            font-weight: 700;
          }

          &.chip-ready.active {
            background: rgba(34, 197, 94, 0.2);
            border-color: #22c55e;
            color: #86efac;
          }

          &.chip-demora.active {
            background: rgba(239, 68, 68, 0.2);
            border-color: #ef4444;
            color: #fca5a5;
          }
        }
      }
    }

    /* ── Grilla de Comandas ── */
    .tickets-grid, .despachadas-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));
      gap: 18px;
      margin-top: 14px;
    }

    .ticket-card {
      background: linear-gradient(135deg, rgba(28, 23, 18, 0.95) 0%, rgba(18, 15, 12, 0.98) 100%);
      border: 1px solid rgba(229, 185, 76, 0.2);
      border-radius: 14px;
      padding: 18px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 10px 24px -6px rgba(0, 0, 0, 0.5);
      transition: all 0.25s ease;
      position: relative;

      &:hover {
        border-color: rgba(229, 185, 76, 0.4);
        transform: translateY(-2px);
      }

      /* ESTADO: COMIDA EN BARRA ESPERANDO AL GARZÓN (VERDE RADIANTE) */
      &.card-en-barra {
        border-color: rgba(34, 197, 94, 0.6);
        background: linear-gradient(135deg, rgba(20, 36, 22, 0.96) 0%, rgba(14, 26, 16, 0.98) 100%);
        box-shadow: 0 12px 30px rgba(34, 197, 94, 0.15), 0 0 0 1px rgba(34, 197, 94, 0.3);
      }

      &.card-demorada {
        border-color: rgba(239, 68, 68, 0.5);
        box-shadow: 0 0 18px rgba(239, 68, 68, 0.2);
      }

      &.anim-exit {
        opacity: 0;
        transform: scale(0.95) translateY(-10px);
        transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .ticket-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;

        .mesa-badge-wrap {
          display: flex;
          align-items: center;
          gap: 8px;

          .mesa-title {
            font-family: 'Inter', system-ui, sans-serif;
            font-size: 1.35rem;
            font-weight: 900;
            letter-spacing: -0.3px;
            color: #fce08c;
          }

          .origen-tag {
            font-size: 0.65rem;
            font-weight: 700;
            padding: 2px 7px;
            border-radius: 4px;
            text-transform: uppercase;

            &.tag-salon { background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.25); }
            &.tag-qr { background: rgba(234, 179, 8, 0.12); color: #facc15; border: 1px solid rgba(234, 179, 8, 0.25); }
            &.tag-ia { background: rgba(168, 85, 247, 0.12); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.25); }
          }
        }

        .time-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 9px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          font-size: 0.74rem;
          color: #a89f92;
          font-weight: 600;

          &.time-danger {
            background: rgba(239, 68, 68, 0.15);
            border-color: rgba(239, 68, 68, 0.4);
            color: #fca5a5;
            font-weight: 800;
          }
        }
      }

      /* Banner de estado claro en la tarjeta */
      .comanda-status-banner {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 5px 10px;
        border-radius: 6px;
        background: rgba(234, 179, 8, 0.1);
        border: 1px solid rgba(234, 179, 8, 0.2);
        color: #facc15;
        font-size: 0.74rem;
        font-weight: 700;
        margin-bottom: 8px;

        &.banner-ready {
          background: rgba(34, 197, 94, 0.15);
          border-color: rgba(34, 197, 94, 0.4);
          color: #4ade80;
        }
      }

      .ticket-meta {
        font-size: 0.8rem;
        color: #9c9285;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);

        .mesero-info {
          display: flex;
          align-items: center;
          gap: 6px;
          strong { color: #e5ded5; }
        }

        .ticket-notes {
          margin-top: 6px;
          padding: 6px 10px;
          background: rgba(234, 179, 8, 0.08);
          border: 1px dashed rgba(234, 179, 8, 0.3);
          border-radius: 6px;
          color: #fde047;
          font-size: 0.78rem;
          font-weight: 600;
        }
      }

      .ticket-body {
        flex: 1;
        margin-bottom: 14px;

        .items-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;

          li {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 10px;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            transition: all 0.2s ease;

            &.item-listo {
              background: rgba(34, 197, 94, 0.1);
              border-color: rgba(34, 197, 94, 0.3);

              .plato-name { color: #86efac; }
            }

            .item-info-col {
              display: flex;
              flex-direction: column;
              gap: 2px;
              flex: 1;
              margin-right: 10px;

              .item-name-row {
                display: flex;
                align-items: center;
                gap: 8px;

                .qty-pill {
                  background: rgba(229, 185, 76, 0.15);
                  color: #fce08c;
                  padding: 2px 7px;
                  border-radius: 4px;
                  font-size: 0.82rem;
                  font-weight: 800;
                }

                .plato-name {
                  font-size: 0.9rem;
                  font-weight: 700;
                  color: #f5ede4;
                }
              }

              .item-especial-note {
                display: flex;
                align-items: center;
                gap: 5px;
                font-size: 0.74rem;
                color: #fca5a5;
                font-style: italic;
                margin-left: 28px;
              }
            }

            .item-action-wrap {
              flex-shrink: 0;

              .btn-item-touch {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                padding: 6px 12px;
                background: rgba(234, 179, 8, 0.12);
                border: 1px solid rgba(234, 179, 8, 0.3);
                color: #fde047;
                border-radius: 6px;
                font-size: 0.76rem;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.2s ease;

                &:hover {
                  background: #eab308;
                  color: #120f0c;
                }
              }

              .badge-item-ready {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 0.76rem;
                font-weight: 800;
                color: #4ade80;
                background: rgba(34, 197, 94, 0.12);
                border: 1px solid rgba(34, 197, 94, 0.25);
                padding: 4px 8px;
                border-radius: 6px;
                cursor: pointer;

                &:hover {
                  border-color: rgba(239, 68, 68, 0.5);
                  color: #fca5a5;
                }
              }
            }
          }
        }
      }

      /* ── PIE DEL TICKET: BOTONES DE FLUJO INTUITIVO ── */
      .ticket-footer {
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        padding-top: 12px;

        /* PASO 1: EN COCINA */
        .footer-step-1 {
          display: flex;
          gap: 8px;
          align-items: stretch;

          .btn-poner-barra {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            padding: 12px 14px;
            background: linear-gradient(135deg, #e5b94c 0%, #caa038 100%);
            color: #120e07;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(229, 185, 76, 0.3);
            transition: all 0.2s ease;

            &:hover {
              background: linear-gradient(135deg, #f2c75e 0%, #d8ae42 100%);
              transform: translateY(-2px);
              box-shadow: 0 6px 18px rgba(229, 185, 76, 0.45);
            }

            .btn-text-block {
              display: flex;
              flex-direction: column;
              text-align: left;
              line-height: 1.2;

              .main-txt { font-size: 0.92rem; font-weight: 800; }
              .sub-txt { font-size: 0.68rem; font-weight: 600; opacity: 0.85; }
            }
          }

          .btn-shortcut-direct {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 0 14px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.12);
            color: #a89f92;
            border-radius: 10px;
            font-size: 0.74rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s ease;

            &:hover {
              background: rgba(34, 197, 94, 0.15);
              border-color: #22c55e;
              color: #4ade80;
            }
          }
        }

        /* PASO 2: EN BARRA LISTO PARA EL GARZÓN */
        .footer-step-2 {
          .btn-entregar-mesa-ready {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            padding: 14px 18px;
            background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
            color: #ffffff;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            box-shadow: 0 6px 20px rgba(34, 197, 94, 0.4);
            transition: all 0.2s ease;

            &:hover {
              background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
              transform: translateY(-2px);
              box-shadow: 0 8px 26px rgba(34, 197, 94, 0.55);
            }

            .btn-text-block {
              display: flex;
              flex-direction: column;
              text-align: left;
              line-height: 1.2;

              .main-txt { font-size: 1rem; font-weight: 900; }
              .sub-txt { font-size: 0.72rem; font-weight: 600; opacity: 0.9; }
            }
          }
        }
      }
    }

    /* ── PESTAÑA 2: DESPACHADAS RECIENTES (SALVAVIDAS) ── */
    .despachadas-view {
      .despachadas-header-card {
        background: rgba(22, 19, 15, 0.85);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 16px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 14px;

        .info-block {
          h3 { margin: 0 0 4px; font-size: 1rem; color: #f5ede4; display: flex; align-items: center; gap: 8px; }
          p { margin: 0; font-size: 0.84rem; color: #9c9285; }
        }

        .btn-refresh {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #f5ede4;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 600;

          &:hover { background: rgba(255, 255, 255, 0.08); }
        }
      }

      .despachado-card {
        border-color: rgba(255, 255, 255, 0.08);
        background: rgba(22, 19, 15, 0.6);

        .badge-despachado-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: rgba(34, 197, 94, 0.12);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #4ade80;
          font-size: 0.7rem;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 4px;
        }

        .time-despacho-lbl {
          font-size: 0.76rem;
          color: #8c8276;
          font-weight: 600;
        }

        .items-list-compact {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 0.82rem;

          li {
            display: flex;
            align-items: center;
            gap: 6px;
            color: #b0a597;

            .qty-pill { font-weight: 700; color: #e5b94c; }
          }
        }

        .btn-deshacer-error {
          width: 100%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 9px 14px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.35);
          color: #fca5a5;
          border-radius: 8px;
          font-size: 0.82rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;

          &:hover {
            background: rgba(239, 68, 68, 0.2);
            color: #ffffff;
            border-color: #ef4444;
          }
        }
      }
    }

    /* ── Toast Flotante de Deshacer Rápido ── */
    .floating-undo-toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #1c1813;
      border: 1px solid rgba(229, 185, 76, 0.4);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
      border-radius: 12px;
      padding: 12px 18px;
      display: flex;
      align-items: center;
      gap: 14px;
      z-index: 1000;
      animation: slideInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);

      .toast-content {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.88rem;
        color: #f5ede4;
      }

      .btn-toast-undo {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: #e5b94c;
        color: #120e07;
        font-weight: 800;
        font-size: 0.8rem;
        padding: 5px 12px;
        border-radius: 6px;
        border: none;
        cursor: pointer;

        &:hover { background: #f2c75e; }
      }

      .btn-toast-close {
        background: transparent;
        border: none;
        color: #8c8276;
        cursor: pointer;
        font-size: 0.9rem;
        padding: 0 4px;

        &:hover { color: #f5ede4; }
      }
    }

    @keyframes slideInUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    /* ── Estado Vacío ── */
    .empty-state-panel {
      grid-column: 1 / -1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 70px 20px;
      text-align: center;
      background: rgba(22, 19, 15, 0.65);
      border: 1px dashed rgba(229, 185, 76, 0.2);
      border-radius: 16px;

      .empty-icon-box {
        width: 70px;
        height: 70px;
        border-radius: 50%;
        background: rgba(229, 185, 76, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 16px;
      }

      h2 { font-family: 'Playfair Display', Georgia, serif; font-size: 1.6rem; color: #f5ede4; margin: 0 0 8px; }
      p { color: #b5ac9e; font-size: 0.95rem; margin: 0 0 6px; }
      .empty-sub { color: #7d7366; font-size: 0.8rem; }
    }
  `],
})
export class CocinaComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private socketService = inject(SocketService);

  private readonly baseUrl = 'http://localhost:3000/api';

  tabActiva = signal<'activas' | 'despachadas'>('activas');
  pedidos = signal<Pedido[]>([]);
  despachadosRecientes = signal<Pedido[]>([]);
  ultimoPedidoDespachado = signal<Pedido | null>(null);

  filtroSeleccionado = signal<'todos' | 'listos' | 'demora'>('todos');
  sonidoHabilitado = signal(true);

  private subs: Subscription[] = [];
  private audioCtx: AudioContext | null = null;
  private toastTimer: any = null;

  // ── Métricas Computadas ──
  totalComandas = computed(() => this.pedidos().length);

  platosEnPreparacion = computed(() => {
    return this.pedidos().reduce((acc, p) => {
      const cant = p.detalles.filter(d => d.estadoItem === 'PENDIENTE' || d.estadoItem === 'PREPARANDO').length;
      return acc + cant;
    }, 0);
  });

  platosListosEnMostrador = computed(() => {
    return this.pedidos().reduce((acc, p) => {
      const cant = p.detalles.filter(d => d.estadoItem === 'LISTO').length;
      return acc + cant;
    }, 0);
  });

  comandasConPlatosListos = computed(() => {
    return this.pedidos().filter(p => p.detalles.some(d => d.estadoItem === 'LISTO')).length;
  });

  comandasDemoradas = computed(() => {
    return this.pedidos().filter(p => !this.todosPlatosListos(p) && this.getTiempoTranscurrido(p.createdAt) >= 15).length;
  });

  pedidosFiltrados = computed(() => {
    const list = this.pedidos();
    const filtro = this.filtroSeleccionado();

    if (filtro === 'listos') {
      return list.filter(p => p.detalles.some(d => d.estadoItem === 'LISTO'));
    }
    if (filtro === 'demora') {
      return list.filter(p => !this.todosPlatosListos(p) && this.getTiempoTranscurrido(p.createdAt) >= 15);
    }
    return list;
  });

  ngOnInit() {
    this.cargarPedidosActivos();
    this.cargarDespachadosRecientes();
    this.suscribirAActualizaciones();
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
    }
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
  }

  toggleSonido() {
    this.sonidoHabilitado.update(v => !v);
  }

  playCampanaSonido() {
    if (!this.sonidoHabilitado()) return;
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.audioCtx.currentTime); // A5 chime
      osc.frequency.exponentialRampToValueAtTime(587.33, this.audioCtx.currentTime + 0.35); // D5

      gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.4);
    } catch {
      // Audio no permitido por política del navegador hasta el primer clic
    }
  }

  notesFormat(val: any): boolean {
    return !!val && String(val).trim().length > 0;
  }

  todosPlatosListos(pedido: Pedido): boolean {
    return pedido.detalles.length > 0 && pedido.detalles.every(
      (d) => d.estadoItem === 'LISTO' || d.estadoItem === 'CANCELADO'
    );
  }

  cargarPedidosActivos() {
    this.http.get<any>(`${this.baseUrl}/pedidos/activos`).subscribe({
      next: (res) => {
        this.pedidos.set(res.data || res || []);
      },
      error: (err) => console.error('Error cargando pedidos activos', err)
    });
  }

  cargarDespachadosRecientes() {
    this.http.get<any>(`${this.baseUrl}/pedidos/despachados-recientes`).subscribe({
      next: (res) => {
        this.despachadosRecientes.set(res.data || res || []);
      },
      error: (err) => console.error('Error cargando despachados recientes', err)
    });
  }

  suscribirAActualizaciones() {
    // 1. Nuevo pedido creado en sala o por cliente QR / IA
    const subNuevo = this.socketService
      .onEvent<Pedido>('pedido:creado')
      .subscribe((nuevoPedido) => {
        this.pedidos.update((lista) => {
          const yaExiste = lista.some(p => p.id === nuevoPedido.id);
          if (yaExiste) return lista;
          return [nuevoPedido, ...lista];
        });
        this.playCampanaSonido();
      });

    // 2. Estado de pedido actualizado
    const subEstado = this.socketService
      .onEvent<{ pedidoId: string; estado: string }>('pedido:estado-actualizado')
      .subscribe((data) => {
        if (data.estado === 'ENTREGADO') {
          // Si otro usuario lo entregó, removerlo de la cola activa
          const pedidoEntregado = this.pedidos().find(p => p.id === data.pedidoId);
          if (pedidoEntregado) {
            this.pedidos.update((lista) => lista.filter((p) => p.id !== data.pedidoId));
            this.despachadosRecientes.update(lista => [{ ...pedidoEntregado, estado: 'ENTREGADO' }, ...lista]);
          }
        } else if (data.estado === 'CANCELADO') {
          this.pedidos.update((lista) => lista.filter((p) => p.id !== data.pedidoId));
        } else {
          // Reabierto o actualizado a LISTO / EN_COCINA
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

    // 3. Estado de plato individual
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

  // ── PASO 1: Pasar plato individual a barra ──
  marcarPlatoEnBarra(pedidoId: string, itemId: string) {
    this.http
      .patch(`${this.baseUrl}/pedidos/${pedidoId}/items/${itemId}/estado`, { estado: 'LISTO' })
      .subscribe({
        next: () => {
          this.pedidos.update((lista) => {
            return lista.map((p) => {
              if (p.id === pedidoId) {
                const nuevosDetalles = p.detalles.map((d) => {
                  if (d.id === itemId) return { ...d, estadoItem: 'LISTO' as any };
                  return d;
                });
                return { ...p, detalles: nuevosDetalles };
              }
              return p;
            });
          });
          this.playCampanaSonido();
        },
        error: (err) => console.error('Error al marcar plato en barra', err)
      });
  }

  revertirPlatoAFogon(pedidoId: string, itemId: string) {
    this.http
      .patch(`${this.baseUrl}/pedidos/${pedidoId}/items/${itemId}/estado`, { estado: 'PREPARANDO' })
      .subscribe({
        next: () => {
          this.pedidos.update((lista) => {
            return lista.map((p) => {
              if (p.id === pedidoId) {
                const nuevosDetalles = p.detalles.map((d) => {
                  if (d.id === itemId) return { ...d, estadoItem: 'PREPARANDO' as any };
                  return d;
                });
                return { ...p, detalles: nuevosDetalles };
              }
              return p;
            });
          });
        },
        error: (err) => console.error('Error al revertir plato', err)
      });
  }

  // ── PASO 1: Poner toda la comida en la barra ──
  ponerTodaLaComidaEnBarra(pedidoId: string) {
    this.http
      .post(`${this.baseUrl}/pedidos/${pedidoId}/servir-todos`, {})
      .subscribe({
        next: () => {
          this.pedidos.update((lista) => {
            return lista.map((p) => {
              if (p.id === pedidoId) {
                const itemsListos = p.detalles.map((d) => ({ ...d, estadoItem: 'LISTO' as any }));
                return { ...p, estado: 'LISTO' as any, detalles: itemsListos };
              }
              return p;
            });
          });
          this.playCampanaSonido();
        },
        error: (err) => console.error('Error al pasar toda la comida a barra', err)
      });
  }

  // ── ATAJO: Servir directo a mesa saltándose el paso de barra ──
  confirmarEntregaDirecta(pedido: Pedido) {
    this.marcarPedidoEntregado(pedido);
  }

  // ── PASO 2: Entregar comanda a la mesa ──
  marcarPedidoEntregado(pedido: Pedido) {
    // 1. Iniciar animación suave de salida
    pedido.animandoSalida = true;

    setTimeout(() => {
      this.http
        .patch(`${this.baseUrl}/pedidos/${pedido.id}/estado`, { estado: 'ENTREGADO' })
        .subscribe({
          next: () => {
            // Remover de la cola activa
            this.pedidos.update((lista) => lista.filter((p) => p.id !== pedido.id));

            // Agregar a recientes
            const pedidoArchivado = { ...pedido, estado: 'ENTREGADO' as any, animandoSalida: false, updatedAt: new Date().toISOString() };
            this.despachadosRecientes.update((lista) => [pedidoArchivado, ...lista.slice(0, 19)]);

            // Mostrar toast de deshacer por 8 segundos
            this.ultimoPedidoDespachado.set(pedidoArchivado);
            if (this.toastTimer) clearTimeout(this.toastTimer);
            this.toastTimer = setTimeout(() => {
              this.ultimoPedidoDespachado.set(null);
            }, 8000);
          },
          error: (err) => {
            pedido.animandoSalida = false;
            console.error('Error al marcar pedido entregado', err);
          }
        });
    }, 300);
  }

  // ── SALVAVIDAS: Deshacer error desde Toast o desde Pestaña de Recientes ──
  deshacerUltimaEntrega() {
    const ultimo = this.ultimoPedidoDespachado();
    if (ultimo) {
      this.recuperarPedidoACocina(ultimo);
      this.ultimoPedidoDespachado.set(null);
    }
  }

  recuperarPedidoACocina(pedido: Pedido) {
    this.http
      .patch(`${this.baseUrl}/pedidos/${pedido.id}/estado`, { estado: 'LISTO' })
      .subscribe({
        next: () => {
          // Remover de recientes y regresar a cola activa
          this.despachadosRecientes.update((lista) => lista.filter((p) => p.id !== pedido.id));
          this.pedidos.update((lista) => {
            const yaEsta = lista.some(p => p.id === pedido.id);
            if (yaEsta) return lista;
            return [{ ...pedido, estado: 'LISTO' as any, animandoSalida: false }, ...lista];
          });
          this.tabActiva.set('activas');
          this.playCampanaSonido();
        },
        error: (err) => console.error('Error al recuperar pedido a cocina', err)
      });
  }

  getTiempoTranscurrido(createdAt: string): number {
    const inicio = new Date(createdAt).getTime();
    const ahora = new Date().getTime();
    const diffMinutos = Math.floor((ahora - inicio) / 1000 / 60);
    return Math.max(0, diffMinutos);
  }

  getOrigenLabel(origen?: string): string {
    switch (origen) {
      case 'CLIENTE_DIGITAL': return 'Cliente QR';
      case 'IA_DON_BETO': return 'Don Beto IA';
      default: return 'Salón';
    }
  }

  getOrigenClass(origen?: string): string {
    switch (origen) {
      case 'CLIENTE_DIGITAL': return 'tag-qr';
      case 'IA_DON_BETO': return 'tag-ia';
      default: return 'tag-salon';
    }
  }
}
