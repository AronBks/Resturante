import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PedidosGateway } from './pedidos.gateway';
import { CrearPedidoDto } from './dto/crear-pedido.dto';
import {
  EstadoMesa,
  EstadoPedido,
  EstadoItemPedido,
  Prisma,
} from '@prisma/client';

@Injectable()
export class PedidosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PedidosGateway,
  ) {}

  /**
   * Crea un nuevo pedido para una mesa libre y cambia su estado a ocupada.
   */
  async crearPedido(meseroId: string, dto: CrearPedidoDto) {
    const { mesaId, items, notas } = dto;

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Verificar existencia y estado de la mesa
      const mesa = await tx.mesa.findUnique({ where: { id: mesaId } });
      if (!mesa || !mesa.activa) {
        throw new BadRequestException('La mesa seleccionada no existe o no está activa');
      }
      if (mesa.estado !== EstadoMesa.LIBRE) {
        throw new BadRequestException(`La mesa ${mesa.numero} no está disponible (Estado actual: ${mesa.estado})`);
      }

      const itemsDetalle: {
        platoId: string;
        cantidad: number;
        precioUnitario: number;
        notas?: string;
      }[] = [];
      let subtotal = 0;

      // 2. Validar disponibilidad de platos y guardar snapshots de precio
      for (const item of items) {
        const plato = await tx.plato.findUnique({
          where: { id: item.platoId },
        });

        if (!plato) {
          throw new NotFoundException(`El plato con ID ${item.platoId} no existe`);
        }
        if (!plato.disponible) {
          throw new BadRequestException(`El plato "${plato.nombre}" no está disponible temporalmente`);
        }

        const precioVenta = Number(plato.precioVenta);
        subtotal += precioVenta * item.cantidad;

        itemsDetalle.push({
          platoId: plato.id,
          cantidad: item.cantidad,
          precioUnitario: precioVenta,
          notas: item.notas,
        });
      }

      // 3. Crear el Pedido y sus Detalles
      const pedido = await tx.pedido.create({
        data: {
          subtotal: new Prisma.Decimal(subtotal),
          total: new Prisma.Decimal(subtotal),
          notas,
          mesaId,
          meseroId,
          estado: EstadoPedido.ABIERTO,
          detalles: {
            create: itemsDetalle.map((item) => ({
              cantidad: item.cantidad,
              precioUnitario: new Prisma.Decimal(item.precioUnitario),
              notas: item.notas,
              estadoItem: EstadoItemPedido.PENDIENTE,
              platoId: item.platoId,
            })),
          },
        },
        include: {
          detalles: {
            include: {
              plato: {
                select: { nombre: true, imagenUrl: true },
              },
            },
          },
          mesa: {
            select: { id: true, numero: true, estado: true },
          },
          mesero: {
            select: { nombre: true },
          },
        },
      });

      // 4. Actualizar el estado de la mesa a OCUPADA
      const mesaActualizada = await tx.mesa.update({
        where: { id: mesaId },
        data: { estado: EstadoMesa.OCUPADA },
        select: { id: true, estado: true },
      });

      return { pedido, mesaActualizada };
    });

    // 5. Notificaciones WebSocket en tiempo real
    this.gateway.broadcastNuevoPedido(result.pedido);
    this.gateway.broadcastMesaEstado(result.mesaActualizada.id, result.mesaActualizada.estado);

    return result.pedido;
  }

  /**
   * Obtiene todos los pedidos activos (que no estén entregados ni cancelados)
   */
  async obtenerPedidosActivos() {
    return this.prisma.pedido.findMany({
      where: {
        estado: {
          in: [EstadoPedido.ABIERTO, EstadoPedido.EN_COCINA, EstadoPedido.LISTO],
        },
      },
      include: {
        detalles: {
          include: {
            plato: {
              select: { nombre: true, imagenUrl: true },
            },
          },
        },
        mesa: {
          select: { id: true, numero: true, estado: true },
        },
        mesero: {
          select: { nombre: true },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Obtiene el historial de pedidos de una mesa
   */
  async obtenerPedidoActivoPorMesa(mesaId: number) {
    const mesa = await this.prisma.mesa.findUnique({ where: { id: mesaId } });
    if (!mesa || mesa.estado === EstadoMesa.LIBRE) {
      return null;
    }
    return this.prisma.pedido.findFirst({
      where: {
        mesaId,
        estado: {
          in: [EstadoPedido.ABIERTO, EstadoPedido.EN_COCINA, EstadoPedido.LISTO, EstadoPedido.ENTREGADO],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        detalles: {
          include: {
            plato: {
              select: { nombre: true, precioVenta: true },
            },
          },
        },
      },
    });
  }

  /**
   * Actualiza el estado de preparación de un plato individual en la comanda
   */
  async actualizarEstadoItem(pedidoId: string, itemId: string, nuevoEstado: EstadoItemPedido) {
    const item = await this.prisma.detallePedido.findUnique({
      where: { id: itemId },
      include: { pedido: true },
    });

    if (!item || item.pedidoId !== pedidoId) {
      throw new NotFoundException(`El item de comanda con ID ${itemId} no pertenece al pedido especificado`);
    }

    // Actualizar el estado del item
    const itemActualizado = await this.prisma.detallePedido.update({
      where: { id: itemId },
      data: { estadoItem: nuevoEstado },
    });

    // Difundir por WebSockets
    this.gateway.broadcastEstadoItem(pedidoId, itemId, nuevoEstado);

    // Actualizar el estado general del pedido automáticamente si corresponde
    const todosLosItems = await this.prisma.detallePedido.findMany({
      where: { pedidoId },
    });

    let nuevoEstadoPedido: EstadoPedido | null = null;

    if (nuevoEstado === EstadoItemPedido.PREPARANDO && item.pedido.estado === EstadoPedido.ABIERTO) {
      nuevoEstadoPedido = EstadoPedido.EN_COCINA;
    } else if (nuevoEstado === EstadoItemPedido.LISTO) {
      // Si todos los platos están LISTOS o CANCELADOS, el pedido pasa a LISTO
      const listosOCancelados = todosLosItems.every(
        (i) => i.estadoItem === EstadoItemPedido.LISTO || i.estadoItem === EstadoItemPedido.CANCELADO,
      );
      if (listosOCancelados && item.pedido.estado !== EstadoPedido.LISTO) {
        nuevoEstadoPedido = EstadoPedido.LISTO;
      }
    }

    if (nuevoEstadoPedido) {
      await this.actualizarEstadoPedido(pedidoId, nuevoEstadoPedido);
    }

    return itemActualizado;
  }

  /**
   * Actualiza el estado de un pedido completo
   */
  async actualizarEstadoPedido(pedidoId: string, nuevoEstado: EstadoPedido) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { mesa: true },
    });

    if (!pedido) {
      throw new NotFoundException(`El pedido con ID ${pedidoId} no existe`);
    }

    const pedidoActualizado = await this.prisma.pedido.update({
      where: { id: pedidoId },
      data: { estado: nuevoEstado },
    });

    // Difundir estado
    this.gateway.broadcastEstadoPedido(pedidoId, nuevoEstado);

    // Ajustar estado de la mesa según ciclo de vida del pedido
    let nuevoEstadoMesa: EstadoMesa | null = null;

    if (nuevoEstado === EstadoPedido.ENTREGADO) {
      nuevoEstadoMesa = EstadoMesa.POR_COBRAR;
    } else if (nuevoEstado === EstadoPedido.CANCELADO) {
      nuevoEstadoMesa = EstadoMesa.LIBRE;
    }

    if (nuevoEstadoMesa && pedido.mesa.estado !== nuevoEstadoMesa) {
      await this.prisma.mesa.update({
        where: { id: pedido.mesaId },
        data: { estado: nuevoEstadoMesa },
      });
      this.gateway.broadcastMesaEstado(pedido.mesaId, nuevoEstadoMesa);
    }

    return pedidoActualizado;
  }
}
