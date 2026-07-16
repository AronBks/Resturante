import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
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
  private readonly baseUrl = 'http://localhost:3000/api';

  user = this.authService.currentUserSignal;

  // KPI Signals
  totalRecaudado = signal(0);
  ocupacionActual = signal('0 / 0 Mesas');
  ocupacionPorcentaje = signal(0);
  comandasActivas = signal(0);
  platoEstrella = signal('Ninguno');

  // Live Feed
  movimientos = signal<any[]>([]);

  private subs: Subscription[] = [];

  ngOnInit() {
    this.cargarResumenHoy();
    this.suscribirAActualizaciones();
  }

  ngOnDestroy() {
    this.subs.forEach((s) => s.unsubscribe());
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

  suscribirAActualizaciones() {
    // Escuchar actualizaciones de mesas, comandas y pedidos
    const subMesa = this.socketService
      .onEvent<any>('mesa:estado-actualizado')
      .subscribe(() => {
        this.cargarResumenHoy();
      });

    const subPedido = this.socketService
      .onEvent<any>('pedido:creado')
      .subscribe(() => {
        this.cargarResumenHoy();
      });

    const subPedidoAct = this.socketService
      .onEvent<any>('pedido:estado-actualizado')
      .subscribe(() => {
        this.cargarResumenHoy();
      });

    this.subs.push(subMesa, subPedido, subPedidoAct);
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
