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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { CartaService } from './carta.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
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
      disponible?: boolean;
      variantes?: { nombre: string; precio: number; disponible?: boolean }[];
    },
  ) {
    return this.cartaService.createPlato(data);
  }

  @Post('imagen/upload')
  @Roles('ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImagenLocal(
    @UploadedFile()
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('No se recibió ningún archivo de imagen');
    }

    const allowedMimeTypes = ['image/webp', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Formato no permitido. Usa WebP, PNG o JPG.');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('La imagen no debe superar los 5 MB.');
    }

    const ext = file.mimetype === 'image/webp'
      ? 'webp'
      : file.mimetype === 'image/png'
        ? 'png'
        : 'jpg';
    const safeName = `plato-${Date.now()}.${ext}`;

    const platosDir = existsSync(join(process.cwd(), 'public'))
      ? join(process.cwd(), 'public', 'platos')
      : join(process.cwd(), 'backend', 'public', 'platos');

    await mkdir(platosDir, { recursive: true });
    await writeFile(join(platosDir, safeName), file.buffer);

    return { url: `/public/platos/${safeName}` };
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

  // ── GESTIÓN DE STOCK (ADMIN Y CAJERO) ──

  @Patch('platos/:id/stock')
  @Roles('ADMIN', 'CAJERO')
  actualizarStockPlato(
    @Param('id') id: string,
    @Body()
    body: {
      stockActual?: number | null;
      controlarStock?: boolean;
      stockMinimo?: number;
      motivo?: string;
    },
    @CurrentUser() usuario: any,
  ) {
    return this.cartaService.actualizarStockPlato(id, body, usuario);
  }

  @Post('stock/bulk')
  @Roles('ADMIN', 'CAJERO')
  reposicionMasivaStock(
    @Body()
    body: {
      items: Array<{
        platoId: string;
        stockActual: number;
        controlarStock?: boolean;
        stockMinimo?: number;
      }>;
      motivo?: string;
    },
    @CurrentUser() usuario: any,
  ) {
    return this.cartaService.reposicionMasivaStock(body.items, usuario, body.motivo);
  }
}
