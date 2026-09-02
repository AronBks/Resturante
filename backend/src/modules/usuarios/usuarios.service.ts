import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RolUsuario } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.usuario.findMany({
      where: {
        rol: { not: 'CHEF' },
        email: { not: 'ia@tukuypaj.com' },
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    return user;
  }

  async findByRol(rol: RolUsuario) {
    return this.prisma.usuario.findMany({
      where: { rol, activo: true },
      select: { id: true, nombre: true, email: true, rol: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async create(data: CreateUsuarioDto) {
    if ((data.rol as string) === 'CHEF') {
      throw new BadRequestException('El rol de cocina/chef no está admitido en el sistema.');
    }

    const cleanEmail = data.email.trim().toLowerCase();
    const existing = await this.prisma.usuario.findUnique({
      where: { email: cleanEmail },
    });
    if (existing) {
      throw new ConflictException(`El correo electrónico ${cleanEmail} ya está registrado`);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    return this.prisma.usuario.create({
      data: {
        nombre: data.nombre.trim(),
        email: cleanEmail,
        passwordHash,
        rol: data.rol,
        activo: true,
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        createdAt: true,
      },
    });
  }

  async toggleActive(id: string, currentUserId?: string) {
    if (currentUserId && currentUserId === id) {
      throw new BadRequestException('Por seguridad, no puedes desactivar tu propia cuenta de administrador.');
    }

    const user = await this.findOne(id);

    // Si se va a desactivar un Administrador, verificar que quede al menos otro activo
    if (user.rol === RolUsuario.ADMIN && user.activo) {
      const activeAdmins = await this.prisma.usuario.count({
        where: { rol: RolUsuario.ADMIN, activo: true, id: { not: id } },
      });
      if (activeAdmins === 0) {
        throw new BadRequestException('Operación denegada: Debe existir al menos un Administrador activo en el sistema.');
      }
    }

    return this.prisma.usuario.update({
      where: { id },
      data: { activo: !user.activo },
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
      },
    });
  }

  async update(id: string, data: UpdateUsuarioDto, currentUserId?: string) {
    const user = await this.findOne(id);

    if ((data.rol as string) === 'CHEF') {
      throw new BadRequestException('El rol de cocina/chef no está admitido.');
    }

    // Si un admin intenta cambiarse a sí mismo de rol
    if (currentUserId && currentUserId === id && data.rol && data.rol !== RolUsuario.ADMIN) {
      throw new BadRequestException('No puedes revocar tu propio rol de Administrador.');
    }

    const updateData: any = {};
    if (data.nombre) updateData.nombre = data.nombre.trim();
    
    if (data.email) {
      const cleanEmail = data.email.trim().toLowerCase();
      if (cleanEmail !== user.email.toLowerCase()) {
        const emailExists = await this.prisma.usuario.findFirst({
          where: { email: cleanEmail, id: { not: id } },
        });
        if (emailExists) {
          throw new ConflictException(`El correo electrónico ${cleanEmail} ya está en uso por otro colaborador.`);
        }
        updateData.email = cleanEmail;
      }
    }

    if (data.rol) updateData.rol = data.rol;

    if (data.password) {
      if (data.password.length < 6) {
        throw new BadRequestException('La nueva contraseña debe tener un mínimo de 6 caracteres.');
      }
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(data.password, salt);
    }

    return this.prisma.usuario.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
      },
    });
  }

  async remove(id: string, currentUserId?: string) {
    if (currentUserId && currentUserId === id) {
      throw new BadRequestException('Por seguridad, no puedes dar de baja tu propia cuenta de administrador.');
    }

    const user = await this.findOne(id);

    if (user.rol === RolUsuario.ADMIN) {
      const activeAdmins = await this.prisma.usuario.count({
        where: { rol: RolUsuario.ADMIN, activo: true, id: { not: id } },
      });
      if (activeAdmins === 0) {
        throw new BadRequestException('No es posible dar de baja al único Administrador activo del restaurante.');
      }
    }

    try {
      return await this.prisma.usuario.delete({
        where: { id },
        select: { id: true, nombre: true },
      });
    } catch {
      // Si tiene historial en cajas o pedidos, aplicar soft-delete (desactivar acceso)
      return await this.prisma.usuario.update({
        where: { id },
        data: { activo: false },
        select: { id: true, nombre: true, activo: true },
      });
    }
  }
}

