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
      this.logger.error(`Error de autenticación en handshake de WebSocket: ${error.message}`);
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
      .to(`role:${RolUsuario.CHEF}`)
      .to(`role:${RolUsuario.MESERO}`)
      .to(`role:${RolUsuario.ADMIN}`)
      .to(`role:${RolUsuario.CAJERO}`)
      .emit('pedido:creado', pedido);
  }

  /**
   * Emite el cambio de estado global de un pedido
   */
  broadcastEstadoPedido(pedidoId: string, estado: string) {
    this.server.emit('pedido:estado-actualizado', { pedidoId, estado });
  }

  /**
   * Emite el cambio de estado de un item individual del pedido
   */
  broadcastEstadoItem(pedidoId: string, itemId: string, estado: string) {
    this.server.emit('item:estado-actualizado', { pedidoId, itemId, estado });
  }

  /**
   * Emite la actualización de estado de una mesa en tiempo real
   */
  broadcastMesaEstado(mesaId: number, estado: string) {
    this.server.emit('mesa:estado-actualizado', { mesaId, estado });
  }

  /**
   * Emite señal de que el menú cambió (debido a stock crítico)
   */
  broadcastMenuActualizado() {
    this.server.emit('menu:actualizado');
  }
}
