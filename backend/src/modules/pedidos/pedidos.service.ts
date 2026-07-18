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
   * Si la mesa ya está OCUPADA, agrega los items al pedido activo existente
   * (soporte multi-ronda para pedidos autónomos por IA).
   */
  async crearPedido(meseroId: string, dto: CrearPedidoDto, esIA = false) {
    const { mesaId, items, notas } = dto;

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Verificar existencia y estado de la mesa
      const mesa = await tx.mesa.findUnique({ where: { id: mesaId } });
      if (!mesa || !mesa.activa) {
        throw new BadRequestException('La mesa seleccionada no existe o no está activa');
      }

      // Si la mesa está OCUPADA y es un pedido IA, agregar items al pedido activo
      if (mesa.estado === EstadoMesa.OCUPADA && esIA) {
        return this.agregarItemsAPedidoActivo(tx, mesaId, meseroId, items, notas);
      }

      // Para pedidos manuales, la mesa debe estar LIBRE
      if (mesa.estado !== EstadoMesa.LIBRE && !esIA) {
        throw new BadRequestException(`La mesa ${mesa.numero} no está disponible (Estado actual: ${mesa.estado})`);
      }

      // Si la mesa está POR_COBRAR, no se puede agregar nada
      if (mesa.estado === EstadoMesa.POR_COBRAR) {
        throw new BadRequestException(`La mesa ${mesa.numero} está pendiente de cobro.`);
      }

      const itemsDetalle: {
        platoId: string;
        varianteId?: string;
        varianteNombreSnapshot?: string;
        cantidad: number;
        precioUnitario: number;
        notas?: string;
      }[] = [];
      let subtotal = 0;

      // 2. Validar disponibilidad de platos y guardar snapshots de precio
      for (const item of items) {
        const plato = await tx.plato.findUnique({
          where: { id: item.platoId },
          include: { variantes: true },
        });

        if (!plato) {
          throw new NotFoundException(`El plato con ID ${item.platoId} no existe`);
        }
        if (!plato.disponible) {
          throw new BadRequestException(`El plato "${plato.nombre}" no está disponible temporalmente`);
        }

        let precioVenta = Number(plato.precioVenta);
        let varianteNombreSnapshot: string | null = null;

        if (item.varianteId) {
          const variante = plato.variantes.find((v) => v.id === item.varianteId);
          if (!variante) {
            throw new NotFoundException(`La variante con ID ${item.varianteId} no pertenece al plato o no existe`);
          }
          if (!variante.disponible) {
            throw new BadRequestException(`La variante "${variante.nombre}" del plato "${plato.nombre}" no está disponible`);
          }
          precioVenta = Number(variante.precio);
          varianteNombreSnapshot = variante.nombre;
        }

        subtotal += precioVenta * item.cantidad;

        itemsDetalle.push({
          platoId: plato.id,
          varianteId: item.varianteId,
          varianteNombreSnapshot: varianteNombreSnapshot || undefined,
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
          notas: esIA ? `[Pedido IA] ${notas || ''}`.trim() : notas,
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
              varianteId: item.varianteId || null,
              varianteNombreSnapshot: item.varianteNombreSnapshot || null,
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
   * Agrega items a un pedido activo existente (multi-ronda IA).
   */
  private async agregarItemsAPedidoActivo(
    tx: any,
    mesaId: number,
    meseroId: string,
    items: { platoId: string; varianteId?: string; cantidad: number; notas?: string }[],
    notas?: string,
  ) {
    // Buscar pedido activo de esta mesa
    const pedidoActivo = await tx.pedido.findFirst({
      where: {
        mesaId,
        estado: { in: [EstadoPedido.ABIERTO, EstadoPedido.EN_COCINA] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!pedidoActivo) {
      throw new BadRequestException('No se encontró un pedido activo para esta mesa.');
    }

    let subtotalNuevo = 0;

    // Validar y crear los nuevos items
    for (const item of items) {
      const plato = await tx.plato.findUnique({
        where: { id: item.platoId },
        include: { variantes: true },
      });
      if (!plato || !plato.disponible) continue;

      let precio = Number(plato.precioVenta);
      let varianteNombreSnapshot: string | null = null;

      if (item.varianteId) {
        const variante = plato.variantes.find((v: any) => v.id === item.varianteId);
        if (!variante || !variante.disponible) continue;
        precio = Number(variante.precio);
        varianteNombreSnapshot = variante.nombre;
      }

      subtotalNuevo += precio * item.cantidad;

      await tx.detallePedido.create({
        data: {
          pedidoId: pedidoActivo.id,
          platoId: item.platoId,
          varianteId: item.varianteId || null,
          varianteNombreSnapshot: varianteNombreSnapshot,
          cantidad: item.cantidad,
          precioUnitario: new Prisma.Decimal(precio),
          notas: item.notas || null,
          estadoItem: EstadoItemPedido.PENDIENTE,
        },
      });
    }

    // Actualizar totales del pedido
    const pedidoActualizado = await tx.pedido.update({
      where: { id: pedidoActivo.id },
      data: {
        subtotal: { increment: new Prisma.Decimal(subtotalNuevo) },
        total: { increment: new Prisma.Decimal(subtotalNuevo) },
        notas: notas
          ? `${pedidoActivo.notas || ''}\n[Ronda IA] ${notas}`.trim()
          : pedidoActivo.notas,
      },
      include: {
        detalles: {
          include: { plato: { select: { nombre: true, imagenUrl: true } } },
        },
        mesa: { select: { id: true, numero: true, estado: true } },
        mesero: { select: { nombre: true } },
      },
    });

    const mesa = await tx.mesa.findUnique({
      where: { id: mesaId },
      select: { id: true, estado: true },
    });

    return { pedido: pedidoActualizado, mesaActualizada: mesa! };
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
