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
import { CartaPublicaService, CategoriaPublica, PlatoPublico, VariantePublica, resolverImagenLocal } from '../../services/carta-publica.service';
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
  private wsStockSub?: Subscription;

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

  tienePedidoActivo = computed(() => {
    return !!this.carritoService.ultimoPedido() || this.carritoService.pedidoConfirmado();
  });

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
          // Si el plato se marca como no disponible, pasa a estado agotado (NUNCA desaparece de la carta)
          this.cartaService.actualizarStockPlato(evento.platoId, 0, false);
        } else {
          // Plato reactivado → re-fetch para incorporarlo con sus datos
          this.cartaService.recargarCarta();
        }
      });

    // 3. Suscripción a cambios de stock en tiempo real (evita sobreventa)
    this.wsStockSub = this.socketService
      .onStockActualizado()
      .subscribe((evento) => {
        this.cartaService.actualizarStockPlato(evento.platoId, evento.stockActual, evento.disponible);
      });
  }

  ngOnDestroy(): void {
    this.wsSub?.unsubscribe();
    this.wsStockSub?.unsubscribe();
  }

  isPlatoRemoving(platoId: string): boolean {
    return this.removingPlatoIds().has(platoId);
  }

  isAgotado(plato: PlatoPublico): boolean {
    if (plato.agotado === true) return true;
    if (plato.stockActual !== null && plato.stockActual !== undefined) {
      return plato.stockActual <= 0;
    }
    return false;
  }

  isFueraDeHorario(plato: PlatoPublico): boolean {
    if (this.isAgotado(plato)) return false;
    return !!plato.horaInicio && plato.disponibleAhora === false;
  }

  selectCategory(catId: number | null): void {
    this.selectedCategoryId.set(catId);
  }

  // ── Operaciones con Variantes ──

  abrirSelectorVariante(plato: PlatoPublico): void {
    if (this.isAgotado(plato) || this.isFueraDeHorario(plato)) return;
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

  /**
   * Obtiene la URL local de la imagen del plato desde el servidor del restaurante
   */
  getPlatoImageUrl(plato: any): string {
    return resolverImagenLocal(plato?.nombre || '', plato?.imagenUrl);
  }

  /**
   * Fallback visual con imágenes locales optimizadas en WebP
   */
  getFoodImageFallback(nombre: string): string {
    return resolverImagenLocal(nombre);
  }

  onImgError(event: Event, nombre: string): void {
    const target = event.target as HTMLImageElement;
    if (target && !target.dataset['fallbackApplied']) {
      target.dataset['fallbackApplied'] = 'true';
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
