import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Logger } from '@nestjs/common';
import { RolUsuario } from '@prisma/client';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class PedidosGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PedidosGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        this.logger.warn(`Conexión rechazada: Token ausente (${socket.id})`);
        socket.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const user = await this.prisma.usuario.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, rol: true, nombre: true, activo: true },
      });

      if (!user || !user.activo) {
        this.logger.warn(`Conexión rechazada: Usuario inválido o inactivo (${socket.id})`);
        socket.disconnect();
        return;
      }

      // Guardamos la información del usuario en la metadata del socket
      socket.data.user = user;
      this.logger.log(`Cliente conectado: ${user.nombre} (${user.rol}) - ID: ${socket.id}`);

      // Unimos al usuario a una sala específica de su rol
      socket.join(`role:${user.rol}`);
    } catch (error) {
      if (error.name === 'TokenExpiredError' || error.message?.includes('expired')) {
        this.logger.warn(`Conexión WebSocket rechazada: Token expirado (${socket.id})`);
      } else {
        this.logger.error(`Error de autenticación en handshake de WebSocket: ${error.message}`);
      }
      socket.disconnect();
    }
  }

  handleDisconnect(socket: Socket) {
    const user = socket.data.user;
    if (user) {
      this.logger.log(`Cliente desconectado: ${user.nombre} (${user.rol}) - ID: ${socket.id}`);
    } else {
      this.logger.log(`Cliente anónimo desconectado: ID: ${socket.id}`);
    }
  }

  /**
   * Envía la comanda a todos los roles operativos involucrados
   */
  broadcastNuevoPedido(pedido: any) {
    this.server
      .to(`role:${RolUsuario.MESERO}`)
      .to(`role:${RolUsuario.ADMIN}`)
      .emit('pedido:creado', pedido);
  }

  /**
   * Emite el cambio de estado global de un pedido
   */
  broadcastEstadoPedido(pedidoId: string, estado: string) {
    this.server
      .to(`role:${RolUsuario.MESERO}`)
      .to(`role:${RolUsuario.ADMIN}`)
      .to(`role:${RolUsuario.CAJERO}`)
      .emit('pedido:estado-actualizado', { pedidoId, estado });
  }

  /**
   * Emite el cambio de estado de un item individual del pedido
   */
  broadcastEstadoItem(pedidoId: string, itemId: string, estado: string) {
    this.server
      .to(`role:${RolUsuario.MESERO}`)
      .to(`role:${RolUsuario.ADMIN}`)
      .emit('item:estado-actualizado', { pedidoId, itemId, estado });
  }

  /**
   * Emite la actualización de estado de una mesa en tiempo real
   */
  broadcastMesaEstado(mesaId: number, estado: string) {
    this.server
      .to(`role:${RolUsuario.MESERO}`)
      .to(`role:${RolUsuario.ADMIN}`)
      .to(`role:${RolUsuario.CAJERO}`)
      .emit('mesa:estado-actualizado', { mesaId, estado });
  }

  /**
   * Emite un pedido autónomo creado por IA al panel administrativo.
   * Incluye metadata especial para que el frontend muestre alerta diferenciada.
   */
  broadcastPedidoIA(pedido: any, mesaNumero: string) {
    const payload = {
      pedido,
      mesaNumero,
      esIA: true,
      timestamp: new Date().toISOString(),
    };

    this.server
      .to(`role:${RolUsuario.MESERO}`)
      .to(`role:${RolUsuario.ADMIN}`)
      .to(`role:${RolUsuario.CHEF}`)
      .emit('pedido:ia-creado', payload);

    this.logger.log(`🤖 Pedido IA emitido para Mesa ${mesaNumero}`);
  }

  /**
   * Emite la creación de una nueva transacción en tiempo real
   */
  broadcastTransaccionCreada(transaccion: any) {
    this.server
      .to(`role:${RolUsuario.ADMIN}`)
      .to(`role:${RolUsuario.CAJERO}`)
      .emit('transaccion:creada', transaccion);
    this.logger.log(`💳 Transacción emitida: ${transaccion.nroRecibo}`);
  }

  /**
   * Emite el evento de cierre de caja en tiempo real
   */
  broadcastCajaCerrada(data: any) {
    this.server
      .to(`role:${RolUsuario.ADMIN}`)
      .to(`role:${RolUsuario.CAJERO}`)
      .emit('caja:cerrada', data);
    this.logger.log(`🔒 Caja Cerrada emitida: ${data.cajaId}`);
  }
}

