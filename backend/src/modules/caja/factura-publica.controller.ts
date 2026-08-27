import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Logger,
} from '@nestjs/common';
import { FacturacionService } from './facturacion.service';
import { EmitirFacturaDigitalDto } from './dto/emitir-factura-digital.dto';

@Controller('caja/factura-digital')
export class FacturaPublicaController {
  private readonly logger = new Logger(FacturaPublicaController.name);

  constructor(private readonly facturacionService: FacturacionService) {}

  /**
   * Emisión automática de factura digital desde la carta interactiva (Cliente móvil).
   * Endpoint público (sin JWT) para permitir que los comensales generen su factura tras el pago.
   */
  @Post()
  async emitirFactura(@Body() dto: EmitirFacturaDigitalDto) {
    this.logger.log(
      `🧾 Solicitud de factura digital: Mesa ${dto.mesaNumero} | NIT: ${dto.nit} | Razón: ${dto.razonSocial}`,
    );
    return this.facturacionService.emitirFacturaDigital(dto);
  }
}
