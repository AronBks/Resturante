import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { SocketService } from '../../core/services/socket.service';
import { Subscription } from 'rxjs';
import { ComandaDrawerComponent } from './comanda-drawer.component';

interface Mesa {
  id: number;
  numero: string;
  capacidad: number;
  estado: string;
  posicion?: any;
  pedidos?: any[];
}

interface Plato {
  id: string;
  nombre: string;
  precioVenta: number;
  descripcion?: string;
  disponible: boolean;
  categoriaId: number;
}

@Component({
  selector: 'app-mesas',
  standalone: true,
  imports: [CommonModule, ComandaDrawerComponent],
  templateUrl: './mesas.component.html',
  styleUrls: ['./mesas.component.scss'],
})
export class MesasComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private socketService = inject(SocketService);
  private readonly baseUrl = 'http://localhost:3000/api';

  mesas = signal<Mesa[]>([]);
  platos = signal<Plato[]>([]);

  // Computed zone signals for daily layout
  mesasCentral = signal<Mesa[]>([]);
  mesasVentanales = signal<Mesa[]>([]);
  mesasBarra = signal<Mesa[]>([]);

  // Drawer states
  isDrawerOpen = false;
  selectedMesa: Mesa | null = null;

  // Real-time UI enhancements
  flashingMesas = signal<Record<number, boolean>>({});
  elapsedTimes = signal<Record<number, string>>({});
  private timerInterval: any;
  private subs: Subscription[] = [];

  ngOnInit() {
    this.cargarMesas();
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

  cargarMesas() {
    this.http.get<any>(`${this.baseUrl}/mesas`).subscribe({
      next: (res) => {
        const data: Mesa[] = res.data || [];
        this.mesas.set(data);
        this.clasificarMesas(data);
      },
      error: (err) => console.error('Error cargando mesas', err),
    });
  }

  clasificarMesas(mesas: Mesa[]) {
    const central: Mesa[] = [];
    const ventanales: Mesa[] = [];
    const barra: Mesa[] = [];

    for (const mesa of mesas) {
      const pos = typeof mesa.posicion === 'string' ? JSON.parse(mesa.posicion) : mesa.posicion;
      const zona = pos?.zona || '';
      if (zona === 'Zona Ventanales') {
        ventanales.push(mesa);
      } else if (zona === 'Barra') {
        barra.push(mesa);
      } else {
        central.push(mesa);
      }
    }
    this.mesasCentral.set(central);
    this.mesasVentanales.set(ventanales);
    this.mesasBarra.set(barra);
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

  suscribirAActualizaciones() {
    const subMesa = this.socketService
      .onEvent<{ mesaId: number; estado: string }>('mesa:estado-actualizado')
      .subscribe((data) => {
        // Trigger flashing effect for 1.5 seconds
        this.flashingMesas.update((fm) => ({ ...fm, [data.mesaId]: true }));
        setTimeout(() => {
          this.flashingMesas.update((fm) => ({ ...fm, [data.mesaId]: false }));
        }, 1500);

        // Fetch updated tables to refresh active order information (total, waiter, etc.)
        this.cargarMesas();
      });

    const subMenu = this.socketService.onEvent<void>('menu:actualizado').subscribe(() => this.cargarPlatos());
    
    // We should also listen to order creations to update table list totals
    const subPedido = this.socketService.onEvent<any>('pedido:creado').subscribe(() => this.cargarMesas());
    const subPedidoAct = this.socketService.onEvent<any>('pedido:estado-actualizado').subscribe(() => this.cargarMesas());
    
    // Listen to AI order creation to trigger visual updates on the table map
    const subPedidoIa = this.socketService.onEvent<any>('pedido:ia-creado').subscribe((data) => {
      // Trigger flashing effect on the mesa
      const mesaId = data.pedido?.mesaId;
      if (mesaId) {
        this.flashingMesas.update((fm) => ({ ...fm, [mesaId]: true }));
        setTimeout(() => {
          this.flashingMesas.update((fm) => ({ ...fm, [mesaId]: false }));
        }, 1500);
      }
      this.cargarMesas();
    });

    this.subs.push(subMesa, subMenu, subPedido, subPedidoAct, subPedidoIa);
  }

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
          const secs = Math.floor((diff % 60000) / 1000);
          
          const pad = (n: number) => String(n).padStart(2, '0');
          times[mesa.id] = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
        }
      });
      this.elapsedTimes.set(times);
    }, 1000);
  }

  onMesaClick(mesa: Mesa) {
    this.selectedMesa = mesa;
    this.isDrawerOpen = true;
  }

  closeDrawer() {
    this.isDrawerOpen = false;
    this.selectedMesa = null;
  }

  getMesaClass(mesa: Mesa): string {
    const base = mesa.estado.toLowerCase().replace('_', '-');
    const isFlashing = this.flashingMesas()[mesa.id] ? ' ws-flash-active' : '';
    return `${base}${isFlashing}`;
  }

  getMesaEstadoLabel(estado: string): string {
    switch (estado) {
      case 'LIBRE':
        return 'Libre';
      case 'OCUPADA':
        return 'Ocupada';
      case 'POR_COBRAR':
        return 'Por Cobrar';
      default:
        return estado;
    }
  }
}
