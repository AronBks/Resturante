import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PedidosGateway } from './pedidos.gateway';
import { CrearPedidoDto } from './dto/crear-pedido.dto';
import {
  EstadoMesa,
  EstadoPedido,
  EstadoItemPedido,
  TipoMovimientoInventario,
  Prisma,
} from '@prisma/client';

@Injectable()
export class PedidosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PedidosGateway,
  ) {}

  /**
   * Crea un nuevo pedido descontando stock de ingredientes de forma transaccional.
   * Si un ingrediente cae por debajo del umbral crítico, desactiva automáticamente los platos.
   */
  async crearPedido(meseroId: string, dto: CrearPedidoDto) {
    const { mesaId, items, notas } = dto;

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Verificar existencia y estado de la mesa
      const mesa = await tx.mesa.findUnique({ where: { id: mesaId } });
      if (!mesa || !mesa.activa) {
        throw new BadRequestException('La mesa seleccionada no existe o no está activa');
      }
      if (mesa.estado === EstadoMesa.OCUPADA) {
        throw new BadRequestException(`La mesa ${mesa.numero} ya está ocupada`);
      }

      // Estructuras para consolidar los ingredientes necesarios y precios de venta
      const ingredientesAReducir: {
        [id: string]: {
          cantidad: number;
          nombre: string;
          stockActual: number;
          umbralCritico: number;
        };
      } = {};
      const itemsDetalle: {
        platoId: string;
        cantidad: number;
        precioUnitario: number;
        notas?: string;
      }[] = [];
      let subtotal = 0;

      // 2. Analizar cada plato y consolidar ingredientes necesarios
      for (const item of items) {
        const plato = await tx.plato.findUnique({
          where: { id: item.platoId },
          include: {
            recetaDetalles: {
              include: { ingrediente: true },
            },
          },
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

        // Recopilar ingredientes requeridos
        for (const detalle of plato.recetaDetalles) {
          const ing = detalle.ingrediente;
          const cantidadRequerida = Number(detalle.cantidadRequerida) * item.cantidad;

          if (!ingredientesAReducir[ing.id]) {
            ingredientesAReducir[ing.id] = {
              cantidad: 0,
              nombre: ing.nombre,
              stockActual: Number(ing.stockActual),
              umbralCritico: Number(ing.umbralCritico),
            };
          }
          ingredientesAReducir[ing.id].cantidad += cantidadRequerida;
        }
      }

      // 3. Validar disponibilidad de stock
      for (const ingId in ingredientesAReducir) {
        const ing = ingredientesAReducir[ingId];
        if (ing.stockActual < ing.cantidad) {
          throw new BadRequestException(
            `Stock insuficiente del ingrediente "${ing.nombre}" para preparar la comanda. ` +
              `(Requerido: ${ing.cantidad.toFixed(2)}, Disponible: ${ing.stockActual.toFixed(2)})`,
          );
        }
      }

      // 4. Reducir stock, registrar movimientos y desactivar platos si aplica (Inventario Crítico)
      let menuCambio = false;
      for (const ingId in ingredientesAReducir) {
        const ing = ingredientesAReducir[ingId];
        const nuevoStock = ing.stockActual - ing.cantidad;

        // Actualizar stock del ingrediente
        await tx.ingrediente.update({
          where: { id: ingId },
          data: { stockActual: nuevoStock },
        });

        // Registrar movimiento inmutable (Event Sourcing)
        await tx.movimientoInventario.create({
          data: {
            tipo: TipoMovimientoInventario.SALIDA_VENTA,
            cantidad: ing.cantidad,
            stockResultante: nuevoStock,
            ingredienteId: ingId,
            usuarioId: meseroId,
            referencia: `Comanda - Mesa ${mesa.numero}`,
          },
        });

        // Si cae por debajo del umbral crítico, desactivamos automáticamente los platos dependientes
        if (nuevoStock <= ing.umbralCritico) {
          const recetasConIngrediente = await tx.recetaDetalle.findMany({
            where: { ingredienteId: ingId },
            select: { platoId: true },
          });

          const platoIdsADesactivar = recetasConIngrediente.map((r) => r.platoId);
          if (platoIdsADesactivar.length > 0) {
            await tx.plato.updateMany({
              where: { id: { in: platoIdsADesactivar }, disponible: true },
              data: { disponible: false },
            });
            menuCambio = true;
          }
        }
      }

      // 5. Crear el Pedido y sus Detalles
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

      // 6. Actualizar el estado de la mesa a OCUPADA
      const mesaActualizada = await tx.mesa.update({
        where: { id: mesaId },
        data: { estado: EstadoMesa.OCUPADA },
        select: { id: true, estado: true },
      });

      return { pedido, mesaActualizada, menuCambio };
    });

    // 7. Notificaciones WebSocket en tiempo real (fuera de la transacción de base de datos)
    this.gateway.broadcastNuevoPedido(result.pedido);
    this.gateway.broadcastMesaEstado(result.mesaActualizada.id, result.mesaActualizada.estado);

    if (result.menuCambio) {
      this.gateway.broadcastMenuActualizado();
    }

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
    return this.prisma.pedido.findFirst({
      where: {
        mesaId,
        estado: {
          in: [EstadoPedido.ABIERTO, EstadoPedido.EN_COCINA, EstadoPedido.LISTO],
        },
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

    // Flujo inteligente: Actualizar el estado general del pedido automáticamente si corresponde
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
      // El pedido fue servido a la mesa, queda pendiente de pago
      nuevoEstadoMesa = EstadoMesa.POR_COBRAR;
    } else if (nuevoEstado === EstadoPedido.CANCELADO) {
      // Restaurar mesa si el pedido es cancelado
      nuevoEstadoMesa = EstadoMesa.LIBRE;
      
      // Restaurar stock de ingredientes de forma asíncrona
      await this.restaurarStockPorCancelacion(pedidoId);
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

  /**
   * Restaura stock de ingredientes en caso de cancelación del pedido
   */
  private async restaurarStockPorCancelacion(pedidoId: string) {
    try {
      const pedido = await this.prisma.pedido.findUnique({
        where: { id: pedidoId },
        select: { meseroId: true },
      });

      if (!pedido) return;

      const detalles = await this.prisma.detallePedido.findMany({
        where: { pedidoId },
        include: {
          plato: {
            include: {
              recetaDetalles: true,
            },
          },
        },
      });

      await this.prisma.$transaction(async (tx) => {
        for (const detalle of detalles) {
          if (detalle.estadoItem === EstadoItemPedido.CANCELADO) continue;

          for (const receta of detalle.plato.recetaDetalles) {
            const cantidadARestaurar = Number(receta.cantidadRequerida) * detalle.cantidad;

            // Obtener stock actual
            const ing = await tx.ingrediente.findUnique({
              where: { id: receta.ingredienteId },
            });

            if (ing) {
              const nuevoStock = Number(ing.stockActual) + cantidadARestaurar;

              await tx.ingrediente.update({
                where: { id: ing.id },
                data: { stockActual: nuevoStock },
              });

              // Registrar movimiento
              await tx.movimientoInventario.create({
                data: {
                  tipo: TipoMovimientoInventario.AJUSTE,
                  cantidad: cantidadARestaurar,
                  stockResultante: nuevoStock,
                  ingredienteId: ing.id,
                  usuarioId: pedido.meseroId, // Mesero asociado
                  referencia: `Cancelación de Pedido ${pedidoId}`,
                },
              });

              // Si el ingrediente vuelve a estar sobre el umbral crítico, restaurar disponibilidad del plato
              if (nuevoStock > Number(ing.umbralCritico)) {
                await tx.plato.update({
                  where: { id: receta.platoId },
                  data: { disponible: true },
                });
              }
            }
          }
        }
      });

      this.gateway.broadcastMenuActualizado();
    } catch (error) {
      // Registro silencioso de errores de restauración para evitar tumbar la respuesta HTTP
      console.error(`Error restaurando stock para pedido cancelado ${pedidoId}:`, error);
    }
  }
}
