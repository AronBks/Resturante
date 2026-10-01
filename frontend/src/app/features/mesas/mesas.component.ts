import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { SocketService } from '../../core/services/socket.service';
import { AuthService } from '../../core/services/auth.service';
import { ComandaDrawerComponent } from './comanda-drawer.component';
import { LucideAngularModule } from 'lucide-angular';

export interface Mesa {
  id: number;
  numero: string;
  capacidad: number;
  estado: 'LIBRE' | 'OCUPADA' | 'POR_COBRAR' | 'RESERVADA' | string;
  posicion?: any;
  pedidos?: any[];
  meseroAsignadoId?: string | null;
  meseroAsignado?: { id: string; nombre: string; rol?: string };
}

export interface Plato {
  id: string;
  nombre: string;
  precioVenta: number;
  descripcion?: string;
  imagenUrl?: string;
  disponible: boolean;
  categoriaId: number;
  variantes?: {
    id: string;
    nombre: string;
    precio: number;
    disponible: boolean;
  }[];
}

export interface LiveLogEvent {
  id: string;
  tipo: 'ALERTA' | 'COMANDA' | 'CUENTA' | 'APERTURA';
  titulo: string;
  descripcion: string;
  tiempo: string;
  timestamp: number;
}

@Component({
  selector: 'app-mesas',
  standalone: true,
  imports: [CommonModule, FormsModule, ComandaDrawerComponent, LucideAngularModule],
  templateUrl: './mesas.component.html',
  styleUrls: ['./mesas.component.scss'],
})
export class MesasComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly socketService = inject(SocketService);
  public readonly authService = inject(AuthService);
  private readonly baseUrl = 'http://localhost:3000/api';

  // ── Signals de Estado Principal ──
  mesas = signal<Mesa[]>([]);
  platos = signal<Plato[]>([]);
  selectedMesa = signal<Mesa | null>(null);
  activeDrawer = signal<'COMANDA' | 'COBRO' | null>(null);

  // ── Asignación de Meseros y Seguridad Operativa ──
  meseros = signal<{ id: string; nombre: string; rol: string }[]>([]);
  mesaParaAsignar = signal<Mesa | null>(null);
  filtroMeseroId = signal<string>('TODOS'); // 'TODOS' | 'MIS_MESAS' | meseroId específico

  // ── Filtros de Zona y Estado ──
  filtroZona = signal<string>('TODOS');
  filtroEstado = signal<string>('TODOS');

  // ── Señales en Tiempo Real y Temporizadores ──
  flashingMesas = signal<Record<number, boolean>>({});
  mesasLlamando = signal<Set<string>>(new Set());
  llamadasDetalle = signal<Record<string, { motivo: string; timestamp: string }>>({});
  elapsedTimes = signal<Record<number, string>>({});
  autoOpenCobro = signal<boolean>(false);

  // ── Actividad y Alertas del Salón en Tiempo Real ──
  liveEvents = signal<LiveLogEvent[]>([]);

  private timerInterval: any;
  private subs: Subscription[] = [];

  // ── Resumen Financiero y KPIs ──
  montoMesasAbiertas = computed(() => {
    return this.mesas().reduce((acc, m) => {
      const activePed = m.pedidos?.[0];
      return acc + (Number(activePed?.total) || 0);
    }, 0);
  });

  totalMesas = computed(() => this.mesas().length);
  libresCount = computed(() => this.mesas().filter((m) => m.estado === 'LIBRE').length);
  ocupadasCount = computed(() => this.mesas().filter((m) => m.estado === 'OCUPADA').length);
  porCobrarCount = computed(() => this.mesas().filter((m) => m.estado === 'POR_COBRAR').length);

  // ── Mesas Filtradas por Estado y por Mesero Designado ──
  mesasFiltradas = computed(() => {
    let result = this.mesas();

    // 1. Filtro por Estado Operativo
    const estado = this.filtroEstado();
    if (estado !== 'TODOS') {
      if (estado === 'COMANDA') {
        result = result.filter((m) => m.estado === 'OCUPADA' || m.pedidos?.[0]?.estado === 'EN_COCINA');
      } else {
        result = result.filter((m) => m.estado === estado);
      }
    }

    // 2. Filtro por Apartado de Mesero / "Mis Mesas"
    const filtroMesero = this.filtroMeseroId();
    if (filtroMesero === 'MIS_MESAS') {
      const user = this.authService.currentUserSignal();
      if (user) {
        result = result.filter((m) => m.meseroAsignadoId === user.id);
      }
    } else if (filtroMesero !== 'TODOS') {
      result = result.filter((m) => m.meseroAsignadoId === filtroMesero);
    }

    return result;
  });

  marcarEntregadoMesa(mesa: Mesa, ev: MouseEvent) {
    ev.stopPropagation();
    const pedido = mesa.pedidos?.[0];
    if (!pedido || !pedido.id) return;

    this.http.patch(`${this.baseUrl}/pedidos/${pedido.id}/estado`, { estado: 'ENTREGADO' }).subscribe({
      next: () => {
        this.cargarMesas();
      },
      error: (err) => console.error('Error al entregar pedido', err),
    });
  }

  esCuentaEntregada(mesa: Mesa): boolean {
    return !!(mesa.pedidos?.[0] as any)?.cuentaEntregadaAt;
  }

  entregarCuentaMesa(mesa: Mesa, ev: MouseEvent) {
    ev.stopPropagation();
    const meseroNombre = this.authService.currentUserSignal()?.nombre || 'Garzón';
    this.http
      .post<any>(`${this.baseUrl}/pedidos/entregar-cuenta`, {
        mesaNumero: mesa.numero,
        meseroNombre,
      })
      .subscribe({
        next: () => {
          this.agregarEvento({
            tipo: 'CUENTA',
            titulo: `Mesa ${mesa.numero}: Cuenta entregada`,
            descripcion: `Entregada por ${meseroNombre}. Opciones de pago habilitadas en el móvil del comensal.`,
          });
          this.cargarMesas();
        },
        error: (err) => {
          console.error('Error al entregar cuenta', err);
          alert('No se pudo marcar la cuenta como entregada.');
        },
      });
  }

  reabrirComandaMesa(mesa: Mesa, ev: MouseEvent) {
    ev.stopPropagation();
    if (!confirm(`¿Deseas reabrir la comanda de la Mesa ${mesa.numero}? La mesa volverá a estar OCUPADA y los comensales podrán ordenar platos adicionales.`)) {
      return;
    }
    const meseroNombre = this.authService.currentUserSignal()?.nombre || 'Personal de Salón';
    this.http
      .post<any>(`${this.baseUrl}/pedidos/reabrir-comanda`, {
        mesaNumero: mesa.numero,
        motivo: 'Comensales desean ordenar ítems adicionales',
      })
      .subscribe({
        next: () => {
          this.agregarEvento({
            tipo: 'COMANDA',
            titulo: `Mesa ${mesa.numero}: Comanda reabierta`,
            descripcion: `Reabierta por ${meseroNombre}. La comanda vuelve a estar editable para nuevos platos.`,
          });
          this.cargarMesas();
        },
        error: (err) => {
          console.error('Error al reabrir comanda', err);
          alert('No se pudo reabrir la comanda.');
        },
      });
  }

  cerrarMenuContextual() {
    this.selectedMesa.set(null);
  }

  ngOnInit() {
    this.cargarMesas();
    this.cargarMeseros();
    this.cargarLlamadasMesero();
    this.cargarPlatos();
    this.suscribirAActualizaciones();
    this.iniciarTemporizador();
  }

  cargarMeseros() {
    this.http.get<any>(`${this.baseUrl}/mesas/meseros-activos`).subscribe({
      next: (res) => {
        const data = res?.data || res || [];
        this.meseros.set(data);
      },
      error: (err) => console.error('Error cargando meseros de salón', err),
    });
  }

  abrirAsignarMesero(mesa: Mesa, ev: MouseEvent) {
    ev.stopPropagation();
    this.mesaParaAsignar.set(mesa);
  }

  asignarMeseroAMesa(mesaId: number, meseroId: string | null) {
    this.http.patch<any>(`${this.baseUrl}/mesas/${mesaId}/asignar-mesero`, { meseroId }).subscribe({
      next: () => {
        this.cargarMesas();
        this.mesaParaAsignar.set(null);
      },
      error: (err) => {
        console.error('Error al asignar mesero a la mesa', err);
        alert('No se pudo asignar el mesero a la mesa.');
      },
    });
  }

  ngOnDestroy() {
    this.subs.forEach((s) => s.unsubscribe());
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  // ── Cargas de Datos ──
  cargarMesas() {
    this.http.get<any>(`${this.baseUrl}/mesas`).subscribe({
      next: (res) => {
        const data: Mesa[] = res.data || [];
        this.mesas.set(data);
        this.cargarLlamadasMesero();
        this.sincronizarEventosDesdeMesas(data);
      },
      error: (err) => console.error('Error cargando mesas', err),
    });
  }

  sincronizarEventosDesdeMesas(mesas: Mesa[]) {
    const eventos: LiveLogEvent[] = [];
    const now = Date.now();

    for (const mesa of mesas) {
      if (this.mesasLlamando().has(mesa.numero)) {
        eventos.push({
          id: `llamada-${mesa.id}`,
          tipo: 'ALERTA',
          titulo: `Mesa ${mesa.numero}: Atención requerida`,
          descripcion: 'El comensal solicita la presencia de un garzón.',
          tiempo: 'Activo',
          timestamp: now,
        });
      }

      const pedido = mesa.pedidos?.[0];
      if (pedido && (mesa.estado === 'OCUPADA' || mesa.estado === 'POR_COBRAR')) {
        const start = new Date(pedido.createdAt).getTime();
        const diffMins = Math.floor((now - start) / 60000);
        const timeAgoStr = diffMins > 0 ? `Hace ${diffMins} min` : 'Hace un momento';

        if (mesa.estado === 'POR_COBRAR') {
          eventos.push({
            id: `cuenta-${mesa.id}`,
            tipo: 'CUENTA',
            titulo: `Mesa ${mesa.numero}: Lista para cobro`,
            descripcion: `Consumo total registrado por Bs. ${Number(pedido.total || 0).toFixed(2)}.`,
            tiempo: timeAgoStr,
            timestamp: start,
          });
        } else if (diffMins >= 30) {
          eventos.push({
            id: `espera-${mesa.id}`,
            tipo: 'ALERTA',
            titulo: `Mesa ${mesa.numero}: Demora en cocina (${diffMins}m)`,
            descripcion: `Comanda en preparación por más de ${diffMins} minutos.`,
            tiempo: timeAgoStr,
            timestamp: start,
          });
        } else {
          const itemsCount = pedido.detalles?.length || 0;
          const nombres = (pedido.detalles || [])
            .map((d: any) => `${d.cantidad}x ${d.plato?.nombre || 'Plato'}`)
            .slice(0, 2)
            .join(', ');
          const desc = itemsCount > 0
            ? `${nombres} en preparación.`
            : 'Comanda activa en preparación en cocina.';
          eventos.push({
            id: `comanda-${mesa.id}`,
            tipo: 'COMANDA',
            titulo: `Mesa ${mesa.numero}: Comanda en cocina`,
            descripcion: desc,
            tiempo: timeAgoStr,
            timestamp: start,
          });
        }
      }
    }

    if (eventos.length > 0) {
      this.liveEvents.set(eventos.slice(0, 7));
    }
  }

  cargarLlamadasMesero() {
    this.http.get<any>(`${this.baseUrl}/pedidos/llamadas-mesero`).subscribe({
      next: (res) => {
        let llamadas: any[] = [];
        if (Array.isArray(res)) {
          llamadas = res;
        } else if (Array.isArray(res?.data)) {
          llamadas = res.data;
        } else if (Array.isArray(res?.data?.data)) {
          llamadas = res.data.data;
        }
        const setLlamando = new Set<string>();
        const mapDetalle: Record<string, { motivo: string; timestamp: string }> = {};
        for (const l of llamadas) {
          if (l?.mesaNumero) {
            setLlamando.add(l.mesaNumero);
            mapDetalle[l.mesaNumero] = {
              motivo: l.motivo || 'Atención presencial solicitada en mesa',
              timestamp: l.timestamp || new Date().toISOString(),
            };
          }
        }
        this.mesasLlamando.set(setLlamando);
        this.llamadasDetalle.set(mapDetalle);
      },
      error: (err) => console.error('Error cargando llamadas de mesero', err),
    });
  }

  cargarPlatos() {
    this.http.get<any>(`${this.baseUrl}/carta/platos`).subscribe({
      next: (res) => {
        const lista = res.data || [];
        this.platos.set(lista.filter((p: Plato) => p.disponible));
      },
      error: (err) => console.error('Error cargando carta', err),
    });
  }

  // ── Suscripciones WebSocket en Tiempo Real ──
  suscribirAActualizaciones() {
    const subMesa = this.socketService
      .onEvent<{ mesaId: number; estado: string }>('mesa:estado-actualizado')
      .subscribe((data) => {
        this.flashingMesas.update((fm) => ({ ...fm, [data.mesaId]: true }));
        setTimeout(() => {
          this.flashingMesas.update((fm) => ({ ...fm, [data.mesaId]: false }));
        }, 1500);

        // Actualización inmediata en memoria de la mesa y del drawer abierto si coincide
        this.mesas.update((list) =>
          list.map((m) => (m.id === data.mesaId ? { ...m, estado: data.estado } : m))
        );
        if (this.selectedMesa()?.id === data.mesaId) {
          this.selectedMesa.update((m) => (m ? { ...m, estado: data.estado } : null));
        }

        this.cargarMesas();
      });

    const subMesaLiberada = this.socketService
      .onEvent<{ mesaId: number }>('mesa:liberada')
      .subscribe((data) => {
        this.agregarEvento({
          tipo: 'APERTURA',
          titulo: `Mesa liberada`,
          descripcion: `Mesa lista y limpia para nuevos comensales.`,
        });
        this.cargarMesas();
      });

    const subPedido = this.socketService
      .onEvent<any>('pedido:creado')
      .subscribe((data) => {
        const mesaNum = data?.mesa?.numero || data?.mesaNumero || 'Salón';
        this.agregarEvento({
          tipo: 'COMANDA',
          titulo: `Mesa ${mesaNum}: Comanda recibida`,
          descripcion: `Nuevo pedido ingresado en cocina.`,
        });
        this.cargarMesas();
      });

    const subMeseroLlamado = this.socketService
      .onEvent<{ mesaNumero: string; motivo: string; timestamp?: string }>('mesero:llamado')
      .subscribe((data) => {
        const mesaNum = data?.mesaNumero || 'M01';
        const motivo = data?.motivo || 'El comensal solicita la presencia de un garzón.';
        const timestamp = data?.timestamp || new Date().toISOString();

        this.mesasLlamando.update((prev) => {
          const next = new Set(prev);
          next.add(mesaNum);
          return next;
        });

        this.llamadasDetalle.update((prev) => ({
          ...prev,
          [mesaNum]: { motivo, timestamp },
        }));

        this.agregarEvento({
          tipo: 'ALERTA',
          titulo: `Mesa ${mesaNum}: Asistencia requerida`,
          descripcion: motivo,
        });

        // Si es pago en efectivo o QR, la mesa pasa de inmediato a POR_COBRAR en UI
        const motLower = motivo.toLowerCase();
        const esCobro =
          motLower.includes('pago') ||
          motLower.includes('cuenta') ||
          motLower.includes('efectivo') ||
          motLower.includes('qr');

        if (esCobro) {
          this.mesas.update((list) =>
            list.map((m) => (m.numero === mesaNum ? { ...m, estado: 'POR_COBRAR' } : m))
          );
          if (this.selectedMesa()?.numero === mesaNum) {
            this.selectedMesa.update((m) => (m ? { ...m, estado: 'POR_COBRAR' } : null));
          }
        }

        this.cargarMesas();
      });

    const subPagoConf = this.socketService
      .onEvent<any>('pago:confirmado')
      .subscribe((data) => {
        const mesaNum = data?.mesaNumero || 'Salón';
        this.agregarEvento({
          tipo: 'CUENTA',
          titulo: `Mesa ${mesaNum}: Pago confirmado`,
          descripcion: `Cobro procesado correctamente en caja.`,
        });
        this.cargarMesas();
      });

    const subStock = this.socketService
      .onEvent<{ platoId: string; nuevoStock: number; disponible: boolean }>('plato:stock-actualizado')
      .subscribe((data) => {
        this.platos.update((lista) =>
          lista.map((p) =>
            p.id === data.platoId
              ? { ...p, stockActual: data.nuevoStock, disponible: data.disponible }
              : p,
          ),
        );
      });

    const subMeseroAtendido = this.socketService
      .onEvent<{ mesaNumero: string }>('mesero:atendido')
      .subscribe((data) => {
        const mesaNum = data?.mesaNumero;
        if (mesaNum) {
          this.mesasLlamando.update((prev) => {
            const next = new Set(prev);
            next.delete(mesaNum);
            return next;
          });
          this.llamadasDetalle.update((prev) => {
            const next = { ...prev };
            delete next[mesaNum];
            return next;
          });
        }
        this.cargarMesas();
      });

    const subCuentaEntregada = this.socketService
      .onEvent<{ mesaNumero: string; meseroNombre?: string }>('cuenta:entregada')
      .subscribe((data) => {
        const mesaNum = data?.mesaNumero;
        if (mesaNum) {
          this.agregarEvento({
            tipo: 'CUENTA',
            titulo: `Mesa ${mesaNum}: Cuenta entregada`,
            descripcion: `Personal ${data.meseroNombre || 'de salón'} entregó la cuenta físicamente.`,
          });
          this.cargarMesas();
        }
      });

    const subComandaReabierta = this.socketService
      .onEvent<{ mesaNumero: string; meseroNombre?: string }>('comanda:reabierta')
      .subscribe((data) => {
        const mesaNum = data?.mesaNumero;
        if (mesaNum) {
          this.agregarEvento({
            tipo: 'COMANDA',
            titulo: `Mesa ${mesaNum}: Comanda reabierta`,
            descripcion: `Personal ${data.meseroNombre || 'de salón'} reabrió la comanda.`,
          });
          this.cargarMesas();
        }
      });

    this.subs.push(subMesa, subMesaLiberada, subPedido, subMeseroLlamado, subMeseroAtendido, subPagoConf, subStock, subCuentaEntregada, subComandaReabierta);
  }

  private agregarEvento(ev: { tipo: 'ALERTA' | 'COMANDA' | 'CUENTA' | 'APERTURA'; titulo: string; descripcion: string }) {
    const nuevo: LiveLogEvent = {
      id: `ev-${Date.now()}`,
      tipo: ev.tipo,
      titulo: ev.titulo,
      descripcion: ev.descripcion,
      tiempo: 'Hace un momento',
      timestamp: Date.now(),
    };
    this.liveEvents.update((list) => [nuevo, ...list.slice(0, 7)]);
  }

  // ── Temporizador en Vivo ──
  iniciarTemporizador() {
    this.timerInterval = setInterval(() => {
      const times: Record<number, string> = {};
      const now = new Date().getTime();
      this.mesas().forEach((mesa) => {
        const activePedido = mesa.pedidos?.[0];
        if (activePedido && (mesa.estado === 'OCUPADA' || mesa.estado === 'POR_COBRAR')) {
          const start = new Date(activePedido.createdAt).getTime();
          const diff = Math.max(0, now - start);
          const hrs = Math.floor(diff / 3600000);
          const mins = Math.floor((diff % 3600000) / 60000);

          if (hrs > 0) {
            times[mesa.id] = `${hrs}h ${mins}m transcurridos`;
          } else {
            times[mesa.id] = `${mins}m transcurridos`;
          }
        }
      });
      this.elapsedTimes.set(times);

      // Actualizar marcas de tiempo de las notificaciones
      this.liveEvents.update((events) =>
        events.map((e) => {
          const diff = Math.max(0, now - e.timestamp);
          const mins = Math.floor(diff / 60000);
          return {
            ...e,
            tiempo: mins <= 0 ? 'Hace un momento' : `Hace ${mins} min`,
          };
        })
      );
    }, 1000);
  }

  // ── Interacción con Mesas ──
  onMesaClick(mesa: Mesa, event?: Event) {
    if (event) event.stopPropagation();
    this.selectedMesa.set(mesa);

    if (mesa.estado === 'POR_COBRAR') {
      this.autoOpenCobro.set(true);
      this.activeDrawer.set('COBRO');
    } else {
      this.autoOpenCobro.set(false);
      this.activeDrawer.set('COMANDA');
    }
  }

  onCobroDirecto(mesa: Mesa, event: Event) {
    event.stopPropagation();
    this.selectedMesa.set(mesa);
    this.autoOpenCobro.set(true);
    this.activeDrawer.set('COBRO');
  }

  onCobroClick(mesa: Mesa, event: Event) {
    this.onCobroDirecto(mesa, event);
  }

  atenderMesero(mesaNumero: string, event?: Event) {
    if (event) event.stopPropagation();
    this.http.post(`${this.baseUrl}/pedidos/atender-mesero`, { mesaNumero }).subscribe({
      next: () => console.log(`Garzón en camino para Mesa ${mesaNumero}`),
      error: (err) => console.error('Error al atender mesero', err),
    });
    this.mesasLlamando.update((prev) => {
      const next = new Set(prev);
      next.delete(mesaNumero);
      return next;
    });
    this.llamadasDetalle.update((prev) => {
      const next = { ...prev };
      delete next[mesaNumero];
      return next;
    });
  }

  getLlamadaMesa(mesa: Mesa | null): { motivo: string; timestamp: string } | null {
    if (!mesa) return null;
    return this.llamadasDetalle()[mesa.numero] || null;
  }

  closeDrawer() {
    this.activeDrawer.set(null);
    this.selectedMesa.set(null);
    this.autoOpenCobro.set(false);
  }

  // ── Helpers para Renderizado de Tarjeta de Mesa ──
  getPlatosCount(mesa: Mesa): number {
    const detalles = mesa.pedidos?.[0]?.detalles || [];
    return detalles
      .filter((d: any) => {
        const cat = (d.plato?.categoria?.nombre || '').toLowerCase();
        return !cat.includes('bebida') && !cat.includes('gaseosa') && !cat.includes('jugo') && !cat.includes('cerveza') && !cat.includes('refresco');
      })
      .reduce((sum: number, d: any) => sum + (d.cantidad || 1), 0);
  }

  getBebidasCount(mesa: Mesa): number {
    const detalles = mesa.pedidos?.[0]?.detalles || [];
    return detalles
      .filter((d: any) => {
        const cat = (d.plato?.categoria?.nombre || '').toLowerCase();
        return cat.includes('bebida') || cat.includes('gaseosa') || cat.includes('jugo') || cat.includes('cerveza') || cat.includes('refresco');
      })
      .reduce((sum: number, d: any) => sum + (d.cantidad || 1), 0);
  }

  getComandaItems(mesa: Mesa): { nombre: string; cantidad: number; subtotal: number }[] {
    const detalles = mesa.pedidos?.[0]?.detalles || [];
    return detalles.slice(0, 3).map((d: any) => {
      const precio = Number(d.precioUnitario) || Number(d.plato?.precioVenta) || 0;
      const cant = Number(d.cantidad) || 1;
      return {
        nombre: d.plato?.nombre || 'Producto',
        cantidad: cant,
        subtotal: (precio * cant) || 0,
      };
    });
  }

  getMesaSubtotal(mesa: Mesa): number {
    const pedido = mesa.pedidos?.[0];
    if (!pedido) return 0;
    if (pedido.total) return Number(pedido.total);
    const detalles = pedido.detalles || [];
    return detalles.reduce((sum: number, d: any) => {
      const p = Number(d.precioUnitario) || Number(d.plato?.precioVenta) || 0;
      return sum + p * (d.cantidad || 1);
    }, 0);
  }

  getKitchenProgress(mesa: Mesa): number {
    const detalles = mesa.pedidos?.[0]?.detalles || [];
    if (detalles.length === 0) return 0;
    const listosOServidos = detalles.filter(
      (d: any) => d.estadoItem === 'LISTO' || d.estadoItem === 'ENTREGADO' || d.estadoItem === 'SERVIDO'
    ).length;
    return Math.round((listosOServidos / detalles.length) * 100) || 25;
  }

  getMesaClass(mesa: Mesa): string {
    const estadoClass = mesa.estado.toLowerCase().replace('_', '-');
    const isFlashing = this.flashingMesas()[mesa.id] ? ' ws-flash-active' : '';
    const isCalling = this.mesasLlamando().has(mesa.numero) ? ' solicita-mesero' : '';
    const isSelected = this.selectedMesa()?.id === mesa.id ? ' mesa-selected' : '';
    return `mesa-card-cmd ${estadoClass}${isFlashing}${isCalling}${isSelected}`;
  }
}

