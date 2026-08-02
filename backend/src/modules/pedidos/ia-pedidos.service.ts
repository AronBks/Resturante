import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface PlatoDisponible {
  id: string;
  nombre: string;
  precioVenta: number;
  categoriaId: number;
  variantes?: {
    id: string;
    nombre: string;
    precio: number;
  }[];
}

export interface ItemInterpretado {
  platoId: string;
  varianteId?: string;
  nombre: string;
  cantidad: number;
  notas?: string;
  precioUnitario: number;
  variantes?: { id: string; nombre: string; precio: number }[];
}

export type EstadoConversacion = 'SALUDO' | 'TOMANDO_PEDIDO' | 'CONFIRMACION_FINAL';

export interface ResultadoConversacionIA {
  respuestaMesero: string;
  comandaActualizada: ItemInterpretado[];
  estadoConversacion: EstadoConversacion;
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
   * Interpreta la interacción del cliente con el Mesero Virtual "Don Beto".
   */
  async interpretarPedido(
    textoCliente: string,
    historial: Array<{ rol: 'usuario' | 'asistente'; texto: string }> = [],
    comandaPrevia: ItemInterpretado[] = [],
  ): Promise<ResultadoConversacionIA> {
    const platosDisponibles = await this.obtenerCartaDisponible();

    if (platosDisponibles.length === 0) {
      throw new BadRequestException('No hay platos disponibles en este momento.');
    }

    if (this.geminiApiKey) {
      try {
        const resultado = await this.interpretarConGemini(
          textoCliente,
          historial,
          comandaPrevia,
          platosDisponibles,
        );
        return resultado;
      } catch (error) {
        this.logger.warn(`Gemini API error, usando motor de contingencia local: ${error.message}`);
      }
    }

    return this.interpretarConMotorLocal(textoCliente, comandaPrevia, platosDisponibles);
  }

  // ─────────────────────────────────────────────
  // MOTOR PRIMARIO: Google Gemini (Don Beto - Mesero Virtual)
  // ─────────────────────────────────────────────

  private async interpretarConGemini(
    textoCliente: string,
    historial: Array<{ rol: 'usuario' | 'asistente'; texto: string }>,
    comandaPrevia: ItemInterpretado[],
    platos: PlatoDisponible[],
  ): Promise<ResultadoConversacionIA> {
    const cartaJSON = platos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      precioBase: Number(p.precioVenta),
      variantes: p.variantes || [],
    }));

    const systemPrompt = `Eres "Don Beto", el cordial, educado y atento mesero virtual de "Peña Restaurant Tukuypaj" en Cochabamba, Bolivia.

PERSONALIDAD Y TONO VALLUNO:
- Tu trato es siempre muy atento, amigable, respetuoso y con la calidez típica de la llajta cochabambina.
- Usas expresiones amables como: "¡Buen provecho!", "Con mucho gusto", "¿Gusta alguna cosita más?", "Le sugiero nuestra jarrita de limonada bien helada", "¡Servido casero/casera!".

COMPORTAMIENTO Y REGLAS DE CONVERSACIÓN:
1. SALUDO O CONSULTAS DE MENÚ:
   - Si el cliente solo saluda (ej: "hola", "buenas tardes", "buen día") o pregunta qué recomienda la casa, NO fuerces la comanda de inmediato.
   - Saluda cordialmente, ofrece las especialidades estrella de la peña (Pique Macho, Chicharrón, Silpancho o Parrillada Tukuypaj) y sugiere bebidas tradicionales.
   - Marca "estadoConversacion": "SALUDO".

2. ELECCIÓN DE TAMAÑOS Y VARIANTES:
   - Si el cliente solicita un plato con variantes de tamaño (ej: "Quiero un Pique Macho") y NO aclara la porción, pregúntale amablemente qué tamaño prefiere explicándole las porciones:
     * Personal (para 1 persona)
     * Mediano (para 2 o 3 personas)
     * Grande / Familiar (para compartir en familia)
   - Si especifica tamaño (ej: "un Pique mediano"), asigna el varianteId correspondiente.
   - Marca "estadoConversacion": "TOMANDO_PEDIDO".

3. SUGERENCIA INTELIGENTE DE BEBIDAS / MARIDAJE:
   - De manera fluida y natural, al pedir platos fuertes (Pique, Chicharrón, Parrillada), sugiere acompañar la mesa con limonada con hierba buena, chicha cochabambina o una cerveza bien fría.

4. CONFIRMACIÓN FINAL:
   - Si el cliente indica que completó su elección (ej: "eso es todo", "confirmar pedido", "envíalo a cocina", "ya está"), agradece con calidez y asigna "estadoConversacion": "CONFIRMACION_FINAL".

5. ACUMULACIÓN DE COMANDA:
   - Mantén en "comandaActualizada" los platos de la comanda previa, actualizándolos o agregando nuevos si el cliente añade más ítems.

FORMATO DE SALIDA (RESPOONDE ÚNICAMENTE CON JSON VÁLIDO CON ESTA ESTRUCTURA EXACTA):
{
  "respuestaMesero": "Mensaje en lenguaje natural de Don Beto con calidez valluna.",
  "comandaActualizada": [
    {
      "platoId": "uuid-del-plato",
      "varianteId": "uuid-de-la-variante-o-null",
      "nombre": "Nombre exacto del plato y tamaño",
      "cantidad": 1,
      "precioUnitario": 90.00,
      "notas": "Notas de preparación (ej: sin locoto, bien jugoso)"
    }
  ],
  "estadoConversacion": "SALUDO" | "TOMANDO_PEDIDO" | "CONFIRMACION_FINAL"
}

CARTA REAL DISPONIBLE EN PEÑA TUKUYPAJ:
${JSON.stringify(cartaJSON, null, 2)}`;

    const promptContents = [
      { role: 'user', parts: [{ text: systemPrompt }] },
    ];

    // Incluir historial de conversación
    for (const msg of historial) {
      promptContents.push({
        role: msg.rol === 'usuario' ? 'user' : 'model',
        parts: [{ text: msg.texto }],
      });
    }

    // Incluir el nuevo mensaje con la comanda previa como contexto
    const contextoComanda = comandaPrevia.length > 0
      ? ` [Comanda previa actual en mesa: ${JSON.stringify(comandaPrevia)}]`
      : '';

    promptContents.push({
      role: 'user',
      parts: [{ text: `Mensaje del cliente: "${textoCliente}"${contextoComanda}` }],
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    try {
      const response = await fetch(`${this.geminiUrl}?key=${this.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: promptContents,
          generationConfig: {
            temperature: 0.3,
            topP: 0.85,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
          },
        }),
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini Error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const textContent = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsed = JSON.parse(textContent);

      const platosMap = new Map(platos.map((p) => [p.id, p]));
      const itemsValidados: ItemInterpretado[] = [];
      let total = 0;

      for (const item of parsed.comandaActualizada || []) {
        const plato = platosMap.get(item.platoId);
        if (plato) {
          let precio = Number(item.precioUnitario || plato.precioVenta);
          let nombreConVariante = item.nombre || plato.nombre;
          let varianteIdValida: string | undefined = item.varianteId || undefined;

          if (plato.variantes && plato.variantes.length > 0) {
            let variante = plato.variantes.find((v) => v.id === item.varianteId);
            if (!variante) {
              const sorted = [...plato.variantes].sort((a, b) => Number(a.precio) - Number(b.precio));
              variante = sorted[0];
            }
            if (variante) {
              precio = Number(variante.precio);
              nombreConVariante = `${plato.nombre} (${variante.nombre})`;
              varianteIdValida = variante.id;
            }
          }

          const cant = Math.max(1, Math.round(item.cantidad || 1));
          itemsValidados.push({
            platoId: plato.id,
            varianteId: varianteIdValida,
            nombre: nombreConVariante,
            cantidad: cant,
            notas: item.notas || '',
            precioUnitario: precio,
            variantes: plato.variantes && plato.variantes.length > 0
              ? plato.variantes.map((v) => ({ id: v.id, nombre: v.nombre, precio: Number(v.precio) }))
              : undefined,
          });

          total += precio * cant;
        }
      }

      const estado: EstadoConversacion =
        parsed.estadoConversacion === 'CONFIRMACION_FINAL'
          ? 'CONFIRMACION_FINAL'
          : itemsValidados.length > 0
            ? 'TOMANDO_PEDIDO'
            : (parsed.estadoConversacion || 'SALUDO');

      return {
        respuestaMesero: parsed.respuestaMesero || '¡Con mucho gusto le atiendo, casero! ¿Qué se le antoja degustar hoy?',
        comandaActualizada: itemsValidados,
        estadoConversacion: estado,
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
    comandaPrevia: ItemInterpretado[],
    platos: PlatoDisponible[],
  ): ResultadoConversacionIA {
    const textoNorm = this.normalizar(textoCliente);
    const itemsEncontrados: ItemInterpretado[] = [...comandaPrevia];
    const platosUsados = new Set<string>(itemsEncontrados.map((i) => i.platoId));

    for (const plato of platos) {
      const nombreNorm = this.normalizar(plato.nombre);
      const palabrasPlato = nombreNorm.split(/\s+/);
      const match = this.buscarCoincidenciaEnTexto(textoNorm, nombreNorm, palabrasPlato);

      if (match && !platosUsados.has(plato.id)) {
        platosUsados.add(plato.id);
        const cantidad = this.extraerCantidad(textoNorm, match.indice);
        const notas = this.extraerNotas(textoNorm);

        let precioUnitario = Number(plato.precioVenta);
        let varianteId: string | undefined = undefined;
        let nombreMostrar = plato.nombre;

        if (plato.variantes && plato.variantes.length > 0) {
          const variantesOrdenadas = [...plato.variantes].sort((a, b) => a.precio - b.precio);
          let varianteEncontrada = null;
          for (const v of variantesOrdenadas) {
            if (textoNorm.includes(this.normalizar(v.nombre))) {
              varianteEncontrada = v;
              break;
            }
          }
          const vElegida = varianteEncontrada || variantesOrdenadas[0];
          varianteId = vElegida.id;
          precioUnitario = vElegida.precio;
          nombreMostrar = `${plato.nombre} (${vElegida.nombre})`;
        }

        itemsEncontrados.push({
          platoId: plato.id,
          varianteId,
          nombre: nombreMostrar,
          cantidad,
          notas,
          precioUnitario,
          variantes: plato.variantes && plato.variantes.length > 0
            ? plato.variantes.map((v) => ({ id: v.id, nombre: v.nombre, precio: Number(v.precio) }))
            : undefined,
        });
      }
    }

    const total = itemsEncontrados.reduce(
      (sum, item) => sum + item.precioUnitario * item.cantidad,
      0,
    );

    let mensaje: string;
    let estado: EstadoConversacion = 'TOMANDO_PEDIDO';

    if (itemsEncontrados.length > 0) {
      const resumen = itemsEncontrados.map((i) => `${i.cantidad}x ${i.nombre}`).join(', ');
      mensaje = `¡Con mucho gusto, casero! Le anoto: ${resumen}. El total estimado es Bs. ${total.toFixed(2)}. ¿Gusta alguna cosita más o lo enviamos a cocina?`;
    } else {
      estado = 'SALUDO';
      mensaje = '¡Sea bienvenido a Peña Tukuypaj, casero! Le sugiero probar nuestro sabroso Pique Macho, un Chicharrón bien dorado o un Silpancho. ¿Con qué le podemos servir hoy?';
    }

    if (textoNorm.includes('eso es todo') || textoNorm.includes('confirmar') || textoNorm.includes('enviar')) {
      estado = 'CONFIRMACION_FINAL';
    }

    return {
      respuestaMesero: mensaje,
      comandaActualizada: itemsEncontrados,
      estadoConversacion: estado,
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
        variantes: {
          where: { disponible: true },
          select: {
            id: true,
            nombre: true,
            precio: true,
          },
        },
      },
    });
    return platos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      precioVenta: Number(p.precioVenta),
      categoriaId: p.categoriaId,
      variantes: p.variantes.map((v) => ({
        id: v.id,
        nombre: v.nombre,
        precio: Number(v.precio),
      })),
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
