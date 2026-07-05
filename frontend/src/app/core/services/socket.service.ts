import { Injectable, inject, effect, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { AuthService } from './auth.service';
import { Observable, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private authService = inject(AuthService);
  private socket: Socket | null = null;

  // Signal para exponer el estado de conexión
  private isConnectedSignal = signal<boolean>(false);
  isConnected = this.isConnectedSignal.asReadonly();

  // Canal unificado para eventos del servidor
  private events$ = new Subject<{ event: string; data: any }>();

  constructor() {
    // Sincronizar reactivamente la conexión con el estado de sesión del usuario
    effect(() => {
      const user = this.authService.currentUserSignal();
      if (user) {
        this.connect();
      } else {
        this.disconnect();
      }
    });
  }

  private connect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }

    const token = this.authService.getToken();
    if (!token) return;

    this.socket = io('http://localhost:3000', {
      auth: {
        token,
      },
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      this.isConnectedSignal.set(true);
      console.log('🔌 Conectado al servidor de WebSockets');
    });

    this.socket.on('disconnect', () => {
      this.isConnectedSignal.set(false);
      console.log('🔌 Desconectado del servidor de WebSockets');
    });

    // Registrar escuchadores para los eventos operativos core
    const coreEvents = [
      'pedido:creado',
      'pedido:estado-actualizado',
      'item:estado-actualizado',
      'mesa:estado-actualizado',
      'menu:actualizado',
    ];

    coreEvents.forEach((event) => {
      this.socket?.on(event, (data) => {
        this.events$.next({ event, data });
      });
    });
  }

  private disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnectedSignal.set(false);
  }

  /**
   * Suscribe a un evento WebSocket específico y gestiona la desinscripción automáticamente
   */
  onEvent<T>(eventName: string): Observable<T> {
    return new Observable<T>((observer) => {
      const checkAndListen = () => {
        if (!this.socket) {
          setTimeout(checkAndListen, 500); // Reintentar si el socket se está creando
          return;
        }

        const handler = (data: T) => observer.next(data);
        this.socket.on(eventName, handler);

        // Teardown: Remueve el listener de socket.io al cancelar la suscripción de RxJS
        observer.add(() => {
          this.socket?.off(eventName, handler);
        });
      };

      checkAndListen();
    });
  }

  /**
   * Envía datos al servidor mediante socket
   */
  emit(eventName: string, data: any): void {
    if (this.socket && this.isConnectedSignal()) {
      this.socket.emit(eventName, data);
    } else {
      console.warn('🔌 Imposible emitir: socket desconectado');
    }
  }

  /**
   * Stream reactivo consolidado de todos los eventos
   */
  get allEvents$() {
    return this.events$.asObservable();
  }
}
