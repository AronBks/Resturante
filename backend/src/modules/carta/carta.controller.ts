import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CartaService } from './carta.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('carta')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CartaController {
  constructor(private readonly cartaService: CartaService) {}

  // ── Categorías ──

  @Get('categorias')
  findAllCategorias() {
    return this.cartaService.findAllCategorias();
  }


  @Post('categorias')
  @Roles('ADMIN')
  createCategoria(
    @Body() data: { nombre: string; descripcion?: string; orden?: number },
  ) {
    return this.cartaService.createCategoria(data);
  }

  @Patch('categorias/:id')
  @Roles('ADMIN')
  updateCategoria(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { nombre?: string; descripcion?: string; orden?: number },
  ) {
    return this.cartaService.updateCategoria(id, data);
  }

  // ── Platos ──

  @Get('platos')
  findAllPlatos(@Query('categoriaId') categoriaId?: string) {
    return this.cartaService.findAllPlatos(
      categoriaId ? parseInt(categoriaId) : undefined,
    );
  }

  @Get('platos/:id')
  findOnePlato(@Param('id') id: string) {
    return this.cartaService.findOnePlato(id);
  }

  @Post('platos')
  @Roles('ADMIN')
  createPlato(
    @Body()
    data: {
      nombre: string;
      descripcion?: string;
      precioVenta: number;
      categoriaId: number;
      imagenUrl?: string;
    },
  ) {
    return this.cartaService.createPlato(data);
  }

  @Patch('platos/:id/imagen')
  @Roles('ADMIN')
  updateImagenPlato(
    @Param('id') id: string,
    @Body() body: { imagenUrl: string },
  ) {
    return this.cartaService.updateImagenPlato(id, body.imagenUrl);
  }

  @Patch('platos/:id')
  @Roles('ADMIN')
  updatePlato(
    @Param('id') id: string,
    @Body()
    data: {
      nombre?: string;
      descripcion?: string;
      precioVenta?: number;
      categoriaId?: number;
      imagenUrl?: string;
      disponible?: boolean;
    },
  ) {
    return this.cartaService.updatePlato(id, data);
  }

  @Patch('platos/:id/toggle-disponible')
  @Roles('ADMIN')
  toggleDisponible(@Param('id') id: string) {
    return this.cartaService.toggleDisponible(id);
  }

  @Patch('variantes/:id/toggle')
  @Roles('ADMIN')
  toggleVarianteDisponible(@Param('id') id: string) {
    return this.cartaService.toggleVarianteDisponible(id);
  }

  @Put('variantes/:id/precio')
  @Roles('ADMIN')
  updateVariantePrecio(
    @Param('id') id: string,
    @Body() body: { precio: number },
  ) {
    return this.cartaService.updateVariantePrecio(id, body.precio);
  }
}
