// ============================================================
// MenuDigitalComponent — Carta Interactiva en Tiempo Real
//
// Componente estrella de la client-app:
// - Carga la carta pública desde GET /api/carta/publica
// - Se suscribe al WebSocket público (/publica) para recibir
//   cambios de disponibilidad en tiempo real
// - Platos no disponibles se ocultan con animación fadeOut
// - Platos reactivados aparecen con re-fetch + fadeIn
// - Sticky category tabs con scroll horizontal
// - Mobile-first, optimizado para pantallas de teléfono
// ============================================================

import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { CartaPublicaService, CategoriaPublica, PlatoPublico, VariantePublica } from '../../services/carta-publica.service';
import { SocketPublicoService } from '../../services/socket-publico.service';
import { CarritoService } from '../../services/carrito.service';
import { CarritoDrawerComponent } from '../carrito-drawer/carrito-drawer.component';

@Component({
  selector: 'client-menu-digital',
  standalone: true,
  imports: [CommonModule, RouterLink, CarritoDrawerComponent, LucideAngularModule],
  templateUrl: './menu-digital.component.html',
  styleUrl: './menu-digital.component.scss',
})
export class MenuDigitalComponent implements OnInit, OnDestroy {
  readonly cartaService = inject(CartaPublicaService);
  readonly carritoService = inject(CarritoService);
  private readonly socketService = inject(SocketPublicoService);
  private readonly route = inject(ActivatedRoute);
  private wsSub!: Subscription;

  // Control de visibilidad de drawers y modales
  drawerOpen = signal(false);
  mobileNavOpen = signal(false);
  tableModalOpen = signal(false);

  // Número de mesa para pasar al FAB de IA
  mesaNumero = signal('M01');

  // ── Estado local del UI ──
  selectedCategoryId = signal<number | null>(null);
  removingPlatoIds = signal<Set<string>>(new Set());

  // Selector modal de variantes
  selectedPlatoParaVariante = signal<PlatoPublico | null>(null);
  selectedVariante = signal<VariantePublica | null>(null);

  // WebSocket connection status
  isLive = this.socketService.isConnected;

  toggleMobileNav(): void {
    this.mobileNavOpen.update((v) => !v);
  }

  abrirCarrito(): void {
    if (this.carritoService.ultimoPedido() && !this.carritoService.items().length) {
      this.carritoService.pedidoConfirmado.set(true);
    }
    this.drawerOpen.set(true);
  }

  abrirMesaModal(): void {
    this.tableModalOpen.set(true);
  }

  cerrarMesaModal(): void {
    this.tableModalOpen.set(false);
  }

  // ── Computed Signals ──
  filteredCategorias = computed<CategoriaPublica[]>(() => {
    const catId = this.selectedCategoryId();
    const cats = this.cartaService.categorias();
    if (catId === null) return cats;
    return cats.filter((c) => c.id === catId);
  });

  totalPlatos = this.cartaService.totalPlatos;

  ngOnInit(): void {
    // 0. Leer mesa de la URL o localStorage y restaurar comanda activa automáticamente
    this.route.queryParams.subscribe((params) => {
      let mesa = params['mesa'];
      if (mesa) {
        try { localStorage.setItem('tukuypaj_mesa_asignada', mesa); } catch (e) {}
      } else {
        try { mesa = localStorage.getItem('tukuypaj_mesa_asignada') || 'M01'; } catch (e) { mesa = 'M01'; }
      }
      this.mesaNumero.set(mesa);
      this.carritoService.consultarPedidoActivoMesa(mesa).subscribe();
    });

    // 1. Carga inicial de la carta
    this.cartaService.cargarCarta();

    // 2. Suscripción al WebSocket público para cambios en tiempo real
    this.wsSub = this.socketService
      .onDisponibilidadActualizada()
      .subscribe((evento) => {
        if (!evento.disponible) {
          // Plato desactivado → animación fadeOut + remover del estado
          this.removingPlatoIds.update((set) => {
            const next = new Set(set);
            next.add(evento.platoId);
            return next;
          });

          // Esperar a que la animación CSS termine antes de remover
          setTimeout(() => {
            this.cartaService.removerPlato(evento.platoId);
            this.removingPlatoIds.update((set) => {
              const next = new Set(set);
              next.delete(evento.platoId);
              return next;
            });
          }, 400);
        } else {
          // Plato reactivado → re-fetch para incorporarlo con sus datos
          this.cartaService.recargarCarta();
        }
      });
  }

  ngOnDestroy(): void {
    this.wsSub?.unsubscribe();
  }

  isPlatoRemoving(platoId: string): boolean {
    return this.removingPlatoIds().has(platoId);
  }

  selectCategory(catId: number | null): void {
    this.selectedCategoryId.set(catId);
  }

  // ── Operaciones con Variantes ──

  abrirSelectorVariante(plato: PlatoPublico): void {
    if (plato.disponibleAhora === false) return;
    this.selectedPlatoParaVariante.set(plato);
    const disponible = plato.variantes?.find((v) => v.disponible);
    this.selectedVariante.set(disponible || null);
  }

  seleccionarVariante(variante: VariantePublica): void {
    this.selectedVariante.set(variante);
  }

  cerrarSelectorVariante(): void {
    this.selectedPlatoParaVariante.set(null);
    this.selectedVariante.set(null);
  }

  agregarPlatoConVariante(plato: PlatoPublico): void {
    const varSel = this.selectedVariante();
    if (varSel) {
      this.carritoService.agregarPlato(plato, varSel);
      this.cerrarSelectorVariante();
      this.abrirCarrito();
    }
  }

  obtenerCantidadTotalPlato(plato: PlatoPublico): number {
    if (!plato.variantes || plato.variantes.length === 0) {
      return this.carritoService.obtenerCantidad(plato.id);
    }
    return this.carritoService.items()
      .filter((item) => item.platoId === plato.id)
      .reduce((sum, item) => sum + item.cantidad, 0);
  }

  obtenerPrecioMostrar(plato: PlatoPublico): number {
    if (!plato.variantes || plato.variantes.length === 0) {
      return plato.precioVenta;
    }
    const precios = plato.variantes.map((v) => v.precio);
    return Math.min(...precios);
  }

  /**
   * Genera nombres de íconos vectoriales Lucide según la categoría
   */
  getCategoryIcon(nombre: string): string {
    const n = nombre.toLowerCase();
    if (n.includes('tradicional')) return 'utensils-crossed';
    if (n.includes('parrilla') || n.includes('carne') || n.includes('asado')) return 'flame';
    if (n.includes('sopa') || n.includes('caldo')) return 'soup';
    if (n.includes('bebida') || n.includes('trago') || n.includes('refresco') || n.includes('cerveza')) return 'beer';
    if (n.includes('postre') || n.includes('helado') || n.includes('dulce')) return 'cake';
    return 'utensils';
  }

  readonly CLOUDINARY_DISHES: Record<string, string> = {
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

  /**
   * Obtiene la URL oficial de la imagen del plato en Cloudinary
   */
  getPlatoImageUrl(plato: any): string {
    const raw = plato?.nombre || '';
    const n = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['`’\s-]/g, '');

    // 1. Bebidas y Refrescos (coca se evalúa primero para evitar colisión con caldocola)
    if (n.includes('coca')) return this.CLOUDINARY_DISHES['cocacola'];
    if (n.includes('cascada')) return this.CLOUDINARY_DISHES['cascada'];
    if (n.includes('fanta')) return this.CLOUDINARY_DISHES['fanta'];
    if (n.includes('simba')) return this.CLOUDINARY_DISHES['simba'];
    if (n.includes('sprite')) return this.CLOUDINARY_DISHES['sprite'];
    if (n.includes('acuari') || n.includes('aquari')) return this.CLOUDINARY_DISHES['acuarius'];
    if (n.includes('valle')) return this.CLOUDINARY_DISHES['delvalle'];
    if (n.includes('puravida')) return this.CLOUDINARY_DISHES['puravida'];
    if (n.includes('hervido')) return this.CLOUDINARY_DISHES['hervido'];
    if (n.includes('huari')) return this.CLOUDINARY_DISHES['huari'];
    if (n.includes('pacen')) return this.CLOUDINARY_DISHES['pacena'];

    // 2. Caldos y Especialidades
    if (n.includes('perol')) return this.CLOUDINARY_DISHES['rinonperol'];
    if (n.includes('rinon')) return this.CLOUDINARY_DISHES['rinon'];
    if (n.includes('cola')) return this.CLOUDINARY_DISHES['caldocola'];
    if (n.includes('chanka')) return this.CLOUDINARY_DISHES['chankapollo'];
    if (n.includes('kawi')) return this.CLOUDINARY_DISHES['kawi'];
    if (n.includes('pulpito')) return this.CLOUDINARY_DISHES['pulpitos'];

    // 3. Platos Tradicionales
    if (n.includes('pique')) return this.CLOUDINARY_DISHES['pique'];
    if (n.includes('charque')) return this.CLOUDINARY_DISHES['charque'];
    if (n.includes('planch')) return this.CLOUDINARY_DISHES['planchita'];
    if (n.includes('lapp')) return this.CLOUDINARY_DISHES['lapping'];
    if (n.includes('pamp')) return this.CLOUDINARY_DISHES['pampa'];
    if (n.includes('picant')) return this.CLOUDINARY_DISHES['picante'];
    if (n.includes('mixto')) return this.CLOUDINARY_DISHES['mixto'];

    return plato?.imagenUrl || this.getFoodImageFallback(raw);
  }

  /**
   * Fallback visual con fotos culinarias HD de alta calidad
   */
  getFoodImageFallback(nombre: string): string {
    const n = (nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['`’\s-]/g, '');

    if (n.includes('coca')) return this.CLOUDINARY_DISHES['cocacola'];
    if (n.includes('cascada')) return this.CLOUDINARY_DISHES['cascada'];
    if (n.includes('fanta')) return this.CLOUDINARY_DISHES['fanta'];
    if (n.includes('simba')) return this.CLOUDINARY_DISHES['simba'];
    if (n.includes('sprite')) return this.CLOUDINARY_DISHES['sprite'];
    if (n.includes('acuari') || n.includes('aquari')) return this.CLOUDINARY_DISHES['acuarius'];
    if (n.includes('valle')) return this.CLOUDINARY_DISHES['delvalle'];
    if (n.includes('puravida')) return this.CLOUDINARY_DISHES['puravida'];
    if (n.includes('hervido')) return this.CLOUDINARY_DISHES['hervido'];
    if (n.includes('huari')) return this.CLOUDINARY_DISHES['huari'];
    if (n.includes('pacen')) return this.CLOUDINARY_DISHES['pacena'];

    if (n.includes('perol')) return this.CLOUDINARY_DISHES['rinonperol'];
    if (n.includes('rinon')) return this.CLOUDINARY_DISHES['rinon'];
    if (n.includes('cola')) return this.CLOUDINARY_DISHES['caldocola'];
    if (n.includes('chanka')) return this.CLOUDINARY_DISHES['chankapollo'];
    if (n.includes('kawi')) return this.CLOUDINARY_DISHES['kawi'];
    if (n.includes('pulpito')) return this.CLOUDINARY_DISHES['pulpitos'];

    if (n.includes('pique')) return this.CLOUDINARY_DISHES['pique'];
    if (n.includes('charque')) return this.CLOUDINARY_DISHES['charque'];
    if (n.includes('planch')) return this.CLOUDINARY_DISHES['planchita'];
    if (n.includes('lapp')) return this.CLOUDINARY_DISHES['lapping'];
    if (n.includes('pamp')) return this.CLOUDINARY_DISHES['pampa'];
    if (n.includes('picant')) return this.CLOUDINARY_DISHES['picante'];
    if (n.includes('mixto')) return this.CLOUDINARY_DISHES['mixto'];

    return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=80';
  }

  onImgError(event: Event, nombre: string): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = this.getFoodImageFallback(nombre);
    }
  }

  /**
   * Sistema inteligente de emojis como fallback visual
   * cuando el plato no tiene imagenUrl.
   */
  getFoodEmoji(nombre: string): string {
    const n = nombre.toLowerCase();
    if (n.includes('pique')) return '🥩';
    if (n.includes('silpancho')) return '🍳';
    if (n.includes('chicharrón') || n.includes('cerdo')) return '🐖';
    if (n.includes('chanka') || n.includes('pollo')) return '🍗';
    if (n.includes('parrillada') || n.includes('lomo')) return '🍖';
    if (n.includes('anticucho')) return '🍢';
    if (n.includes('ranga') || n.includes('sopa')) return '🍲';
    if (n.includes('sajta')) return '🌶️';
    if (n.includes('tranca') || n.includes('trucha') || n.includes('pescado')) return '🐟';
    if (n.includes('ensalada')) return '🥗';
    if (n.includes('chicha')) return '🥛';
    if (n.includes('limonada') || n.includes('refresco') || n.includes('jugo')) return '🍹';
    if (n.includes('cerveza')) return '🍺';
    if (n.includes('helado')) return '🍨';
    if (n.includes('buñuelo') || n.includes('postre')) return '🍩';
    if (n.includes('api') || n.includes('café') || n.includes('mate')) return '☕';
    return '🍽️';
  }

  /**
   * Determina si el ítem es una bebida embotellada para aplicar formato de pedestal y contain
   */
  esBebida(plato: any): boolean {
    const raw = (plato?.nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['`’\s-]/g, '');
    const cat = (plato?.categoria?.nombre || '').toLowerCase();
    if (raw.includes('hervido')) return false; // Hervido es infusión caliente en taza / sopa
    return (
      cat.includes('gaseosa') ||
      cat.includes('refresco') ||
      cat.includes('jugo') ||
      cat.includes('cerveza') ||
      cat.includes('bebida') ||
      raw.includes('coca') ||
      raw.includes('fanta') ||
      raw.includes('sprite') ||
      raw.includes('simba') ||
      raw.includes('cascada') ||
      raw.includes('acuari') ||
      raw.includes('aquari') ||
      raw.includes('valle') ||
      raw.includes('puravida') ||
      raw.includes('pura') ||
      raw.includes('vida') ||
      raw.includes('huari') ||
      raw.includes('pacen')
    );
  }
}
