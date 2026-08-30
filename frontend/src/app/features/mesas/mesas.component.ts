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
import { ComandaDrawerComponent } from './comanda-drawer.component';
import { LucideAngularModule } from 'lucide-angular';

export interface Mesa {
  id: number;
  numero: string;
  capacidad: number;
  estado: 'LIBRE' | 'OCUPADA' | 'POR_COBRAR' | 'RESERVADA' | string;
  posicion?: any;
  pedidos?: any[];
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
  private readonly baseUrl = 'http://localhost:3000/api';

  // ── Signals de Estado Principal ──
  mesas = signal<Mesa[]>([]);
  platos = signal<Plato[]>([]);
  selectedMesa = signal<Mesa | null>(null);
  activeDrawer = signal<'COMANDA' | 'COBRO' | null>(null);

  // ── Filtros de Zona y Estado ──
  filtroZona = signal<string>('TODOS');
  filtroEstado = signal<string>('TODOS');

  // ── Señales en Tiempo Real y Temporizadores ──
  flashingMesas = signal<Record<number, boolean>>({});
  mesasLlamando = signal<Set<string>>(new Set());
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

  // ── Mesas Filtradas ──
  mesasFiltradas = computed(() => {
    let result = this.mesas();

    const estado = this.filtroEstado();
    if (estado !== 'TODOS') {
      if (estado === 'COMANDA') {
        result = result.filter((m) => m.estado === 'OCUPADA' || m.pedidos?.[0]?.estado === 'EN_COCINA');
      } else {
        result = result.filter((m) => m.estado === estado);
      }
    }

    return result;
  });

  cerrarMenuContextual() {
    this.selectedMesa.set(null);
  }

  ngOnInit() {
    this.cargarMesas();
    this.cargarLlamadasMesero();
    this.cargarPlatos();
    this.suscribirAActualizaciones();
    this.iniciarTemporizador();
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

  llamadasDetalle = signal<Record<string, { motivo: string; timestamp: string }>>({});

  getLlamadaMesa(mesa: Mesa | null): { motivo: string; timestamp: string } | null {
    if (!mesa || !mesa.numero) return null;
    return this.llamadasDetalle()[mesa.numero] || null;
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
      .onEvent<{ mesaNumero: string; motivo: string }>('mesero:llamado')
      .subscribe((data) => {
        const mesaNum = data?.mesaNumero || 'M01';
        this.mesasLlamando.update((prev) => {
          const next = new Set(prev);
          next.add(mesaNum);
          return next;
        });
        this.agregarEvento({
          tipo: 'ALERTA',
          titulo: `Mesa ${mesaNum}: Asistencia requerida`,
          descripcion: data?.motivo || 'El comensal solicita la presencia de un garzón.',
        });
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

    this.subs.push(subMesa, subMesaLiberada, subPedido, subMeseroLlamado, subPagoConf);
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

