import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PedidosGateway } from './pedidos.gateway';
import { CartaGateway } from '../carta/carta.gateway';
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
    @Inject(forwardRef(() => CartaGateway))
    private readonly cartaGateway: CartaGateway,
  ) {}

  private llamadasMeseroPendientes = new Map<string, { mesaNumero: string; motivo: string; timestamp: string }>();

  async registrarLlamadaMesero(mesaNumero: string, motivo: string, mesaId?: number) {
    this.llamadasMeseroPendientes.set(mesaNumero, {
      mesaNumero,
      motivo,
      timestamp: new Date().toISOString(),
    });

    const esCobro =
      motivo.toLowerCase().includes('pago') ||
      motivo.toLowerCase().includes('cuenta') ||
      motivo.toLowerCase().includes('efectivo') ||
      motivo.toLowerCase().includes('qr');

    if (esCobro) {
      try {
        const mesa = mesaId
          ? await this.prisma.mesa.findUnique({ where: { id: mesaId } })
          : await this.prisma.mesa.findUnique({ where: { numero: mesaNumero } });

        if (mesa && mesa.estado !== EstadoMesa.POR_COBRAR) {
          await this.prisma.mesa.update({
            where: { id: mesa.id },
            data: { estado: EstadoMesa.POR_COBRAR },
          });
          this.gateway.broadcastMesaEstado(mesa.id, EstadoMesa.POR_COBRAR);
        }
      } catch (e) {
        // En caso de error en actualización de mesa, la llamada aún se registró
      }
    }
  }

  removerLlamadaMesero(mesaNumero: string) {
    this.llamadasMeseroPendientes.delete(mesaNumero);
  }

  obtenerLlamadasMeseroPendientes() {
    return Array.from(this.llamadasMeseroPendientes.values());
  }

  /**
   * Crea un nuevo pedido para una mesa libre y cambia su estado a ocupada.
   * Si la mesa ya está OCUPADA, agrega los items al pedido activo existente
   * (soporte multi-ronda para pedidos autónomos por IA y pedidos POS).
   */
  async crearPedido(meseroId: string, dto: CrearPedidoDto, esIA = false, esAdmin = false) {
    const { mesaId, items, notas } = dto;

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Verificar existencia y estado de la mesa
      const mesa = await tx.mesa.findUnique({ where: { id: mesaId } });
      if (!mesa || !mesa.activa) {
        throw new BadRequestException('La mesa seleccionada no existe o no está activa');
      }

      // Si la mesa está OCUPADA, agregar items al pedido activo (soporte multi-ronda para admin y para IA)
      if (mesa.estado === EstadoMesa.OCUPADA) {
        return this.agregarItemsAPedidoActivo(tx, mesaId, meseroId, items, notas, esAdmin, esIA);
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

        // Validación estricta de horario (ej. Caldos 09:00 - 13:00 / Platos 12:00 - 17:00)
        // En POS de administración y pedidos de Don Beto (esIA=true) se autoriza la comanda.
        if (!esAdmin && !esIA) {
          this.validarHorarioPlato(plato);
        }

        let precioVenta = Number(plato.precioVenta);
        let varianteNombreSnapshot: string | null = null;

        if (plato.variantes && plato.variantes.length > 0) {
          if (!item.varianteId) {
            throw new BadRequestException(`Debe especificar una variante (tamaño/porción) para el plato "${plato.nombre}"`);
          }
          const variante = plato.variantes.find((v) => v.id === item.varianteId);
          if (!variante) {
            throw new NotFoundException(`La variante con ID ${item.varianteId} no pertenece al plato o no existe`);
          }
          if (!variante.disponible) {
            throw new BadRequestException(`La variante "${variante.nombre}" del plato "${plato.nombre}" no está disponible`);
          }
          precioVenta = Number(variante.precio);
          varianteNombreSnapshot = variante.nombre;
        } else {
          if (item.varianteId) {
            throw new BadRequestException(`El plato "${plato.nombre}" no tiene variantes`);
          }
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
    this.gateway.broadcastEstadoPedido(result.pedido.id, result.pedido.estado);
    this.gateway.broadcastMesaEstado(result.mesaActualizada.id, result.mesaActualizada.estado);

    if (this.cartaGateway) {
      const mesaNumeroPublica =
        result.pedido.mesa?.numero ||
        result.mesaActualizada?.numero ||
        'M01';
      this.cartaGateway.broadcastEstadoPedidoPublico(
        result.pedido.id,
        mesaNumeroPublica,
        result.pedido.estado,
      );
    }

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
    esAdmin = false,
    esIA = false,
  ) {
    // Buscar pedido activo de esta mesa en cualquier estado no cancelado
    let pedidoActivo = await tx.pedido.findFirst({
      where: {
        mesaId,
        estado: {
          in: [
            EstadoPedido.ABIERTO,
            EstadoPedido.EN_COCINA,
            EstadoPedido.LISTO,
            EstadoPedido.ENTREGADO,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Si la mesa está ocupada pero no tenía pedido activo, creamos uno directamente
    if (!pedidoActivo) {
      pedidoActivo = await tx.pedido.create({
        data: {
          mesaId,
          meseroId,
          notas: esIA ? `[Pedido IA] ${notas || ''}`.trim() : notas,
          subtotal: 0,
          total: 0,
          estado: EstadoPedido.ABIERTO,
        },
      });
    }

    const itemsDetalle: {
      platoId: string;
      varianteId?: string;
      varianteNombreSnapshot?: string;
      cantidad: number;
      precioUnitario: number;
      notas?: string;
    }[] = [];
    let subtotalNuevo = 0;

    // Validar y crear los nuevos items
    for (const item of items) {
      const plato = await tx.plato.findUnique({
        where: { id: item.platoId },
        include: { variantes: true },
      });
      if (!plato) {
        throw new NotFoundException(`El plato con ID ${item.platoId} no existe`);
      }
      if (!plato.disponible) {
        throw new BadRequestException(`El plato "${plato.nombre}" no está disponible`);
      }

      // Validación estricta de horario solo para pedidos de clientes móviles por QR
      if (!esAdmin && !esIA) {
        this.validarHorarioPlato(plato);
      }

      let precio = Number(plato.precioVenta);
      let varianteNombreSnapshot: string | null = null;

      if (plato.variantes && plato.variantes.length > 0) {
        if (!item.varianteId) {
          throw new BadRequestException(`Debe especificar una variante (tamaño/porción) para el plato "${plato.nombre}"`);
        }
        const variante = plato.variantes.find((v: any) => v.id === item.varianteId);
        if (!variante) {
          throw new NotFoundException(`La variante con ID ${item.varianteId} no pertenece al plato o no existe`);
        }
        if (!variante.disponible) {
          throw new BadRequestException(`La variante "${variante.nombre}" del plato "${plato.nombre}" no está disponible`);
        }
        precio = Number(variante.precio);
        varianteNombreSnapshot = variante.nombre;
      } else {
        if (item.varianteId) {
          throw new BadRequestException(`El plato "${plato.nombre}" no tiene variantes`);
        }
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

    // Si el pedido ya estaba LISTO o ENTREGADO, ahora tiene platos nuevos pendientes,
    // por lo que debe volver a EN_COCINA para que cocina lo prepare de inmediato.
    let nuevoEstadoPedido = pedidoActivo.estado;
    if (
      pedidoActivo.estado === EstadoPedido.ENTREGADO ||
      pedidoActivo.estado === EstadoPedido.LISTO
    ) {
      nuevoEstadoPedido = EstadoPedido.EN_COCINA;
    }

    // Actualizar totales y estado del pedido
    const pedidoActualizado = await tx.pedido.update({
      where: { id: pedidoActivo.id },
      data: {
        estado: nuevoEstadoPedido,
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
   * Consulta el pedido activo de una mesa usando su identificador visible (ej: "M01", "1", "mesa-1") para la Carta Digital
   */
  async obtenerPedidoActivoPorNumeroMesa(mesaNumero: string) {
    let mesa = await this.prisma.mesa.findUnique({
      where: { numero: mesaNumero },
    });

    if (!mesa) {
      const match = mesaNumero.match(/\d+/);
      if (match) {
        const num = String(parseInt(match[0], 10)).padStart(2, '0');
        mesa = await this.prisma.mesa.findFirst({
          where: {
            OR: [
              { numero: `M${num}` },
              { numero: match[0] },
              { numero: `Mesa ${match[0]}` },
              { numero: `Mesa ${num}` },
            ],
          },
        });
      }
    }

    if (!mesa || mesa.estado === EstadoMesa.LIBRE) {
      return null;
    }

    const pedido = await this.prisma.pedido.findFirst({
      where: {
        mesaId: mesa.id,
        estado: {
          in: [
            EstadoPedido.ABIERTO,
            EstadoPedido.EN_COCINA,
            EstadoPedido.LISTO,
            EstadoPedido.ENTREGADO,
          ],
        },
        transacciones: {
          none: {},
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        detalles: {
          where: {
            estadoItem: { not: EstadoItemPedido.CANCELADO },
          },
          include: {
            plato: {
              select: { id: true, nombre: true, precioVenta: true, imagenUrl: true },
            },
          },
        },
      },
    });

    if (!pedido) return null;

    const pad = (n: number) => n.toString().padStart(2, '0');
    const createdDate = new Date(pedido.createdAt);
    const horaRecibido = `${pad(createdDate.getHours())}:${pad(createdDate.getMinutes())}`;
    const cocinaDate = new Date(createdDate.getTime() + 5 * 60000);
    const horaCocina = `${pad(cocinaDate.getHours())}:${pad(cocinaDate.getMinutes())}`;
    const randomNum = pedido.id.replace(/\D/g, '').slice(-4) || '1000';
    const codigoCmd = `CMD-${pedido.id.substring(0, 4).toUpperCase()}`;

    return {
      id: pedido.id,
      codigo: codigoCmd,
      ticket: `TK-${randomNum}`,
      mesaNumero: mesa.numero,
      estado: pedido.estado,
      horaRecibido,
      horaCocina,
      createdAt: pedido.createdAt,
      total: Number(pedido.total),
      subtotal: Number(pedido.subtotal),
      items: pedido.detalles.map((d) => ({
        id: d.id,
        platoId: d.platoId,
        varianteId: d.varianteId || undefined,
        varianteNombre: d.varianteNombreSnapshot || undefined,
        nombre: d.plato?.nombre || 'Plato',
        precioUnitario: Number(d.precioUnitario),
        cantidad: d.cantidad,
        notas: d.notas || '',
        estadoItem: d.estadoItem,
        imagenUrl: d.plato?.imagenUrl,
      })),
    };
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

    if (this.cartaGateway && item.pedido?.mesaId) {
      const mesaItem = await this.prisma.mesa.findUnique({
        where: { id: item.pedido.mesaId },
        select: { numero: true },
      });
      if (mesaItem?.numero) {
        this.cartaGateway.broadcastEstadoPedidoPublico(
          pedidoId,
          mesaItem.numero,
          item.pedido.estado,
        );
      }
    }

    // Actualizar el estado general del pedido automáticamente según los ítems activos
    const todosLosItems = await this.prisma.detallePedido.findMany({
      where: { pedidoId },
    });

    const itemsActivos = todosLosItems.filter(
      (i) => i.estadoItem !== EstadoItemPedido.CANCELADO,
    );

    let nuevoEstadoPedido: EstadoPedido | null = null;

    if (itemsActivos.length > 0) {
      const todosEntregados = itemsActivos.every(
        (i) => i.estadoItem === EstadoItemPedido.ENTREGADO,
      );
      const todosListosOEntregados = itemsActivos.every(
        (i) => i.estadoItem === EstadoItemPedido.LISTO || i.estadoItem === EstadoItemPedido.ENTREGADO,
      );
      const algunPreparandoOListo = itemsActivos.some(
        (i) =>
          i.estadoItem === EstadoItemPedido.PREPARANDO ||
          i.estadoItem === EstadoItemPedido.LISTO ||
          i.estadoItem === EstadoItemPedido.ENTREGADO,
      );
      const todosPendientes = itemsActivos.every(
        (i) => i.estadoItem === EstadoItemPedido.PENDIENTE,
      );

      if (todosEntregados) {
        nuevoEstadoPedido = EstadoPedido.ENTREGADO;
      } else if (todosListosOEntregados) {
        nuevoEstadoPedido = EstadoPedido.LISTO;
      } else if (algunPreparandoOListo) {
        nuevoEstadoPedido = EstadoPedido.EN_COCINA;
      } else if (todosPendientes) {
        nuevoEstadoPedido = EstadoPedido.ABIERTO;
      }
    }

    if (nuevoEstadoPedido && item.pedido.estado !== nuevoEstadoPedido) {
      await this.actualizarEstadoPedido(pedidoId, nuevoEstadoPedido);
    }

    return itemActualizado;
  }

  /**
   * Marca todos los items de un pedido como ENTREGADO (Servir Todo)
   */
  async servirTodosLosItems(pedidoId: string) {
    await this.prisma.detallePedido.updateMany({
      where: { pedidoId, estadoItem: { not: EstadoItemPedido.CANCELADO } },
      data: { estadoItem: EstadoItemPedido.ENTREGADO },
    });

    return this.actualizarEstadoPedido(pedidoId, EstadoPedido.ENTREGADO);
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

    // Difundir estado a admin y a la carta pública
    this.gateway.broadcastEstadoPedido(pedidoId, nuevoEstado);
    if (pedido.mesa?.numero) {
      this.cartaGateway.broadcastEstadoPedidoPublico(pedidoId, pedido.mesa.numero, nuevoEstado);
    }

    // Ajustar estado de la mesa según ciclo de vida del pedido
    let nuevoEstadoMesa: EstadoMesa | null = null;

    // Solo si el pedido es CANCELADO y no quedan otros pedidos activos, la mesa vuelve a LIBRE.
    // Cuando el pedido pasa a ENTREGADO, la mesa PERMANECE OCUPADA (los comensales están comiendo).
    // La mesa solo pasa a POR_COBRAR cuando el cliente solicita la cuenta o el personal emite pre-cuenta.
    if (nuevoEstado === EstadoPedido.CANCELADO) {
      const otrosPedidosActivos = await this.prisma.pedido.count({
        where: {
          mesaId: pedido.mesaId,
          id: { not: pedidoId },
          estado: {
            in: [
              EstadoPedido.ABIERTO,
              EstadoPedido.EN_COCINA,
              EstadoPedido.LISTO,
              EstadoPedido.ENTREGADO,
            ],
          },
        },
      });
      if (otrosPedidosActivos === 0) {
        nuevoEstadoMesa = EstadoMesa.LIBRE;
      }
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
   * Valida estrictamente si un plato está dentro de su ventana horaria permitida
   */
  private validarHorarioPlato(plato: { nombre: string; horaInicio: string | null; horaFin: string | null }) {
    if (!plato.horaInicio) return;
    try {
      const boliviaStr = new Date().toLocaleString('en-US', { timeZone: 'America/La_Paz', hour12: false });
      const boliviaDate = new Date(boliviaStr);
      const ahoraMin = boliviaDate.getHours() * 60 + boliviaDate.getMinutes();

      const [hI, mI] = plato.horaInicio.split(':').map(Number);
      const inicioMin = hI * 60 + mI;
      const [hF, mF] = (plato.horaFin || '23:59').split(':').map(Number);
      const finMin = hF * 60 + mF;

      if (ahoraMin < inicioMin || ahoraMin > finMin) {
        throw new BadRequestException(
          `El plato "${plato.nombre}" no se puede ordenar a esta hora. Su horario de servicio es de ${plato.horaInicio} a ${plato.horaFin || 'cierre'}.`
        );
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
    }
  }
}
