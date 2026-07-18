import { Module } from '@nestjs/common';
import { CajaService } from './caja.service';
import { CajaController } from './caja.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { PedidosModule } from '../pedidos/pedidos.module';

@Module({
  imports: [PrismaModule, PedidosModule],
  controllers: [CajaController],
  providers: [CajaService],
  exports: [CajaService],
})
export class CajaModule {}
