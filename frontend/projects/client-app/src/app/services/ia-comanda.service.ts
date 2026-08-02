// ============================================================
// IaComandaService — Mesero Virtual "Don Beto" (Google Gemini)
//
// Maneja la interacción conversacional fluida y en vivo con
// la IA en la client-app y sincroniza la comanda actual.
// ============================================================

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';

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

export interface MensajeHistorial {
  rol: 'usuario' | 'asistente';
  texto: string;
}

export interface ResultadoIA {
  mesa: { numero: string; estado: string };
  respuestaMesero: string;
  comandaActualizada: ItemInterpretado[];
  estadoConversacion: EstadoConversacion;
  totalEstimado: number;
  motor: 'gemini' | 'local';
}

@Injectable({ providedIn: 'root' })
export class IaComandaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/api/pedidos';

  // ── Estado reactivo ──
  loading = signal(false);
  error = signal<string | null>(null);
  resultado = signal<ResultadoIA | null>(null);
  comandaActual = signal<ItemInterpretado[]>([]);
  estadoConversacion = signal<EstadoConversacion>('SALUDO');
  
  pedidoConfirmado = signal(false);
  confirmando = signal(false);

  // ── Computed signals ──
  totalEstimado = computed(() => {
    return this.comandaActual().reduce((sum, item) => sum + item.precioUnitario * item.cantidad, 0);
  });

  hayItemsEnComanda = computed(() => this.comandaActual().length > 0);

  /**
   * Envía texto en lenguaje natural al Mesero Virtual Don Beto.
   */
  interpretarPedido(
    texto: string,
    mesaNumero: string,
    historial: MensajeHistorial[] = [],
  ): void {
    this.loading.set(true);
    this.error.set(null);

    const bodyPayload = {
      texto,
      mesaNumero,
      historial,
      comandaPrevia: this.comandaActual(),
    };

    this.http
      .post<ResultadoIA>(`${this.apiUrl}/ia`, bodyPayload)
      .subscribe({
        next: (res) => {
          this.resultado.set(res);
          this.comandaActual.set(res.comandaActualizada || []);
          this.estadoConversacion.set(res.estadoConversacion || 'TOMANDO_PEDIDO');
          this.loading.set(false);
        },
        error: (err) => {
          const msg =
            err.error?.message ||
            '¡Uy casero! Tuve un inconveniente al escucharte. ¿Me repites por favor?';
          this.error.set(msg);
          this.loading.set(false);
        },
      });
  }

  /**
   * Confirma el pedido y lo envía directo a cocina.
   */
  confirmarPedido(
    mesaNumero: string,
    itemsOverride?: ItemInterpretado[],
  ): void {
    const itemsAConfirmar = itemsOverride || this.comandaActual();
    if (itemsAConfirmar.length === 0) return;

    this.confirmando.set(true);
    this.error.set(null);

    const payloadItems = itemsAConfirmar.map((i) => ({
      platoId: i.platoId,
      varianteId: i.varianteId || undefined,
      cantidad: i.cantidad,
      notas: i.notas || undefined,
    }));

    this.http
      .post(`${this.apiUrl}/ia/confirmar`, {
        mesaNumero,
        items: payloadItems,
      })
      .subscribe({
        next: () => {
          this.confirmando.set(false);
          this.pedidoConfirmado.set(true);
        },
        error: (err) => {
          const msg =
            err.error?.message ||
            'Ocurrió un error al enviar el pedido a cocina. Intenta de nuevo por favor.';
          this.error.set(msg);
          this.confirmando.set(false);
        },
      });
  }

  /**
   * Modifica la cantidad de un plato en el ticket en vivo.
   */
  actualizarCantidad(platoId: string, varianteId: string | undefined, delta: number): void {
    this.comandaActual.update((items) => {
      return items
        .map((item) => {
          if (item.platoId === platoId && item.varianteId === varianteId) {
            const nuevaCantidad = item.cantidad + delta;
            return nuevaCantidad > 0 ? { ...item, cantidad: nuevaCantidad } : null;
          }
          return item;
        })
        .filter((item): item is ItemInterpretado => item !== null);
    });
  }

  /**
   * Elimina un plato del ticket en vivo.
   */
  eliminarItem(platoId: string, varianteId?: string): void {
    this.comandaActual.update((items) =>
      items.filter((i) => !(i.platoId === platoId && i.varianteId === varianteId)),
    );
  }

  /**
   * Resetea el estado para reiniciar la interacción.
   */
  reset(): void {
    this.loading.set(false);
    this.error.set(null);
    this.resultado.set(null);
    this.comandaActual.set([]);
    this.estadoConversacion.set('SALUDO');
    this.pedidoConfirmado.set(false);
    this.confirmando.set(false);
  }
}
