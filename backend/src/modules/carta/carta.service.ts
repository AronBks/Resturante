import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CartaService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Categorías ──

  async findAllCategorias() {
    return this.prisma.categoriaPlato.findMany({
      where: { activa: true },
      include: {
        platos: {
          where: { disponible: true },
          select: { id: true, nombre: true, precioVenta: true, imagenUrl: true },
          orderBy: { nombre: 'asc' },
        },
      },
      orderBy: { orden: 'asc' },
    });
  }

  async createCategoria(data: { nombre: string; descripcion?: string; orden?: number }) {
    return this.prisma.categoriaPlato.create({ data });
  }

  async updateCategoria(id: number, data: { nombre?: string; descripcion?: string; orden?: number }) {
    return this.prisma.categoriaPlato.update({ where: { id }, data });
  }

  // ── Platos ──

  async findAllPlatos(categoriaId?: number) {
    return this.prisma.plato.findMany({
      where: categoriaId ? { categoriaId, disponible: true } : { disponible: true },
      include: {
        categoria: { select: { id: true, nombre: true } },
        recetaDetalles: {
          include: {
            ingrediente: {
              select: { id: true, nombre: true, unidadMedida: true, precioUnitario: true },
            },
          },
        },
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOnePlato(id: string) {
    const plato = await this.prisma.plato.findUnique({
      where: { id },
      include: {
        categoria: { select: { id: true, nombre: true } },
        recetaDetalles: {
          include: {
            ingrediente: {
              select: { id: true, nombre: true, unidadMedida: true, stockActual: true, precioUnitario: true },
            },
          },
        },
      },
    });

    if (!plato) {
      throw new NotFoundException(`Plato con ID ${id} no encontrado`);
    }

    return plato;
  }

  async createPlato(data: {
    nombre: string;
    descripcion?: string;
    precioVenta: number;
    categoriaId: number;
    imagenUrl?: string;
  }) {
    return this.prisma.plato.create({
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion,
        precioVenta: data.precioVenta,
        categoriaId: data.categoriaId,
        imagenUrl: data.imagenUrl,
      },
      include: { categoria: { select: { nombre: true } } },
    });
  }

  async updatePlato(
    id: string,
    data: {
      nombre?: string;
      descripcion?: string;
      precioVenta?: number;
      categoriaId?: number;
      imagenUrl?: string;
      disponible?: boolean;
    },
  ) {
    await this.findOnePlato(id);
    return this.prisma.plato.update({
      where: { id },
      data,
      include: { categoria: { select: { nombre: true } } },
    });
  }

  async toggleDisponible(id: string) {
    const plato = await this.findOnePlato(id);
    return this.prisma.plato.update({
      where: { id },
      data: { disponible: !plato.disponible },
    });
  }
}
