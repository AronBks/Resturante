// ============================================================
// SocketPublicoService — WebSocket Público (Sin JWT)
//
// Conecta al namespace /publica del backend para recibir
// eventos de disponibilidad de platos en tiempo real.
// No requiere autenticación — es un listener pasivo.
// ============================================================

import { Injectable, signal, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

export interface EventoDisponibilidad {
  platoId: string;
  disponible: boolean;
  timestamp: Date;
}

@Injectable({ providedIn: 'root' })
export class SocketPublicoService implements OnDestroy {
  private socket: Socket;

  // Signal para exponer el estado de conexión
  isConnected = signal<boolean>(false);

  constructor() {
    // Conexión al namespace público — SIN autenticación JWT
    this.socket = io('http://localhost:3000/publica', {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 3000,
      reconnectionDelayMax: 10000,
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      this.isConnected.set(true);
      console.log('📱 Menú Digital conectado al servidor en tiempo real');
    });

    this.socket.on('disconnect', () => {
      this.isConnected.set(false);
      console.log('📱 Menú Digital desconectado del servidor');
    });

    this.socket.on('connect_error', (err) => {
      console.warn('📱 Error de conexión WebSocket público:', err.message);
    });
  }

  /**
   * Observable que emite cada vez que un plato cambia
   * su estado de disponibilidad desde el panel de administración.
   *
   * El componente MenuDigital se suscribe para actualizar
   * la interfaz en tiempo real sin recarga.
   */
  onDisponibilidadActualizada(): Observable<EventoDisponibilidad> {
    return new Observable<EventoDisponibilidad>((observer) => {
      const handler = (data: EventoDisponibilidad) => observer.next(data);

      this.socket.on('plato:disponibilidad-actualizada', handler);

      // Teardown: limpiar listener al cancelar suscripción
      return () => {
        this.socket.off('plato:disponibilidad-actualizada', handler);
      };
    });
  }

  /**
   * Observable que emite en tiempo real cuando el stock de un plato disminuye
   * o se agota tras la compra de cualquier mesa.
   */
  onStockActualizado(): Observable<{ platoId: string; stockActual: number | null; disponible: boolean }> {
    return new Observable<{ platoId: string; stockActual: number | null; disponible: boolean }>((observer) => {
      const handler = (data: any) => observer.next(data);

      this.socket.on('plato:stock-actualizado', handler);

      return () => {
        this.socket.off('plato:stock-actualizado', handler);
      };
    });
  }

  /**
   * Observable que emite cuando el mesero o administrador marca 'Atender'
   * para notificar al cliente que un garzón va en camino.
   */
  onMeseroAtendido(): Observable<{ mesaNumero: string }> {
    return new Observable<{ mesaNumero: string }>((observer) => {
      const handler = (data: any) => observer.next(data);

      this.socket.on('mesero:atendido', handler);

      return () => {
        this.socket.off('mesero:atendido', handler);
      };
    });
  }

  /**
   * Observable que emite cambios de estado del pedido (ABIERTO, EN_COCINA, LISTO, ENTREGADO)
   * para actualizar el timeline del cliente en tiempo real sin recargar la página.
   */
  onEstadoPedidoActualizado(): Observable<{ pedidoId: string; mesaNumero: string; estado: string }> {
    return new Observable<{ pedidoId: string; mesaNumero: string; estado: string }>((observer) => {
      const handler = (data: any) => observer.next(data);

      this.socket.on('pedido:estado-actualizado', handler);

      return () => {
        this.socket.off('pedido:estado-actualizado', handler);
      };
    });
  }

  /**
   * Observable que emite cuando la cuenta fue solicitada al personal de salón.
   */
  onCuentaSolicitada(): Observable<{ mesaNumero: string }> {
    return new Observable<{ mesaNumero: string }>((observer) => {
      const handler = (data: any) => observer.next(data);
      this.socket.on('cuenta:solicitada', handler);
      return () => {
        this.socket.off('cuenta:solicitada', handler);
      };
    });
  }

  /**
   * Observable que emite cuando el garzón entrega físicamente la cuenta a la mesa.
   * Desbloquea las opciones de pago en el cliente (Efectivo / QR).
   */
  onCuentaEntregada(): Observable<{ mesaNumero: string }> {
    return new Observable<{ mesaNumero: string }>((observer) => {
      const handler = (data: any) => observer.next(data);
      this.socket.on('cuenta:entregada', handler);
      return () => {
        this.socket.off('cuenta:entregada', handler);
      };
    });
  }

  /**
   * Observable que emite cuando el garzón reabre la comanda.
   * Permite al cliente volver a la carta y ordenar platos adicionales.
   */
  onComandaReabierta(): Observable<{ mesaNumero: string }> {
    return new Observable<{ mesaNumero: string }>((observer) => {
      const handler = (data: any) => observer.next(data);
      this.socket.on('comanda:reabierta', handler);
      return () => {
        this.socket.off('comanda:reabierta', handler);
      };
    });
  }

  /**
   * Observable que emite cuando la cuenta de la mesa fue pagada y confirmada en caja.
   * Desbloquea la factura digital oficial para el cliente.
   */
  onPagoConfirmado(): Observable<{ mesaNumero: string; transaccion: any }> {
    return new Observable<{ mesaNumero: string; transaccion: any }>((observer) => {
      const handler = (data: any) => observer.next(data);

      this.socket.on('pago:confirmado', handler);

      return () => {
        this.socket.off('pago:confirmado', handler);
      };
    });
  }

  ngOnDestroy(): void {
    this.socket.disconnect();
  }
}
