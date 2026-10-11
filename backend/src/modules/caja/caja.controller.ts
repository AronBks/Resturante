import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CajaService } from './caja.service';
import { RegistrarPagoDto } from './dto/registrar-pago.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('caja')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CajaController {
  private readonly logger = new Logger(CajaController.name);

  constructor(private readonly cajaService: CajaService) {}

  /**
   * Registra el pago de un pedido y libera la mesa.
   * Transacción atómica: Transaccion + Caja + Pedido + Mesa + WebSocket.
   */
  @Post('registrar-pago')
  @Roles('ADMIN', 'CAJERO')
  async registrarPago(
    @CurrentUser('id') cajeroId: string,
    @Body() dto: RegistrarPagoDto,
  ) {
    this.logger.log(
      `💳 Procesando pago: Pedido ${dto.pedidoId} | Método: ${dto.metodoPago}`,
    );
    return this.cajaService.registrarPago(cajeroId, dto);
  }

  /**
   * Consulta la caja abierta del usuario actual.
   */
  @Get('abierta')
  @Roles('ADMIN', 'CAJERO')
  async obtenerCajaAbierta(@CurrentUser('id') usuarioId: string) {
    return this.cajaService.obtenerCajaAbierta(usuarioId);
  }

  /**
   * Consulta el historial inmutable de transacciones cobradas hoy.
   */
  @Get('transacciones-hoy')
  @Roles('ADMIN', 'CAJERO')
  async obtenerTransaccionesHoy() {
    return this.cajaService.obtenerTransaccionesHoy();
  }

  /**
   * Abre un turno de caja indicando el fondo inicial de sencillo.
   */
  @Post('abrir')
  @Roles('ADMIN', 'CAJERO')
  async abrirCaja(
    @CurrentUser('id') usuarioId: string,
    @Body('montoApertura') montoApertura: number,
  ) {
    this.logger.log(`🟢 Apertura de caja solicitada con Bs. ${montoApertura}`);
    return this.cajaService.abrirCaja(usuarioId, Number(montoApertura || 0));
  }

  /**
   * Registra una salida de efectivo (gasto menor de caja chica).
   */
  @Post('egreso')
  @Roles('ADMIN', 'CAJERO')
  async registrarEgreso(
    @CurrentUser('id') usuarioId: string,
    @Body() dto: { monto: number; motivo: string; autoriza?: string },
  ) {
    this.logger.log(`➖ Registrando egreso de caja: Bs. ${dto.monto} — ${dto.motivo}`);
    return this.cajaService.registrarEgreso(usuarioId, dto);
  }

  /**
   * Obtiene el resumen consolidado de la caja activa actual en el sistema.
   */
  @Get('resumen-activa')
  @Roles('ADMIN', 'CAJERO')
  async obtenerCajaActivaConsolidada() {
    return this.cajaService.obtenerCajaActivaConsolidada();
  }

  /**
   * Obtiene el historial de turnos de caja cerrados con métricas de arqueo.
   */
  @Get('historial-cajas')
  @Roles('ADMIN', 'CAJERO')
  async obtenerHistorialCajas() {
    return this.cajaService.obtenerHistorialCajas();
  }

  /**
   * Cierra una caja abierta y registra el arqueo correspondiente.
   */
  @Post(':id/cerrar')
  @Roles('ADMIN', 'CAJERO')
  async cerrarCaja(
    @Param('id') cajaId: string,
    @Body('montoCierre') montoCierre: number,
    @Body('desgloseBilletes') desgloseBilletes?: any,
  ) {
    this.logger.log(`🔒 Cerrando caja ${cajaId} con arqueo físico de Bs. ${montoCierre}`);
    return this.cajaService.cerrarCaja(cajaId, Number(montoCierre), desgloseBilletes);
  }
}

