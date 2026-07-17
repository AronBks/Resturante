import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SocketService } from '../../core/services/socket.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './overview.component.html',
  styleUrls: ['./overview.component.scss']
})
export class DashboardOverviewComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private socketService = inject(SocketService);
  private router = inject(Router);
  private readonly baseUrl = 'http://localhost:3000/api';

  user = this.authService.currentUserSignal;

  // KPI Signals
  totalRecaudado = signal(0);
  ocupacionActual = signal('0 / 0 Mesas');
  ocupacionPorcentaje = signal(0);
  comandasActivas = signal(0);
  platoEstrella = signal('Ninguno');

  // Live Feed & Toasts
  movimientos = signal<any[]>([]);
  toasts = signal<any[]>([]);

  // Tables State for Donut Chart
  mesas = signal<any[]>([]);

  // Drawer States
  isDrawerOpen = signal(false);
  pedidosActivos = signal<any[]>([]);
  cargandoActivos = signal(false);

  // Live Update Flash States
  flashRecaudado = signal(false);
  flashOcupacion = signal(false);
  flashComandas = signal(false);
  flashPlato = signal(false);

  private subs: Subscription[] = [];

  // Computed properties for occupancy distribution donut
  mesasPorZona = computed(() => {
    const lista = this.mesas();
    const stats = {
      central: { total: 0, ocupadas: 0, pct: 0 },
      ventanales: { total: 0, ocupadas: 0, pct: 0 },
      barra: { total: 0, ocupadas: 0, pct: 0 }
    };
    
    for (const m of lista) {
      const pos = typeof m.posicion === 'string' ? JSON.parse(m.posicion) : m.posicion;
      const zona = pos?.zona || '';
      const esOcupada = m.estado === 'OCUPADA' || m.estado === 'POR_COBRAR';
      
      if (zona === 'Zona Ventanales') {
        stats.ventanales.total++;
        if (esOcupada) stats.ventanales.ocupadas++;
      } else if (zona === 'Barra') {
        stats.barra.total++;
        if (esOcupada) stats.barra.ocupadas++;
      } else {
        stats.central.total++;
        if (esOcupada) stats.central.ocupadas++;
      }
    }
    
    stats.central.pct = stats.central.total > 0 ? Math.round((stats.central.ocupadas / stats.central.total) * 100) : 0;
    stats.ventanales.pct = stats.ventanales.total > 0 ? Math.round((stats.ventanales.ocupadas / stats.ventanales.total) * 100) : 0;
    stats.barra.pct = stats.barra.total > 0 ? Math.round((stats.barra.ocupadas / stats.barra.total) * 100) : 0;
    
    return stats;
  });

  donutStyle = computed(() => {
    const stats = this.mesasPorZona();
    const c = stats.central.ocupadas;
    const v = stats.ventanales.ocupadas;
    const b = stats.barra.ocupadas;
    const total = c + v + b;
    if (total === 0) {
      return 'conic-gradient(rgba(255, 255, 255, 0.05) 0% 100%)';
    }
    const pc = Math.round((c / total) * 100);
    const pv = Math.round((v / total) * 100);
    
    return `conic-gradient(
      var(--accent) 0% ${pc}%, 
      #c94a4a ${pc}% ${pc + pv}%, 
      #7c9eb8 ${pc + pv}% 100%
    )`;
  });

  ngOnInit() {
    this.cargarResumenHoy();
    this.cargarMesas();
    this.suscribirAActualizaciones();
  }

  ngOnDestroy() {
    this.subs.forEach((s) => s.unsubscribe());
  }

  getSaludo(): string {
    const hora = new Date().getHours();
    const nombre = this.user()?.nombre || 'Operador';
    if (hora >= 6 && hora < 12) {
      return `¡Buen día, ${nombre}!`;
    } else if (hora >= 12 && hora < 19) {
      return `¡Buenas tardes, ${nombre}!`;
    } else {
      return `¡Buenas noches, ${nombre}!`;
    }
  }

  triggerFlash(kpi: 'recaudado' | 'ocupacion' | 'comandas' | 'plato') {
    if (kpi === 'recaudado') {
      this.flashRecaudado.set(true);
      setTimeout(() => this.flashRecaudado.set(false), 1500);
    } else if (kpi === 'ocupacion') {
      this.flashOcupacion.set(true);
      setTimeout(() => this.flashOcupacion.set(false), 1500);
    } else if (kpi === 'comandas') {
      this.flashComandas.set(true);
      setTimeout(() => this.flashComandas.set(false), 1500);
    } else if (kpi === 'plato') {
      this.flashPlato.set(true);
      setTimeout(() => this.flashPlato.set(false), 1500);
    }
  }

  cargarResumenHoy() {
    this.http.get<any>(`${this.baseUrl}/analitica/resumen-hoy`).subscribe({
      next: (res) => {
        const data = res.data || {};
        if (data.kpis) {
          this.totalRecaudado.set(Number(data.kpis.totalRecaudado));
          this.ocupacionActual.set(data.kpis.ocupacionActual);
          this.ocupacionPorcentaje.set(Number(data.kpis.ocupacionPorcentaje));
          this.comandasActivas.set(Number(data.kpis.comandasActivas));
          this.platoEstrella.set(data.kpis.platoEstrella);
        }
        if (data.movimientos) {
          this.movimientos.set(data.movimientos);
        }
      },
      error: (err) => console.error('Error cargando analíticas de hoy', err)
    });
  }

  cargarMesas() {
    this.http.get<any>(`${this.baseUrl}/mesas`).subscribe({
      next: (res) => {
        this.mesas.set(res.data || []);
      },
      error: (err) => console.error('Error cargando mesas para gráfico', err)
    });
  }

  navegarAMesas() {
    this.router.navigate(['/dashboard/mesas']);
  }

  toggleDrawer() {
    this.isDrawerOpen.update((v) => !v);
    if (this.isDrawerOpen()) {
      this.cargarPedidosActivos();
    }
  }

  cargarPedidosActivos() {
    this.cargandoActivos.set(true);
    this.http.get<any>(`${this.baseUrl}/pedidos/activos`).subscribe({
      next: (res) => {
        this.pedidosActivos.set(res || []);
        this.cargandoActivos.set(false);
      },
      error: (err) => {
        console.error('Error cargando pedidos activos', err);
        this.cargandoActivos.set(false);
      }
    });
  }

  suscribirAActualizaciones() {
    const subMesa = this.socketService
      .onEvent<any>('mesa:estado-actualizado')
      .subscribe(() => {
        this.cargarResumenHoy();
        this.cargarMesas();
        this.triggerFlash('ocupacion');
      });

    const subPedido = this.socketService
      .onEvent<any>('pedido:creado')
      .subscribe(() => {
        this.cargarResumenHoy();
        this.cargarMesas();
        if (this.isDrawerOpen()) {
          this.cargarPedidosActivos();
        }
        this.triggerFlash('comandas');
        this.triggerFlash('recaudado');
      });

    const subPedidoAct = this.socketService
      .onEvent<any>('pedido:estado-actualizado')
      .subscribe(() => {
        this.cargarResumenHoy();
        this.cargarMesas();
        if (this.isDrawerOpen()) {
          this.cargarPedidosActivos();
        }
        this.triggerFlash('comandas');
        this.triggerFlash('recaudado');
      });

    const subPedidoIa = this.socketService
      .onEvent<any>('pedido:ia-creado')
      .subscribe((payload) => {
        this.cargarResumenHoy();
        this.cargarMesas();
        if (this.isDrawerOpen()) {
          this.cargarPedidosActivos();
        }
        this.triggerFlash('comandas');
        this.triggerFlash('recaudado');
        this.mostrarToastIa(payload);
      });

    this.subs.push(subMesa, subPedido, subPedidoAct, subPedidoIa);
  }

  mostrarToastIa(payload: any) {
    const pedido = payload.pedido || {};
    const mesaNumero = payload.mesaNumero || 'Mesa';
    const total = Number(pedido.total || 0);
    const count = pedido.detalles?.length || 0;

    const id = Date.now() + Math.random();
    const nuevoToast = {
      id,
      mesaNumero,
      total,
      count,
      detalles: pedido.detalles || [],
      timestamp: new Date()
    };

    this.toasts.update((arr) => [...arr, nuevoToast]);
    this.playNotificationSound();

    setTimeout(() => {
      this.removerToast(id);
    }, 8000);
  }

  removerToast(id: number) {
    this.toasts.update((arr) => arr.filter((t) => t.id !== id));
  }

  playNotificationSound() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (!ctx) return;

      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        
        gain.gain.setValueAtTime(0.08, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

        osc.start(start);
        osc.stop(start + duration);
      };

      const now = ctx.currentTime;
      playTone(523.25, now, 0.2); // C5
      playTone(659.25, now + 0.12, 0.35); // E5
    } catch (e) {
      console.warn('AudioContext no inicializado (requiere interacción previa):', e);
    }
  }

  formatRelativeTime(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const diffMs = Date.now() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHrs = Math.floor(diffMins / 60);

    if (diffSecs < 10) return 'Hace un momento';
    if (diffSecs < 60) return `Hace ${diffSecs} s`;
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHrs < 24) return `Hace ${diffHrs} ${diffHrs === 1 ? 'hora' : 'horas'}`;
    
    return date.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
  }
}

