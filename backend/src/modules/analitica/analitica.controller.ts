import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AnaliticaService } from './analitica.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('analitica')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AnaliticaController {
  constructor(private readonly analiticaService: AnaliticaService) {}

  @Get('resumen-hoy')
  @Roles('ADMIN', 'CAJERO', 'MESERO', 'CHEF')
  async getResumenHoy() {
    const data = await this.analiticaService.getResumenHoy();
    return { data };
  }
}
