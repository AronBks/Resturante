import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { PlatoPublico, VariantePublica } from './carta-publica.service';
import { Observable } from 'rxjs';

export interface ItemCarrito {
  platoId: string;
  varianteId?: string;
  varianteNombre?: string;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  notas: string;
  imagenUrl?: string;
}

export interface ResumenPedidoConfirmado {
  id?: string;
  codigo: string;
  mesaNumero: string;
  estado?: string;
  horaRecibido: string;
  horaCocina: string;
  items: ItemCarrito[];
  total: number;
}

const CLOUDINARY_DISHES_MAP: Record<string, string> = {
  pique: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1788149317/imagen_2026-08-31_000836078_qsx36z.png',
  charque: 'https://res.cloudinary.com/dwquu4l5w/image/upload/v1788148006/imagen_2026-08-30_234644832_rzmnlb.png',
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

function resolverFotoPlato(nombre: string, imagenOriginal?: string): string | undefined {
  const n = (nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['`’\s-]/g, '');

  // 1. Bebidas (coca antes de caldocola)
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

  // 2. Caldos y Especialidades
  if (n.includes('perol')) return CLOUDINARY_DISHES_MAP['rinonperol'];
  if (n.includes('rinon')) return CLOUDINARY_DISHES_MAP['rinon'];
  if (n.includes('cola')) return CLOUDINARY_DISHES_MAP['caldocola'];
  if (n.includes('chanka')) return CLOUDINARY_DISHES_MAP['chankapollo'];
  if (n.includes('kawi')) return CLOUDINARY_DISHES_MAP['kawi'];
  if (n.includes('pulpito')) return CLOUDINARY_DISHES_MAP['pulpitos'];

  // 3. Platos Tradicionales
  if (n.includes('pique')) return CLOUDINARY_DISHES_MAP['pique'];
  if (n.includes('charque')) return CLOUDINARY_DISHES_MAP['charque'];
  if (n.includes('planch')) return CLOUDINARY_DISHES_MAP['planchita'];
  if (n.includes('lapp')) return CLOUDINARY_DISHES_MAP['lapping'];
  if (n.includes('pamp')) return CLOUDINARY_DISHES_MAP['pampa'];
  if (n.includes('picant')) return CLOUDINARY_DISHES_MAP['picante'];
  if (n.includes('mixto')) return CLOUDINARY_DISHES_MAP['mixto'];

  return imagenOriginal;
}

import { SocketPublicoService } from './socket-publico.service';

@Injectable({
  providedIn: 'root',
})
export class CarritoService {
  private readonly http = inject(HttpClient);
  private readonly socketPublico = inject(SocketPublicoService);
  private readonly apiUrl = 'http://localhost:3000/api/pedidos';

  // ── Estado reactivo del carrito ──
  items = signal<ItemCarrito[]>([]);
  confirmando = signal(false);
  pedidoConfirmado = signal(false);
  ultimoPedido = signal<ResumenPedidoConfirmado | null>(null);
  error = signal<string | null>(null);

  // ── Solicitar Atención Presencial (Llamar Mesero) ──
  meseroLlamadoStatus = signal<'idle' | 'calling' | 'success' | 'en_camino' | 'error'>('idle');

  // ── Inicialización desde localStorage (Persistencia) ──
  constructor() {
    this.cargarDeLocalStorage();
    this.socketPublico.onMeseroAtendido().subscribe(() => {
      this.meseroLlamadoStatus.set('en_camino');
      setTimeout(() => this.meseroLlamadoStatus.set('idle'), 12000);
    });

    this.socketPublico.onEstadoPedidoActualizado().subscribe((evento) => {
      const currentMesa = localStorage.getItem('tukuypaj_mesa_asignada') || 'M01';
      if (evento.mesaNumero === currentMesa) {
        this.ultimoPedido.update((p) => {
          if (!p) return p;
          const updated = {
            ...p,
            estado: evento.estado,
          };
          try {
            localStorage.setItem(
              `tukuypaj_pedido_activo_${evento.mesaNumero}`,
              JSON.stringify(updated)
            );
          } catch (e) {}
          return updated;
        });
      }
    });
  }

  // ── Computed Signals ──
  cantidadTotalItems = computed(() => {
    return this.items().reduce((sum, item) => sum + item.cantidad, 0);
  });

  totalAcumulado = computed(() => {
    return this.items().reduce((sum, item) => sum + item.precioUnitario * item.cantidad, 0);
  });

  subtotal = computed(() => this.totalAcumulado());

  // ── Operaciones del Carrito ──

  agregarPlato(plato: PlatoPublico, variante?: VariantePublica): boolean {
    if (plato.disponibleAhora === false) {
      this.error.set(`"${plato.nombre}" no está disponible en este horario (${plato.horaInicio || ''} a ${plato.horaFin || 'cierre'}).`);
      return false;
    }

    this.items.update((currentItems) => {
      const index = currentItems.findIndex(
        (item) => item.platoId === plato.id && item.varianteId === (variante?.id || undefined)
      );
      let updated: ItemCarrito[];

      if (index > -1) {
        updated = currentItems.map((item, idx) =>
          idx === index ? { ...item, cantidad: item.cantidad + 1 } : item
        );
      } else {
        updated = [
          ...currentItems,
          {
            platoId: plato.id,
            varianteId: variante?.id,
            varianteNombre: variante?.nombre,
            nombre: plato.nombre,
            precioUnitario: variante ? variante.precio : plato.precioVenta,
            cantidad: 1,
            notas: '',
            imagenUrl: resolverFotoPlato(plato.nombre, plato.imagenUrl),
          },
        ];
      }
      this.guardarEnLocalStorage(updated);
      return updated;
    });
    return true;
  }

  removerPlato(platoId: string, varianteId?: string): void {
    this.items.update((currentItems) => {
      const index = currentItems.findIndex(
        (item) => item.platoId === platoId && item.varianteId === (varianteId || undefined)
      );
      if (index === -1) return currentItems;

      let updated: ItemCarrito[];
      const item = currentItems[index];

      if (item.cantidad > 1) {
        updated = currentItems.map((it, idx) =>
          idx === index ? { ...it, cantidad: it.cantidad - 1 } : it
        );
      } else {
        updated = currentItems.filter((_, idx) => idx !== index);
      }
      this.guardarEnLocalStorage(updated);
      return updated;
    });
  }

  actualizarCantidad(platoId: string, varianteId: string | undefined, cantidad: number): void {
    if (cantidad <= 0) {
      this.items.update((currentItems) => {
        const updated = currentItems.filter(
          (item) => !(item.platoId === platoId && item.varianteId === (varianteId || undefined))
        );
        this.guardarEnLocalStorage(updated);
        return updated;
      });
      return;
    }

    this.items.update((currentItems) => {
      const updated = currentItems.map((item) =>
        item.platoId === platoId && item.varianteId === (varianteId || undefined)
          ? { ...item, cantidad }
          : item
      );
      this.guardarEnLocalStorage(updated);
      return updated;
    });
  }

  actualizarNotas(platoId: string, varianteId: string | undefined, notas: string): void {
    this.items.update((currentItems) => {
      const updated = currentItems.map((item) =>
        item.platoId === platoId && item.varianteId === (varianteId || undefined)
          ? { ...item, notas }
          : item
      );
      this.guardarEnLocalStorage(updated);
      return updated;
    });
  }

  obtenerCantidad(platoId: string, varianteId?: string): number {
    const item = this.items().find(
      (it) => it.platoId === platoId && it.varianteId === (varianteId || undefined)
    );
    return item ? item.cantidad : 0;
  }

  limpiarCarrito(): void {
    this.items.set([]);
    this.pedidoConfirmado.set(false);
    this.confirmando.set(false);
    this.error.set(null);
    localStorage.removeItem('tukuypaj_carrito');
  }

  // ── API: Confirmación de Pedido ──
  enviarPedido(mesaNumero: string): Observable<any> {
    this.confirmando.set(true);
    this.error.set(null);

    const payload = {
      mesaNumero,
      items: this.items().map((item) => ({
        platoId: item.platoId,
        varianteId: item.varianteId || undefined,
        cantidad: item.cantidad,
        notas: item.notas || undefined,
      })),
    };

    return new Observable((subscriber) => {
      const itemsSnapshot = [...this.items()];
      const totalSnapshot = this.totalAcumulado();
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const horaRecibido = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const cocinaTime = new Date(now.getTime() + 5 * 60000);
      const horaCocina = `${pad(cocinaTime.getHours())}:${pad(cocinaTime.getMinutes())}`;
      const randomNum = Math.floor(1000 + Math.random() * 9000);

      this.http.post(`${this.apiUrl}/ia/confirmar`, payload).subscribe({
        next: (response: any) => {
          const codigo = response?.pedido?.codigo || `TK-${randomNum}`;

          const resumen: ResumenPedidoConfirmado = {
            codigo,
            mesaNumero,
            horaRecibido,
            horaCocina,
            items: itemsSnapshot,
            total: totalSnapshot,
          };

          this.ultimoPedido.set(resumen);
          this.pedidoConfirmado.set(true);
          this.items.set([]);
          localStorage.removeItem('tukuypaj_carrito');

          try {
            localStorage.setItem(
              `tukuypaj_pedido_activo_${mesaNumero}`,
              JSON.stringify(resumen)
            );
          } catch (e) {
            console.error('Error guardando pedido activo en localStorage:', e);
          }

          this.confirmando.set(false);
          subscriber.next(response);
          subscriber.complete();
        },
        error: (err) => {
          this.confirmando.set(false);
          const msg =
            err.error?.message ||
            'Error al enviar el pedido a la cocina. Intenta de nuevo.';
          this.error.set(msg);
          subscriber.error(err);
        },
      });
    });
  }

  /**
   * Consulta el pedido activo de la mesa en el backend para restaurar el seguimiento
   * incluso después de recargar la página (F5) o cerrar el navegador.
   */
  consultarPedidoActivoMesa(mesaNumero: string): Observable<any> {
    return new Observable((subscriber) => {
      // 1. Cargar cache local de inmediato para evitar pantalla en blanco
      const cached = localStorage.getItem(`tukuypaj_pedido_activo_${mesaNumero}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          this.ultimoPedido.set(parsed);
          this.pedidoConfirmado.set(true);
        } catch (e) {}
      }

      // 2. Sincronizar en vivo con el backend
      this.http.get<any>(`${this.apiUrl}/publica/mesa/${mesaNumero}/activo`).subscribe({
        next: (res) => {
          const pedidoActivo = res?.data?.pedidoActivo ?? res?.pedidoActivo ?? (res?.id ? res : null);
          if (pedidoActivo) {
            this.ultimoPedido.set(pedidoActivo);
            this.pedidoConfirmado.set(true);
            try {
              localStorage.setItem(
                `tukuypaj_pedido_activo_${mesaNumero}`,
                JSON.stringify(pedidoActivo)
              );
            } catch (e) {}
          } else {
            // Mesa ya no tiene pedido activo (cuenta pagada o liberada)
            if (!this.items().length) {
              this.ultimoPedido.set(null);
              this.pedidoConfirmado.set(false);
            }
            try {
              localStorage.removeItem(`tukuypaj_pedido_activo_${mesaNumero}`);
            } catch (e) {}
          }
          subscriber.next(pedidoActivo);
          subscriber.complete();
        },
        error: (err) => {
          console.warn('No se pudo sincronizar el pedido activo:', err);
          subscriber.next(this.ultimoPedido());
          subscriber.complete();
        },
      });
    });
  }

  // ── Solicitar Atención Presencial (Llamar Mesero) ──
  llamarMesero(mesaNumero: string, motivo?: string): Observable<any> {
    this.meseroLlamadoStatus.set('calling');
    return new Observable((subscriber) => {
      this.http.post(`${this.apiUrl}/llamar-mesero`, { mesaNumero, motivo }).subscribe({
        next: (res: any) => {
          this.meseroLlamadoStatus.set('success');
          setTimeout(() => this.meseroLlamadoStatus.set('idle'), 6000);
          subscriber.next(res);
          subscriber.complete();
        },
        error: (err) => {
          this.meseroLlamadoStatus.set('error');
          setTimeout(() => this.meseroLlamadoStatus.set('idle'), 4000);
          subscriber.error(err);
        },
      });
    });
  }

  // ── Persistencia Local ──
  private guardarEnLocalStorage(items: ItemCarrito[]): void {
    try {
      localStorage.setItem('tukuypaj_carrito', JSON.stringify(items));
    } catch (e) {
      console.error('Error guardando el carrito en localStorage', e);
    }
  }

  private cargarDeLocalStorage(): void {
    try {
      const data = localStorage.getItem('tukuypaj_carrito');
      if (data) {
        this.items.set(JSON.parse(data));
      }
    } catch (e) {
      console.error('Error cargando el carrito desde localStorage', e);
    }
  }
}
