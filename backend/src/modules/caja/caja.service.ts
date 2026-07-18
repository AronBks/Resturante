import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PedidosGateway } from '../pedidos/pedidos.gateway';
import { RegistrarPagoDto } from './dto/registrar-pago.dto';
import {
  EstadoMesa,
  EstadoPedido,
  EstadoCaja,
  MetodoPago,
  Prisma,
} from '@prisma/client';

@Injectable()
export class CajaService {
  private readonly logger = new Logger(CajaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PedidosGateway,
  ) {}

  /**
   * Registra el pago de un pedido en una transacción atómica Prisma.
   * 1. Valida pedido cobrable
   * 2. Obtiene o crea caja del turno
   * 3. Crea Transaccion
   * 4. Actualiza acumuladores de caja
   * 5. Cambia pedido a ENTREGADO
   * 6. Libera mesa a LIBRE
   * 7. Emite WebSocket events
   */
  async registrarPago(cajeroId: string, dto: RegistrarPagoDto) {
    const { pedidoId, metodoPago, montoRecibido, nit, razonSocial } = dto;

    const result = await this.prisma.$transaction(async (tx) => {
      // ── 1. Buscar y validar pedido ──
      const pedido = await tx.pedido.findUnique({
        where: { id: pedidoId },
        include: {
          detalles: {
            include: { plato: { select: { nombre: true } } },
          },
          mesa: true,
          mesero: { select: { id: true, nombre: true } },
        },
      });

      if (!pedido) {
        throw new NotFoundException(`Pedido con ID ${pedidoId} no encontrado`);
      }

      const estadosCobrable: EstadoPedido[] = [EstadoPedido.LISTO, EstadoPedido.ENTREGADO];
      if (!estadosCobrable.includes(pedido.estado)) {
        throw new BadRequestException(
          `El pedido no está en estado cobrable (estado actual: ${pedido.estado})`,
        );
      }

      // ── 2. Obtener o auto-crear caja del turno ──
      let caja = await tx.caja.findFirst({
        where: { usuarioId: cajeroId, estado: EstadoCaja.ABIERTA },
      });

      if (!caja) {
        this.logger.warn(
          `Cajero ${cajeroId} sin caja abierta — creando turno automático con Bs. 0`,
        );
        caja = await tx.caja.create({
          data: {
            usuarioId: cajeroId,
            montoApertura: new Prisma.Decimal(0),
            estado: EstadoCaja.ABIERTA,
          },
        });
      }

      // ── 3. Calcular montos ──
      const subtotal = Number(pedido.total);
      const totalFinal = subtotal;
      const cambio =
        metodoPago === 'EFECTIVO'
          ? Math.max(0, montoRecibido - totalFinal)
          : 0;

      // ── 4. Crear registro de Transaccion ──
      const transaccion = await tx.transaccion.create({
        data: {
          monto: new Prisma.Decimal(totalFinal),
          metodoPago: metodoPago as MetodoPago,
          cambio: new Prisma.Decimal(cambio),
          nit: nit || null,
          razonSocial: razonSocial || null,
          cajaId: caja.id,
          pedidoId: pedido.id,
        },
      });

      // ── 5. Actualizar acumuladores de la Caja ──
      const incremento = new Prisma.Decimal(totalFinal);
      const cajaUpdate: any = {
        totalVentas: { increment: incremento },
      };
      if (metodoPago === 'EFECTIVO')
        cajaUpdate.totalEfectivo = { increment: incremento };
      if (metodoPago === 'TARJETA')
        cajaUpdate.totalTarjeta = { increment: incremento };
      if (metodoPago === 'QR')
        cajaUpdate.totalQr = { increment: incremento };

      await tx.caja.update({
        where: { id: caja.id },
        data: cajaUpdate,
      });

      // ── 6. Actualizar pedido a ENTREGADO si no lo está ──
      if (pedido.estado !== EstadoPedido.ENTREGADO) {
        await tx.pedido.update({
          where: { id: pedido.id },
          data: { estado: EstadoPedido.ENTREGADO },
        });
      }

      // ── 7. Liberar mesa ──
      await tx.mesa.update({
        where: { id: pedido.mesaId },
        data: { estado: EstadoMesa.LIBRE },
      });

      // ── 8. Generar número de recibo ──
      const hoy = new Date();
      const fechaStr = hoy.toISOString().slice(0, 10).replace(/-/g, '');
      const inicioDelDia = new Date(
        hoy.getFullYear(),
        hoy.getMonth(),
        hoy.getDate(),
      );
      const totalHoy = await tx.transaccion.count({
        where: { createdAt: { gte: inicioDelDia } },
      });
      const nroRecibo = `TKY-${fechaStr}-${String(totalHoy).padStart(3, '0')}`;

      // ── 9. Obtener nombre del cajero ──
      const cajero = await tx.usuario.findUnique({
        where: { id: cajeroId },
        select: { nombre: true },
      });

      return {
        transaccionId: transaccion.id,
        nroRecibo,
        fecha: transaccion.createdAt,
        mesa: { numero: pedido.mesa.numero, id: pedido.mesa.id },
        mesero: { nombre: pedido.mesero.nombre },
        cajero: { nombre: cajero?.nombre || 'Operador' },
        items: pedido.detalles.map((d) => ({
          nombre: d.plato.nombre,
          cantidad: d.cantidad,
          precioUnitario: Number(d.precioUnitario),
          subtotal: Number(d.precioUnitario) * d.cantidad,
          notas: d.notas,
        })),
        subtotal,
        descuento: 0,
        total: totalFinal,
        metodoPago,
        montoRecibido:
          metodoPago === 'EFECTIVO' ? montoRecibido : totalFinal,
        cambio,
        nit: transaccion.nit,
        razonSocial: transaccion.razonSocial,
      };
    });

    // ── Emitir eventos WebSocket (fuera de la transacción) ──
    this.gateway.broadcastMesaEstado(result.mesa.id, EstadoMesa.LIBRE);
    this.gateway.broadcastEstadoPedido(pedidoId, EstadoPedido.ENTREGADO);
    this.gateway.broadcastTransaccionCreada(result);
    this.logger.log(
      `✅ Pago registrado: ${result.nroRecibo} | Mesa ${result.mesa.numero} | Bs. ${result.total} | ${result.metodoPago}`,
    );

    return result;
  }

  /**
   * Consulta la caja abierta del usuario actual
   */
  async obtenerCajaAbierta(usuarioId: string) {
    return this.prisma.caja.findFirst({
      where: { usuarioId, estado: EstadoCaja.ABIERTA },
      include: {
        usuario: { select: { nombre: true, rol: true } },
        _count: { select: { transacciones: true } },
      },
    });
  }

  /**
   * Obtiene el listado inmutable de transacciones del día de hoy.
   * Filtra las transacciones creadas en las últimas 24 horas o asociadas a la caja activa.
   */
  async obtenerTransaccionesHoy() {
    const hoy = new Date();
    const veinticuatroHorasAtras = new Date(hoy.getTime() - 24 * 60 * 60 * 1000);

    const transacciones = await this.prisma.transaccion.findMany({
      where: {
        OR: [
          {
            createdAt: {
              gte: veinticuatroHorasAtras,
            },
          },
          {
            caja: {
              estado: EstadoCaja.ABIERTA,
            },
          },
        ],
      },

      include: {
        caja: {
          include: {
            usuario: {
              select: { nombre: true },
            },
          },
        },
        pedido: {
          include: {
            mesa: {
              select: { numero: true },
            },
            mesero: {
              select: { nombre: true },
            },
            detalles: {
              include: {
                plato: {
                  select: { nombre: true },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc', // Ascendente para asignar número de recibo correlativo por fecha
      },
    });

    const formatted = transacciones.map((t, idx) => {
      const subtotal = Number(t.pedido.subtotal);
      const total = Number(t.monto);
      const cambio = Number(t.cambio);
      const fechaStr = t.createdAt.toISOString().slice(0, 10).replace(/-/g, '');
      const nroRecibo = `TKY-${fechaStr}-${String(idx + 1).padStart(3, '0')}`;

      return {
        transaccionId: t.id,
        nroRecibo,
        fecha: t.createdAt.toISOString(),
        mesa: { numero: t.pedido.mesa.numero },
        mesero: { nombre: t.pedido.mesero.nombre },
        cajero: { nombre: t.caja.usuario.nombre },
        items: t.pedido.detalles.map((d) => ({
          nombre: d.plato.nombre,
          cantidad: d.cantidad,
          precioUnitario: Number(d.precioUnitario),
          subtotal: Number(d.precioUnitario) * d.cantidad,
          notas: d.notas,
        })),
        subtotal,
        descuento: 0,
        total,
        metodoPago: t.metodoPago,
        montoRecibido: t.metodoPago === 'EFECTIVO' ? total + cambio : total,
        cambio,
        nit: t.nit,
        razonSocial: t.razonSocial,
      };
    });

    // Invertir para mostrar primero las más recientes en el feed
    return formatted.reverse();
  }

  /**
   * Obtiene la consolidación de la caja abierta actualmente
   */
  async obtenerCajaActivaConsolidada() {
    const caja = await this.prisma.caja.findFirst({
      where: { estado: EstadoCaja.ABIERTA },
      include: {
        usuario: { select: { nombre: true } },
      },
      orderBy: { apertura: 'desc' },
    });

    if (!caja) {
      return null;
    }

    const totalVentas = Number(caja.totalVentas);
    const totalEfectivo = Number(caja.totalEfectivo);
    const totalTarjeta = Number(caja.totalTarjeta);
    const totalQr = Number(caja.totalQr);
    const montoApertura = Number(caja.montoApertura);
    const balanceCaja = montoApertura + totalEfectivo; // Dinero físico esperado en caja

    return {
      id: caja.id,
      montoApertura,
      totalVentas,
      totalEfectivo,
      totalTarjeta,
      totalQr,
      balanceCaja,
      estado: caja.estado,
      apertura: caja.apertura,
      cajero: caja.usuario.nombre,
    };
  }

  /**
   * Cierra una caja de forma atómica y calcula la discrepancia (arqueo)
   */
  async cerrarCaja(cajaId: string, montoCierre: number) {
    return this.prisma.$transaction(async (tx) => {
      const caja = await tx.caja.findUnique({
        where: { id: cajaId },
      });

      if (!caja) {
        throw new NotFoundException(`Caja con ID ${cajaId} no encontrada`);
      }

      if (caja.estado === EstadoCaja.CERRADA) {
        throw new BadRequestException('La caja ya se encuentra cerrada');
      }

      const totalEfectivo = Number(caja.totalEfectivo);
      const montoApertura = Number(caja.montoApertura);
      const balanceEsperado = montoApertura + totalEfectivo;
      const diferencia = montoCierre - balanceEsperado; // > 0: sobrante, < 0: faltante

      const cajaCerrada = await tx.caja.update({
        where: { id: cajaId },
        data: {
          estado: EstadoCaja.CERRADA,
          cierre: new Date(),
          montoCierre: new Prisma.Decimal(montoCierre),
        },
        include: {
          usuario: { select: { nombre: true } },
        },
      });

      const result = {
        cajaId: cajaCerrada.id,
        montoApertura: Number(cajaCerrada.montoApertura),
        montoCierre: Number(cajaCerrada.montoCierre),
        totalVentas: Number(cajaCerrada.totalVentas),
        totalEfectivo: Number(cajaCerrada.totalEfectivo),
        totalTarjeta: Number(cajaCerrada.totalTarjeta),
        totalQr: Number(cajaCerrada.totalQr),
        balanceEsperado,
        diferencia,
        cajero: cajaCerrada.usuario.nombre,
        cierre: cajaCerrada.cierre,
        estado: cajaCerrada.estado,
      };

      // Emitir evento por WebSockets fuera de la transacción
      setTimeout(() => {
        this.gateway.broadcastCajaCerrada(result);
      }, 0);

      return result;
    });
  }
}

