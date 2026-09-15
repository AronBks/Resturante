import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EstadoMesa } from '@prisma/client';
import { PedidosGateway } from '../pedidos/pedidos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';

@Injectable()
export class MesasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PedidosGateway,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  async findAll() {
    return this.prisma.mesa.findMany({
      where: { activa: true },
      include: {
        meseroAsignado: {
          select: { id: true, nombre: true, rol: true, email: true },
        },
        pedidos: {
          where: { estado: { in: ['ABIERTO', 'EN_COCINA', 'LISTO', 'ENTREGADO'] } },
          select: {
            id: true,
            estado: true,
            canalOrigen: true,
            total: true,
            subtotal: true,
            mesero: { select: { id: true, nombre: true } },
            createdAt: true,
            detalles: {
              select: {
                id: true,
                cantidad: true,
                precioUnitario: true,
                notas: true,
                estadoItem: true,
                plato: {
                  select: {
                    id: true,
                    nombre: true,
                    categoria: { select: { id: true, nombre: true } },
                  },
                },
              },
            },
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
        meseroAsignado: {
          select: { id: true, nombre: true, rol: true, email: true },
        },
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

  /**
   * Obtiene exclusivamente los garzones humanos activos (rol MESERO).
   * Excluye administradores, cajeros y cuentas virtuales de sistema.
   */
  async obtenerMeserosActivos() {
    return this.prisma.usuario.findMany({
      where: {
        rol: 'MESERO',
        activo: true,
        email: { not: 'ia@tukuypaj.com' },
      },
      select: {
        id: true,
        nombre: true,
        rol: true,
        email: true,
      },
      orderBy: { nombre: 'asc' },
    });
  }

  /**
   * Asigna o desasigna un mesero físico a una mesa con registro estricto en auditoría.
   * Valida estrictamente que el usuario tenga rol MESERO (no ADMIN ni CAJERO).
   */
  async asignarMesero(
    id: number,
    meseroId: string | null,
    usuarioAdmin?: { id: string; nombre: string; rol: string },
  ) {
    const mesa = await this.findOne(id);
    let meseroNombre = 'Sin asignar';

    if (meseroId) {
      const mesero = await this.prisma.usuario.findUnique({
        where: { id: meseroId },
        select: { id: true, nombre: true, rol: true, activo: true, email: true },
      });

      if (!mesero || !mesero.activo) {
        throw new BadRequestException('El mesero seleccionado no existe o no está activo');
      }

      if (mesero.rol !== 'MESERO' || mesero.email === 'ia@tukuypaj.com') {
        throw new BadRequestException(
          `Seguridad operativa: Solo el personal con rol MESERO puede ser asignado a mesas de salón. El usuario "${mesero.nombre}" tiene rol ${mesero.rol}.`,
        );
      }

      meseroNombre = mesero.nombre;
    }

    const mesaActualizada = await this.prisma.mesa.update({
      where: { id },
      data: { meseroAsignadoId: meseroId },
      include: {
        meseroAsignado: {
          select: { id: true, nombre: true, rol: true, email: true },
        },
      },
    });

    // Registrar en auditoría inmutable
    await this.auditoriaService.registrarEvento({
      tipoEvento: 'ASIGNACION_MESERO',
      mesaId: mesa.id,
      mesaNumero: mesa.numero,
      usuarioId: usuarioAdmin?.id,
      usuarioNombre: usuarioAdmin?.nombre || 'Administrador',
      rolUsuario: usuarioAdmin?.rol || 'ADMIN',
      meseroResponsableNombre: meseroNombre,
      descripcion: meseroId
        ? `Mesa ${mesa.numero} asignada al mesero ${meseroNombre}`
        : `Mesa ${mesa.numero} liberada de mesero responsable`,
      metadata: { meseroId, meseroNombre },
    });

    // Notificar al salón por WebSocket
    this.gateway.broadcastMesaEstado(id, mesaActualizada.estado);

    return mesaActualizada;
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
