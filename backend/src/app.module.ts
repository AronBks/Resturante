import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { MesasModule } from './modules/mesas/mesas.module';
import { CartaModule } from './modules/carta/carta.module';

@Module({
  imports: [
    // Configuración de variables de entorno
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Base de datos
    PrismaModule,

    // Módulos de negocio
    AuthModule,
    UsuariosModule,
    MesasModule,
    CartaModule,
  ],
})
export class AppModule {}
