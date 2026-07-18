// ============================================================
// IaComandaService — Comunicación con el motor de IA del backend
//
// Maneja las dos fases del flujo de pedidos autónomos:
//   1. Interpretación: envía texto natural → recibe items identificados
//   2. Confirmación: envía items confirmados → pedido transaccional
// ============================================================

import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface ItemInterpretado {
  platoId: string;
  varianteId?: string;
  nombre: string;
  cantidad: number;
  notas: string;
  precioUnitario: number;
  variantes?: { id: string; nombre: string; precio: number }[];
}

export interface ResultadoIA {
  mesa: { numero: string; estado: string };
  items: ItemInterpretado[];
  mensajeIA: string;
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
  pedidoConfirmado = signal(false);
  confirmando = signal(false);

  /**
   * Fase 1: Envía texto en lenguaje natural para interpretación por IA.
   */
  interpretarPedido(texto: string, mesaNumero: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.resultado.set(null);

    this.http
      .post<{ data: ResultadoIA }>(`${this.apiUrl}/ia`, {
        texto,
        mesaNumero,
      })
      .subscribe({
        next: (res) => {
          this.resultado.set(res.data);
          this.loading.set(false);
        },
        error: (err) => {
          const msg =
            err.error?.message ||
            'No pude procesar tu pedido. Intenta de nuevo.';
          this.error.set(msg);
          this.loading.set(false);
        },
      });
  }

  /**
   * Fase 2: Confirma el pedido interpretado y lo registra en el backend.
   */
  confirmarPedido(
    mesaNumero: string,
    items: { platoId: string; varianteId?: string; cantidad: number; notas?: string }[],
  ): void {
    this.confirmando.set(true);
    this.error.set(null);

    this.http
      .post(`${this.apiUrl}/ia/confirmar`, {
        mesaNumero,
        items,
      })
      .subscribe({
        next: () => {
          this.confirmando.set(false);
          this.pedidoConfirmado.set(true);
        },
        error: (err) => {
          const msg =
            err.error?.message ||
            'Error al confirmar tu pedido. Intenta de nuevo.';
          this.error.set(msg);
          this.confirmando.set(false);
        },
      });
  }

  /**
   * Resetea el estado para un nuevo pedido.
   */
  reset(): void {
    this.loading.set(false);
    this.error.set(null);
    this.resultado.set(null);
    this.pedidoConfirmado.set(false);
    this.confirmando.set(false);
  }
}
