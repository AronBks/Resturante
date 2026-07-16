import { Module, forwardRef } from '@nestjs/common';
import { CartaService } from './carta.service';
import { CartaController } from './carta.controller';
import { CartaPublicaController } from './carta-publica.controller';
import { CartaGateway } from './carta.gateway';
import { PedidosModule } from '../pedidos/pedidos.module';

@Module({
  imports: [forwardRef(() => PedidosModule)],
  controllers: [CartaController, CartaPublicaController],
  providers: [CartaService, CartaGateway],
  exports: [CartaService, CartaGateway],
})
export class CartaModule {}
