import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CartaGateway } from './carta.gateway';
import { PedidosGateway } from '../pedidos/pedidos.gateway';

@Injectable()
export class CartaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartaGateway: CartaGateway,
    @Inject(forwardRef(() => PedidosGateway))
    private readonly pedidosGateway: PedidosGateway,
  ) {}

  // ── Categorías ──

  async findAllCategorias() {
    return this.prisma.categoriaPlato.findMany({
      where: { activa: true },
      include: {
        platos: {
          select: { id: true, nombre: true, precioVenta: true, imagenUrl: true, disponible: true },
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
      where: categoriaId ? { categoriaId } : {},
      include: {
        categoria: { select: { id: true, nombre: true } },
        variantes: {
          select: {
            id: true,
            nombre: true,
            precio: true,
            disponible: true,
          },
          orderBy: { precio: 'asc' },
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
    const updated = await this.prisma.plato.update({
      where: { id },
      data,
      include: { categoria: { select: { nombre: true } } },
    });

    // 📡 Notificar actualización en tiempo real
    this.cartaGateway.server.emit('menu:actualizado', { platoId: id, imagenUrl: updated.imagenUrl });
    this.pedidosGateway.server.emit('menu:actualizado', { platoId: id, imagenUrl: updated.imagenUrl });

    return updated;
  }

  async updateImagenPlato(id: string, imagenUrl: string) {
    await this.findOnePlato(id);
    const updated = await this.prisma.plato.update({
      where: { id },
      data: { imagenUrl },
      include: { categoria: { select: { nombre: true } } },
    });

    // 📡 Broadcast al namespace público (/publica) — Client-App (Menú Digital)
    if (this.cartaGateway.server) {
      this.cartaGateway.server.emit('menu:actualizado', {
        platoId: id,
        imagenUrl: updated.imagenUrl,
      });
      this.cartaGateway.broadcastDisponibilidad(id, updated.disponible);
    }

    // 📡 Broadcast al namespace autenticado — Admin-App (meseros, admin)
    if (this.pedidosGateway.server) {
      this.pedidosGateway.server.emit('menu:actualizado', {
        platoId: id,
        imagenUrl: updated.imagenUrl,
      });
    }

    return updated;
  }

  async toggleDisponible(id: string) {
    const plato = await this.findOnePlato(id);
    const updated = await this.prisma.plato.update({
      where: { id },
      data: { disponible: !plato.disponible },
    });

    // 📡 Broadcast al namespace público (/publica) — Client-App
    this.cartaGateway.broadcastDisponibilidad(id, updated.disponible);

    // 📡 Broadcast al namespace autenticado — Admin-App (meseros, admin)
    this.pedidosGateway.server.emit('menu:actualizado', {
      platoId: id,
      disponible: updated.disponible,
    });

    return updated;
  }

  async toggleVarianteDisponible(id: string) {
    const variante = await this.prisma.variantePlato.findUnique({
      where: { id },
      select: { disponible: true, platoId: true },
    });
    if (!variante) {
      throw new NotFoundException('Variante no encontrada');
    }

    const updated = await this.prisma.variantePlato.update({
      where: { id },
      data: { disponible: !variante.disponible },
    });

    // 📡 Broadcast al namespace público (/publica) — Client-App
    this.cartaGateway.broadcastDisponibilidad(updated.platoId, true);

    // 📡 Broadcast al namespace autenticado — Admin-App (meseros, admin)
    this.pedidosGateway.server.emit('menu:actualizado', {
      platoId: updated.platoId,
      varianteId: id,
      disponible: updated.disponible,
    });

    return updated;
  }

  async updateVariantePrecio(id: string, precio: number) {
    const variante = await this.prisma.variantePlato.findUnique({
      where: { id },
      select: { platoId: true },
    });
    if (!variante) {
      throw new NotFoundException('Variante no encontrada');
    }

    const updated = await this.prisma.variantePlato.update({
      where: { id },
      data: { precio },
    });

    // 📡 Broadcast al namespace público (/publica) — Client-App
    this.cartaGateway.broadcastDisponibilidad(updated.platoId, true);

    // 📡 Broadcast al namespace autenticado — Admin-App (meseros, admin)
    this.pedidosGateway.server.emit('menu:actualizado', {
      platoId: updated.platoId,
      varianteId: id,
      precio: updated.precio,
    });

    return updated;
  }

  // ── Carta Pública (Client-App — Menú Digital) ──

  /**
   * Retorna la carta optimizada para consumo público:
   * - Solo categorías activas con al menos un plato disponible
   * - Solo platos con disponible: true
   * - Sin campos sensibles (costoReceta, timestamps internos)
   * - Ordenada por el campo 'orden' de la categoría
   */
  async findCartaPublica() {
    return this.prisma.categoriaPlato.findMany({
      where: {
        activa: true,
        platos: { some: { disponible: true } },
      },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        platos: {
          where: { disponible: true },
          select: {
            id: true,
            nombre: true,
            descripcion: true,
            precioVenta: true,
            imagenUrl: true,
            variantes: {
              where: { disponible: true },
              select: {
                id: true,
                nombre: true,
                precio: true,
                disponible: true,
              },
              orderBy: { precio: 'asc' },
            },
          },
          orderBy: { nombre: 'asc' },
        },
      },
      orderBy: { orden: 'asc' },
    });
  }
}
