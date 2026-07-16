// ============================================================
// CartaPublicaService — Consumo del Menú Digital Público
//
// Consulta GET /api/carta/publica (sin JWT).
// Mantiene un Signal reactivo con las categorías + platos
// disponibles, actualizable en tiempo real vía WebSocket.
// ============================================================

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface PlatoPublico {
  id: string;
  nombre: string;
  descripcion?: string;
  precioVenta: number;
  imagenUrl?: string;
}

export interface CategoriaPublica {
  id: number;
  nombre: string;
  descripcion?: string;
  platos: PlatoPublico[];
}

@Injectable({ providedIn: 'root' })
export class CartaPublicaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/api/carta/publica';

  // ── Estado reactivo ──
  categorias = signal<CategoriaPublica[]>([]);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  totalPlatos = computed(() =>
    this.categorias().reduce((sum, cat) => sum + cat.platos.length, 0),
  );

  /**
   * Carga inicial de la carta pública desde el backend.
   * Solo incluye categorías activas con platos disponibles.
   */
  cargarCarta(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http.get<{ data: CategoriaPublica[] }>(this.apiUrl).subscribe({
      next: (res) => {
        this.categorias.set(res.data ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error cargando carta pública:', err);
        this.error.set('No se pudo cargar el menú. Intenta de nuevo.');
        this.loading.set(false);
      },
    });
  }

  /**
   * Remueve un plato del estado local cuando se desactiva
   * vía WebSocket. Si la categoría queda sin platos, también
   * se remueve para mantener la UI limpia.
   */
  removerPlato(platoId: string): void {
    this.categorias.update((cats) =>
      cats
        .map((cat) => ({
          ...cat,
          platos: cat.platos.filter((p) => p.id !== platoId),
        }))
        .filter((cat) => cat.platos.length > 0),
    );
  }

  /**
   * Cuando un plato se reactiva, hacemos un re-fetch completo
   * para obtener los datos actualizados del plato y su categoría.
   * Esto es más simple y seguro que mantener un cache parcial.
   */
  recargarCarta(): void {
    this.http.get<{ data: CategoriaPublica[] }>(this.apiUrl).subscribe({
      next: (res) => {
        this.categorias.set(res.data ?? []);
      },
    });
  }
}
