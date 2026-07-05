import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PedidosService } from './pedidos.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CrearPedidoDto,
  ActualizarItemEstadoDto,
  ActualizarPedidoEstadoDto,
} from './dto/crear-pedido.dto';
import { EstadoItemPedido, EstadoPedido } from '@prisma/client';

@Controller('pedidos')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PedidosController {
  constructor(private readonly pedidosService: PedidosService) {}

  @Post()
  @Roles('ADMIN', 'MESERO')
  crear(
    @CurrentUser('id') userId: string,
    @Body() dto: CrearPedidoDto,
  ) {
    return this.pedidosService.crearPedido(userId, dto);
  }

  @Get('activos')
  @Roles('ADMIN', 'CHEF', 'MESERO', 'CAJERO')
  obtenerActivos() {
    return this.pedidosService.obtenerPedidosActivos();
  }

  @Get('mesa/:mesaId')
  @Roles('ADMIN', 'CHEF', 'MESERO', 'CAJERO')
  obtenerPorMesa(@Param('mesaId') mesaId: string) {
    return this.pedidosService.obtenerPedidoActivoPorMesa(parseInt(mesaId, 10));
  }

  @Patch(':id/items/:itemId/estado')
  @Roles('ADMIN', 'CHEF')
  actualizarEstadoItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: ActualizarItemEstadoDto,
  ) {
    return this.pedidosService.actualizarEstadoItem(
      id,
      itemId,
      dto.estado as EstadoItemPedido,
    );
  }

  @Patch(':id/estado')
  @Roles('ADMIN', 'CHEF', 'MESERO', 'CAJERO')
  actualizarEstadoPedido(
    @Param('id') id: string,
    @Body() dto: ActualizarPedidoEstadoDto,
  ) {
    return this.pedidosService.actualizarEstadoPedido(
      id,
      dto.estado as EstadoPedido,
    );
  }
}
