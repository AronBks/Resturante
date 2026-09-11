// ============================================================
// DonBetoService — Integración con n8n y Backend Gastronómico
// Peña Restaurant Tukuypaj — Cochabamba, Bolivia
// ============================================================

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CategoriaPublica, PlatoPublico, VariantePublica } from './carta-publica.service';

export interface MensajeChat {
  id?: string;
  emisor: 'cliente' | 'don-beto';
  texto: string;
  timestamp?: Date;
  esConfirmacion?: boolean;
}

export interface ItemComanda {
  platoId: string;
  varianteId?: string;
  varianteNombre?: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  notas?: string;
}

export interface N8nWebhookPayload {
  message: string;
  mesa: string;
}

/**
 * Normaliza cualquier formato de mesa (ej: 'mesa-1', '1', 'M01')
 * al formato oficial de la base de datos: 'M01', 'M02', etc.
 */
export function formatearMesaParaBackend(raw?: string | null): string {
  if (!raw) return 'M01';
  const match = raw.match(/\d+/);
  if (match) {
    const num = parseInt(match[0], 10);
    return `M${String(num).padStart(2, '0')}`;
  }
  return 'M01';
}

/**
 * Normaliza cualquier formato para el webhook de n8n: 'mesa-1', 'mesa-2', etc.
 */
export function resolverIdentificadorMesa(raw?: string | null): string {
  if (!raw) return 'mesa-1';
  const clean = raw.trim().toLowerCase();
  if (!clean) return 'mesa-1';
  if (/^mesa-\w+$/i.test(clean)) return clean;
  if (/^mesa_\w+$/i.test(clean)) return clean.replace('_', '-');

  const matchNumero = clean.match(/\d+/);
  if (matchNumero) {
    const num = parseInt(matchNumero[0], 10);
    return `mesa-${num}`;
  }
  return clean.startsWith('mesa') ? clean : `mesa-${clean}`;
}

/**
 * Detecta si el mensaje expresa la intención de marchar el pedido a la cocina
 */
export function detectarIntencionMarchado(texto: string): boolean {
  const t = (texto || '').toLowerCase();
  return (
    t.includes('marcho el pedido') ||
    t.includes('marchando a la cocina') ||
    t.includes('marchando el pedido') ||
    t.includes('lo marcho con la cocina') ||
    t.includes('lo marcho a la cocina') ||
    t.includes('marcho con la cocina') ||
    t.includes('enseguida lo marcho') ||
    t.includes('enseguida se lo marcho') ||
    t.includes('ya se lo marcho') ||
    t.includes('lo marcho') ||
    t.includes('salga volando') ||
    t.includes('eso nomas seria') ||
    t.includes('eso no mas seria') ||
    t.includes('eso seria todo') ||
    t.includes('eso es todo') ||
    t.includes('con eso ya es todo') ||
    t.includes('con eso es todo') ||
    t.includes('ya es todo') ||
    t.includes('envialo a cocina') ||
    t.includes('marchar a cocina') ||
    t.includes('confirmar pedido') ||
    t.includes('confirmar comanda') ||
    t.includes('marchar la comanda') ||
    (t.includes('anotado') && t.includes('cocina')) ||
    (t.includes('total de') && t.includes('bolivianos') && t.includes('cocina'))
  );
}

@Injectable({
  providedIn: 'root',
})
export class DonBetoService {
  private readonly http = inject(HttpClient);

  // Webhook de Producción n8n
  readonly webhookUrl = 'https://bkshunt.app.n8n.cloud/webhook/97a070a7-8e60-4aad-b51f-60b8ef3a75a4';
  readonly apiUrl = 'http://localhost:3000/api/pedidos';

  /**
   * Envía el mensaje del comensal al flujo de n8n, adjuntando el contexto
   * de la comanda acumulada para que Don Beto calcule el monto consolidado real.
   */
  enviarMensajeN8n(message: string, mesa: string, contextoComanda?: string): Observable<string> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });

    let mensajeFinal = message;
    if (contextoComanda && contextoComanda.trim()) {
      mensajeFinal = `[ESTADO COMANDA MESA: ${contextoComanda.trim()}]\n\nCliente: ${message}`;
    }

    const payload: N8nWebhookPayload = {
      message: mensajeFinal,
      mesa,
    };

    return this.http.post(this.webhookUrl, payload, {
      headers,
      responseType: 'text',
    });
  }

  /**
   * Confirma y marcha la comanda real a la base de datos PostgreSQL del restaurante,
   * cambiando la mesa a OCUPADA y disparando los WebSockets para la cocina y el salón.
   */
  confirmarPedidoEnCocina(mesaNumero: string, items: ItemComanda[]): Observable<any> {
    const mesaBackend = formatearMesaParaBackend(mesaNumero);

    const payload = {
      mesaNumero: mesaBackend,
      items: items.map((i) => ({
        platoId: i.platoId,
        varianteId: i.varianteId || undefined,
        cantidad: i.cantidad,
        notas: i.notas || undefined,
      })),
    };

    return this.http.post<any>(`${this.apiUrl}/ia/confirmar`, payload);
  }

  /**
   * Analiza el texto en lenguaje natural y extrae los platos y bebidas correspondientes
   * al menú real de Peña Tukuypaj, manteniendo actualizada la comanda acumulada.
   */
  extraerItemsDeTexto(
    texto: string,
    categorias: CategoriaPublica[],
    comandaPrevia: ItemComanda[] = [],
  ): ItemComanda[] {
    if (!texto || !categorias || categorias.length === 0) return [...comandaPrevia];

    const textoNorm = this.normalizarTexto(texto);
    const resultado: ItemComanda[] = [...comandaPrevia];

    // Mapear todos los platos disponibles
    const todosLosPlatos: PlatoPublico[] = [];
    for (const cat of categorias) {
      if (cat.platos) {
        todosLosPlatos.push(...cat.platos);
      }
    }

    for (const plato of todosLosPlatos) {
      const nombreNorm = this.normalizarTexto(plato.nombre);
      const matchPlato = this.coincidePlato(textoNorm, nombreNorm);

      if (matchPlato) {
        // 1. Extraer cantidad
        const cantidad = this.extraerCantidad(textoNorm, matchPlato.index);

        // 2. Resolver variante de porción (ej: Entero, Medio, Especial)
        let precio = Number(plato.precioVenta);
        let varianteId: string | undefined = undefined;
        let varianteNombre: string | undefined = undefined;
        let nombreCompleto = plato.nombre;

        if (plato.variantes && plato.variantes.length > 0) {
          const variantesOrdenadas = [...plato.variantes].sort(
            (a, b) => Number(b.precio) - Number(a.precio),
          );

          let varianteMatch: VariantePublica | undefined = undefined;

          // 1. Coincidencia directa por nombre de variante
          for (const v of variantesOrdenadas) {
            const vNorm = this.normalizarTexto(v.nombre);
            if (textoNorm.includes(vNorm)) {
              varianteMatch = v;
              break;
            }
          }

          // 2. Coincidencia inteligente por palabras clave de variante (ej: jarra, entera, media, chico)
          if (!varianteMatch) {
            const palabras = textoNorm.split(' ');
            const tiene = (terminos: string[]) =>
              terminos.some((t) => palabras.includes(t) || textoNorm.includes(t));

            if (tiene(['media', 'medio', 'medios', 'pequeno', 'pequena', 'chica', 'chico', 'mitad', 'jarrita'])) {
              varianteMatch = variantesOrdenadas.find((v) => {
                const vn = this.normalizarTexto(v.nombre);
                return vn.includes('media') || vn.includes('medio') || vn.includes('pequeno');
              });
            } else if (tiene(['especial', 'tukuypaj'])) {
              varianteMatch = variantesOrdenadas.find((v) => {
                const vn = this.normalizarTexto(v.nombre);
                return vn.includes('especial') || vn.includes('tukuypaj');
              });
            } else if (tiene(['entero', 'entera', 'enteros', 'enteras', 'grande', 'grandes', 'jarra', 'completo', 'completa'])) {
              varianteMatch = variantesOrdenadas.find((v) => {
                const vn = this.normalizarTexto(v.nombre);
                return vn.includes('entero') || vn.includes('entera') || vn.includes('grande');
              });
            }
          }

          // Si no se especificó variante explícita pero se pidió el plato, usar Entero/Grande o la primera
          if (!varianteMatch) {
            varianteMatch =
              variantesOrdenadas.find((v) => {
                const vn = this.normalizarTexto(v.nombre);
                return vn.includes('entero') || vn.includes('entera') || vn.includes('grande');
              }) || variantesOrdenadas[0];
          }

          if (varianteMatch) {
            varianteId = varianteMatch.id;
            varianteNombre = varianteMatch.nombre;
            precio = Number(varianteMatch.precio);
            nombreCompleto = `${plato.nombre} (${varianteMatch.nombre})`;
          }
        }

        // Detectar si el usuario pide eliminar / quitar este plato o dice "te equivocaste"
        // NOTA: "cancelar" en Bolivia suele usarse como "cancelar la cuenta / pagar en efectivo",
        // por lo que NO debe interpretarse como eliminar un plato a menos que sea específicamente borrar el plato.
        // Si además el texto incluye palabras afirmativas ("anoto", "anotado", "sale", "marcho"), es una adición.
        const tienePalabrasAfirmativas =
          textoNorm.includes('anoto') ||
          textoNorm.includes('anotado') ||
          textoNorm.includes('le anoto') ||
          textoNorm.includes('sale ') ||
          textoNorm.includes('marcho');

        const esEliminacion =
          !tienePalabrasAfirmativas &&
          (textoNorm.includes('quitar') ||
            textoNorm.includes('eliminar') ||
            textoNorm.includes('borrar') ||
            textoNorm.includes('no quiero') ||
            textoNorm.includes('sin la jarra') ||
            textoNorm.includes('te equivocaste') ||
            (textoNorm.includes('cancelar') &&
              !textoNorm.includes('cancelar en') &&
              !textoNorm.includes('cancelar con') &&
              !textoNorm.includes('cancelar aqui') &&
              !textoNorm.includes('cancelar mediante') &&
              !textoNorm.includes('puede cancelar') &&
              !textoNorm.includes('puedo cancelar')));

        const idxExistente = resultado.findIndex(
          (item) => item.platoId === plato.id && (item.varianteId || '') === (varianteId || ''),
        );

        if (esEliminacion) {
          if (idxExistente >= 0) {
            resultado.splice(idxExistente, 1);
          }
          continue;
        }

        // Detectar notas asociadas en la misma frase (ej: "sin chorizo", "sin locoto", "poco picante")
        let notasItem: string | undefined = undefined;
        const matchSin = textoNorm.match(/\bsin\s+(?:nada\s+de\s+)?([a-zñáéíóú]+(?:\s+[a-zñáéíóú]+)?)/i);
        if (matchSin) {
          const itemSin = matchSin[1].trim();
          const excluir = ['jarra', 'entero', 'medio', 'plato', 'porfa', 'por favor', 'duda', 'consulta'];
          if (!excluir.includes(itemSin)) {
            notasItem = `sin ${itemSin}`;
          }
        } else if (textoNorm.includes('sin locoto')) {
          notasItem = 'sin locoto';
        } else if (textoNorm.includes('sin picante')) {
          notasItem = 'sin picante';
        } else if (textoNorm.includes('con poco locoto') || textoNorm.includes('poco picante')) {
          notasItem = 'poco picante';
        } else if (textoNorm.includes('harto locoto')) {
          notasItem = 'con harto locoto';
        } else if (textoNorm.includes('bien cocido')) {
          notasItem = 'bien cocido';
        }

        // 3. Buscar si ya estaba en la comanda para actualizar cantidad o agregar
        if (idxExistente >= 0) {
          resultado[idxExistente].cantidad = Math.max(resultado[idxExistente].cantidad, cantidad);
          if (notasItem) resultado[idxExistente].notas = notasItem;
        } else {
          resultado.push({
            platoId: plato.id,
            varianteId,
            varianteNombre,
            nombre: nombreCompleto,
            cantidad,
            precioUnitario: precio,
            notas: notasItem,
          });
        }
      }
    }

    return resultado;
  }

  // ─────────────────────────────────────────────
  // UTILIDADES DE PROCESAMIENTO NATURAL
  // ─────────────────────────────────────────────

  private normalizarTexto(str: string): string {
    return (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private coincidePlato(texto: string, nombrePlato: string): { index: number } | null {
    // Si estamos evaluando 'Caldo de Cola' y el texto menciona 'coca cola',
    // evitar falso positivo con la gaseosa a menos que explícitamente se pida caldo o sopa
    if (nombrePlato.includes('cola') && !nombrePlato.includes('coca')) {
      const esGaseosa =
        texto.includes('coca cola') ||
        texto.includes('coca-cola') ||
        texto.includes('cocacola') ||
        texto.includes('gaseosa');
      const tienePalabraCaldo =
        texto.includes('caldo') ||
        texto.includes('sopa') ||
        texto.includes('kawi');
      if (esGaseosa && !tienePalabraCaldo) {
        return null;
      }
    }

    // Reglas de alias para gastronomía local y bebidas
    const aliasMap: Record<string, string[]> = {
      'coca cola': ['cocacola', 'coca', 'coca-cola', 'gaseosa coca', 'gaseosa'],
      fanta: ['gaseosa fanta'],
      sprite: ['gaseosa sprite'],
      charque: ['charquecito', 'charques', 'charquecitos'],
      pique: ['pique macho', 'piquemacho', 'piques', 'piquecito', 'piquecitos'],
      planchita: ['plancha', 'planchitas'],
      matambre: ['matambres', 'matambrito', 'matambritos'],
      lapping: ['lapin', 'lapings'],
      pampaku: ['pampaku', 'pampacu', 'pampakus'],
      kawi: ['caldo kawi', 'kawis', 'caldo de kawi'],
      'caldo de cola': ['caldocola', 'caldo cola', 'sopa de cola', 'caldo colita'],
      'rinon al perol': ['perol', 'rinon perol'],
      rinon: ['caldo de rinon'],
      'chanka de pollo': ['chanka', 'chancadepollo', 'chanca de pollo'],
      hervido: [
        'hervidos',
        'hervidito',
        'herviditos',
        'jarra',
        'jarras',
        'jarrita',
        'jarritas',
        'el de jarra',
        'la de jarra',
        'de jarra',
        'la entera',
        'mi entera',
        'una entera',
        'entera nomas',
        'jarra hervido',
        'jarra de hervido',
        'jarra entera',
        'media jarra',
      ],
      huari: ['cerveza huari'],
      pacena: ['cerveza pacena', 'chela pacena'],
    };

    // Coincidencia directa con límites de palabra
    const regexDirecto = new RegExp(`(?:^|\\s)${nombrePlato}(?:\\s|$)`, 'i');
    const matchDir = texto.match(regexDirecto);
    if (matchDir && matchDir.index !== undefined) {
      return { index: matchDir.index };
    }

    const aliases = aliasMap[nombrePlato] || [];
    for (const a of aliases) {
      const aNorm = this.normalizarTexto(a);
      const regexAlias = new RegExp(`(?:^|\\s)${aNorm}(?:\\s|$)`, 'i');
      const matchAlias = texto.match(regexAlias);
      if (matchAlias && matchAlias.index !== undefined) {
        return { index: matchAlias.index };
      }
    }

    return null;
  }

  private extraerCantidad(texto: string, indicePlato: number): number {
    const fragmento = texto.slice(Math.max(0, indicePlato - 25), indicePlato + 25);

    if (/\b(dos|2)\b/i.test(fragmento)) return 2;
    if (/\b(tres|3)\b/i.test(fragmento)) return 3;
    if (/\b(cuatro|4)\b/i.test(fragmento)) return 4;
    if (/\b(cinco|5)\b/i.test(fragmento)) return 5;
    if (/\b(seis|6)\b/i.test(fragmento)) return 6;
    if (/\b(un|uno|una|1)\b/i.test(fragmento)) return 1;

    const numMatch = fragmento.match(/\b\d+\b/);
    if (numMatch) {
      const val = parseInt(numMatch[0], 10);
      if (val > 0 && val < 50) return val;
    }

    return 1;
  }
}
