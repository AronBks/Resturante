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

  ngOnDestroy(): void {
    this.socket.disconnect();
  }
}
