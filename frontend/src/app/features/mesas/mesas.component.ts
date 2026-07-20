import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { SocketService } from '../../core/services/socket.service';
import { Subscription } from 'rxjs';
import { ComandaDrawerComponent } from './comanda-drawer.component';

export interface Mesa {
  id: number;
  numero: string;
  capacidad: number;
  estado: 'LIBRE' | 'OCUPADA' | 'POR_COBRAR' | string;
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

import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-mesas',
  standalone: true,
  imports: [CommonModule, ComandaDrawerComponent, LucideAngularModule],
  templateUrl: './mesas.component.html',
  styleUrls: ['./mesas.component.scss'],
})
export class MesasComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private socketService = inject(SocketService);
  private readonly baseUrl = 'http://localhost:3000/api';

  mesas = signal<Mesa[]>([]);
  platos = signal<Plato[]>([]);

  // Computed zone signals
  mesasCentral = signal<Mesa[]>([]);
  mesasVentanales = signal<Mesa[]>([]);
  mesasBarra = signal<Mesa[]>([]);

  // Real-time KPIs
  libresCount = computed(() => this.mesas().filter((m) => m.estado === 'LIBRE').length);
  ocupadasCount = computed(() => this.mesas().filter((m) => m.estado === 'OCUPADA').length);
  porCobrarCount = computed(() => this.mesas().filter((m) => m.estado === 'POR_COBRAR').length);

  // Drawer & Cobro modal states
  isDrawerOpen = false;
  selectedMesa: Mesa | null = null;
  autoOpenCobro = false;

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
        this.flashingMesas.update((fm) => ({ ...fm, [data.mesaId]: true }));
        setTimeout(() => {
          this.flashingMesas.update((fm) => ({ ...fm, [data.mesaId]: false }));
        }, 1500);
        this.cargarMesas();
      });

    const subMenu = this.socketService.onEvent<void>('menu:actualizado').subscribe(() => this.cargarPlatos());
    const subPedido = this.socketService.onEvent<any>('pedido:creado').subscribe(() => this.cargarMesas());
    const subPedidoAct = this.socketService.onEvent<any>('pedido:estado-actualizado').subscribe(() => this.cargarMesas());
    
    const subPedidoIa = this.socketService.onEvent<any>('pedido:ia-creado').subscribe((data) => {
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
          
          if (hrs > 0) {
            times[mesa.id] = `${hrs}h ${mins}min`;
          } else {
            times[mesa.id] = `${mins} min`;
          }
        }
      });
      this.elapsedTimes.set(times);
    }, 1000);
  }

  onMesaClick(mesa: Mesa, autoCobro = false) {
    this.selectedMesa = mesa;
    this.autoOpenCobro = autoCobro;
    this.isDrawerOpen = true;
  }

  onCobroClick(mesa: Mesa, event: Event) {
    event.stopPropagation();
    this.onMesaClick(mesa, true);
  }

  closeDrawer() {
    this.isDrawerOpen = false;
    this.selectedMesa = null;
    this.autoOpenCobro = false;
  }

  getMesaClass(mesa: Mesa): string {
    const base = mesa.estado.toLowerCase().replace('_', '-');
    const isFlashing = this.flashingMesas()[mesa.id] ? ' ws-flash-active' : '';
    return `${base}${isFlashing}`;
  }
}

