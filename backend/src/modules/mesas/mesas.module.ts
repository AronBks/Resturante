import { Module } from '@nestjs/common';
import { MesasService } from './mesas.service';
import { MesasController } from './mesas.controller';
import { PedidosModule } from '../pedidos/pedidos.module';

@Module({
  imports: [PedidosModule],
  controllers: [MesasController],
  providers: [MesasService],
  exports: [MesasService],
})
export class MesasModule {}
