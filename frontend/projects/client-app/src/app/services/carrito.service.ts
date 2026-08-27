import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { PlatoPublico, VariantePublica } from './carta-publica.service';
import { Observable } from 'rxjs';

export interface ItemCarrito {
  platoId: string;
  varianteId?: string;
  varianteNombre?: string;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  notas: string;
  imagenUrl?: string;
}

export interface ResumenPedidoConfirmado {
  codigo: string;
  mesaNumero: string;
  horaRecibido: string;
  horaCocina: string;
  items: ItemCarrito[];
  total: number;
}

import { SocketPublicoService } from './socket-publico.service';

@Injectable({
  providedIn: 'root',
})
export class CarritoService {
  private readonly http = inject(HttpClient);
  private readonly socketPublico = inject(SocketPublicoService);
  private readonly apiUrl = 'http://localhost:3000/api/pedidos';

  // ── Estado reactivo del carrito ──
  items = signal<ItemCarrito[]>([]);
  confirmando = signal(false);
  pedidoConfirmado = signal(false);
  ultimoPedido = signal<ResumenPedidoConfirmado | null>(null);
  error = signal<string | null>(null);

  // ── Solicitar Atención Presencial (Llamar Mesero) ──
  meseroLlamadoStatus = signal<'idle' | 'calling' | 'success' | 'en_camino' | 'error'>('idle');

  // ── Inicialización desde localStorage (Persistencia) ──
  constructor() {
    this.cargarDeLocalStorage();
    this.socketPublico.onMeseroAtendido().subscribe(() => {
      this.meseroLlamadoStatus.set('en_camino');
      setTimeout(() => this.meseroLlamadoStatus.set('idle'), 12000);
    });
  }

  // ── Computed Signals ──
  cantidadTotalItems = computed(() => {
    return this.items().reduce((sum, item) => sum + item.cantidad, 0);
  });

  totalAcumulado = computed(() => {
    return this.items().reduce((sum, item) => sum + item.precioUnitario * item.cantidad, 0);
  });

  subtotal = computed(() => this.totalAcumulado());

  // ── Operaciones del Carrito ──

  agregarPlato(plato: PlatoPublico, variante?: VariantePublica): boolean {
    if (plato.disponibleAhora === false) {
      this.error.set(`"${plato.nombre}" no está disponible en este horario (${plato.horaInicio || ''} a ${plato.horaFin || 'cierre'}).`);
      return false;
    }

    this.items.update((currentItems) => {
      const index = currentItems.findIndex(
        (item) => item.platoId === plato.id && item.varianteId === (variante?.id || undefined)
      );
      let updated: ItemCarrito[];

      if (index > -1) {
        updated = currentItems.map((item, idx) =>
          idx === index ? { ...item, cantidad: item.cantidad + 1 } : item
        );
      } else {
        updated = [
          ...currentItems,
          {
            platoId: plato.id,
            varianteId: variante?.id,
            varianteNombre: variante?.nombre,
            nombre: plato.nombre,
            precioUnitario: variante ? variante.precio : plato.precioVenta,
            cantidad: 1,
            notas: '',
            imagenUrl: plato.imagenUrl,
          },
        ];
      }
      this.guardarEnLocalStorage(updated);
      return updated;
    });
    return true;
  }

  removerPlato(platoId: string, varianteId?: string): void {
    this.items.update((currentItems) => {
      const index = currentItems.findIndex(
        (item) => item.platoId === platoId && item.varianteId === (varianteId || undefined)
      );
      if (index === -1) return currentItems;

      let updated: ItemCarrito[];
      const item = currentItems[index];

      if (item.cantidad > 1) {
        updated = currentItems.map((it, idx) =>
          idx === index ? { ...it, cantidad: it.cantidad - 1 } : it
        );
      } else {
        updated = currentItems.filter((_, idx) => idx !== index);
      }
      this.guardarEnLocalStorage(updated);
      return updated;
    });
  }

  actualizarCantidad(platoId: string, varianteId: string | undefined, cantidad: number): void {
    if (cantidad <= 0) {
      this.items.update((currentItems) => {
        const updated = currentItems.filter(
          (item) => !(item.platoId === platoId && item.varianteId === (varianteId || undefined))
        );
        this.guardarEnLocalStorage(updated);
        return updated;
      });
      return;
    }

    this.items.update((currentItems) => {
      const updated = currentItems.map((item) =>
        item.platoId === platoId && item.varianteId === (varianteId || undefined)
          ? { ...item, cantidad }
          : item
      );
      this.guardarEnLocalStorage(updated);
      return updated;
    });
  }

  actualizarNotas(platoId: string, varianteId: string | undefined, notas: string): void {
    this.items.update((currentItems) => {
      const updated = currentItems.map((item) =>
        item.platoId === platoId && item.varianteId === (varianteId || undefined)
          ? { ...item, notas }
          : item
      );
      this.guardarEnLocalStorage(updated);
      return updated;
    });
  }

  obtenerCantidad(platoId: string, varianteId?: string): number {
    const item = this.items().find(
      (it) => it.platoId === platoId && it.varianteId === (varianteId || undefined)
    );
    return item ? item.cantidad : 0;
  }

  limpiarCarrito(): void {
    this.items.set([]);
    this.pedidoConfirmado.set(false);
    this.confirmando.set(false);
    this.error.set(null);
    localStorage.removeItem('tukuypaj_carrito');
  }

  // ── API: Confirmación de Pedido ──
  enviarPedido(mesaNumero: string): Observable<any> {
    this.confirmando.set(true);
    this.error.set(null);

    const payload = {
      mesaNumero,
      items: this.items().map((item) => ({
        platoId: item.platoId,
        varianteId: item.varianteId || undefined,
        cantidad: item.cantidad,
        notas: item.notas || undefined,
      })),
    };

    return new Observable((subscriber) => {
      const itemsSnapshot = [...this.items()];
      const totalSnapshot = this.totalAcumulado();
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const horaRecibido = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const cocinaTime = new Date(now.getTime() + 5 * 60000);
      const horaCocina = `${pad(cocinaTime.getHours())}:${pad(cocinaTime.getMinutes())}`;
      const randomNum = Math.floor(1000 + Math.random() * 9000);

      this.http.post(`${this.apiUrl}/ia/confirmar`, payload).subscribe({
        next: (response: any) => {
          const codigo = response?.pedido?.codigo || `TK-${randomNum}`;

          this.ultimoPedido.set({
            codigo,
            mesaNumero,
            horaRecibido,
            horaCocina,
            items: itemsSnapshot,
            total: totalSnapshot,
          });

          this.confirmando.set(false);
          this.pedidoConfirmado.set(true);
          this.items.set([]);
          localStorage.removeItem('tukuypaj_carrito');
          subscriber.next(response);
          subscriber.complete();
        },
        error: (err) => {
          this.confirmando.set(false);
          const msg =
            err.error?.message ||
            'Error al enviar el pedido a la cocina. Intenta de nuevo.';
          this.error.set(msg);
          subscriber.error(err);
        },
      });
    });
  }

  // ── Solicitar Atención Presencial (Llamar Mesero) ──
  llamarMesero(mesaNumero: string, motivo?: string): Observable<any> {
    this.meseroLlamadoStatus.set('calling');
    return new Observable((subscriber) => {
      this.http.post(`${this.apiUrl}/llamar-mesero`, { mesaNumero, motivo }).subscribe({
        next: (res: any) => {
          this.meseroLlamadoStatus.set('success');
          setTimeout(() => this.meseroLlamadoStatus.set('idle'), 6000);
          subscriber.next(res);
          subscriber.complete();
        },
        error: (err) => {
          this.meseroLlamadoStatus.set('error');
          setTimeout(() => this.meseroLlamadoStatus.set('idle'), 4000);
          subscriber.error(err);
        },
      });
    });
  }

  // ── Persistencia Local ──
  private guardarEnLocalStorage(items: ItemCarrito[]): void {
    try {
      localStorage.setItem('tukuypaj_carrito', JSON.stringify(items));
    } catch (e) {
      console.error('Error guardando el carrito en localStorage', e);
    }
  }

  private cargarDeLocalStorage(): void {
    try {
      const data = localStorage.getItem('tukuypaj_carrito');
      if (data) {
        this.items.set(JSON.parse(data));
      }
    } catch (e) {
      console.error('Error cargando el carrito desde localStorage', e);
    }
  }
}
