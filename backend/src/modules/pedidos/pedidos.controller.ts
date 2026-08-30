import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PedidosService } from './pedidos.service';
import { IaPedidosService } from './ia-pedidos.service';
import { PedidosGateway } from './pedidos.gateway';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CrearPedidoDto,
  ActualizarItemEstadoDto,
  ActualizarPedidoEstadoDto,
} from './dto/crear-pedido.dto';
import {
  InterpretarPedidoIaDto,
  ConfirmarPedidoIaDto,
} from './dto/ia-pedido.dto';
import { EstadoItemPedido, EstadoPedido } from '@prisma/client';

import { CartaGateway } from '../carta/carta.gateway';

@Controller('pedidos')
export class PedidosController {
  private readonly logger = new Logger(PedidosController.name);

  constructor(
    private readonly pedidosService: PedidosService,
    private readonly iaPedidosService: IaPedidosService,
    private readonly gateway: PedidosGateway,
    private readonly cartaGateway: CartaGateway,
  ) {}

  // ─────────────────────────────────────────────
  // ENDPOINTS PÚBLICOS — Pedidos Autónomos por IA
  // (Sin JWT — acceso desde client-app móvil)
  // ─────────────────────────────────────────────

  /**
   * Interpreta un pedido en lenguaje natural usando IA.
   * Devuelve los platos identificados con precios para confirmación.
   */
  @Post('ia')
  async interpretarPedidoIA(@Body() dto: InterpretarPedidoIaDto) {
    this.logger.log(`🤖 Interpretando pedido IA para Mesa ${dto.mesaNumero}: "${dto.texto}"`);

    // Verificar que la mesa existe
    const mesa = await this.iaPedidosService.resolverMesa(dto.mesaNumero);

    // Interpretar con IA (Don Beto)
    const resultado = await this.iaPedidosService.interpretarPedido(
      dto.texto,
      dto.historial || [],
      dto.comandaPrevia || [],
    );

    this.logger.log(
      `🤖 Don Beto (${resultado.motor}) | Estado: ${resultado.estadoConversacion} | Items: ${resultado.comandaActualizada.length} | Total: Bs. ${resultado.totalEstimado}`,
    );

    return {
      mesa: { numero: mesa.numero, estado: mesa.estado },
      ...resultado,
    };
  }

  /**
   * Confirma y registra un pedido autónomo por IA.
   * Crea la transacción en PostgreSQL, actualiza la mesa y dispara WebSockets.
   */
  @Post('ia/confirmar')
  async confirmarPedidoIA(@Body() dto: ConfirmarPedidoIaDto) {
    this.logger.log(`🤖 Confirmando pedido IA para Mesa ${dto.mesaNumero}`);

    const mesa = await this.iaPedidosService.resolverMesa(dto.mesaNumero);
    const meseroIaId = await this.iaPedidosService.obtenerUsuarioIA();

    // Reutilizar el flujo transaccional existente con flag esIA=true
    const pedido = await this.pedidosService.crearPedido(
      meseroIaId,
      {
        mesaId: mesa.id,
        items: dto.items,
        notas: `Pedido autónomo vía Asistente IA — Mesa ${dto.mesaNumero}`,
      },
      true, // esIA: habilita multi-ronda
    );

    // Emitir evento especial para toast de IA en el admin
    this.gateway.broadcastPedidoIA(pedido, mesa.numero);

    this.logger.log(`✅ Pedido IA confirmado para Mesa ${dto.mesaNumero} — ID: ${pedido.id}`);

    return pedido;
  }

  /**
   * Solicitud de atención presencial (Llamar al Mesero) desde la app del cliente.
   */
  @Post('llamar-mesero')
  async llamarMesero(@Body() dto: { mesaNumero: string; motivo?: string }) {
    this.logger.log(`🛎️ Solicitud de mesero para Mesa ${dto.mesaNumero}`);
    const mesa = await this.iaPedidosService.resolverMesa(dto.mesaNumero);
    const motivoTexto = dto.motivo || 'Atención presencial solicitada en mesa';

    // Persistir llamada pendiente en memoria del backend
    this.pedidosService.registrarLlamadaMesero(mesa.numero, motivoTexto);

    // Emitir alerta a todos los administradores y garzones
    this.gateway.broadcastLlamarMesero(mesa.numero, motivoTexto);

    return {
      exito: true,
      mensaje: `Mesero notificado para la Mesa ${mesa.numero}`,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('atender-mesero')
  async atenderMesero(@Body() dto: { mesaNumero: string }) {
    this.logger.log(`🏃‍♂️ Garzón en camino a la Mesa ${dto.mesaNumero}`);
    this.pedidosService.removerLlamadaMesero(dto.mesaNumero);
    this.gateway.broadcastMeseroAtendido(dto.mesaNumero);
    this.cartaGateway.broadcastMeseroAtendido(dto.mesaNumero);
    return {
      exito: true,
      mensaje: `Notificación enviada a la Mesa ${dto.mesaNumero}: Garzón en camino`,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('llamadas-mesero')
  obtenerLlamadasMesero() {
    return this.pedidosService.obtenerLlamadasMeseroPendientes();
  }

  /**
   * Consulta pública del pedido activo de una mesa para el Menú Digital (Client App)
   */
  @Get('publica/mesa/:mesaNumero/activo')
  async obtenerPedidoActivoPublico(@Param('mesaNumero') mesaNumero: string) {
    const pedido = await this.pedidosService.obtenerPedidoActivoPorNumeroMesa(mesaNumero);
    return {
      exito: true,
      pedidoActivo: pedido,
    };
  }

  // ─────────────────────────────────────────────
  // ENDPOINTS PROTEGIDOS — Panel Administrativo
  // ─────────────────────────────────────────────

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'MESERO')
  crear(
    @CurrentUser('id') userId: string,
    @Body() dto: CrearPedidoDto,
  ) {
    return this.pedidosService.crearPedido(userId, dto);
  }

  @Get('activos')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'CHEF', 'MESERO', 'CAJERO')
  obtenerActivos() {
    return this.pedidosService.obtenerPedidosActivos();
  }

  @Get('mesa/:mesaId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'CHEF', 'MESERO', 'CAJERO')
  obtenerPorMesa(@Param('mesaId') mesaId: string) {
    return this.pedidosService.obtenerPedidoActivoPorMesa(parseInt(mesaId, 10));
  }

  @Patch(':id/items/:itemId/estado')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'CHEF')
  actualizarEstadoItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: ActualizarItemEstadoDto,
  ) {
    return this.pedidosService.actualizarEstadoItem(
      id,
      itemId,
      dto.estado as EstadoItemPedido,
    );
  }

  @Post(':id/servir-todos')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'CHEF', 'MESERO')
  servirTodos(@Param('id') id: string) {
    return this.pedidosService.servirTodosLosItems(id);
  }

  @Patch(':id/estado')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'CHEF', 'MESERO', 'CAJERO')
  actualizarEstadoPedido(
    @Param('id') id: string,
    @Body() dto: ActualizarPedidoEstadoDto,
  ) {
    return this.pedidosService.actualizarEstadoPedido(
      id,
      dto.estado as EstadoPedido,
    );
  }
}

