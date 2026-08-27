import { Module } from '@nestjs/common';
import { CajaService } from './caja.service';
import { FacturacionService } from './facturacion.service';
import { CajaController } from './caja.controller';
import { FacturaPublicaController } from './factura-publica.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { PedidosModule } from '../pedidos/pedidos.module';

@Module({
  imports: [PrismaModule, PedidosModule],
  controllers: [CajaController, FacturaPublicaController],
  providers: [CajaService, FacturacionService],
  exports: [CajaService, FacturacionService],
})
export class CajaModule {}

