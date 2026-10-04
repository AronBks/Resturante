import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PedidosGateway } from './pedidos.gateway';
import { CartaGateway } from '../carta/carta.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
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
    private readonly auditoriaService: AuditoriaService,
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

    // Registrar en auditoría
    await this.auditoriaService.registrarEvento({
      tipoEvento: 'LLAMADA_MESERO',
      mesaId,
      mesaNumero,
      canalOrigen: 'CLIENTE_DIGITAL',
      descripcion: `Comensal en Mesa ${mesaNumero} solicitó asistencia: "${motivo}"`,
      metadata: { motivo, esCobro },
    });
  }

  async removerLlamadaMesero(mesaNumero: string, meseroNombre?: string) {
    this.llamadasMeseroPendientes.delete(mesaNumero);

    // Registrar atención en auditoría
    await this.auditoriaService.registrarEvento({
      tipoEvento: 'MESERO_ATENDIO',
      mesaNumero,
      usuarioNombre: meseroNombre || 'Garzón de Turno',
      meseroResponsableNombre: meseroNombre || 'Garzón de Turno',
      descripcion: `Garzón ${meseroNombre || 'de turno'} acudió a atender la Mesa ${mesaNumero}`,
      metadata: { mesaNumero, atendidoPor: meseroNombre },
    });
  }

  async obtenerLlamadasMeseroPendientes() {
    const map = new Map<string, { mesaNumero: string; motivo: string; timestamp: string }>();

    // 1. Agregar las llamadas en memoria activa
    for (const [k, v] of this.llamadasMeseroPendientes.entries()) {
      map.set(k, v);
    }

    // 2. Reconstruir desde DB para mesas POR_COBRAR para resiliencia total ante reinicios
    try {
      const mesasPorCobrar = await this.prisma.mesa.findMany({
        where: { estado: EstadoMesa.POR_COBRAR, activa: true },
        include: {
          pedidos: {
            where: {
              estado: {
                in: [
                  EstadoPedido.ABIERTO,
                  EstadoPedido.EN_COCINA,
                  EstadoPedido.LISTO,
                  EstadoPedido.ENTREGADO,
                ],
              },
            },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      for (const m of mesasPorCobrar) {
        if (!map.has(m.numero)) {
          const ped = m.pedidos?.[0];
          let motivo = `Solicitud de Cuenta en Mesa ${m.numero}`;
          if (ped?.metodoPagoPreferido === 'EFECTIVO' && ped?.montoPagaCon) {
            const cambio = Math.max(0, Number(ped.montoPagaCon) - Number(ped.total));
            motivo = `💵 Mesa ${m.numero} paga en EFECTIVO con Bs. ${ped.montoPagaCon} — Llevar Bs. ${cambio.toFixed(2)} de cambio`;
          } else if (ped?.metodoPagoPreferido === 'QR') {
            motivo = `📱 Mesa ${m.numero} pide cuenta — Pago por QR`;
          }

          map.set(m.numero, {
            mesaNumero: m.numero,
            motivo,
            timestamp: (ped as any)?.cuentaSolicitadaAt ? new Date((ped as any).cuentaSolicitadaAt).toISOString() : new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      // Fallback a mapa en memoria si hay error de consulta
    }

    return Array.from(map.values());
  }

  /**
   * Helper privado para resolver una mesa por número flexible ('M01', '1', 'Mesa 1')
   */
  private async buscarMesaPorNumero(mesaNumero: string) {
    let mesa = await this.prisma.mesa.findUnique({
      where: { numero: mesaNumero },
      include: { meseroAsignado: { select: { id: true, nombre: true } } },
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
          include: { meseroAsignado: { select: { id: true, nombre: true } } },
        });
      }
    }
    return mesa;
  }

  /**
   * Solicitar la cuenta desde la app del comensal o mesero (Persistencia Real en DB).
   * Pone la mesa en POR_COBRAR, sella el timestamp cuentaSolicitadaAt y alerta al salón.
   */
  async solicitarCuenta(mesaNumero: string, metodoPago?: string, montoPagaCon?: number) {
    const mesa = await this.buscarMesaPorNumero(mesaNumero);
    if (!mesa) {
      throw new NotFoundException(`La mesa ${mesaNumero} no existe`);
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
        transacciones: { none: {} },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();

    if (pedido) {
      const nuevoMetodo = metodoPago || (pedido as any).metodoPagoPreferido || null;
      let nuevoMonto = (pedido as any).montoPagaCon;
      if (metodoPago?.toUpperCase() === 'QR') {
        nuevoMonto = null;
      } else if (montoPagaCon) {
        nuevoMonto = new Prisma.Decimal(montoPagaCon);
      }

      await (this.prisma.pedido as any).update({
        where: { id: pedido.id },
        data: {
          cuentaSolicitadaAt: now,
          metodoPagoPreferido: nuevoMetodo,
          montoPagaCon: nuevoMonto,
        },
      });
    }

    if (mesa.estado !== EstadoMesa.POR_COBRAR) {
      await this.prisma.mesa.update({
        where: { id: mesa.id },
        data: { estado: EstadoMesa.POR_COBRAR },
      });
      this.gateway.broadcastMesaEstado(mesa.id, EstadoMesa.POR_COBRAR);
    }

    let motivo = `Solicitud de Cuenta en Mesa ${mesa.numero}`;
    const metPref = metodoPago?.toUpperCase() || (pedido as any)?.metodoPagoPreferido?.toUpperCase();
    const pagCon = (metodoPago?.toUpperCase() === 'QR') ? null : (montoPagaCon || ((pedido as any)?.montoPagaCon ? Number((pedido as any).montoPagaCon) : null));

    if (metPref === 'EFECTIVO' && pagCon && pedido) {
      const cambio = Math.max(0, pagCon - Number(pedido.total));
      motivo = `💵 Mesa ${mesa.numero} paga en EFECTIVO con Bs. ${pagCon} — Llevar Bs. ${cambio.toFixed(2)} de cambio`;
    } else if (metPref === 'QR') {
      motivo = `📱 Mesa ${mesa.numero} pide cuenta — Pago por QR`;
    }

    await this.registrarLlamadaMesero(mesa.numero, motivo, mesa.id);
    this.gateway.broadcastLlamarMesero(mesa.numero, motivo);
    this.cartaGateway.broadcastCuentaSolicitada(mesa.numero);

    await this.auditoriaService.registrarEvento({
      tipoEvento: 'SOLICITUD_CUENTA',
      mesaId: mesa.id,
      mesaNumero: mesa.numero,
      canalOrigen: 'CLIENTE_DIGITAL',
      descripcion: `Comensal solicitó la cuenta en Mesa ${mesa.numero}: ${motivo}`,
      metadata: { metodoPago, montoPagaCon },
    });

    return {
      exito: true,
      mensaje: `Cuenta solicitada correctamente para Mesa ${mesa.numero}`,
      cuentaSolicitadaAt: now,
    };
  }

  /**
   * Entrega física de cuenta por parte del garzón (Endpoint Protegido).
   * Persiste cuentaEntregadaAt en DB y emite 'cuenta:entregada' al cliente para habilitar opciones de pago.
   */
  async entregarCuenta(mesaNumero: string, meseroNombre?: string, usuarioId?: string) {
    const mesa = await this.buscarMesaPorNumero(mesaNumero);
    if (!mesa) {
      throw new NotFoundException(`La mesa ${mesaNumero} no existe`);
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
        transacciones: { none: {} },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();

    if (pedido) {
      await (this.prisma.pedido as any).update({
        where: { id: pedido.id },
        data: {
          cuentaEntregadaAt: now,
          cuentaSolicitadaAt: (pedido as any).cuentaSolicitadaAt || now,
        },
      });
    }

    // Al entregar la cuenta, remover la llamada pendiente
    await this.removerLlamadaMesero(mesa.numero, meseroNombre);

    // Broadcast al cliente público (desbloquea Efectivo / QR en la pantalla)
    this.cartaGateway.broadcastCuentaEntregada(mesa.numero);

    // Broadcast a los paneles administrativos del restaurante
    this.gateway.broadcastCuentaEntregada(mesa.numero, meseroNombre);

    await this.auditoriaService.registrarEvento({
      tipoEvento: 'CUENTA_ENTREGADA',
      mesaId: mesa.id,
      mesaNumero: mesa.numero,
      usuarioId,
      usuarioNombre: meseroNombre || 'Personal de Salón',
      descripcion: `Personal ${meseroNombre || 'de salón'} entregó la cuenta físicamente a la Mesa ${mesa.numero}`,
      metadata: { mesaNumero: mesa.numero, meseroNombre },
    });

    return {
      exito: true,
      mensaje: `Cuenta entregada a Mesa ${mesa.numero}`,
      cuentaEntregadaAt: now,
    };
  }

  /**
   * Reabre la comanda de una mesa que estaba por cobrar.
   * Restablece la mesa a OCUPADA, borra cuentaSolicitadaAt y cuentaEntregadaAt,
   * y desbloquea el menú digital del cliente para que pueda ordenar más ítems.
   */
  async reabrirComanda(mesaNumero: string, meseroNombre?: string, usuarioId?: string, motivo?: string) {
    const mesa = await this.buscarMesaPorNumero(mesaNumero);
    if (!mesa) {
      throw new NotFoundException(`La mesa ${mesaNumero} no existe`);
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
        transacciones: { none: {} },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (pedido) {
      await (this.prisma.pedido as any).update({
        where: { id: pedido.id },
        data: {
          cuentaSolicitadaAt: null,
          cuentaEntregadaAt: null,
          metodoPagoPreferido: null,
          montoPagaCon: null,
        },
      });
    }

    // Regresar mesa a estado OCUPADA
    await this.prisma.mesa.update({
      where: { id: mesa.id },
      data: { estado: EstadoMesa.OCUPADA },
    });

    // Remover llamadas pendientes de mesero
    await this.removerLlamadaMesero(mesa.numero, meseroNombre);

    // Broadcast a la app cliente (desbloquea comanda y redirige a la carta)
    this.cartaGateway.broadcastComandaReabierta(mesa.numero);

    // Broadcast al salón
    this.gateway.broadcastMesaEstado(mesa.id, EstadoMesa.OCUPADA);
    this.gateway.broadcastComandaReabierta(mesa.numero, meseroNombre);

    await this.auditoriaService.registrarEvento({
      tipoEvento: 'COMANDA_REABIERTA',
      mesaId: mesa.id,
      mesaNumero: mesa.numero,
      usuarioId,
      usuarioNombre: meseroNombre || 'Personal de Salón',
      descripcion: `Personal ${meseroNombre || 'de salón'} reabrió la comanda de la Mesa ${mesa.numero} (${motivo || 'cliente continuará ordenando'})`,
      metadata: { mesaNumero: mesa.numero, meseroNombre, motivo },
    });

    return {
      exito: true,
      mensaje: `Comanda de Mesa ${mesa.numero} reabierta con éxito. La mesa vuelve a estar editable.`,
      estadoMesa: EstadoMesa.OCUPADA,
    };
  }

  /**
   * Notificación rápida del comensal indicando que pagará en efectivo y con qué billete.
   * Calcula el cambio exacto para que el garzón acuda con el dinero exacto en un solo viaje.
   */
  async notificarPagoEfectivo(mesaNumero: string, montoPagaCon: number) {
    const mesa = await this.buscarMesaPorNumero(mesaNumero);
    if (!mesa) {
      throw new NotFoundException(`La mesa ${mesaNumero} no existe`);
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
        transacciones: { none: {} },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!pedido) {
      throw new BadRequestException(`No hay comanda activa para la Mesa ${mesaNumero}`);
    }

    await (this.prisma.pedido as any).update({
      where: { id: pedido.id },
      data: {
        metodoPagoPreferido: 'EFECTIVO',
        montoPagaCon: new Prisma.Decimal(montoPagaCon),
      },
    });

    const total = Number(pedido.total);
    const cambio = Math.max(0, montoPagaCon - total);
    const motivo = `💵 Mesa ${mesa.numero} paga en EFECTIVO con Bs. ${montoPagaCon} — Llevar Bs. ${cambio.toFixed(2)} de cambio`;

    await this.registrarLlamadaMesero(mesa.numero, motivo, mesa.id);
    this.gateway.broadcastLlamarMesero(mesa.numero, motivo);
    this.gateway.broadcastMesaEstado(mesa.id, EstadoMesa.POR_COBRAR);

    return {
      exito: true,
      mensaje: `Preferencia de pago en efectivo registrada. Cambio estimado: Bs. ${cambio.toFixed(2)}`,
      cambio,
      montoPagaCon,
    };
  }

  /**
   * Crea un nuevo pedido para una mesa libre y cambia su estado a ocupada.
   * Si la mesa ya está OCUPADA, agrega los items al pedido activo existente
   * (soporte multi-ronda para pedidos autónomos por IA y pedidos POS).
   */
  async crearPedido(
    meseroId: string,
    dto: CrearPedidoDto,
    esIA = false,
    esAdmin = false,
    canalOrigen?: 'MESERO_POS' | 'IA_DON_BETO' | 'CLIENTE_DIGITAL',
  ) {
    const { mesaId, items, notas } = dto;
    const origenFinal = canalOrigen || (esIA ? 'IA_DON_BETO' : 'MESERO_POS');

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Verificar existencia y estado de la mesa
      const mesa = await tx.mesa.findUnique({
        where: { id: mesaId },
        include: { meseroAsignado: true },
      });
      if (!mesa || !mesa.activa) {
        throw new BadRequestException('La mesa seleccionada no existe o no está activa');
      }

      // Si la mesa está OCUPADA, agregar items al pedido activo (soporte multi-ronda para admin y para IA)
      if (mesa.estado === EstadoMesa.OCUPADA) {
        return this.agregarItemsAPedidoActivo(tx, mesaId, meseroId, items, notas, esAdmin, esIA, origenFinal);
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

      const platosStockModificado: { id: string; nombre: string; nuevoStock: number; disponible: boolean }[] = [];

      // 2. Validar disponibilidad de platos, stock y guardar snapshots de precio
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

        // ── CONTROL Y RESERVA ATÓMICA DE STOCK ──
        if (plato.controlarStock) {
          if (plato.stockActual !== null && plato.stockActual < item.cantidad) {
            throw new BadRequestException(
              plato.stockActual <= 0
                ? `Lo sentimos: El plato "${plato.nombre}" se acaba de agotar en cocina.`
                : `Stock insuficiente para "${plato.nombre}". Solicitó ${item.cantidad}, pero solo quedan ${plato.stockActual} porciones disponibles.`,
            );
          }

          const nuevoStock = (plato.stockActual ?? 0) - item.cantidad;

          await tx.plato.update({
            where: { id: plato.id },
            data: {
              stockActual: nuevoStock,
              disponible: true,
            },
          });

          platosStockModificado.push({
            id: plato.id,
            nombre: plato.nombre,
            nuevoStock,
            disponible: nuevoStock > 0,
          });
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

      // 3. Crear el Pedido y sus Detalles con canalOrigen
      const pedido = await tx.pedido.create({
        data: {
          subtotal: new Prisma.Decimal(subtotal),
          total: new Prisma.Decimal(subtotal),
          notas: esIA ? `[Pedido IA] ${notas || ''}`.trim() : notas,
          canalOrigen: origenFinal as any,
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
            select: { id: true, numero: true, estado: true, meseroAsignado: { select: { nombre: true } } },
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

      return { pedido, mesaActualizada, platosStockModificado };
    });

    // 5. Registrar en Auditoría Operativa
    const nombreMeseroResp = result.pedido.mesero?.nombre || 'Mesero';
    await this.auditoriaService.registrarEvento({
      tipoEvento: 'CREACION_PEDIDO',
      mesaId: result.mesaActualizada.id,
      mesaNumero: result.pedido.mesa?.numero,
      usuarioId: result.pedido.meseroId,
      usuarioNombre: nombreMeseroResp,
      rolUsuario: 'MESERO',
      meseroResponsableNombre: nombreMeseroResp,
      canalOrigen: origenFinal,
      descripcion:
        origenFinal === 'IA_DON_BETO'
          ? `Comanda autónoma registrada vía Don Beto IA en Mesa ${result.pedido.mesa?.numero} por Bs. ${Number(result.pedido.total).toFixed(2)} (Responsable de mesa: ${nombreMeseroResp})`
          : `Comanda creada en POS para Mesa ${result.pedido.mesa?.numero} por ${nombreMeseroResp} (Bs. ${Number(result.pedido.total).toFixed(2)})`,
      metadata: {
        pedidoId: result.pedido.id,
        canalOrigen: origenFinal,
        total: Number(result.pedido.total),
      },
    });

    // 6. Notificaciones WebSocket en tiempo real de Pedido y Mesa
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

    // 7. Sincronización instantánea de Stock a comensales y salón (Evita sobreventa)
    if (result.platosStockModificado && result.platosStockModificado.length > 0) {
      for (const sp of result.platosStockModificado) {
        if (this.cartaGateway) {
          this.cartaGateway.broadcastStock(sp.id, sp.nuevoStock, sp.disponible);
        }
        if (this.gateway?.server) {
          this.gateway.server.emit('plato:stock-actualizado', {
            platoId: sp.id,
            nuevoStock: sp.nuevoStock,
            disponible: sp.disponible,
          });
        }
        if (!sp.disponible) {
          await this.auditoriaService.registrarEvento({
            tipoEvento: 'STOCK_AGOTADO',
            mesaId: result.mesaActualizada.id,
            mesaNumero: result.pedido.mesa?.numero,
            usuarioNombre: 'Control de Stock',
            descripcion: `El plato "${sp.nombre}" se ha agotado en cocina tras la orden de la Mesa ${result.pedido.mesa?.numero}`,
            metadata: { platoId: sp.id, platoNombre: sp.nombre },
          });
        }
      }
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
    canalOrigen?: 'MESERO_POS' | 'IA_DON_BETO' | 'CLIENTE_DIGITAL',
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

    // ── CONGELAMIENTO ESTRICTO DE COMANDA ──
    // Si la cuenta ya fue solicitada o entregada, la comanda queda congelada (no se permiten más ítems)
    if (pedidoActivo && ((pedidoActivo as any).cuentaSolicitadaAt || (pedidoActivo as any).cuentaEntregadaAt)) {
      throw new BadRequestException(
        'La comanda de esta mesa se encuentra congelada en proceso de cobro. No es posible agregar más ítems mientras la cuenta esté solicitada o entregada.',
      );
    }

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

    const platosStockModificado: { id: string; nombre: string; nuevoStock: number; disponible: boolean }[] = [];

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

      // ── CONTROL Y RESERVA ATÓMICA DE STOCK ──
      if (plato.controlarStock) {
        if (plato.stockActual !== null && plato.stockActual < item.cantidad) {
          throw new BadRequestException(
            plato.stockActual <= 0
              ? `Lo sentimos: El plato "${plato.nombre}" se acaba de agotar en cocina.`
              : `Stock insuficiente para "${plato.nombre}". Solicitó ${item.cantidad}, pero solo quedan ${plato.stockActual} porciones disponibles.`,
          );
        }

        const nuevoStock = (plato.stockActual ?? 0) - item.cantidad;
        const sigueDisponible = nuevoStock > 0;

        await tx.plato.update({
          where: { id: plato.id },
          data: {
            stockActual: nuevoStock,
            disponible: sigueDisponible,
          },
        });

        platosStockModificado.push({
          id: plato.id,
          nombre: plato.nombre,
          nuevoStock,
          disponible: sigueDisponible,
        });
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
      select: { id: true, estado: true, numero: true },
    });

    // Registrar en auditoría la nueva ronda
    const respNombre = pedidoActualizado.mesero?.nombre || 'Mesero';
    await this.auditoriaService.registrarEvento({
      tipoEvento: 'ITEM_AGREGADO',
      mesaId,
      mesaNumero: mesa?.numero,
      usuarioId: pedidoActualizado.meseroId,
      usuarioNombre: respNombre,
      rolUsuario: 'MESERO',
      meseroResponsableNombre: respNombre,
      canalOrigen: esIA ? 'IA_DON_BETO' : 'MESERO_POS',
      descripcion: esIA
        ? `Nuevos platos agregados vía Don Beto IA a Mesa ${mesa?.numero} (+Bs. ${subtotalNuevo.toFixed(2)}) — Responsable: ${respNombre}`
        : `Nuevos platos agregados en POS a Mesa ${mesa?.numero} (+Bs. ${subtotalNuevo.toFixed(2)}) por ${respNombre}`,
      metadata: {
        pedidoId: pedidoActualizado.id,
        montoAgregado: subtotalNuevo,
        nuevoTotal: Number(pedidoActualizado.total),
      },
    });

    return { pedido: pedidoActualizado, mesaActualizada: mesa!, platosStockModificado };
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
    const mesa = await this.buscarMesaPorNumero(mesaNumero);

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
      cuentaSolicitada: !!(pedido as any).cuentaSolicitadaAt || mesa.estado === EstadoMesa.POR_COBRAR,
      cuentaSolicitadaAt: (pedido as any).cuentaSolicitadaAt || null,
      cuentaEntregada: !!(pedido as any).cuentaEntregadaAt,
      cuentaEntregadaAt: (pedido as any).cuentaEntregadaAt || null,
      metodoPagoPreferido: (pedido as any).metodoPagoPreferido || null,
      montoPagaCon: (pedido as any).montoPagaCon ? Number((pedido as any).montoPagaCon) : null,
      meseroAsignadoNombre: mesa.meseroAsignado?.nombre || null,
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
