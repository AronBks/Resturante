// ============================================================
// IaPedidosService — Motor de Inteligencia Artificial Dual
//
// Arquitectura:
//   1. Motor Primario: Google Gemini 2.0 Flash (API REST)
//   2. Motor Fallback: Coincidencia fonética + Levenshtein local
//
// Interpreta texto en lenguaje natural del cliente y lo mapea
// a platos reales de la carta de la base de datos PostgreSQL.
// ============================================================

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

interface PlatoDisponible {
  id: string;
  nombre: string;
  precioVenta: number;
  categoriaId: number;
}

export interface ItemInterpretado {
  platoId: string;
  nombre: string;
  cantidad: number;
  notas: string;
  precioUnitario: number;
}

export interface ResultadoInterpretacion {
  items: ItemInterpretado[];
  mensajeIA: string;
  totalEstimado: number;
  motor: 'gemini' | 'local';
}

@Injectable()
export class IaPedidosService {
  private readonly logger = new Logger(IaPedidosService.name);
  private readonly geminiApiKey: string;
  private readonly geminiUrl =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.geminiApiKey = this.configService.get<string>('GEMINI_API_KEY') || '';
  }

  /**
   * Punto de entrada principal: interpreta un texto de lenguaje natural
   * y lo mapea a platos reales de la carta.
   */
  async interpretarPedido(texto: string): Promise<ResultadoInterpretacion> {
    // 1. Obtener la carta disponible actual
    const platosDisponibles = await this.obtenerCartaDisponible();

    if (platosDisponibles.length === 0) {
      throw new BadRequestException('No hay platos disponibles en este momento.');
    }

    // 2. Intentar con Gemini primero, fallback a motor local
    if (this.geminiApiKey) {
      try {
        const resultado = await this.interpretarConGemini(texto, platosDisponibles);
        if (resultado.items.length > 0) {
          return resultado;
        }
      } catch (error) {
        this.logger.warn(`Gemini falló, usando motor local: ${error.message}`);
      }
    }

    // 3. Motor local de coincidencia inteligente
    return this.interpretarConMotorLocal(texto, platosDisponibles);
  }

  // ─────────────────────────────────────────────
  // MOTOR PRIMARIO: Google Gemini 2.0 Flash
  // ─────────────────────────────────────────────

  private async interpretarConGemini(
    textoCliente: string,
    platos: PlatoDisponible[],
  ): Promise<ResultadoInterpretacion> {
    const cartaJSON = platos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      precio: Number(p.precioVenta),
    }));

    const systemPrompt = `Eres el asistente de pedidos de "Peña Restaurant Tukuypaj" en Cochabamba, Bolivia.
Tu ÚNICA función es interpretar el pedido del cliente y mapearlo a platos de nuestra carta REAL.

CARTA DISPONIBLE (estos son los ÚNICOS platos que puedes usar):
${JSON.stringify(cartaJSON, null, 2)}

REGLAS ESTRICTAS:
1. SOLO puedes mapear a platos que existan en la carta de arriba. NO inventes platos.
2. Si el cliente pide algo que no existe, ignóralo y menciona en el mensaje que ese plato no está disponible.
3. Extrae cantidades numéricas: "dos" = 2, "un" = 1, "tres" = 3, etc. Si no especifica cantidad, asume 1.
4. Extrae notas de preparación: "sin locoto", "extra picante", "bien cocido", "sin cebolla", etc.
5. La moneda es Bolivianos (Bs.).

RESPONDE SOLO con un JSON válido con esta estructura exacta:
{
  "items": [
    { "platoId": "uuid-del-plato", "nombre": "nombre exacto", "cantidad": 1, "notas": "sin locoto" }
  ],
  "mensaje": "Un mensaje amigable y breve en español confirmando lo que entendiste, mencionando los platos y el total en Bs."
}

Si no puedes identificar NINGÚN plato, responde:
{ "items": [], "mensaje": "Lo siento, no pude identificar platos de nuestra carta en tu pedido. ¿Podrías intentar de nuevo?" }`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${this.geminiUrl}?key=${this.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: systemPrompt },
                { text: `Pedido del cliente: "${textoCliente}"` },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            topP: 0.8,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
          },
        }),
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const textContent =
        data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      this.logger.log(`Gemini response: ${textContent.substring(0, 200)}...`);

      const parsed = JSON.parse(textContent);

      // Validar que los IDs devueltos realmente existen en la carta
      const platosMap = new Map(platos.map((p) => [p.id, p]));
      const itemsValidados: ItemInterpretado[] = [];
      let total = 0;

      for (const item of parsed.items || []) {
        const plato = platosMap.get(item.platoId);
        if (plato) {
          const precio = Number(plato.precioVenta);
          itemsValidados.push({
            platoId: plato.id,
            nombre: plato.nombre,
            cantidad: Math.max(1, Math.round(item.cantidad || 1)),
            notas: item.notas || '',
            precioUnitario: precio,
          });
          total += precio * Math.max(1, Math.round(item.cantidad || 1));
        }
      }

      return {
        items: itemsValidados,
        mensajeIA: parsed.mensaje || 'He interpretado tu pedido.',
        totalEstimado: total,
        motor: 'gemini',
      };
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  // ─────────────────────────────────────────────
  // MOTOR FALLBACK: Coincidencia inteligente local
  // ─────────────────────────────────────────────

  private interpretarConMotorLocal(
    textoCliente: string,
    platos: PlatoDisponible[],
  ): ResultadoInterpretacion {
    const textoNorm = this.normalizar(textoCliente);
    const tokens = textoNorm.split(/[\s,;.!?]+/).filter(Boolean);

    const itemsEncontrados: ItemInterpretado[] = [];
    const platosUsados = new Set<string>();

    for (const plato of platos) {
      const nombreNorm = this.normalizar(plato.nombre);
      const palabrasPlato = nombreNorm.split(/\s+/);

      // Estrategia 1: Coincidencia directa de nombre o parte significativa
      const match = this.buscarCoincidenciaEnTexto(textoNorm, nombreNorm, palabrasPlato);

      if (match && !platosUsados.has(plato.id)) {
        platosUsados.add(plato.id);

        // Extraer cantidad cercana al match
        const cantidad = this.extraerCantidad(textoNorm, match.indice);

        // Extraer notas de preparación
        const notas = this.extraerNotas(textoNorm);

        itemsEncontrados.push({
          platoId: plato.id,
          nombre: plato.nombre,
          cantidad,
          notas,
          precioUnitario: Number(plato.precioVenta),
        });
      }
    }

    const total = itemsEncontrados.reduce(
      (sum, item) => sum + item.precioUnitario * item.cantidad,
      0,
    );

    let mensaje: string;
    if (itemsEncontrados.length > 0) {
      const resumen = itemsEncontrados
        .map((i) => `${i.cantidad}x ${i.nombre}`)
        .join(', ');
      mensaje = `He identificado: ${resumen}. Total estimado: Bs. ${total.toFixed(2)}. ¿Deseas confirmar?`;
    } else {
      mensaje =
        'No pude identificar platos de nuestra carta. Intenta mencionar platos como "Pique Macho", "Silpancho", "Chicharrón" o "Limonada".';
    }

    return {
      items: itemsEncontrados,
      mensajeIA: mensaje,
      totalEstimado: total,
      motor: 'local',
    };
  }

  // ─────────────────────────────────────────────
  // UTILIDADES DE NLP LOCAL
  // ─────────────────────────────────────────────

  /**
   * Normaliza texto: minúsculas, elimina tildes, caracteres especiales.
   */
  private normalizar(texto: string): string {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Busca coincidencia de un plato en el texto del cliente.
   * Usa aliases comunes + distancia de Levenshtein para tolerancia a errores.
   */
  private buscarCoincidenciaEnTexto(
    textoNorm: string,
    nombreNorm: string,
    palabrasPlato: string[],
  ): { indice: number } | null {
    // Coincidencia directa del nombre completo
    const idxDirecto = textoNorm.indexOf(nombreNorm);
    if (idxDirecto >= 0) return { indice: idxDirecto };

    // Aliases y variaciones comunes de la gastronomía boliviana
    const aliases: Record<string, string[]> = {
      'pique macho': ['pique', 'pikemacho', 'pique macho'],
      'silpancho cochabambino': ['silpancho', 'silpanchos'],
      'chicharron de cerdo': ['chicharron', 'chicharrones', 'chicharon'],
      'trancapecho': ['trancapecho', 'tranca', 'trancapechos'],
      'parrillada tukuypaj': ['parrillada', 'parrilla', 'parillada'],
      'lomo a la plancha': ['lomo', 'lomito', 'lomo plancha'],
      'chanka de pollo': ['chanka', 'chanca', 'chanka pollo'],
      'sopa de mani': ['sopa mani', 'sopa de mani', 'mani'],
      'anticuchos de corazon': ['anticucho', 'anticuchos', 'anti cucho'],
      'ranga ranga': ['ranga', 'rangaranga'],
      'chicha cochabambina': ['chicha', 'chichita'],
      'limonada con hierba buena': ['limonada', 'limonadas'],
      'refresco en botella': ['refresco', 'coca cola', 'cocacola', 'sprite', 'fanta', 'gaseosa'],
      'helado de canela': ['helado', 'helados'],
      'bunuelos con miel': ['bunuelo', 'bunuelos', 'buñuelo', 'buñuelos'],
    };

    // Buscar por aliases
    for (const [key, aliasList] of Object.entries(aliases)) {
      if (this.normalizar(key) === nombreNorm || this.levenshteinClose(nombreNorm, this.normalizar(key))) {
        for (const alias of aliasList) {
          const aliasNorm = this.normalizar(alias);
          const idx = textoNorm.indexOf(aliasNorm);
          if (idx >= 0) return { indice: idx };
        }
      }
    }

    // Coincidencia por palabras clave significativas (>= 4 chars) con Levenshtein
    const palabrasSignificativas = palabrasPlato.filter((p) => p.length >= 4);
    for (const palabra of palabrasSignificativas) {
      const tokens = textoNorm.split(/\s+/);
      for (let i = 0; i < tokens.length; i++) {
        if (
          tokens[i].length >= 4 &&
          this.levenshteinClose(tokens[i], palabra)
        ) {
          return { indice: textoNorm.indexOf(tokens[i]) };
        }
      }
    }

    return null;
  }

  /**
   * Distancia de Levenshtein entre dos strings.
   */
  private levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () =>
      Array(n + 1).fill(0),
    );

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] =
          a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  /**
   * Verifica si dos palabras son suficientemente similares
   * (tolerancia de ~25% de caracteres de error).
   */
  private levenshteinClose(a: string, b: string): boolean {
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return true;
    const dist = this.levenshtein(a, b);
    return dist <= Math.ceil(maxLen * 0.25);
  }

  /**
   * Extrae la cantidad numérica más cercana a una posición en el texto.
   * Soporta números y palabras: "un", "dos", "tres", etc.
   */
  private extraerCantidad(texto: string, indice: number): number {
    const numerosTextuales: Record<string, number> = {
      un: 1, una: 1, uno: 1,
      dos: 2,
      tres: 3,
      cuatro: 4,
      cinco: 5,
      seis: 6,
      siete: 7,
      ocho: 8,
      nueve: 9,
      diez: 10,
      media: 1,
      medio: 1,
    };

    // Buscar en una ventana de 40 chars antes del match
    const ventana = texto.substring(Math.max(0, indice - 40), indice + 5);

    // Buscar número escrito
    for (const [palabra, valor] of Object.entries(numerosTextuales)) {
      if (ventana.includes(palabra)) return valor;
    }

    // Buscar dígitos
    const digitMatch = ventana.match(/(\d+)/);
    if (digitMatch) {
      const num = parseInt(digitMatch[1], 10);
      if (num >= 1 && num <= 50) return num;
    }

    return 1; // Default
  }

  /**
   * Extrae notas de preparación comunes del texto.
   */
  private extraerNotas(texto: string): string {
    const patrones = [
      /sin\s+\w+/gi,
      /extra\s+\w+/gi,
      /bien\s+\w+/gi,
      /poco\s+\w+/gi,
      /con\s+mucho?\s+\w+/gi,
      /al\s+punto/gi,
      /termino\s+\w+/gi,
    ];

    const notas: string[] = [];
    for (const patron of patrones) {
      const matches = texto.match(patron);
      if (matches) {
        notas.push(...matches.map((m) => m.trim()));
      }
    }

    return notas.length > 0 ? notas.join(', ') : '';
  }

  /**
   * Obtiene la carta completa disponible de la BD.
   */
  private async obtenerCartaDisponible(): Promise<PlatoDisponible[]> {
    const platos = await this.prisma.plato.findMany({
      where: { disponible: true },
      select: {
        id: true,
        nombre: true,
        precioVenta: true,
        categoriaId: true,
      },
    });
    return platos.map((p) => ({
      ...p,
      precioVenta: Number(p.precioVenta),
    }));
  }

  /**
   * Resuelve el mesaId numérico a partir del número visible (ej: "M03" → 3)
   */
  async resolverMesa(mesaNumero: string): Promise<{ id: number; numero: string; estado: string }> {
    const mesa = await this.prisma.mesa.findUnique({
      where: { numero: mesaNumero },
      select: { id: true, numero: true, estado: true, activa: true },
    });

    if (!mesa || !mesa.activa) {
      throw new BadRequestException(`La mesa "${mesaNumero}" no existe o no está activa.`);
    }

    return mesa;
  }

  /**
   * Obtiene el ID del usuario virtual IA para usarlo como meseroId.
   */
  async obtenerUsuarioIA(): Promise<string> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: 'ia@tukuypaj.com' },
      select: { id: true },
    });

    if (!usuario) {
      throw new BadRequestException(
        'El usuario del Sistema IA no está configurado. Ejecuta el seed.',
      );
    }

    return usuario.id;
  }
}
