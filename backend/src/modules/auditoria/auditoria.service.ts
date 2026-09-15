import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface RegistrarAuditoriaDto {
  tipoEvento: string;
  mesaId?: number;
  mesaNumero?: string;
  usuarioId?: string;
  usuarioNombre?: string;
  rolUsuario?: string;
  meseroResponsableNombre?: string;
  canalOrigen?: 'MESERO_POS' | 'IA_DON_BETO' | 'CLIENTE_DIGITAL';
  descripcion: string;
  metadata?: any;
}

@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra un evento inmutable en la bitácora de auditoría operativa.
   */
  async registrarEvento(dto: RegistrarAuditoriaDto) {
    try {
      const evento = await (this.prisma as any).auditoriaEvento.create({
        data: {
          tipoEvento: dto.tipoEvento,
          mesaId: dto.mesaId || null,
          mesaNumero: dto.mesaNumero || null,
          usuarioId: dto.usuarioId || null,
          usuarioNombre: dto.usuarioNombre || null,
          rolUsuario: dto.rolUsuario || null,
          meseroResponsableNombre: dto.meseroResponsableNombre || null,
          canalOrigen: dto.canalOrigen || null,
          descripcion: dto.descripcion,
          metadata: dto.metadata ? dto.metadata : undefined,
        },
      });

      this.logger.log(
        `🛡️ [AUDITORÍA] ${dto.tipoEvento} | Mesa: ${dto.mesaNumero || 'N/A'} | Resp: ${
          dto.meseroResponsableNombre || dto.usuarioNombre || 'Sistema'
        } | ${dto.descripcion}`,
      );

      return evento;
    } catch (error) {
      this.logger.error(`Error al registrar evento de auditoría: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Obtiene la bitácora de auditoría con filtros opcionales.
   */
  async obtenerEventos(filtros?: {
    mesaNumero?: string;
    tipoEvento?: string;
    fechaInicio?: Date;
    limit?: number;
  }) {
    const where: any = {};

    if (filtros?.mesaNumero) {
      where.mesaNumero = filtros.mesaNumero;
    }

    if (filtros?.tipoEvento) {
      where.tipoEvento = filtros.tipoEvento;
    }

    if (filtros?.fechaInicio) {
      where.createdAt = { gte: filtros.fechaInicio };
    }

    return (this.prisma as any).auditoriaEvento.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filtros?.limit || 100,
    });
  }

  /**
   * Historial de auditoría para una mesa específica (del turno / últimas 24h).
   */
  async obtenerHistorialMesa(mesaNumero: string) {
    const hace24Horas = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return (this.prisma as any).auditoriaEvento.findMany({
      where: {
        mesaNumero,
        createdAt: { gte: hace24Horas },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
