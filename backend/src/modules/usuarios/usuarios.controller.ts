import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsuariosService } from './usuarios.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RolUsuario } from '@prisma/client';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

@Controller('usuarios')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @Roles('ADMIN')
  findAll() {
    return this.usuariosService.findAll();
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() createDto: CreateUsuarioDto) {
    return this.usuariosService.create(createDto);
  }

  @Get('por-rol')
  @Roles('ADMIN')
  findByRol(@Query('rol') rol: RolUsuario) {
    return this.usuariosService.findByRol(rol);
  }

  @Get(':id')
  @Roles('ADMIN')
  findOne(@Param('id') id: string) {
    return this.usuariosService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateUsuarioDto,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.usuariosService.update(id, updateDto, currentUserId);
  }

  @Patch(':id/toggle-active')
  @Roles('ADMIN')
  toggleActive(
    @Param('id') id: string,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.usuariosService.toggleActive(id, currentUserId);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(
    @Param('id') id: string,
    @CurrentUser('id') currentUserId: string,
  ) {
    return this.usuariosService.remove(id, currentUserId);
  }
}

