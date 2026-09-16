import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CartaGateway } from './carta.gateway';
import { PedidosGateway } from '../pedidos/pedidos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';

@Injectable()
export class CartaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartaGateway: CartaGateway,
    @Inject(forwardRef(() => PedidosGateway))
    private readonly pedidosGateway: PedidosGateway,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  // ── Categorías ──

  async findAllCategorias() {
    return this.prisma.categoriaPlato.findMany({
      where: { activa: true },
      include: {
        platos: {
          select: {
            id: true,
            nombre: true,
            precioVenta: true,
            imagenUrl: true,
            disponible: true,
            stockActual: true,
            controlarStock: true,
            stockMinimo: true,
          },
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
    const platos = await this.prisma.plato.findMany({
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

    const ahoraMinutos = this.minutosDelDia(new Date());
    return platos.map((plato) => ({
      ...plato,
      disponibleAhora: this.estaDisponibleAhora(
        plato.horaInicio,
        plato.horaFin,
        ahoraMinutos,
      ),
    }));
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
    disponible?: boolean;
    variantes?: { nombre: string; precio: number; disponible?: boolean }[];
  }) {
    const created = await this.prisma.plato.create({
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion,
        precioVenta: data.precioVenta,
        categoriaId: Number(data.categoriaId),
        imagenUrl: data.imagenUrl,
        disponible: data.disponible !== undefined ? data.disponible : true,
        variantes: data.variantes && data.variantes.length > 0 ? {
          create: data.variantes.map(v => ({
            nombre: v.nombre,
            precio: Number(v.precio),
            disponible: v.disponible !== undefined ? v.disponible : true,
          }))
        } : undefined,
      },
      include: {
        categoria: { select: { nombre: true } },
        variantes: true,
      },
    });

    this.cartaGateway.server?.emit('menu:actualizado', { platoId: created.id });
    this.pedidosGateway.server?.emit('menu:actualizado', { platoId: created.id });

    return created;
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
    const newEstado = !plato.disponible;

    const updated = await this.prisma.plato.update({
      where: { id },
      data: { disponible: newEstado },
    });

    // Sincronizar todas las variantes con el estado maestro del plato
    await this.prisma.variantePlato.updateMany({
      where: { platoId: id },
      data: { disponible: newEstado },
    });

    // 📡 Broadcast al namespace público y autenticado
    if (this.cartaGateway) {
      this.cartaGateway.broadcastDisponibilidad(id, updated.disponible);
    }
    if (this.pedidosGateway?.server) {
      this.pedidosGateway.server.emit('menu:actualizado', {
        platoId: id,
        disponible: updated.disponible,
      });
    }

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

    // Verificar si queda al menos una variante disponible para el plato
    const variantesPlato = await this.prisma.variantePlato.findMany({
      where: { platoId: updated.platoId },
      select: { disponible: true },
    });

    const anyDisponible = variantesPlato.some((v) => v.disponible);

    // Actualizar disponibilidad del plato padre
    await this.prisma.plato.update({
      where: { id: updated.platoId },
      data: { disponible: anyDisponible },
    });

    // 📡 Broadcast al namespace público y autenticado
    if (this.cartaGateway) {
      this.cartaGateway.broadcastDisponibilidad(updated.platoId, anyDisponible);
    }
    if (this.pedidosGateway?.server) {
      this.pedidosGateway.server.emit('menu:actualizado', {
        platoId: updated.platoId,
        varianteId: id,
        disponible: updated.disponible,
      });
    }

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
    const categorias = await this.prisma.categoriaPlato.findMany({
      where: {
        activa: true,
      },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        orden: true,
        platos: {
          select: {
            id: true,
            nombre: true,
            descripcion: true,
            precioVenta: true,
            imagenUrl: true,
            horaInicio: true,
            horaFin: true,
            stockActual: true,
            controlarStock: true,
            stockMinimo: true,
            disponible: true,
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

    // Enriquecer cada plato con flag de disponibilidad horaria y de stock actual
    const ahoraMinutos = this.minutosDelDia(new Date());

    return categorias
      .map((cat) => ({
        ...cat,
        platos: cat.platos.map((plato) => {
          const porHorario = this.estaDisponibleAhora(
            plato.horaInicio,
            plato.horaFin,
            ahoraMinutos,
          );
          const estaAgotado =
            plato.stockActual !== null && plato.stockActual !== undefined
              ? plato.stockActual <= 0
              : false;
          const disponibleAhora = porHorario && !estaAgotado;

          return {
            ...plato,
            controlarStock: true,
            disponibleAhora,
            enHorario: porHorario,
            agotado: estaAgotado,
          };
        }),
      }))
      .filter((cat) => cat.platos.length > 0);
  }

  /** Convierte "HH:MM" a minutos desde medianoche según la hora local de Bolivia (UTC-4) */
  private minutosDelDia(date: Date): number {
    try {
      const boliviaStr = date.toLocaleString('en-US', { timeZone: 'America/La_Paz', hour12: false });
      const boliviaDate = new Date(boliviaStr);
      return boliviaDate.getHours() * 60 + boliviaDate.getMinutes();
    } catch {
      return date.getHours() * 60 + date.getMinutes();
    }
  }

  /** Retorna true si el plato está en su ventana horaria (o si no tiene restricción) */
  private estaDisponibleAhora(
    horaInicio: string | null,
    horaFin: string | null,
    ahoraMinutos: number,
  ): boolean {
    if (!horaInicio) return true; // Sin restricción horaria
    const [hI, mI] = horaInicio.split(':').map(Number);
    const inicioMin = hI * 60 + mI;
    if (!horaFin) return ahoraMinutos >= inicioMin;
    const [hF, mF] = horaFin.split(':').map(Number);
    const finMin = hF * 60 + mF;
    return ahoraMinutos >= inicioMin && ahoraMinutos <= finMin;
  }

  // ── GESTIÓN Y ADMINISTRACIÓN DE STOCK (ADMIN & CAJERO) ──

  async actualizarStockPlato(
    id: string,
    dto: {
      stockActual?: number | null;
      controlarStock?: boolean;
      stockMinimo?: number;
      motivo?: string;
    },
    usuario?: any,
  ) {
    const plato = await this.prisma.plato.findUnique({
      where: { id },
      include: { categoria: true },
    });

    if (!plato) {
      throw new NotFoundException(`Plato con ID ${id} no encontrado`);
    }

    const stockAnterior = plato.stockActual ?? 0;

    let nuevoStock = plato.stockActual ?? 0;
    if (dto.stockActual !== undefined && dto.stockActual !== null) {
      nuevoStock = Math.max(0, dto.stockActual);
    }

    const nuevoStockMinimo =
      dto.stockMinimo !== undefined ? Math.max(0, dto.stockMinimo) : (plato.stockMinimo || 3);

    // Todo producto tiene stock finito: si llega a 0 queda agotado por hoy, pero permanece en carta
    const updated = await this.prisma.plato.update({
      where: { id },
      data: {
        stockActual: nuevoStock,
        controlarStock: true,
        stockMinimo: nuevoStockMinimo,
        disponible: true,
      },
      include: {
        categoria: { select: { id: true, nombre: true } },
        variantes: true,
      },
    });

    // 📡 Broadcast en tiempo real a clientes y POS interno
    this.cartaGateway.broadcastStock(id, updated.stockActual, updated.disponible);
    if (this.pedidosGateway?.server) {
      this.pedidosGateway.server.emit('plato:stock-actualizado', {
        platoId: id,
        stockActual: updated.stockActual,
        controlarStock: true,
        stockMinimo: updated.stockMinimo,
        disponible: updated.disponible,
      });
      this.pedidosGateway.server.emit('menu:actualizado', {
        platoId: id,
        disponible: updated.disponible,
      });
    }

    // 🛡️ Registrar evento en Auditoría inmutable
    try {
      if (this.auditoriaService) {
        await this.auditoriaService.registrarEvento({
          tipoEvento: 'AJUSTE_STOCK',
          usuarioId: usuario?.id,
          usuarioNombre: usuario?.nombre || usuario?.username || 'Administración',
          rolUsuario: usuario?.rol || 'ADMIN',
          canalOrigen: 'MESERO_POS',
          descripcion: `Ajuste de inventario para "${plato.nombre}": ` +
            `Existencia anterior: ${stockAnterior} ➔ Nueva existencia: ${updated.stockActual} porciones/unidades ` +
            `(Alerta mínima: ${updated.stockMinimo}). ` +
            `${dto.motivo ? 'Motivo: ' + dto.motivo : ''}`.trim(),
          metadata: {
            platoId: id,
            platoNombre: plato.nombre,
            categoria: plato.categoria?.nombre,
            stockAnterior,
            stockNuevo: updated.stockActual,
            controlarStock: true,
            stockMinimo: updated.stockMinimo,
            disponible: updated.disponible,
            motivo: dto.motivo,
          },
        });
      }
    } catch (e) {
      console.error('Error registrando auditoría de stock:', e);
    }

    return updated;
  }

  async reposicionMasivaStock(
    items: Array<{
      platoId: string;
      stockActual: number;
      controlarStock?: boolean;
      stockMinimo?: number;
    }>,
    usuario?: any,
    motivo?: string,
  ) {
    const resultados = [];

    for (const item of items) {
      try {
        const res = await this.actualizarStockPlato(
          item.platoId,
          {
            stockActual: item.stockActual,
            controlarStock: item.controlarStock !== undefined ? item.controlarStock : true,
            stockMinimo: item.stockMinimo,
            motivo: motivo || 'Apertura de turno / Reposición masiva de inventario',
          },
          usuario,
        );
        resultados.push(res);
      } catch (err) {
        console.error(`Error actualizando stock masivo plato ${item.platoId}:`, err);
      }
    }

    return {
      success: true,
      actualizados: resultados.length,
      total: items.length,
      items: resultados,
    };
  }
}

