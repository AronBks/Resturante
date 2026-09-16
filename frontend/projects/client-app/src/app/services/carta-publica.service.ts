// ============================================================
// CartaPublicaService — Consumo del Menú Digital Público
//
// Consulta GET /api/carta/publica (sin JWT).
// Mantiene un Signal reactivo con las categorías + platos
// disponibles, actualizable en tiempo real vía WebSocket.
// ============================================================

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface VariantePublica {
  id: string;
  nombre: string;
  precio: number;
  disponible: boolean;
}

export interface PlatoPublico {
  id: string;
  nombre: string;
  descripcion?: string;
  precioVenta: number;
  imagenUrl?: string;
  horaInicio?: string | null;
  horaFin?: string | null;
  disponibleAhora?: boolean;
  stockActual?: number | null;
  controlarStock?: boolean;
  stockMinimo?: number;
  agotado?: boolean;
  variantes?: VariantePublica[];
}

export interface CategoriaPublica {
  id: number;
  nombre: string;
  descripcion?: string;
  orden?: number;
  platos: PlatoPublico[];
}

export const CLOUDINARY_DISHES_MAP: Record<string, string> = {
  pique: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1788149317/imagen_2026-08-31_000836078_qsx36z.png',
  charque: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1788148006/imagen_2026-08-30_234644832_rzmnlb.png',
  matambre: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1788727966/imagen_2026-09-06_165244510_bcowih.png',
  planchita: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1784584019/128-image_web_q0hfc9.jpg',
  lapping: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1788148549/imagen_2026-08-30_235546907_jepqxy.png',
  pampa: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1768345718/pampaku_xq0ery.jpg',
  picante: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1788148920/imagen_2026-08-31_000159494_wohszo.png',
  caldocola: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1788186581/imagen_2026-08-31_102937931_hekruk.png',
  chankapollo: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1788186618/imagen_2026-08-31_103016359_tbagpm.png',
  kawi: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1788187077/imagen_2026-08-31_103754357_j15tvd.png',
  mixto: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1788187431/imagen_2026-08-31_104348629_eqnlgx.png',
  pulpitos: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1788187649/imagen_2026-08-31_104727437_va831n.png',
  rinon: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1788187778/imagen_2026-08-31_104910253_zyn75s.png',
  rinonperol: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1788188359/imagen_2026-08-31_105916523_vnltvb.png',
  cascada: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1788188707/imagen_2026-08-31_110504501_aes1qs.png',
  cocacola: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1788188744/imagen_2026-08-31_110542466_ie0rbm.png',
  fanta: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1788189726/imagen_2026-08-31_112203919_ektxjf.png',
  simba: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1788188831/imagen_2026-08-31_110659388_zhhqsl.png',
  sprite: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1788188853/imagen_2026-08-31_110712193_czeqsb.png',
  acuarius: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1788189793/imagen_2026-08-31_112311316_p1ak1c.png',
  delvalle: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1788188966/imagen_2026-08-31_110918796_umt3wg.png',
  puravida: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1788188998/imagen_2026-08-31_110954488_cx756s.png',
  hervido: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1788189390/imagen_2026-08-31_111617464_glk2sd.png',
  huari: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1788189407/imagen_2026-08-31_111645781_hubsxx.png',
  pacena: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1788189457/imagen_2026-08-31_111735504_vdr4d4.png',
};

/**
 * Resuelve la imagen oficial de Cloudinary según el nombre del plato
 */
export function resolverImagenCloudinary(nombre: string, imagenOriginal?: string): string {
  const n = (nombre || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['`’\s-]/g, '');

  if (n.includes('coca')) return CLOUDINARY_DISHES_MAP['cocacola'];
  if (n.includes('cascada')) return CLOUDINARY_DISHES_MAP['cascada'];
  if (n.includes('fanta')) return CLOUDINARY_DISHES_MAP['fanta'];
  if (n.includes('simba')) return CLOUDINARY_DISHES_MAP['simba'];
  if (n.includes('sprite')) return CLOUDINARY_DISHES_MAP['sprite'];
  if (n.includes('acuari') || n.includes('aquari')) return CLOUDINARY_DISHES_MAP['acuarius'];
  if (n.includes('valle')) return CLOUDINARY_DISHES_MAP['delvalle'];
  if (n.includes('puravida')) return CLOUDINARY_DISHES_MAP['puravida'];
  if (n.includes('hervido')) return CLOUDINARY_DISHES_MAP['hervido'];
  if (n.includes('huari')) return CLOUDINARY_DISHES_MAP['huari'];
  if (n.includes('pacen')) return CLOUDINARY_DISHES_MAP['pacena'];

  if (n.includes('perol')) return CLOUDINARY_DISHES_MAP['rinonperol'];
  if (n.includes('rinon')) return CLOUDINARY_DISHES_MAP['rinon'];
  if (n.includes('cola')) return CLOUDINARY_DISHES_MAP['caldocola'];
  if (n.includes('chanka')) return CLOUDINARY_DISHES_MAP['chankapollo'];
  if (n.includes('kawi')) return CLOUDINARY_DISHES_MAP['kawi'];
  if (n.includes('pulpito')) return CLOUDINARY_DISHES_MAP['pulpitos'];

  if (n.includes('pique')) return CLOUDINARY_DISHES_MAP['pique'];
  if (n.includes('charque')) return CLOUDINARY_DISHES_MAP['charque'];
  if (n.includes('matambre')) return CLOUDINARY_DISHES_MAP['matambre'];
  if (n.includes('planch')) return CLOUDINARY_DISHES_MAP['planchita'];
  if (n.includes('lapp')) return CLOUDINARY_DISHES_MAP['lapping'];
  if (n.includes('pamp')) return CLOUDINARY_DISHES_MAP['pampa'];
  if (n.includes('picant')) return CLOUDINARY_DISHES_MAP['picante'];
  if (n.includes('mixto')) return CLOUDINARY_DISHES_MAP['mixto'];

  return imagenOriginal || '';
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

  private procesarCategorias(cats: CategoriaPublica[]): CategoriaPublica[] {
    return cats.map((cat) => ({
      ...cat,
      platos: (cat.platos || []).map((p) => ({
        ...p,
        imagenUrl: resolverImagenCloudinary(p.nombre, p.imagenUrl),
      })),
    }));
  }

  /**
   * Carga inicial de la carta pública desde el backend.
   * Enriquecida con imágenes HD de Cloudinary de forma centralizada.
   */
  cargarCarta(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http.get<any>(this.apiUrl).subscribe({
      next: (res) => {
        const items = Array.isArray(res) ? res : (res?.data ?? []);
        this.categorias.set(this.procesarCategorias(items));
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
   * Actualiza en vivo el stock y disponibilidad de un plato
   * cuando se recibe un evento WebSocket de compra o reposición.
   */
  actualizarStockPlato(platoId: string, nuevoStock: number | null, disponible: boolean): void {
    this.categorias.update((cats) =>
      cats.map((cat) => ({
        ...cat,
        platos: cat.platos.map((p) => {
          if (p.id === platoId) {
            const esAgotado = (nuevoStock !== null && nuevoStock !== undefined && nuevoStock <= 0) || !disponible;
            return {
              ...p,
              stockActual: nuevoStock,
              controlarStock: true,
              disponibleAhora: !esAgotado,
              agotado: esAgotado,
            };
          }
          return p;
        }),
      })),
    );
  }

  /**
   * Cuando un plato se reactiva, hacemos un re-fetch completo
   * para obtener los datos actualizados del plato y su categoría.
   * Esto es más simple y seguro que mantener un cache parcial.
   */
  recargarCarta(): void {
    this.http.get<any>(this.apiUrl).subscribe({
      next: (res) => {
        const items = Array.isArray(res) ? res : (res?.data ?? []);
        this.categorias.set(this.procesarCategorias(items));
      },
    });
  }
}
