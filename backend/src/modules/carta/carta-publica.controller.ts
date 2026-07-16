// ============================================================
// CartaPublicaController — Endpoint Público (Sin JWT)
//
// Controlador separado del CartaController (que tiene
// @UseGuards a nivel de clase). Este NO requiere autenticación.
// Ruta: GET /api/carta/publica
// ============================================================

import { Controller, Get } from '@nestjs/common';
import { CartaService } from './carta.service';

@Controller('carta')
export class CartaPublicaController {
  constructor(private readonly cartaService: CartaService) {}

  /**
   * Retorna la carta completa filtrada:
   * - Solo categorías activas
   * - Solo platos con disponible: true
   * - Sin datos sensibles (costoReceta, timestamps internos)
   *
   * Consumido por la client-app (Menú Digital QR)
   */
  @Get('publica')
  findCartaPublica() {
    return this.cartaService.findCartaPublica();
  }
}
