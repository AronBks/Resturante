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
import { CartaPublicaService, CategoriaPublica, PlatoPublico, VariantePublica } from '../../services/carta-publica.service';
import { SocketPublicoService } from '../../services/socket-publico.service';
import { CarritoService } from '../../services/carrito.service';
import { CarritoDrawerComponent } from '../carrito-drawer/carrito-drawer.component';

@Component({
  selector: 'client-menu-digital',
  standalone: true,
  imports: [CommonModule, RouterLink, CarritoDrawerComponent],
  templateUrl: './menu-digital.component.html',
  styleUrl: './menu-digital.component.scss',
})
export class MenuDigitalComponent implements OnInit, OnDestroy {
  readonly cartaService = inject(CartaPublicaService);
  readonly carritoService = inject(CarritoService);
  private readonly socketService = inject(SocketPublicoService);
  private readonly route = inject(ActivatedRoute);
  private wsSub!: Subscription;

  // Control de visibilidad del drawer de confirmación
  drawerOpen = signal(false);

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

  // ── Computed Signals ──
  filteredCategorias = computed<CategoriaPublica[]>(() => {
    const catId = this.selectedCategoryId();
    const cats = this.cartaService.categorias();
    if (catId === null) return cats;
    return cats.filter((c) => c.id === catId);
  });

  totalPlatos = this.cartaService.totalPlatos;

  ngOnInit(): void {
    // 0. Leer mesa de la URL
    this.route.queryParams.subscribe((params) => {
      if (params['mesa']) this.mesaNumero.set(params['mesa']);
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
}
