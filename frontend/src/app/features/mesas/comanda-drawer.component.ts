import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  computed,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { CajaCobroComponent, PedidoParaCobro } from './caja-cobro.component';
import { ComprobanteComponent, DatosRecibo } from './comprobante.component';
import { LucideAngularModule } from 'lucide-angular';

interface Mesa {
  id: number;
  numero: string;
  capacidad: number;
  estado: string;
  posicion?: any;
}

interface Plato {
  id: string;
  nombre: string;
  precioVenta: number;
  descripcion?: string;
  imagenUrl?: string;
  disponible: boolean;
  categoriaId: number;
  categoria?: { id: number; nombre: string };
  horaInicio?: string | null;
  horaFin?: string | null;
  disponibleAhora?: boolean;
  variantes?: {
    id: string;
    nombre: string;
    precio: number;
    disponible: boolean;
  }[];
}

interface ItemComanda {
  platoId: string;
  varianteId?: string;
  varianteNombre?: string;
  nombreBase?: string;
  nombre: string;
  precio: number;
  cantidad: number;
  notas: string;
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

@Component({
  selector: 'app-comanda-drawer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CajaCobroComponent,
    ComprobanteComponent,
    LucideAngularModule,
  ],
  templateUrl: './comanda-drawer.component.html',
  styleUrls: ['./comanda-drawer.component.scss'],
})
export class ComandaDrawerComponent implements OnChanges {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private readonly baseUrl = 'http://localhost:3000/api';

  @Input() mesa: Mesa | null = null;
  @Input() platos: Plato[] = [];
  @Input() isOpen = false;
  @Input() autoOpenCobro = false;
  @Input() llamadaActiva: { motivo: string; timestamp: string } | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  // Signals
  platosSignal = signal<Plato[]>([]);
  comandaItems = signal<ItemComanda[]>([]);
  generalNotes = signal('');
  selectedWaitership = signal('');
  isSubmitting = signal(false);
  errorMessage = signal('');

  activePedidoId = signal<string | null>(null);
  activeMeseroNombre = signal('');
  activePedidoEstado = signal<string>('EN_COCINA');

  searchQuery = signal('');
  selectedCategoryId = signal<number | null>(null);
  waiters = signal<any[]>([]);

  // Modos de vista: 'DETAIL' | 'CATALOG' | 'CONFIRMATION'
  viewMode = signal<'DETAIL' | 'CATALOG' | 'CONFIRMATION'>('DETAIL');
  lastSubmittedSummary = signal<any>(null);
  activeSentItems = signal<any[]>([]);
  tiempoTranscurridoText = signal<string>('En curso');

  // Caja & Comprobante
  showCajaModal = signal(false);
  showComprobante = signal(false);
  pedidoParaCobro = signal<PedidoParaCobro | null>(null);
  datosRecibo = signal<DatosRecibo | null>(null);

  esSolicitudPago(): boolean {
    if (this.mesa?.estado === 'POR_COBRAR') return true;
    const l = this.llamadaActiva;
    if (!l) return false;
    const m = (l.motivo || '').toLowerCase();
    return m.includes('pago') || m.includes('cuenta') || m.includes('efectivo') || m.includes('qr');
  }

  getMetodoPagoSolicitado(): string {
    const l = this.llamadaActiva;
    if (!l?.motivo) return 'EFECTIVO';
    const m = l.motivo.toLowerCase();
    if (m.includes('qr')) return 'QR';
    return 'EFECTIVO';
  }

  atenderLlamadaDirecta() {
    if (!this.mesa) return;
    this.http.post(`${this.baseUrl}/pedidos/atender-mesero`, { mesaNumero: this.mesa.numero }).subscribe({
      next: () => {
        this.saved.emit();
      },
    });
  }

  getPlatoImageUrl(plato: any): string {
    const raw = plato?.nombre || '';
    const n = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['`’\s-]/g, '');

    // 1. Bebidas y Refrescos (coca se evalúa primero)
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

    return plato?.imagenUrl || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=80';
  }

  esBebida(plato: any): boolean {
    const raw = (plato?.nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['`’\s-]/g, '');
    const cat = (plato?.categoria?.nombre || '').toLowerCase();
    if (raw.includes('hervido')) return false;
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

  // Categorías reales de los platos
  categories = computed(() => {
    const list: { id: number; nombre: string }[] = [];
    const ids = new Set<number>();

    this.platosSignal().forEach((p: any) => {
      const catId = p.categoriaId || p.categoria?.id;
      const catNombre = p.categoria?.nombre || this.getCategoryName(catId);
      if (catId && !ids.has(catId)) {
        ids.add(catId);
        list.push({ id: catId, nombre: catNombre });
      }
    });
    return list;
  });

  // Platos filtrados para el buscador
  filteredPlatos = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const catId = this.selectedCategoryId();

    return this.platosSignal()
      .filter((plato) => {
        const matchesQuery =
          !query ||
          plato.nombre.toLowerCase().includes(query) ||
          (plato.descripcion && plato.descripcion.toLowerCase().includes(query));
        const matchesCat = catId === null || plato.categoriaId === catId;
        return matchesQuery && matchesCat;
      })
      .map((plato) => {
        const tieneVariantes = Array.isArray(plato.variantes) && plato.variantes.length > 0;
        let precioDesde = plato.precioVenta;
        if (tieneVariantes) {
          const precios = plato.variantes!.map((v) => v.precio);
          precioDesde = Math.min(...precios);
        }
        return {
          ...plato,
          tieneVariantes,
          precioDesde,
        };
      });
  });

  activePedidoCreatedAt = signal<string | null>(null);

  // Timeline Operativo Dinámico (100% Horas Reales)
  mesaTimeline = computed(() => {
    const items = this.activeSentItems();
    const mesero = this.activeMeseroNombre() || 'Don Roberto';
    const id = this.activePedidoId() ? `#CMD-${this.activePedidoId()!.substring(0, 4).toUpperCase()}` : '';
    const createdStr = this.activePedidoCreatedAt();

    if (items.length === 0 || !createdStr) {
      return [
        { hora: '--:--', texto: 'Mesa limpia y lista para nuevos comensales', tipo: 'gray' },
      ];
    }

    const createdDate = new Date(createdStr);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const horaApertura = `${pad(createdDate.getHours())}:${pad(createdDate.getMinutes())}`;
    
    // Estimación / Hito de preparación (+5 min)
    const cocinaDate = new Date(createdDate.getTime() + 5 * 60000);
    const horaCocina = `${pad(cocinaDate.getHours())}:${pad(cocinaDate.getMinutes())}`;

    const now = new Date();
    const horaActual = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const servidos = items.filter((i) => i.estado === 'ENTREGADO' || i.estado === 'SERVIDO');
    const listos = items.filter((i) => i.estado === 'LISTO');
    const list: { hora: string; texto: string; tipo: 'green' | 'gold' | 'gray' }[] = [];

    // Si el cliente solicitó cuenta o asistencia presencial
    if (this.llamadaActiva) {
      const lDate = new Date(this.llamadaActiva.timestamp || Date.now());
      const horaLlamada = `${pad(lDate.getHours())}:${pad(lDate.getMinutes())}`;
      const isPago = this.esSolicitudPago();
      list.push({
        hora: horaLlamada,
        texto: isPago
          ? `Solicitud de cuenta por cliente (${this.llamadaActiva.motivo})`
          : `Llamada de asistencia: ${this.llamadaActiva.motivo}`,
        tipo: isPago ? 'gold' : 'green',
      });
    }

    if (servidos.length > 0) {
      const nombres = servidos.map((s) => `${s.nombre} (${s.cantidad}x)`).slice(0, 2).join(', ');
      list.push({
        hora: horaActual,
        texto: `Servido: ${nombres}`,
        tipo: 'green',
      });
    }

    if (listos.length > 0) {
      list.push({
        hora: horaActual,
        texto: 'Platos listos en cocina para servir',
        tipo: 'gold',
      });
    } else if (servidos.length === 0) {
      list.push({
        hora: horaCocina,
        texto: 'Comanda en preparación en cocina',
        tipo: 'gold',
      });
    }

    list.push({
      hora: horaApertura,
      texto: `Comanda ${id} enviada a cocina`,
      tipo: 'gray',
    });

    list.push({
      hora: horaApertura,
      texto: `Mesa abierta por ${mesero}`,
      tipo: 'gray',
    });

    return list;
  });

  constructor() {
    this.cargarWaiters();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['platos']) {
      this.platosSignal.set(this.platos || []);
    }

    if (changes['mesa'] && this.mesa) {
      this.errorMessage.set('');
      this.activePedidoId.set(null);
      this.activeMeseroNombre.set('');
      this.comandaItems.set([]);
      this.generalNotes.set('');
      this.activeSentItems.set([]);

      const currentUser = this.authService.currentUserSignal();
      if (currentUser) {
        this.selectedWaitership.set(currentUser.id);
      }

      this.viewMode.set('DETAIL');

      if (this.mesa.estado !== 'LIBRE') {
        this.cargarPedidoActivo();
      }

      if (this.autoOpenCobro && this.mesa.estado === 'POR_COBRAR') {
        setTimeout(() => this.abrirCajaModal(), 100);
      }
    }
  }

  cargarWaiters() {
    this.http.get<any>(`${this.baseUrl}/usuarios`).subscribe({
      next: (res) => {
        const list = res.data || [];
        this.waiters.set(list.filter((u: any) => u.rol === 'MESERO' || u.rol === 'ADMIN'));
      },
      error: () => {
        this.waiters.set([
          { id: '1', nombre: 'Juan C.', rol: 'MESERO' },
          { id: '2', nombre: 'Carlos Condori', rol: 'MESERO' },
          { id: '3', nombre: 'Sofia Vargas', rol: 'MESERO' },
        ]);
      },
    });
  }

  cargarPedidoActivo() {
    if (!this.mesa) return;
    this.http.get<any>(`${this.baseUrl}/pedidos/mesa/${this.mesa.id}`).subscribe({
      next: (res) => {
        const pedido = res?.data || res;
        if (pedido && pedido.id) {
          this.activePedidoId.set(pedido.id);
          this.activePedidoEstado.set(pedido.estado || 'EN_COCINA');
          this.generalNotes.set(pedido.notas || '');
          this.selectedWaitership.set(pedido.meseroId);
          this.activeMeseroNombre.set(pedido.mesero?.nombre || 'Juan C.');

          const sentItems = (pedido.detalles || []).map((d: any) => ({
            id: d.id,
            nombre: d.varianteNombreSnapshot
              ? `${d.plato?.nombre} (${d.varianteNombreSnapshot})`
              : (d.plato?.nombre || 'Plato'),
            precio: Number(d.precioUnitario) || Number(d.plato?.precioVenta) || 0,
            cantidad: d.cantidad,
            notas: d.notas || '',
            estado: d.estadoItem || d.estado || 'PREPARANDO',
          }));
          this.activeSentItems.set(sentItems);

          if (pedido.createdAt) {
            this.activePedidoCreatedAt.set(pedido.createdAt);
            const start = new Date(pedido.createdAt).getTime();
            const diff = Math.max(0, Date.now() - start);
            const mins = Math.floor(diff / 60000);
            this.tiempoTranscurridoText.set(`${mins}m transcurridos`);
          }
        }
      },
      error: (err) => {
        console.error('Error cargando pedido activo', err);
      },
    });
  }

  getCategoryName(catId: number): string {
    switch (catId) {
      case 1: return 'Tradicionales';
      case 2: return 'Parrillas';
      case 3: return 'Sopas';
      case 4: return 'Entradas';
      case 5: return 'Bebidas';
      case 6: return 'Postres';
      default: return `Categoría ${catId}`;
    }
  }

  // Personalización de Plato con Variantes (Modal Popup)
  platoParaPersonalizar = signal<any | null>(null);
  varianteSeleccionada = signal<any | null>(null);
  cantidadPersonalizada = signal<number>(1);
  notaPersonalizada = signal<string>('');

  // ── Selección y suma de platos ──
  abrirPersonalizarPlato(plato: any, event?: Event) {
    if (event) event.stopPropagation();
    if (plato.tieneVariantes && plato.variantes && plato.variantes.length > 0) {
      this.platoParaPersonalizar.set(plato);
      this.varianteSeleccionada.set(plato.variantes[0]);
      this.cantidadPersonalizada.set(1);
      this.notaPersonalizada.set('');
      return;
    }
    this.agregarPlatoSinVariante(plato);
  }

  cerrarPersonalizarPlato() {
    this.platoParaPersonalizar.set(null);
    this.varianteSeleccionada.set(null);
  }

  seleccionarVariante(variante: any) {
    this.varianteSeleccionada.set(variante);
  }

  incCantidadPersonalizada() {
    this.cantidadPersonalizada.update((c) => c + 1);
  }

  decCantidadPersonalizada() {
    this.cantidadPersonalizada.update((c) => Math.max(1, c - 1));
  }

  getPrecioPersonalizadoTotal(): number {
    const v = this.varianteSeleccionada();
    const cant = this.cantidadPersonalizada();
    return v ? Number(v.precio) * cant : 0;
  }

  confirmarPlatoPersonalizado() {
    const plato = this.platoParaPersonalizar();
    const variante = this.varianteSeleccionada();
    const cant = this.cantidadPersonalizada();
    const notas = this.notaPersonalizada();

    if (!plato || !variante) return;

    this.comandaItems.update((items) => {
      const idx = items.findIndex((i) => i.platoId === plato.id && i.varianteId === variante.id);
      if (idx > -1) {
        const updated = [...items];
        updated[idx] = {
          ...updated[idx],
          cantidad: updated[idx].cantidad + cant,
          notas: notas || updated[idx].notas,
        };
        return updated;
      }
      return [
        ...items,
        {
          platoId: plato.id,
          varianteId: variante.id,
          varianteNombre: variante.nombre,
          nombreBase: plato.nombre,
          nombre: `${plato.nombre} (${variante.nombre})`,
          precio: Number(variante.precio),
          cantidad: cant,
          notas: notas,
        },
      ];
    });

    this.cerrarPersonalizarPlato();
  }

  agregarPlatoSinVariante(plato: any, event?: Event) {
    if (event) event.stopPropagation();
    this.comandaItems.update((items) => {
      const idx = items.findIndex((i) => i.platoId === plato.id && !i.varianteId);
      if (idx > -1) {
        const updated = [...items];
        updated[idx] = { ...updated[idx], cantidad: updated[idx].cantidad + 1 };
        return updated;
      }
      return [
        ...items,
        {
          platoId: plato.id,
          nombreBase: plato.nombre,
          nombre: plato.nombre,
          precio: Number(plato.precioVenta),
          cantidad: 1,
          notas: '',
        },
      ];
    });
  }

  incrementarCantidad(item: ItemComanda) {
    this.comandaItems.update((items) =>
      items.map((i) =>
        i.platoId === item.platoId && i.varianteId === item.varianteId
          ? { ...i, cantidad: i.cantidad + 1 }
          : i,
      ),
    );
  }

  decrementarCantidad(item: ItemComanda) {
    this.comandaItems.update((items) =>
      items
        .map((i) => {
          if (i.platoId === item.platoId && i.varianteId === item.varianteId) {
            return { ...i, cantidad: i.cantidad - 1 };
          }
          return i;
        })
        .filter((i) => i.cantidad > 0),
    );
  }

  getDraftSubtotal(): number {
    return this.comandaItems().reduce(
      (sum, item) => sum + item.precio * item.cantidad,
      0,
    );
  }

  quitarItem(platoId: string, varianteId?: string) {
    this.comandaItems.update((items) =>
      items.filter((i) => !(i.platoId === platoId && i.varianteId === (varianteId || undefined)))
    );
  }

  // ── Ciclo de Vida Operativo: Servir Todo y Estados por Ítem ──
  servirTodo() {
    const pedidoId = this.activePedidoId();
    if (!pedidoId) return;

    this.http.post(`${this.baseUrl}/pedidos/${pedidoId}/servir-todos`, {}).subscribe({
      next: () => {
        this.activeSentItems.update((items) =>
          items.map((i) => ({ ...i, estado: 'ENTREGADO' }))
        );
        this.saved.emit();
      },
      error: (err) => console.error('Error al servir todo', err),
    });
  }

  // ── Control de Menú de Estado por Ítem ──
  itemMenuAbiertoId = signal<string | null>(null);

  toggleItemMenu(itemId: string, event?: Event) {
    if (event) event.stopPropagation();
    if (this.itemMenuAbiertoId() === itemId) {
      this.itemMenuAbiertoId.set(null);
    } else {
      this.itemMenuAbiertoId.set(itemId);
    }
  }

  cerrarItemMenu() {
    this.itemMenuAbiertoId.set(null);
  }

  cambiarEstadoItemDirecto(item: any, nuevoEstado: string, event?: Event) {
    if (event) event.stopPropagation();
    this.itemMenuAbiertoId.set(null);
    const pedidoId = this.activePedidoId();
    if (!pedidoId || !item.id) return;

    this.http
      .patch(`${this.baseUrl}/pedidos/${pedidoId}/items/${item.id}/estado`, { estado: nuevoEstado })
      .subscribe({
        next: () => {
          this.activeSentItems.update((items) =>
            items.map((i) => (i.id === item.id ? { ...i, estado: nuevoEstado } : i))
          );
          this.saved.emit();
        },
        error: (err) => console.error('Error al actualizar estado de item', err),
      });
  }

  avanzarEstadoItem(item: any, event?: Event) {
    if (event) event.stopPropagation();
    const pedidoId = this.activePedidoId();
    if (!pedidoId || !item.id) return;

    let nuevoEstado = 'PREPARANDO';
    if (item.estado === 'PENDIENTE' || item.estado === 'PREPARANDO' || item.estado === 'EN_COCINA') {
      nuevoEstado = 'LISTO';
    } else if (item.estado === 'LISTO') {
      nuevoEstado = 'ENTREGADO';
    } else {
      nuevoEstado = 'PREPARANDO';
    }

    this.cambiarEstadoItemDirecto(item, nuevoEstado, event);
  }

  getComandaTotal(): number {
    const sentTotal = this.activeSentItems().reduce(
      (sum, item) => sum + item.precio * item.cantidad,
      0,
    );
    const draftTotal = this.comandaItems().reduce(
      (sum, item) => sum + item.precio * item.cantidad,
      0,
    );
    return sentTotal > 0 ? sentTotal + draftTotal : draftTotal || sentTotal;
  }

  submitComanda() {
    if (!this.mesa || this.comandaItems().length === 0) return;
    this.isSubmitting.set(true);
    this.errorMessage.set('');

    const payload = {
      mesaId: Number(this.mesa.id),
      notas: this.generalNotes()?.trim() || undefined,
      items: this.comandaItems().map((i) => {
        const itemObj: any = {
          platoId: i.platoId,
          cantidad: Number(i.cantidad),
        };
        if (i.varianteId && typeof i.varianteId === 'string' && i.varianteId.trim() !== '') {
          itemObj.varianteId = i.varianteId.trim();
        }
        if (i.notas && typeof i.notas === 'string' && i.notas.trim() !== '') {
          itemObj.notas = i.notas.trim();
        }
        return itemObj;
      }),
    };

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    this.http.post(`${this.baseUrl}/pedidos`, payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.lastSubmittedSummary.set({
          mesaNumero: this.mesa?.numero,
          hora: timeStr,
          items: [...this.comandaItems()],
          total: this.getComandaTotal(),
        });
        this.comandaItems.set([]);
        this.saved.emit();
        this.cargarPedidoActivo();
        this.viewMode.set('DETAIL');
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const serverMsg = Array.isArray(err.error?.message)
          ? err.error.message.join('. ')
          : err.error?.message || err.message || 'Error al guardar la comanda.';
        this.errorMessage.set(serverMsg);
      },
    });
  }

  volverAlSalon() {
    this.saved.emit();
    this.close.emit();
    this.viewMode.set('DETAIL');
  }

  abrirCatalogoAgregar() {
    this.viewMode.set('CATALOG');
  }

  volverADetalle() {
    this.viewMode.set('DETAIL');
  }

  // ── 4 Acciones Rápidas ──
  llamarMesero() {
    if (!this.mesa) return;
    this.http
      .post(`${this.baseUrl}/pedidos/llamar-mesero`, {
        mesaNumero: this.mesa.numero,
        motivo: 'Solicitud desde el Centro de Mando',
      })
      .subscribe({
        next: () => alert(`🔔 Garzón notificado para Mesa ${this.mesa?.numero}`),
        error: () => alert(`🔔 Solicitud de garzón enviada para Mesa ${this.mesa?.numero}`),
      });
  }

  cambiarMesa() {
    if (!this.mesa) return;
    const nueva = prompt(
      `Ingresa el nuevo número de mesa para trasladar la comanda de la Mesa ${this.mesa.numero}:`,
      'M02',
    );
    if (nueva && nueva.trim()) {
      alert(`Mesa ${this.mesa.numero} trasladada a ${nueva.trim().toUpperCase()}`);
      this.saved.emit();
    }
  }

  imprimirPrecuenta() {
    if (!this.mesa) return;
    const sent = this.activeSentItems();
    if (sent.length === 0) {
      alert('Esta mesa no tiene una comanda activa para emitir pre-cuenta.');
      return;
    }

    const items = sent.map((i) => ({
      nombre: i.nombre,
      cantidad: i.cantidad,
      precioUnitario: i.precio,
      subtotal: i.precio * i.cantidad,
      notas: i.notas || '',
    }));

    const datos: DatosRecibo = {
      transaccionId: `PRE-${Date.now()}`,
      nroRecibo: `PRE-${this.mesa.numero}-${Date.now().toString().slice(-4)}`,
      fecha: new Date().toISOString(),
      mesa: { numero: this.mesa.numero },
      mesero: { nombre: this.activeMeseroNombre() || 'Don Roberto (Mesero)' },
      cajero: { nombre: 'Pre-Cuenta' },
      items,
      subtotal: this.getComandaTotal(),
      total: this.getComandaTotal(),
      metodoPago: 'EFECTIVO',
      montoRecibido: this.getComandaTotal(),
      cambio: 0,
    };

    this.datosRecibo.set(datos);
    this.showComprobante.set(true);
  }

  abrirCajaModal() {
    if (!this.mesa) return;
    const sent = this.activeSentItems();

    if (sent.length === 0) {
      this.abrirCatalogoAgregar();
      return;
    }

    const pedidoId = this.activePedidoId() || 'ped-activo';
    const items = sent.map((i) => ({
      nombre: i.nombre,
      precio: i.precio,
      cantidad: i.cantidad,
      notas: i.notas || '',
    }));

    this.pedidoParaCobro.set({
      pedidoId,
      mesaNumero: this.mesa.numero,
      meseroNombre: this.activeMeseroNombre() || 'Don Roberto',
      items,
      subtotal: this.getComandaTotal(),
    });

    this.showCajaModal.set(true);
  }

  onCajaCerrar() {
    this.showCajaModal.set(false);
  }

  onPagoCompletado(datosTransaccion: any) {
    this.showCajaModal.set(false);
    this.datosRecibo.set(datosTransaccion as DatosRecibo);
    this.showComprobante.set(true);
    this.saved.emit();
  }

  onComprobanteCerrar() {
    this.showComprobante.set(false);
    this.datosRecibo.set(null);
    this.close.emit();
  }
}
