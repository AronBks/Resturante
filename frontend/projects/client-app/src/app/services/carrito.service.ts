import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { PlatoPublico, VariantePublica } from './carta-publica.service';
import { Observable } from 'rxjs';
import { formatearMesaParaBackend } from './don-beto.service';

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
  id?: string;
  codigo: string;
  mesaNumero: string;
  estado?: string;
  horaRecibido: string;
  horaCocina: string;
  items: ItemCarrito[];
  total: number;
}

import { resolverImagenLocal } from './carta-publica.service';

function resolverFotoPlato(nombre: string, imagenOriginal?: string): string | undefined {
  return resolverImagenLocal(nombre, imagenOriginal);
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

    this.socketPublico.onEstadoPedidoActualizado().subscribe((evento) => {
      const currentMesa = localStorage.getItem('tukuypaj_mesa_asignada') || 'M01';
      const mesaNormEvent = formatearMesaParaBackend(evento.mesaNumero);
      const mesaNormCurrent = formatearMesaParaBackend(currentMesa);

      if (mesaNormEvent === mesaNormCurrent) {
        // Re-consultar pedido completo para sincronizar estados de platos, totales e ítems en tiempo real
        this.consultarPedidoActivoMesa(mesaNormCurrent).subscribe();
      }
    });

    this.socketPublico.onEstadoItemActualizado().subscribe((evento) => {
      const currentMesa = localStorage.getItem('tukuypaj_mesa_asignada') || 'M01';
      const mesaNormCurrent = formatearMesaParaBackend(currentMesa);
      const activo = this.ultimoPedido();
      if (activo && (!evento.pedidoId || evento.pedidoId === activo.id)) {
        this.consultarPedidoActivoMesa(mesaNormCurrent).subscribe();
      }
    });

    this.socketPublico.onPagoConfirmado().subscribe((evento) => {
      const currentMesa = localStorage.getItem('tukuypaj_mesa_asignada') || 'M01';
      const mesaNormEvent = formatearMesaParaBackend(evento.mesaNumero);
      const mesaNormCurrent = formatearMesaParaBackend(currentMesa);

      if (mesaNormEvent === mesaNormCurrent) {
        this.limpiarCarrito();
        this.ultimoPedido.set(null);
        this.pedidoConfirmado.set(false);
        try {
          localStorage.removeItem(`tukuypaj_pedido_activo_${mesaNormCurrent}`);
          localStorage.removeItem(`tukuypaj_pedido_activo_${evento.mesaNumero}`);
        } catch (e) {}
      }
    });

    this.socketPublico.onStockActualizado().subscribe((stockEvt) => {
      this.items.update((currentItems) => {
        let changed = false;
        const updated = currentItems
          .map((item) => {
            if (item.platoId === stockEvt.platoId && stockEvt.stockActual !== null && stockEvt.stockActual !== undefined) {
              if (stockEvt.stockActual <= 0) {
                changed = true;
                this.error.set(`⚠️ El plato "${item.nombre}" se acaba de agotar en cocina y fue retirado del pedido.`);
                return null;
              } else if (item.cantidad > stockEvt.stockActual) {
                changed = true;
                this.error.set(`⚠️ Ajuste de cocina: solo quedan ${stockEvt.stockActual} porciones de "${item.nombre}".`);
                return { ...item, cantidad: stockEvt.stockActual };
              }
            }
            return item;
          })
          .filter(Boolean) as ItemCarrito[];

        if (changed) {
          this.guardarEnLocalStorage(updated);
        }
        return updated;
      });
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

    if (plato.controlarStock && plato.stockActual !== null && plato.stockActual !== undefined) {
      if (plato.stockActual <= 0) {
        this.error.set(`Lo sentimos: El plato "${plato.nombre}" se encuentra agotado en cocina.`);
        return false;
      }
      const cantActual = this.items().find((it) => it.platoId === plato.id && it.varianteId === (variante?.id || undefined))?.cantidad || 0;
      if (cantActual >= plato.stockActual) {
        this.error.set(`Solo quedan ${plato.stockActual} porciones disponibles de "${plato.nombre}".`);
        return false;
      }
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
            imagenUrl: resolverFotoPlato(plato.nombre, plato.imagenUrl),
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
      canalOrigen: 'CLIENTE_DIGITAL',
      notas: `Pedido interactivo desde la Carta Digital — Mesa ${mesaNumero}`,
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

      this.http.post(`${this.apiUrl}/publica/confirmar`, payload).subscribe({
        next: (response: any) => {
          const codigo = response?.pedido?.codigo || `TK-${randomNum}`;

          const resumen: ResumenPedidoConfirmado = {
            codigo,
            mesaNumero,
            horaRecibido,
            horaCocina,
            items: itemsSnapshot,
            total: totalSnapshot,
          };

          this.ultimoPedido.set(resumen);
          this.pedidoConfirmado.set(true);
          this.items.set([]);
          localStorage.removeItem('tukuypaj_carrito');

          try {
            localStorage.setItem(
              `tukuypaj_pedido_activo_${mesaNumero}`,
              JSON.stringify(resumen)
            );
          } catch (e) {
            console.error('Error guardando pedido activo en localStorage:', e);
          }

          this.confirmando.set(false);
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

  /**
   * Consulta el pedido activo de la mesa en el backend para restaurar el seguimiento
   * incluso después de recargar la página (F5) o cerrar el navegador.
   */
  consultarPedidoActivoMesa(mesaNumero: string): Observable<any> {
    const mesaBackend = formatearMesaParaBackend(mesaNumero);
    try {
      localStorage.setItem('tukuypaj_mesa_asignada', mesaBackend);
    } catch (e) {}

    return new Observable((subscriber) => {
      // 1. Cargar cache local de inmediato para evitar pantalla en blanco
      const cached =
        localStorage.getItem(`tukuypaj_pedido_activo_${mesaBackend}`) ||
        localStorage.getItem(`tukuypaj_pedido_activo_${mesaNumero}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          this.ultimoPedido.set(parsed);
          this.pedidoConfirmado.set(true);
        } catch (e) {}
      }

      // 2. Sincronizar en vivo con el backend
      this.http.get<any>(`${this.apiUrl}/publica/mesa/${mesaBackend}/activo`).subscribe({
        next: (res) => {
          const pedidoActivo = res?.data?.pedidoActivo ?? res?.pedidoActivo ?? (res?.id ? res : null);
          if (pedidoActivo) {
            this.ultimoPedido.set(pedidoActivo);
            this.pedidoConfirmado.set(true);
            try {
              localStorage.setItem(
                `tukuypaj_pedido_activo_${mesaBackend}`,
                JSON.stringify(pedidoActivo)
              );
            } catch (e) {}
          } else {
            // Mesa ya no tiene pedido activo (cuenta pagada o liberada)
            this.ultimoPedido.set(null);
            this.pedidoConfirmado.set(false);
            try {
              localStorage.removeItem(`tukuypaj_pedido_activo_${mesaBackend}`);
              localStorage.removeItem(`tukuypaj_pedido_activo_${mesaNumero}`);
            } catch (e) {}
          }
          subscriber.next(pedidoActivo);
          subscriber.complete();
        },
        error: (err) => {
          console.warn('No se pudo sincronizar el pedido activo:', err);
          subscriber.next(this.ultimoPedido());
          subscriber.complete();
        },
      });
    });
  }

  // ── Solicitar Atención Presencial (Llamar Mesero) ──
  llamarMesero(mesaNumero: string, motivo?: string): Observable<any> {
    this.meseroLlamadoStatus.set('calling');
    const mesaBackend = formatearMesaParaBackend(mesaNumero);
    return new Observable((subscriber) => {
      this.http.post(`${this.apiUrl}/llamar-mesero`, { mesaNumero: mesaBackend, motivo }).subscribe({
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

  // ── Solicitar la Cuenta (Flujo Seguro de Restaurante) ──
  solicitarCuenta(mesaNumero: string, metodoPago?: string, montoPagaCon?: number): Observable<any> {
    const mesaBackend = formatearMesaParaBackend(mesaNumero);
    return this.http.post(`${this.apiUrl}/solicitar-cuenta`, {
      mesaNumero: mesaBackend,
      metodoPago,
      montoPagaCon,
    });
  }

  // ── Notificar Pago en Efectivo y Billete con el que se paga (Cálculo de cambio) ──
  notificarPagoEfectivo(mesaNumero: string, montoPagaCon: number): Observable<any> {
    const mesaBackend = formatearMesaParaBackend(mesaNumero);
    return this.http.post(`${this.apiUrl}/notificar-pago-efectivo`, {
      mesaNumero: mesaBackend,
      montoPagaCon,
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
