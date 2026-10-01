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
   * Confirma y registra un pedido autónomo por IA o pedido público desde el menú digital interactivo.
   * Crea la transacción en PostgreSQL, actualiza la mesa y dispara WebSockets.
   */
  @Post('ia/confirmar')
  async confirmarPedidoIA(@Body() dto: ConfirmarPedidoIaDto) {
    const origenFinal = dto.canalOrigen || 'IA_DON_BETO';
    const esIA = origenFinal === 'IA_DON_BETO';

    this.logger.log(
      esIA
        ? `🤖 Confirmando pedido IA para Mesa ${dto.mesaNumero}`
        : `📱 Confirmando pedido digital interactivo para Mesa ${dto.mesaNumero}`
    );

    const mesa = await this.iaPedidosService.resolverMesa(dto.mesaNumero);
    const meseroResponsableId = await this.iaPedidosService.resolverMeseroResponsable(mesa);

    // Reutilizar el flujo transaccional existente con flags y canalOrigen adecuados
    const pedido = await this.pedidosService.crearPedido(
      meseroResponsableId,
      {
        mesaId: mesa.id,
        items: dto.items,
        notas: dto.notas || (esIA
          ? `Pedido autónomo vía Asistente IA — Mesa ${dto.mesaNumero}`
          : `Pedido interactivo Carta Digital — Mesa ${dto.mesaNumero}`),
      },
      true, // habilita multi-ronda
      false, // esAdmin
      origenFinal, // canalOrigen explícito
    );

    // Emitir evento especial para toast de IA en el admin solo si realmente proviene de IA
    if (esIA) {
      this.gateway.broadcastPedidoIA(pedido, mesa.numero);
    }

    const codigoCmd = `CMD-${pedido.id.substring(0, 4).toUpperCase()}`;

    return {
      ...pedido,
      codigo: codigoCmd,
      mesaNumero: mesa.numero,
    };
  }

  /**
   * Endpoint específico para pedidos confirmados directamente desde el menú digital interactivo.
   */
  @Post('publica/confirmar')
  async confirmarPedidoClienteDigital(@Body() dto: ConfirmarPedidoIaDto) {
    dto.canalOrigen = 'CLIENTE_DIGITAL';
    return this.confirmarPedidoIA(dto);
  }

  /**
   * Solicitud de la cuenta desde la app del cliente o mesa.
   */
  @Post('solicitar-cuenta')
  solicitarCuenta(@Body() dto: { mesaNumero: string; metodoPago?: string; montoPagaCon?: number }) {
    this.logger.log(`🧾 Solicitud formal de cuenta para Mesa ${dto.mesaNumero}`);
    return this.pedidosService.solicitarCuenta(dto.mesaNumero, dto.metodoPago, dto.montoPagaCon);
  }

  /**
   * Notificación de pago en efectivo con billete/monto con el que paga el comensal.
   */
  @Post('notificar-pago-efectivo')
  notificarPagoEfectivo(@Body() dto: { mesaNumero: string; montoPagaCon: number }) {
    this.logger.log(`💵 Mesa ${dto.mesaNumero} pagará en efectivo con Bs. ${dto.montoPagaCon}`);
    return this.pedidosService.notificarPagoEfectivo(dto.mesaNumero, dto.montoPagaCon);
  }

  /**
   * Endpoint estrictamente protegido para que el Garzón o Cajero confirme la entrega física de la cuenta.
   * Desbloquea de forma segura las opciones de cobro en el dispositivo del cliente.
   */
  @Post('entregar-cuenta')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'MESERO', 'CAJERO')
  entregarCuenta(
    @CurrentUser('id') userId: string,
    @CurrentUser('nombre') userName: string,
    @Body() dto: { mesaNumero: string; meseroNombre?: string },
  ) {
    const nombre = dto.meseroNombre || userName || 'Personal de Salón';
    this.logger.log(`🏃‍♂️ Cuenta entregada a Mesa ${dto.mesaNumero} por ${nombre}`);
    return this.pedidosService.entregarCuenta(dto.mesaNumero, nombre, userId);
  }

  /**
   * Endpoint protegido para que el Garzón o Administrador desbloquee y reabra una comanda.
   * Cancela la solicitud de cuenta y permite a los comensales ordenar platos adicionales.
   */
  @Post('reabrir-comanda')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'MESERO', 'CAJERO')
  reabrirComanda(
    @CurrentUser('id') userId: string,
    @CurrentUser('nombre') userName: string,
    @Body() dto: { mesaNumero: string; motivo?: string },
  ) {
    const nombre = userName || 'Personal de Salón';
    this.logger.log(`🔓 Reapertura de comanda para Mesa ${dto.mesaNumero} solicitada por ${nombre}`);
    return this.pedidosService.reabrirComanda(dto.mesaNumero, nombre, userId, dto.motivo);
  }

  /**
   * Solicitud de atención presencial (Llamar al Mesero) desde la app del cliente.
   */
  @Post('llamar-mesero')
  async llamarMesero(@Body() dto: { mesaNumero: string; motivo?: string }) {
    this.logger.log(`🛎️ Solicitud de mesero para Mesa ${dto.mesaNumero}`);
    const mesa = await this.iaPedidosService.resolverMesa(dto.mesaNumero);
    const motivoTexto = dto.motivo || 'Atención presencial solicitada en mesa';

    // Persistir llamada pendiente en memoria del backend y actualizar estado a POR_COBRAR si aplica
    await this.pedidosService.registrarLlamadaMesero(mesa.numero, motivoTexto, mesa.id);

    // Emitir alerta a todos los administradores y garzones
    this.gateway.broadcastLlamarMesero(mesa.numero, motivoTexto);

    return {
      exito: true,
      mensaje: `Mesero notificado para la Mesa ${mesa.numero}`,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('atender-mesero')
  async atenderMesero(@Body() dto: { mesaNumero: string; meseroNombre?: string }) {
    this.logger.log(`🏃‍♂️ Garzón en camino a la Mesa ${dto.mesaNumero}`);
    await this.pedidosService.removerLlamadaMesero(dto.mesaNumero, dto.meseroNombre);
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
  @Roles('ADMIN', 'MESERO', 'CAJERO')
  crear(
    @CurrentUser('id') userId: string,
    @Body() dto: CrearPedidoDto,
  ) {
    return this.pedidosService.crearPedido(userId, dto, false, true);
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
  @Roles('ADMIN', 'CHEF', 'MESERO')
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

