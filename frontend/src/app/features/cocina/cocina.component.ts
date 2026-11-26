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
            <span class="current">Pase &amp; Despacho de Cocina</span>
          </div>
          <div class="header-live-group">
            <div class="live-clock-pill" title="Hora actual del monitor">
              <lucide-icon name="clock" class="icon-xs"></lucide-icon>
              <span>{{ tickReloj() | date:'HH:mm' }}</span>
            </div>
          </div>
        </div>

        <div class="header-main-row">
          <div>
            <h1 class="page-title">Pase de Platos &amp; Despacho</h1>
            <p class="page-subtitle">
              Monitor de cocina en tiempo real · Control de preparación, aviso a sala y despacho de comandas.
            </p>
          </div>

          <!-- Herramientas táctiles superiores -->
          <div class="header-tools">
            <button
              type="button"
              class="btn-tool-refresh"
              (click)="cargarPedidosActivos(); cargarDespachadosRecientes()"
              title="Actualizar comandas manualmente"
            >
              <lucide-icon name="refresh-cw" class="icon-sm"></lucide-icon>
              <span>Actualizar</span>
            </button>
            <button
              type="button"
              class="btn-audio-toggle"
              [class.active]="sonidoHabilitado()"
              (click)="toggleSonido()"
              title="Aviso sonoro al entrar pedidos o marcar platos listos"
            >
              <lucide-icon [name]="sonidoHabilitado() ? 'bell' : 'bell-ring'" class="icon-sm"></lucide-icon>
              <span>{{ sonidoHabilitado() ? 'Timbre: Activo' : 'Timbre: Silenciado' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- ── Pestañas Principales (En Preparación vs Historial de Despacho) ── -->
      <div class="main-tabs-bar no-print">
        <button 
          type="button" 
          class="tab-main-btn" 
          [class.active]="tabActiva() === 'activas'"
          (click)="tabActiva.set('activas')"
        >
          <lucide-icon name="flame" class="icon-sm"></lucide-icon>
          <span>En Preparación</span>
          <span class="tab-badge-count">{{ totalComandas() }}</span>
        </button>

        <button 
          type="button" 
          class="tab-main-btn" 
          [class.active]="tabActiva() === 'despachadas'"
          (click)="tabActiva.set('despachadas')"
        >
          <lucide-icon name="history" class="icon-sm"></lucide-icon>
          <span>Historial de Despacho</span>
          @if (despachadosHoyCount() > 0) {
            <span class="tab-badge-count success">{{ despachadosHoyCount() }} hoy</span>
          }
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
              <span class="stat-lbl">Comandas Activas</span>
            </div>
            <div class="stat-pill warning" [class.highlight]="platosEnPreparacion() > 0">
              <span class="stat-num">{{ platosEnPreparacion() }}</span>
              <span class="stat-lbl">En Preparación</span>
            </div>
            <div class="stat-pill success pulse-glow" [class.highlight]="platosListosEnMostrador() > 0">
              <span class="stat-num">{{ platosListosEnMostrador() }}</span>
              <span class="stat-lbl">Listos para Servir</span>
            </div>
          </div>

          <!-- Filtros táctiles -->
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
              <span>Listos ({{ comandasConPlatosListos() }})</span>
            </button>
            <button 
              type="button" 
              class="filter-chip chip-demora" 
              [class.active]="filtroSeleccionado() === 'demora'" 
              (click)="filtroSeleccionado.set('demora')"
            >
              <lucide-icon name="clock" class="icon-xs"></lucide-icon>
              <span>Demora +15 min ({{ comandasDemoradas() }})</span>
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
                </div>
                <div class="time-badge" [class.time-danger]="!todosPlatosListos(pedido) && getTiempoTranscurrido(pedido.createdAt) >= 15">
                  <lucide-icon name="clock" class="icon-xs"></lucide-icon>
                  <span>{{ formatTiempoTranscurrido(pedido.createdAt) }}</span>
                </div>
              </div>

              <!-- Progreso de platos en la comanda -->
              <div class="ticket-progress-row">
                <div class="ticket-progress-track">
                  <div
                    class="ticket-progress-fill"
                    [class.fill-complete]="todosPlatosListos(pedido)"
                    [style.width.%]="getProgresoPorcentaje(pedido)"
                  ></div>
                </div>
                <span class="ticket-progress-lbl">
                  {{ getPlatosListosCount(pedido) }}/{{ pedido.detalles.length }} listos
                </span>
              </div>

              <!-- Banner de Estado de Comanda (Claridad Visual Inmediata) -->
              <div class="comanda-status-banner" [class.banner-ready]="todosPlatosListos(pedido)">
                @if (todosPlatosListos(pedido)) {
                  <lucide-icon name="check-circle-2" class="icon-xs"></lucide-icon>
                  <span>LISTO EN BARRA · Esperando que el mesero retire</span>
                } @else {
                  <lucide-icon name="flame" class="icon-xs"></lucide-icon>
                  <span>En Preparación · {{ getPlatosPendientesCount(pedido) === 1 ? 'Falta 1 plato' : 'Faltan ' + getPlatosPendientesCount(pedido) + ' platos' }}</span>
                }
              </div>

              <div class="ticket-meta">
                <div class="mesero-info">
                  <lucide-icon name="user" class="icon-xs text-muted"></lucide-icon>
                  <span>Mesero: <strong>{{ pedido.mesero.nombre }}</strong></span>
                </div>
                @if (getNotaVisible(pedido.notas); as notaLimpia) {
                  <div class="ticket-notes">
                    <lucide-icon name="alert-circle" class="icon-xs"></lucide-icon>
                    <span>Nota: {{ notaLimpia }}</span>
                  </div>
                }
              </div>

              <!-- Lista de Platos de la Mesa -->
              <div class="ticket-body">
                <ul class="items-list">
                  @for (item of pedido.detalles; track item.id) {
                    <li [class.item-listo]="item.estadoItem === 'LISTO' || item.estadoItem === 'ENTREGADO'">
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

                      <!-- Botón táctil de 1 toque individual por plato -->
                      <div class="item-action-wrap">
                        @if (item.estadoItem === 'ENTREGADO') {
                          <span class="badge-item-servido" title="Ya fue retirado y servido en la mesa por el mesero">
                            <lucide-icon name="check-check" class="icon-xs"></lucide-icon>
                            <span>Servido</span>
                          </span>
                        } @else if (item.estadoItem !== 'LISTO') {
                          <button 
                            type="button" 
                            class="btn-item-touch" 
                            (click)="marcarPlatoEnBarra(pedido.id, item.id)"
                            title="Tocar para marcar este plato como listo"
                          >
                            <lucide-icon name="check" class="icon-xs"></lucide-icon>
                            <span>Marcar Listo</span>
                          </button>
                        } @else {
                          <button
                            type="button"
                            class="badge-item-ready"
                            (click)="revertirPlatoAFogon(pedido.id, item.id)"
                            title="Tocar para devolver a preparación si hubo un error"
                          >
                            <lucide-icon name="check-circle-2" class="icon-xs"></lucide-icon>
                            <span>Listo</span>
                          </button>
                        }
                      </div>
                    </li>
                  }
                </ul>
              </div>

              <!-- ── Pie del Ticket: FLUJO TÁCTIL EN 2 PASOS ── -->
              <div class="ticket-footer">
                @if (!todosPlatosListos(pedido)) {
                  <!-- PASO 1: Aún faltan platos por salir de cocina -->
                  <div class="footer-step-1">
                    <button 
                      type="button" 
                      class="btn-step-action btn-poner-barra" 
                      (click)="ponerTodaLaComidaEnBarra(pedido.id)"
                      title="Marca todos los platos de esta mesa como listos"
                    >
                      <lucide-icon name="concierge-bell" class="icon-sm"></lucide-icon>
                      <div class="btn-text-block">
                        <span class="main-txt">Marcar Todo Listo</span>
                        <span class="sub-txt">Avisar comanda completa a sala</span>
                      </div>
                    </button>

                    <!-- Atajo rápido para despacho inmediato a mesa -->
                    <button 
                      type="button" 
                      class="btn-shortcut-direct" 
                      (click)="confirmarEntregaDirecta(pedido)"
                      title="Confirmar que la comanda ya fue entregada directamente a la mesa"
                    >
                      <lucide-icon name="send" class="icon-xs"></lucide-icon>
                      <span>Entregar ya</span>
                    </button>
                  </div>
                } @else {
                  <!-- PASO 2: Todo listo en barra esperando retiro del mesero -->
                  <div class="footer-step-2">
                    <button 
                      type="button" 
                      class="btn-step-action btn-entregar-mesa-ready" 
                      (click)="marcarPedidoEntregado(pedido)"
                      title="Tocar cuando el mesero ya retiró los platos de la barra"
                    >
                      <lucide-icon name="check-circle-2" class="icon-md"></lucide-icon>
                      <div class="btn-text-block">
                        <span class="main-txt">Retirado por Mesero</span>
                        <span class="sub-txt">Confirmar despacho de comanda</span>
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
           VISTA 2: HISTORIAL DE DESPACHO (AUDITORÍA Y DESHACER)
           ═══════════════════════════════════════════ -->
      <div *ngIf="tabActiva() === 'despachadas'" class="despachadas-view">
        <div class="despachadas-header-card glass-panel">
          <div class="info-block">
            <h3><lucide-icon name="history" class="icon-sm text-gold"></lucide-icon> Historial de Despacho</h3>
            <p>Registro de comandas entregadas. Puedes consultar el turno actual o los últimos despachos y devolver una orden a cocina si se marcó por error.</p>
          </div>
          <div class="despachadas-tools">
            <div class="historial-period-tabs">
              <button
                type="button"
                class="period-tab-btn"
                [class.active]="filtroHistorial() === 'hoy'"
                (click)="cambiarFiltroHistorial('hoy')"
              >
                Turno de Hoy
              </button>
              <button
                type="button"
                class="period-tab-btn"
                [class.active]="filtroHistorial() === 'recientes'"
                (click)="cambiarFiltroHistorial('recientes')"
              >
                Últimos 30
              </button>
            </div>
            <button type="button" class="btn-refresh" (click)="cargarDespachadosRecientes()">
              <lucide-icon name="refresh-cw" class="icon-xs"></lucide-icon>
              <span>Actualizar</span>
            </button>
          </div>
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
                  {{ formatFechaDespacho(pedido.updatedAt || pedido.createdAt) }}
                </span>
              </div>

              <div class="ticket-meta">
                <div class="mesero-info">
                  <lucide-icon name="user" class="icon-xs text-muted"></lucide-icon>
                  <span>Mesero: <strong>{{ pedido.mesero.nombre }}</strong></span>
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
                  title="¿Se marcó por error? Toca aquí para regresar la comanda a cocina"
                >
                  <lucide-icon name="rotate-ccw" class="icon-xs"></lucide-icon>
                  <span>Devolver a Cocina</span>
                </button>
              </div>
            </div>
          } @empty {
            <div class="empty-state-panel glass-panel">
              <div class="empty-icon-box">
                <lucide-icon name="history" class="icon-xl text-gold"></lucide-icon>
              </div>
              <h2>{{ filtroHistorial() === 'hoy' ? 'Sin despachos en el turno de hoy' : 'Sin registros recientes' }}</h2>
              <p>
                {{ filtroHistorial() === 'hoy'
                  ? 'Las comandas que marques como entregadas hoy aparecerán aquí. Puedes cambiar a "Últimos 30" para consultar despachos anteriores.'
                  : 'No hay pedidos despachados registrados.' }}
              </p>
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

      .header-live-group {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .live-clock-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #f5ede4;
        font-size: 0.78rem;
        font-weight: 700;
        border-radius: 20px;
        font-variant-numeric: tabular-nums;
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

      .header-tools {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .btn-tool-refresh {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        min-height: 42px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #e5ded5;
        padding: 8px 16px;
        border-radius: 10px;
        font-size: 0.84rem;
        font-weight: 600;
        cursor: pointer;
        touch-action: manipulation;
        transition: all 0.2s ease;

        &:hover {
          background: rgba(255, 255, 255, 0.09);
          border-color: rgba(229, 185, 76, 0.4);
          color: #ffffff;
        }
      }

      .btn-audio-toggle {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 42px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #a89f92;
        padding: 8px 16px;
        border-radius: 10px;
        font-size: 0.84rem;
        font-weight: 600;
        cursor: pointer;
        touch-action: manipulation;
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

      /* ESTADO: COMIDA EN BARRA ESPERANDO RETIRO (ESMERALDA SOBRIO Y ELEGANTE) */
      &.card-en-barra {
        border-color: rgba(52, 168, 110, 0.45);
        background: linear-gradient(135deg, rgba(24, 28, 24, 0.96) 0%, rgba(17, 20, 17, 0.98) 100%);
        box-shadow: 0 10px 26px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(52, 168, 110, 0.18);
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

      /* Barra de progreso visual dentro de cada comanda */
      .ticket-progress-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;

        .ticket-progress-track {
          flex: 1;
          height: 6px;
          background: rgba(255, 255, 255, 0.07);
          border-radius: 999px;
          overflow: hidden;
        }

        .ticket-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #e5b94c 0%, #f59e0b 100%);
          border-radius: 999px;
          transition: width 0.3s ease;

          &.fill-complete {
            background: linear-gradient(90deg, #22c55e 0%, #4ade80 100%);
          }
        }

        .ticket-progress-lbl {
          font-size: 0.72rem;
          font-weight: 700;
          color: #a89f92;
          white-space: nowrap;
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
          background: rgba(52, 168, 110, 0.12);
          border-color: rgba(52, 168, 110, 0.32);
          color: #6ee7a8;
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
              background: rgba(52, 168, 110, 0.08);
              border-color: rgba(52, 168, 110, 0.25);

              .plato-name { color: #a7e8c4; }
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
                justify-content: center;
                gap: 6px;
                min-height: 40px;
                padding: 8px 14px;
                background: rgba(234, 179, 8, 0.14);
                border: 1px solid rgba(234, 179, 8, 0.38);
                color: #fde047;
                border-radius: 9px;
                font-size: 0.8rem;
                font-weight: 700;
                cursor: pointer;
                touch-action: manipulation;
                transition: all 0.2s ease;

                &:hover, &:active {
                  background: #eab308;
                  color: #120f0c;
                }
              }

              .badge-item-ready {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 5px;
                min-height: 40px;
                font-size: 0.8rem;
                font-weight: 700;
                color: #6ee7a8;
                background: rgba(52, 168, 110, 0.12);
                border: 1px solid rgba(52, 168, 110, 0.32);
                padding: 8px 14px;
                border-radius: 9px;
                cursor: pointer;
                touch-action: manipulation;
                transition: all 0.2s ease;

                &:hover {
                  border-color: rgba(239, 68, 68, 0.5);
                  color: #fca5a5;
                }
              }

              .badge-item-servido {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 5px;
                min-height: 40px;
                font-size: 0.78rem;
                font-weight: 700;
                color: #9e9484;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                padding: 8px 14px;
                border-radius: 9px;
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

        /* PASO 2: EN BARRA LISTO PARA RETIRO DEL MESERO */
        .footer-step-2 {
          .btn-entregar-mesa-ready {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            padding: 14px 18px;
            background: rgba(52, 168, 110, 0.16);
            color: #7ee8b2;
            border: 1px solid rgba(52, 168, 110, 0.45);
            border-radius: 10px;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
            transition: all 0.2s ease;

            &:hover {
              background: #2f9e66;
              border-color: #3bb878;
              color: #ffffff;
              transform: translateY(-1px);
              box-shadow: 0 6px 18px rgba(47, 158, 102, 0.35);
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

        .despachadas-tools {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .historial-period-tabs {
          display: inline-flex;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 9px;
          padding: 3px;
          gap: 4px;

          .period-tab-btn {
            background: transparent;
            border: none;
            color: #9c9285;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 0.78rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s ease;

            &.active {
              background: rgba(229, 185, 76, 0.2);
              color: #fcd34d;
              border: 1px solid rgba(229, 185, 76, 0.35);
            }
          }
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

    /* ── Optimización Táctil para Tablet y Móvil ── */
    @media (max-width: 900px) {
      .tickets-grid, .despachadas-grid {
        grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
        gap: 14px;
      }

      .main-tabs-bar {
        flex-wrap: wrap;

        .tab-main-btn {
          flex: 1 1 auto;
          justify-content: center;
          min-height: 46px;
        }
      }

      .stats-filters-bar .filter-chips .filter-chip {
        min-height: 40px;
        padding: 8px 14px;
      }
    }

    @media (max-width: 600px) {
      .tickets-grid, .despachadas-grid {
        grid-template-columns: 1fr;
      }

      .ticket-card .ticket-footer .footer-step-1 {
        flex-direction: column;

        .btn-shortcut-direct {
          min-height: 44px;
          padding: 10px 14px;
        }
      }
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
  filtroHistorial = signal<'hoy' | 'recientes'>('hoy');
  sonidoHabilitado = signal(true);
  tickReloj = signal(Date.now());

  private subs: Subscription[] = [];
  private audioCtx: AudioContext | null = null;
  private toastTimer: any = null;
  private clockInterval: any = null;

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

  despachadosHoyCount = computed(() => {
    return this.despachadosRecientes().filter(p => this.esDeHoy(p.updatedAt || p.createdAt)).length;
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
    this.clockInterval = setInterval(() => {
      this.tickReloj.set(Date.now());
    }, 30000);
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
    }
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
      (d) => d.estadoItem === 'LISTO' || d.estadoItem === 'ENTREGADO' || d.estadoItem === 'CANCELADO'
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

  cambiarFiltroHistorial(periodo: 'hoy' | 'recientes') {
    this.filtroHistorial.set(periodo);
    this.cargarDespachadosRecientes();
  }

  cargarDespachadosRecientes() {
    const periodo = this.filtroHistorial();
    this.http.get<any>(`${this.baseUrl}/pedidos/despachados-recientes?periodo=${periodo}`).subscribe({
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
        let pedidoCompletado: Pedido | null = null;

        this.pedidos.update((lista) => {
          return lista
            .map((pedido) => {
              if (pedido.id === data.pedidoId) {
                const nuevosDetalles = pedido.detalles.map((item) => {
                  if (item.id === data.itemId) {
                    return { ...item, estadoItem: data.estado as any };
                  }
                  return item;
                });
                const actualizado = { ...pedido, detalles: nuevosDetalles };
                const todosEntregados =
                  nuevosDetalles.length > 0 &&
                  nuevosDetalles.every((d) => d.estadoItem === 'ENTREGADO' || d.estadoItem === 'CANCELADO');
                if (todosEntregados) {
                  pedidoCompletado = { ...actualizado, estado: 'ENTREGADO', updatedAt: new Date().toISOString() };
                  return null;
                }
                return actualizado;
              }
              return pedido;
            })
            .filter((p): p is Pedido => p !== null);
        });

        if (pedidoCompletado) {
          this.despachadosRecientes.update((lista) => {
            if (lista.some((p) => p.id === pedidoCompletado!.id)) return lista;
            return [pedidoCompletado!, ...lista];
          });
        }
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

  // ── PASO 1: Marcar toda la comanda como LISTO en barra ──
  ponerTodaLaComidaEnBarra(pedidoId: string) {
    this.http
      .patch(`${this.baseUrl}/pedidos/${pedidoId}/estado`, { estado: 'LISTO' })
      .subscribe({
        next: () => {
          this.pedidos.update((lista) => {
            return lista.map((p) => {
              if (p.id === pedidoId) {
                const itemsListos = p.detalles.map((d) =>
                  d.estadoItem === 'ENTREGADO' || d.estadoItem === 'CANCELADO'
                    ? d
                    : { ...d, estadoItem: 'LISTO' as any }
                );
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

            // Agregar a recientes en el turno actual
            const pedidoArchivado = { ...pedido, estado: 'ENTREGADO' as any, animandoSalida: false, updatedAt: new Date().toISOString() };
            this.despachadosRecientes.update((lista) => [pedidoArchivado, ...lista]);

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
    const ahora = this.tickReloj();
    const diffMinutos = Math.floor((ahora - inicio) / 1000 / 60);
    return Math.max(0, diffMinutos);
  }

  formatTiempoTranscurrido(createdAt: string): string {
    const mins = this.getTiempoTranscurrido(createdAt);
    if (mins < 1) return 'Recién llegado';
    if (mins < 60) return `${mins} min`;
    const horas = Math.floor(mins / 60);
    const restoMin = mins % 60;
    if (horas < 24) {
      return restoMin > 0 ? `${horas}h ${restoMin}m` : `${horas}h`;
    }
    const dias = Math.floor(horas / 24);
    const restoHoras = horas % 24;
    return restoHoras > 0 ? `+${dias}d ${restoHoras}h` : `+${dias}d`;
  }

  getPlatosListosCount(pedido: Pedido): number {
    return pedido.detalles.filter((d) => d.estadoItem === 'LISTO' || d.estadoItem === 'ENTREGADO' || d.estadoItem === 'CANCELADO').length;
  }

  getPlatosPendientesCount(pedido: Pedido): number {
    return pedido.detalles.filter((d) => d.estadoItem !== 'LISTO' && d.estadoItem !== 'ENTREGADO' && d.estadoItem !== 'CANCELADO').length;
  }

  getProgresoPorcentaje(pedido: Pedido): number {
    if (!pedido.detalles.length) return 0;
    return Math.round((this.getPlatosListosCount(pedido) / pedido.detalles.length) * 100);
  }

  getNotaVisible(nota: string | null): string | null {
    if (!nota) return null;
    const limpia = nota.trim();
    if (!limpia) return null;
    if (
      limpia.startsWith('[Pedido IA]') ||
      limpia.toLowerCase().includes('pedido interactivo desde la carta digital')
    ) {
      return null;
    }
    return limpia;
  }

  esDeHoy(fechaStr: string): boolean {
    if (!fechaStr) return false;
    const d = new Date(fechaStr);
    const hoy = new Date();
    return (
      d.getFullYear() === hoy.getFullYear() &&
      d.getMonth() === hoy.getMonth() &&
      d.getDate() === hoy.getDate()
    );
  }

  formatFechaDespacho(fechaStr: string): string {
    if (!fechaStr) return '';
    const d = new Date(fechaStr);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const hora = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (this.esDeHoy(fechaStr)) {
      return `Hoy · ${hora}`;
    }
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} · ${hora}`;
  }

  getOrigenLabel(origen?: string): string {
    switch (origen) {
      case 'CLIENTE_DIGITAL': return 'Cliente QR';
      case 'IA_DON_BETO': return 'Tukuy IA';
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
