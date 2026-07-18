import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EstadoMesa, EstadoPedido } from '@prisma/client';

@Injectable()
export class AnaliticaService {
  constructor(private readonly prisma: PrismaService) {}

  async getResumenHoy() {
    const hoy = new Date();
    const hace24Horas = new Date(hoy.getTime() - 24 * 60 * 60 * 1000);

    // 1. Total Recaudado (Suma de transacciones en las últimas 24h o de la caja activa)
    const sumResult = await this.prisma.transaccion.aggregate({
      _sum: {
        monto: true,
      },
      where: {
        OR: [
          {
            createdAt: {
              gte: hace24Horas,
            },
          },
          {
            caja: {
              estado: 'ABIERTA',
            },
          },
        ],
      },
    });
    const totalRecaudado = Number(sumResult._sum.monto || 0);

    // 2. Ocupación Actual del Salón (Mesas OCUPADA o POR_COBRAR vs Total Activas)
    const totalMesas = await this.prisma.mesa.count({
      where: { activa: true },
    });
    const mesasOcupadas = await this.prisma.mesa.count({
      where: {
        activa: true,
        estado: {
          in: [EstadoMesa.OCUPADA, EstadoMesa.POR_COBRAR],
        },
      },
    });
    const ocupacionPorcentaje = totalMesas > 0 ? Math.round((mesasOcupadas / totalMesas) * 100) : 0;
    const ocupacionActual = `${mesasOcupadas} / ${totalMesas} Mesas`;

    // 3. Comandas Activas (Pedidos en estado ABIERTO o EN_COCINA o LISTO)
    const comandasActivas = await this.prisma.pedido.count({
      where: {
        estado: {
          in: [EstadoPedido.ABIERTO, EstadoPedido.EN_COCINA, EstadoPedido.LISTO],
        },
      },
    });

    // 4. Plato Estrella (Más vendido en las últimas 24 horas)
    const topPlatos = await this.prisma.detallePedido.groupBy({
      by: ['platoId'],
      _sum: {
        cantidad: true,
      },
      where: {
        createdAt: {
          gte: hace24Horas,
        },
        pedido: {
          estado: {
            not: EstadoPedido.CANCELADO,
          },
        },
      },
      orderBy: {
        _sum: {
          cantidad: 'desc',
        },
      },
      take: 1,
    });

    let platoEstrella = 'Ninguno';
    let cantidadEstrella = 0;

    if (topPlatos.length > 0) {
      const platoInfo = await this.prisma.plato.findUnique({
        where: { id: topPlatos[0].platoId },
        select: { nombre: true },
      });
      if (platoInfo) {
        platoEstrella = platoInfo.nombre;
        cantidadEstrella = topPlatos[0]._sum.cantidad || 0;
      }
    }
    const platoEstrellaText = cantidadEstrella > 0 ? `${platoEstrella} (${cantidadEstrella} uds)` : 'Ninguno';

    // 5. Historial reciente del Live Feed (últimas 24 horas)
    const pedidosRecientes = await this.prisma.pedido.findMany({
      where: {
        createdAt: {
          gte: hace24Horas,
        },
      },
      include: {
        mesa: true,
        mesero: {
          select: { nombre: true },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 15,
    });

    const movimientos = [];
    for (const p of pedidosRecientes) {
      if (p.estado === EstadoPedido.ABIERTO || p.estado === EstadoPedido.EN_COCINA || p.estado === EstadoPedido.LISTO) {
        movimientos.push({
          id: `${p.id}-open`,
          mesa: p.mesa.numero,
          tipo: 'ABIERTO',
          descripcion: `Mesa ${p.mesa.numero} abierta - Nueva comanda enviada por ${p.mesero.nombre}`,
          timestamp: p.createdAt.toISOString(),
        });
      } else if (p.estado === EstadoPedido.ENTREGADO) {
        if (p.mesa.estado === EstadoMesa.POR_COBRAR) {
          movimientos.push({
            id: `${p.id}-collect`,
            mesa: p.mesa.numero,
            tipo: 'POR_COBRAR',
            descripcion: `Mesa ${p.mesa.numero} cambió a POR COBRAR - Cuenta solicitada por ${p.mesero.nombre}`,
            timestamp: p.updatedAt.toISOString(),
          });
        } else if (p.mesa.estado === EstadoMesa.LIBRE) {
          movimientos.push({
            id: `${p.id}-free`,
            mesa: p.mesa.numero,
            tipo: 'LIBERADA',
            descripcion: `Mesa ${p.mesa.numero} liberada - Pago registrado en Caja`,
            timestamp: p.updatedAt.toISOString(),
          });
        }
      }
    }

    return {
      kpis: {
        totalRecaudado,
        ocupacionActual,
        ocupacionPorcentaje,
        comandasActivas,
        platoEstrella: platoEstrellaText,
      },
      movimientos: movimientos.slice(0, 10), // Limit to top 10 elements
    };
  }
}
