import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AnaliticaController } from './analitica.controller';
import { AnaliticaService } from './analitica.service';

@Module({
  imports: [PrismaModule],
  controllers: [AnaliticaController],
  providers: [AnaliticaService],
  exports: [AnaliticaService],
})
export class AnaliticaModule {}
