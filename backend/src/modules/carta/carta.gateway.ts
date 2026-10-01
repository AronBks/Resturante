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

  /**
   * Emite a TODOS los clientes conectados al namespace público (/publica)
   * la actualización exacta de stock remanente en tiempo real.
   */
  broadcastStock(platoId: string, stockActual: number | null, disponible: boolean) {
    this.server.emit('plato:stock-actualizado', {
      platoId,
      stockActual,
      disponible,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `📡 Broadcast público de Stock: Plato ${platoId} → Stock: ${stockActual} | Disp: ${disponible}`,
    );
  }

  /**
   * Emite a la app cliente que el garzón ya va en camino a atender la mesa
   */
  broadcastMeseroAtendido(mesaNumero: string) {
    this.server.emit('mesero:atendido', {
      mesaNumero,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `🏃‍♂️ Broadcast público: Mesero en camino a Mesa ${mesaNumero}`,
    );
  }

  /**
   * Emite el cambio de estado de un pedido (ABIERTO, EN_COCINA, LISTO, ENTREGADO)
   * a todos los clientes del namespace público (/publica) para actualizar el timeline en vivo.
   */
  broadcastEstadoPedidoPublico(pedidoId: string, mesaNumero: string, estado: string) {
    this.server.emit('pedido:estado-actualizado', {
      pedidoId,
      mesaNumero,
      estado,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `📡 Broadcast público: Pedido ${pedidoId} (Mesa ${mesaNumero}) → ${estado}`,
    );
  }

  /**
   * Emite a la app cliente que la cuenta fue solicitada al personal de salón.
   */
  broadcastCuentaSolicitada(mesaNumero: string) {
    this.server.emit('cuenta:solicitada', {
      mesaNumero,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `🧾 Broadcast público: Cuenta solicitada para Mesa ${mesaNumero}`,
    );
  }

  /**
   * Emite a la app cliente que el garzón ya entregó la cuenta en mesa, desbloqueando opciones de pago.
   */
  broadcastCuentaEntregada(mesaNumero: string) {
    this.server.emit('cuenta:entregada', {
      mesaNumero,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `🧾 Broadcast público: Cuenta entregada para Mesa ${mesaNumero}`,
    );
  }

  /**
   * Emite a la app cliente que la comanda fue desbloqueada y reabierta por el personal.
   */
  broadcastComandaReabierta(mesaNumero: string) {
    this.server.emit('comanda:reabierta', {
      mesaNumero,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `🔓 Broadcast público: Comanda reabierta para Mesa ${mesaNumero}`,
    );
  }

  /**
   * Emite a la app cliente que la cuenta de su mesa ya fue cobrada y confirmada en caja.
   * Desbloquea la factura digital oficial descargable.
   */
  broadcastPagoConfirmadoPublico(mesaNumero: string, transaccion: any) {
    this.server.emit('pago:confirmado', {
      mesaNumero,
      transaccion,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(
      `💳 Broadcast público: Pago confirmado para Mesa ${mesaNumero} — Recibo: ${transaccion?.nroRecibo}`,
    );
  }
}
