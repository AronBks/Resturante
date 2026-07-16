import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EstadoMesa } from '@prisma/client';
import { PedidosGateway } from '../pedidos/pedidos.gateway';

@Injectable()
export class MesasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PedidosGateway,
  ) {}

  async findAll() {
    return this.prisma.mesa.findMany({
      where: { activa: true },
      include: {
        pedidos: {
          where: { estado: { in: ['ABIERTO', 'EN_COCINA', 'LISTO'] } },
          select: {
            id: true,
            estado: true,
            total: true,
            mesero: { select: { id: true, nombre: true } },
            createdAt: true,
          },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { numero: 'asc' },
    });
  }

  async findOne(id: number) {
    const mesa = await this.prisma.mesa.findUnique({
      where: { id },
      include: {
        pedidos: {
          where: { estado: { in: ['ABIERTO', 'EN_COCINA', 'LISTO'] } },
          include: {
            detalles: {
              include: { plato: { select: { nombre: true } } },
            },
            mesero: { select: { id: true, nombre: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!mesa) {
      throw new NotFoundException(`Mesa con ID ${id} no encontrada`);
    }

    return mesa;
  }

  async create(data: {
    numero: string;
    capacidad: number;
    posicion?: { x: number; y: number; rotacion?: number };
  }) {
    return this.prisma.mesa.create({
      data: {
        numero: data.numero,
        capacidad: data.capacidad,
        posicion: data.posicion
          ? JSON.stringify(data.posicion)
          : '{"x": 0, "y": 0, "rotacion": 0}',
      },
    });
  }

  async update(
    id: number,
    data: {
      numero?: string;
      capacidad?: number;
      posicion?: { x: number; y: number; rotacion?: number };
    },
  ) {
    await this.findOne(id);
    return this.prisma.mesa.update({
      where: { id },
      data: {
        ...data,
        posicion: data.posicion ? JSON.stringify(data.posicion) : undefined,
      },
    });
  }

  async cambiarEstado(id: number, estado: EstadoMesa) {
    await this.findOne(id);
    const mesaActualizada = await this.prisma.mesa.update({
      where: { id },
      data: { estado },
    });
    this.gateway.broadcastMesaEstado(id, estado);
    return mesaActualizada;
  }

  async toggleActive(id: number) {
    const mesa = await this.findOne(id);
    return this.prisma.mesa.update({
      where: { id },
      data: { activa: !mesa.activa },
    });
  }
}
