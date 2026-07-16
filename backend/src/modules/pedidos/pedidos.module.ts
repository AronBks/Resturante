import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PedidosService } from './pedidos.service';
import { IaPedidosService } from './ia-pedidos.service';
import { PedidosController } from './pedidos.controller';
import { PedidosGateway } from './pedidos.gateway';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION') ?? '15m',
        } as any,
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [PedidosController],
  providers: [PedidosService, IaPedidosService, PedidosGateway],
  exports: [PedidosService, IaPedidosService, PedidosGateway],
})
export class PedidosModule {}

