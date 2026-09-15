import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuditoriaService } from './auditoria.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('auditoria')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  @Roles('ADMIN')
  obtenerEventos(
    @Query('mesaNumero') mesaNumero?: string,
    @Query('tipoEvento') tipoEvento?: string,
    @Query('limit') limit?: string,
  ) {
    return this.auditoriaService.obtenerEventos({
      mesaNumero,
      tipoEvento,
      limit: limit ? parseInt(limit, 10) : 100,
    });
  }

  @Get('mesa/:mesaNumero')
  @Roles('ADMIN', 'MESERO', 'CAJERO')
  obtenerHistorialMesa(@Param('mesaNumero') mesaNumero: string) {
    return this.auditoriaService.obtenerHistorialMesa(mesaNumero);
  }
}
