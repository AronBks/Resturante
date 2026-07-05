import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MesasService } from './mesas.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { EstadoMesa } from '@prisma/client';

@Controller('mesas')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class MesasController {
  constructor(private readonly mesasService: MesasService) {}

  @Get()
  findAll() {
    return this.mesasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.mesasService.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  create(
    @Body()
    data: {
      numero: string;
      capacidad: number;
      posicion?: { x: number; y: number; rotacion?: number };
    },
  ) {
    return this.mesasService.create(data);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    data: {
      numero?: string;
      capacidad?: number;
      posicion?: { x: number; y: number; rotacion?: number };
    },
  ) {
    return this.mesasService.update(id, data);
  }

  @Patch(':id/estado')
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body('estado') estado: EstadoMesa,
  ) {
    return this.mesasService.cambiarEstado(id, estado);
  }

  @Patch(':id/toggle-active')
  @Roles('ADMIN')
  toggleActive(@Param('id', ParseIntPipe) id: number) {
    return this.mesasService.toggleActive(id);
  }
}
