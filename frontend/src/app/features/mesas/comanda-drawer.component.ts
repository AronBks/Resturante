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
  stockActual?: number | null;
  controlarStock?: boolean;
  stockMinimo?: number;
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

@Component({
  selector: 'app-comanda-drawer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CajaCobroComponent,
    LucideAngularModule,
  ],
  templateUrl: './comanda-drawer.component.html',
  styleUrls: ['./comanda-drawer.component.scss'],
})
export class ComandaDrawerComponent implements OnChanges {
  private http = inject(HttpClient);
  public readonly authService = inject(AuthService);
  private readonly baseUrl = 'http://localhost:3000/api';

  @Input() mesa: Mesa | null = null;
  @Input() platos: Plato[] = [];
  @Input() isOpen = false;
  @Input() autoOpenCobro = false;
  @Input() llamadaActiva: { motivo: string; timestamp: string } | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  // Permiso para liquidar / cobrar en caja
  puedeCobrar = computed(() => {
    const rol = this.authService.userRole();
    return rol === 'ADMIN' || rol === 'CAJERO';
  });

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
  activeCanalOrigen = signal<string>('MESERO_POS');
  auditoriaEventos = signal<any[]>([]);
  mostrarAuditoria = signal<boolean>(false);

  searchQuery = signal('');
  selectedCategoryId = signal<number | null>(null);
  waiters = signal<any[]>([]);

  // Modos de vista: 'DETAIL' | 'CATALOG' | 'CONFIRMATION'
  viewMode = signal<'DETAIL' | 'CATALOG' | 'CONFIRMATION'>('DETAIL');
  lastSubmittedSummary = signal<any>(null);
  activeSentItems = signal<any[]>([]);
  tiempoTranscurridoText = signal<string>('En curso');

  // Caja
  showCajaModal = signal(false);
  pedidoParaCobro = signal<PedidoParaCobro | null>(null);

  esSolicitudPago(): boolean {
    if (this.mesa?.estado === 'POR_COBRAR') return true;
    const l = this.llamadaActiva;
    if (!l) return false;
    const m = (l.motivo || '').toLowerCase();
    return m.includes('pago') || m.includes('cuenta') || m.includes('efectivo') || m.includes('qr');
  }

  getMetodoPagoSolicitado(): string {
    const l = this.llamadaActiva;
    if (l?.motivo) {
      const m = l.motivo.toLowerCase();
      if (m.includes('qr')) return 'QR';
      if (m.includes('efectivo')) return 'EFECTIVO';
    }
    const pref = (this.mesa as any)?.pedidos?.[0]?.metodoPagoPreferido;
    if (pref) return pref.toUpperCase();
    return 'EFECTIVO';
  }

  getDetalleCobroDrawer(): string {
    if (this.llamadaActiva?.motivo) return this.llamadaActiva.motivo;
    const p = (this.mesa as any)?.pedidos?.[0];
    if (p?.metodoPagoPreferido?.toUpperCase() === 'EFECTIVO' && p?.montoPagaCon) {
      const cambio = Math.max(0, Number(p.montoPagaCon) - this.getComandaTotal());
      return `💵 Paga en EFECTIVO con Bs. ${Number(p.montoPagaCon).toFixed(2)} — Llevar Bs. ${cambio.toFixed(2)} de cambio`;
    }
    if (p?.metodoPagoPreferido?.toUpperCase() === 'QR') {
      return `📱 Pago por Código QR Simple`;
    }
    return `Mesa pendiente de cobro en caja`;
  }

  getSubtextoCobroDrawer(): string {
    const p = (this.mesa as any)?.pedidos?.[0];
    if (p?.metodoPagoPreferido?.toUpperCase() === 'EFECTIVO' && p?.montoPagaCon) {
      return `El comensal declaró su billete desde su teléfono. Acércate con la pre-cuenta y el cambio preparado en mano.`;
    }
    if (p?.metodoPagoPreferido?.toUpperCase() === 'QR') {
      return `El comensal solicitó pagar por QR. Valida la transferencia bancaria y confirma el cobro.`;
    }
    return this.llamadaActiva
      ? 'El comensal ha solicitado la cuenta desde el menú digital • Acércate a la mesa o procesa en caja.'
      : 'Mesa pendiente de cobro • Acércate a la mesa con la cuenta o procesa el cobro en caja.';
  }

  atenderLlamadaDirecta() {
    if (!this.mesa) return;
    const currentUser = this.authService.currentUserSignal();
    const meseroNombre = currentUser?.nombre || this.activeMeseroNombre() || 'Garzón de Turno';
    this.http.post(`${this.baseUrl}/pedidos/atender-mesero`, { 
      mesaNumero: this.mesa.numero,
      meseroNombre,
    }).subscribe({
      next: () => {
        this.saved.emit();
        this.cargarAuditoriaMesa(this.mesa!.numero);
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
    if (n.includes('matambre')) return CLOUDINARY_DISHES_MAP['matambre'];
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
      this.activeMeseroNombre.set((this.mesa as any).meseroAsignado?.nombre || '');
      this.activeCanalOrigen.set('MESERO_POS');
      this.mostrarAuditoria.set(false);
      this.comandaItems.set([]);
      this.generalNotes.set('');
      this.activeSentItems.set([]);

      const currentUser = this.authService.currentUserSignal();
      if (currentUser) {
        this.selectedWaitership.set(currentUser.id);
      }

      this.viewMode.set('DETAIL');

      // Cargar eventos de auditoría histórica de la mesa
      this.cargarAuditoriaMesa(this.mesa.numero);

      if (this.mesa.estado !== 'LIBRE') {
        this.cargarPedidoActivo();
      }

      if (this.autoOpenCobro && this.mesa.estado === 'POR_COBRAR' && this.puedeCobrar()) {
        setTimeout(() => this.abrirCajaModal(), 100);
      }
    }
  }

  cargarAuditoriaMesa(mesaNumero: string) {
    this.http.get<any>(`${this.baseUrl}/auditoria/mesa/${mesaNumero}`).subscribe({
      next: (res) => {
        const list = res?.data || res || [];
        this.auditoriaEventos.set(list);
      },
      error: () => this.auditoriaEventos.set([]),
    });
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
          this.activeCanalOrigen.set(pedido.canalOrigen || 'MESERO_POS');
          this.generalNotes.set(pedido.notas || '');
          this.selectedWaitership.set(pedido.meseroId);
          if (pedido.mesero?.nombre) {
            this.activeMeseroNombre.set(pedido.mesero.nombre);
          } else if ((this.mesa as any)?.meseroAsignado?.nombre) {
            this.activeMeseroNombre.set((this.mesa as any).meseroAsignado.nombre);
          }

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

          // Refrescar bitácora de auditoría
          if (this.mesa?.numero) {
            this.cargarAuditoriaMesa(this.mesa.numero);
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

  isAgotado(plato: any): boolean {
    return !!(
      plato?.controlarStock &&
      plato?.stockActual !== null &&
      plato?.stockActual !== undefined &&
      plato?.stockActual <= 0
    );
  }

  isPocasPorciones(plato: any): boolean {
    return !!(
      plato?.controlarStock &&
      plato?.stockActual !== null &&
      plato?.stockActual !== undefined &&
      plato?.stockActual > 0 &&
      plato?.stockActual <= (plato?.stockMinimo || 3)
    );
  }

  // ── Selección y suma de platos ──
  abrirPersonalizarPlato(plato: any, event?: Event) {
    if (event) event.stopPropagation();

    if (this.isAgotado(plato)) {
      this.errorMessage.set(`Lo sentimos: El plato "${plato.nombre}" se encuentra agotado en cocina.`);
      return;
    }

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
    const plato = this.platoParaPersonalizar();
    if (plato?.controlarStock && plato.stockActual !== null && plato.stockActual !== undefined) {
      if (this.cantidadPersonalizada() >= plato.stockActual) {
        this.errorMessage.set(`Solo quedan ${plato.stockActual} porciones disponibles de "${plato.nombre}".`);
        return;
      }
    }
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

    if (plato.controlarStock && plato.stockActual !== null && plato.stockActual !== undefined) {
      const actualEnDraft = this.comandaItems().find((i) => i.platoId === plato.id && i.varianteId === variante.id)?.cantidad || 0;
      if (actualEnDraft + cant > plato.stockActual) {
        this.errorMessage.set(`Stock insuficiente: Solo quedan ${plato.stockActual} porciones de "${plato.nombre}".`);
        return;
      }
    }

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

    if (this.isAgotado(plato)) {
      this.errorMessage.set(`El plato "${plato.nombre}" se encuentra agotado en cocina.`);
      return;
    }

    if (plato.controlarStock && plato.stockActual !== null && plato.stockActual !== undefined) {
      const itemExistente = this.comandaItems().find((i) => i.platoId === plato.id && !i.varianteId);
      if (itemExistente && itemExistente.cantidad >= plato.stockActual) {
        this.errorMessage.set(`Solo quedan ${plato.stockActual} porciones disponibles de "${plato.nombre}".`);
        return;
      }
    }

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
    const plato = this.platosSignal().find((p) => p.id === item.platoId);
    if (plato?.controlarStock && plato.stockActual !== null && plato.stockActual !== undefined) {
      if (item.cantidad >= plato.stockActual) {
        this.errorMessage.set(`Solo quedan ${plato.stockActual} porciones disponibles de "${item.nombre}".`);
        return;
      }
    }

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
        motivo: 'Asistencia solicitada para Mesa ' + this.mesa.numero,
      })
      .subscribe({
        next: () => {
          this.saved.emit();
        },
        error: () => {
          this.saved.emit();
        },
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

  abrirCajaModal() {
    if (!this.puedeCobrar()) return;
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

    const pedido = (this.mesa as any)?.pedidos?.[0];
    const metodoPref = pedido?.metodoPagoPreferido?.toUpperCase() || (this.llamadaActiva?.motivo?.includes('QR') ? 'QR' : 'EFECTIVO');
    const montoCon = pedido?.montoPagaCon ? Number(pedido.montoPagaCon) : undefined;

    this.pedidoParaCobro.set({
      pedidoId,
      mesaNumero: this.mesa.numero,
      meseroNombre: this.activeMeseroNombre() || 'Don Roberto',
      items,
      subtotal: this.getComandaTotal(),
      metodoPagoPreferido: metodoPref,
      montoPagaCon: montoCon,
    });

    this.showCajaModal.set(true);
  }

  onCajaCerrar() {
    this.showCajaModal.set(false);
  }

  onPagoCompletado(datosTransaccion: any) {
    this.showCajaModal.set(false);
    this.saved.emit();
    this.close.emit();
  }
}
