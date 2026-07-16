// ============================================================
// CartaGateway — Namespace WebSocket Público (/publica)
//
// Canal de difusión en tiempo real para la app del cliente.
// NO requiere autenticación JWT — solo emite, no procesa
// mensajes entrantes de clientes anónimos.
// ============================================================

import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  namespace: '/publica',
  cors: {
    origin: '*',
  },
})
export class CartaGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CartaGateway.name);
  private clientCount = 0;

  handleConnection(socket: Socket) {
    this.clientCount++;
    this.logger.log(
      `📱 Cliente público conectado (${socket.id}) — Total: ${this.clientCount}`,
    );
  }

  handleDisconnect(socket: Socket) {
    this.clientCount--;
    this.logger.log(
      `📱 Cliente público desconectado (${socket.id}) — Total: ${this.clientCount}`,
    );
  }

  /**
   * Emite a TODOS los clientes conectados al namespace público
   * que un plato cambió su estado de disponibilidad.
   *
   * Llamado desde CartaService.toggleDisponible()
   */
  broadcastDisponibilidad(platoId: string, disponible: boolean) {
    this.server.emit('plato:disponibilidad-actualizada', {
      platoId,
      disponible,
      timestamp: new Date(),
    });

    this.logger.log(
      `📡 Broadcast público: Plato ${platoId} → ${disponible ? 'DISPONIBLE' : 'AGOTADO'} (${this.clientCount} clientes)`,
    );
  }
}
