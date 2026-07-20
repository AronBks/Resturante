import { Component, Input, Output, EventEmitter, inject, signal, computed, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { CajaCobroComponent, PedidoParaCobro } from './caja-cobro.component';
import { ComprobanteComponent, DatosRecibo } from './comprobante.component';

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

import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-comanda-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, CajaCobroComponent, ComprobanteComponent, LucideAngularModule],
  templateUrl: './comanda-drawer.component.html',
  styleUrls: ['./comanda-drawer.component.scss']
})
export class ComandaDrawerComponent implements OnChanges {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private readonly baseUrl = 'http://localhost:3000/api';

  @Input() mesa: Mesa | null = null;
  @Input() platos: Plato[] = [];
  @Input() isOpen = false;
  @Input() autoOpenCobro = false;

  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  // Reactive signal wrapping the input array to enable computed signal tracking
  platosSignal = signal<Plato[]>([]);

  // Form states
  comandaItems = signal<ItemComanda[]>([]);
  generalNotes = signal('');
  selectedWaitership = signal('');
  isSubmitting = signal(false);
  errorMessage = signal('');

  // Active order ID if occupied
  activePedidoId = signal<string | null>(null);
  activeMeseroNombre = signal('');

  // Search & Filter
  searchQuery = signal('');
  selectedCategoryId = signal<number | null>(null);

  // Users / Waiters
  waiters = signal<any[]>([]);

  // ── Caja & Comprobante States ──
  showCajaModal = signal(false);
  showComprobante = signal(false);
  pedidoParaCobro = signal<PedidoParaCobro | null>(null);
  datosRecibo = signal<DatosRecibo | null>(null);

  // Computed Categories from inputs
  categories = computed(() => {
    const list: { id: number; nombre: string }[] = [];
    const ids = new Set<number>();
    
    this.platosSignal().forEach(p => {
      if (p.categoriaId && !ids.has(p.categoriaId)) {
        ids.add(p.categoriaId);
        list.push({ id: p.categoriaId, nombre: this.getCategoryName(p.categoriaId) });
      }
    });
    return list;
  });

  // Filtered dishes for quick search with variant consolidation
  filteredPlatos = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const catId = this.selectedCategoryId();
    
    return this.platosSignal()
      .filter(plato => {
        const matchesQuery = !query || 
          plato.nombre.toLowerCase().includes(query) || 
          (plato.descripcion && plato.descripcion.toLowerCase().includes(query));
        const matchesCat = catId === null || plato.categoriaId === catId;
        return matchesQuery && matchesCat;
      })
      .map(plato => {
        const tieneVariantes = Array.isArray(plato.variantes) && plato.variantes.length > 0;
        let precioDesde = plato.precioVenta;
        if (tieneVariantes) {
          const precios = plato.variantes!.map(v => v.precio);
          precioDesde = Math.min(...precios);
        }
        return {
          ...plato,
          tieneVariantes,
          precioDesde
        };
      });
  });

  viewMode = signal<'FORM' | 'CONFIRMATION' | 'OCCUPIED_DETAIL'>('FORM');
  activeSubTab = signal<'DETALLE' | 'HISTORIAL'>('DETALLE');
  lastSubmittedSummary = signal<any>(null);
  activeSentItems = signal<any[]>([]);
  historialPedidos = signal<any[]>([]);

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
      
      // Default waiter to logged-in user
      const currentUser = this.authService.currentUserSignal();
      if (currentUser) {
        this.selectedWaitership.set(currentUser.id);
      }

      if (this.mesa.estado === 'LIBRE') {
        this.comandaItems.set([]);
        this.generalNotes.set('');
        this.viewMode.set('FORM');
      } else {
        this.cargarPedidoActivo();
        this.viewMode.set('OCCUPIED_DETAIL');
      }

      if (this.autoOpenCobro && this.mesa.estado === 'POR_COBRAR') {
        setTimeout(() => this.abrirCajaModal(), 100);
      }
    }
  }

  limpiarTodo() {
    this.comandaItems.set([]);
    this.generalNotes.set('');
  }

  cargarWaiters() {
    this.http.get<any>(`${this.baseUrl}/usuarios`).subscribe({
      next: (res) => {
        const list = res.data || [];
        this.waiters.set(list.filter((u: any) => u.rol === 'MESERO' || u.rol === 'ADMIN'));
      },
      error: () => {
        this.waiters.set([
          { id: '1', nombre: 'Don Roberto Mamani', rol: 'ADMIN' },
          { id: '2', nombre: 'Carlos Condori', rol: 'MESERO' },
          { id: '3', nombre: 'Sofia Vargas', rol: 'MESERO' }
        ]);
      }
    });
  }

  cargarPedidoActivo() {
    if (!this.mesa) return;
    this.http.get<any>(`${this.baseUrl}/pedidos/mesa/${this.mesa.id}`).subscribe({
      next: (res) => {
        const pedido = res.data;
        if (pedido) {
          this.activePedidoId.set(pedido.id);
          this.generalNotes.set(pedido.notas || '');
          this.selectedWaitership.set(pedido.meseroId);
          this.activeMeseroNombre.set(pedido.mesero?.nombre || 'Mesero');
          
          const items: ItemComanda[] = (pedido.detalles || []).map((d: any) => ({
            platoId: d.platoId,
            varianteId: d.varianteId || undefined,
            varianteNombre: d.varianteNombreSnapshot || (d.variante ? d.variante.nombre : undefined),
            nombreBase: d.plato?.nombre || 'Plato',
            nombre: d.plato?.nombre || 'Plato',
            precio: Number(d.precioUnitario || d.plato?.precioVenta),
            cantidad: d.cantidad,
            notas: d.notas || ''
          }));
          this.comandaItems.set(items);

          const sentItems = (pedido.detalles || []).map((d: any) => ({
            id: d.id,
            nombre: d.varianteNombreSnapshot ? `${d.plato?.nombre} (${d.varianteNombreSnapshot})` : (d.plato?.nombre || 'Plato'),
            precio: Number(d.precioUnitario || d.plato?.precioVenta),
            cantidad: d.cantidad,
            notas: d.notas || '',
            estado: d.estado || 'EN_PREPARACION'
          }));
          this.activeSentItems.set(sentItems);

        }
      },
      error: (err) => {
        console.error('Error cargando pedido activo', err);
        this.errorMessage.set('No se pudo cargar la comanda activa.');
      }
    });
  }

  cargarHistorialMesa() {
    if (!this.mesa) return;
    this.http.get<any>(`${this.baseUrl}/pedidos?mesaId=${this.mesa.id}&limit=10`).subscribe({
      next: (res) => {
        this.historialPedidos.set(res.data || []);
      },
      error: () => {
        this.historialPedidos.set([]);
      }
    });
  }

  setSubTab(tab: 'DETALLE' | 'HISTORIAL') {
    this.activeSubTab.set(tab);
    if (tab === 'HISTORIAL') {
      this.cargarHistorialMesa();
    }
  }

  getCategoryName(catId: number): string {
    switch (catId) {
      case 1: return 'Tradicionales';
      case 2: return 'Parrillas';
      case 3: return 'Sopas';
      case 4: return 'Entradas';
      case 5: return 'Bebidas';
      case 6: return 'Postres';
      default: return `Cat ${catId}`;
    }
  }

  agregarPlatoConVariante(plato: any, variante: any, event?: Event) {
    if (event) event.stopPropagation();
    if (!plato.disponible || !variante.disponible) return;

    this.comandaItems.update(items => {
      const idx = items.findIndex(i => i.platoId === plato.id && i.varianteId === variante.id);
      if (idx > -1) {
        const updated = [...items];
        updated[idx] = { ...updated[idx], cantidad: updated[idx].cantidad + 1 };
        return updated;
      }
      return [...items, {
        platoId: plato.id,
        varianteId: variante.id,
        varianteNombre: variante.nombre,
        nombreBase: plato.nombre,
        nombre: plato.nombre,
        precio: Number(variante.precio),
        cantidad: 1,
        notas: ''
      }];
    });
  }

  agregarPlatoSinVariante(plato: any, event?: Event) {
    if (event) event.stopPropagation();
    if (!plato.disponible) return;

    this.comandaItems.update(items => {
      const idx = items.findIndex(i => i.platoId === plato.id && !i.varianteId);
      if (idx > -1) {
        const updated = [...items];
        updated[idx] = { ...updated[idx], cantidad: updated[idx].cantidad + 1 };
        return updated;
      }
      return [...items, {
        platoId: plato.id,
        nombreBase: plato.nombre,
        nombre: plato.nombre,
        precio: Number(plato.precioVenta),
        cantidad: 1,
        notas: ''
      }];
    });
  }

  incrementarCantidad(item: ItemComanda) {
    this.comandaItems.update(items => {
      return items.map(i => (i.platoId === item.platoId && i.varianteId === item.varianteId) ? { ...i, cantidad: i.cantidad + 1 } : i);
    });
  }

  decrementarCantidad(item: ItemComanda) {
    this.comandaItems.update(items => {
      return items.map(i => {
        if (i.platoId === item.platoId && i.varianteId === item.varianteId) {
          const newQty = i.cantidad - 1;
          return { ...i, cantidad: newQty };
        }
        return i;
      }).filter(i => i.cantidad > 0);
    });
  }

  quitarItem(platoId: string, varianteId?: string) {
    this.comandaItems.update(items => items.filter(i => !(i.platoId === platoId && i.varianteId === (varianteId || undefined))));
  }

  getComandaTotal(): number {
    return this.comandaItems().reduce((sum, item) => sum + item.precio * item.cantidad, 0);
  }

  submitComanda() {
    if (!this.mesa) return;
    this.isSubmitting.set(true);
    this.errorMessage.set('');

    const payload = {
      mesaId: this.mesa.id,
      notas: this.generalNotes(),
      items: this.comandaItems().map(i => ({
        platoId: i.platoId,
        varianteId: i.varianteId || undefined,
        cantidad: i.cantidad,
        notas: i.notas
      }))
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
          total: this.getComandaTotal()
        });
        this.saved.emit();
        this.viewMode.set('CONFIRMATION');
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err.error?.message || 'Error al guardar la comanda.');
      }
    });
  }

  volverAlSalon() {
    this.saved.emit();
    this.close.emit();
    this.viewMode.set('FORM');
  }

  verDetalleMesa() {
    this.cargarPedidoActivo();
    this.viewMode.set('OCCUPIED_DETAIL');
  }

  irAFormularioNuevoItem() {
    this.comandaItems.set([]);
    this.viewMode.set('FORM');
  }

  formatEstadoItem(estado?: string): string {
    switch (estado?.toUpperCase()) {
      case 'ENTREGADO':
      case 'SERVIDO':
        return '✓ SERVIDO';
      case 'LISTO':
        return '✓ LISTO';
      case 'EN_PREPARACION':
      default:
        return '⟳ EN PREPARACIÓN';
    }
  }

  solicitarCuenta() {
    const pedidoId = this.activePedidoId();
    if (!pedidoId) {
      this.errorMessage.set('No hay un pedido activo registrado para esta mesa.');
      return;
    }
    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.http.patch(`${this.baseUrl}/pedidos/${pedidoId}/estado`, { estado: 'ENTREGADO' }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.saved.emit();
        this.close.emit();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err.error?.message || 'Error al solicitar la cuenta.');
      }
    });
  }

  // ── Flujo de Cobro & Facturación ──

  imprimirPrecuenta() {
    if (!this.mesa) return;
    const sent = this.activeSentItems();
    const items = (sent.length > 0 ? sent : this.comandaItems()).map(i => ({
      nombre: i.nombre,
      cantidad: i.cantidad,
      precioUnitario: i.precio,
      subtotal: i.precio * i.cantidad,
      notas: i.notas || ''
    }));

    const datos: DatosRecibo = {
      transaccionId: `PRE-${Date.now()}`,
      nroRecibo: `PRE-${this.mesa.numero}-${Date.now().toString().slice(-4)}`,
      fecha: new Date().toISOString(),
      mesa: { numero: this.mesa.numero },
      mesero: { nombre: this.activeMeseroNombre() || 'Mesero' },
      cajero: { nombre: 'Pre-Cuenta' },
      items,
      subtotal: this.getComandaTotal(),
      total: this.getComandaTotal(),
      metodoPago: 'EFECTIVO',
      montoRecibido: this.getComandaTotal(),
      cambio: 0
    };

    this.datosRecibo.set(datos);
    this.showComprobante.set(true);
  }

  abrirCajaModal() {
    const pedidoId = this.activePedidoId();
    if (!pedidoId || !this.mesa) {
      this.errorMessage.set('No hay un pedido activo para cobrar.');
      return;
    }

    const sent = this.activeSentItems();
    const items = (sent.length > 0 ? sent : this.comandaItems()).map(i => ({
      nombre: i.nombre,
      precio: i.precio,
      cantidad: i.cantidad,
      notas: i.notas || ''
    }));

    this.pedidoParaCobro.set({
      pedidoId,
      mesaNumero: this.mesa.numero,
      meseroNombre: this.activeMeseroNombre(),
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
    // Emitir que los datos cambiaron (mesa liberada)
    this.saved.emit();
  }

  onComprobanteCerrar() {
    this.showComprobante.set(false);
    this.datosRecibo.set(null);
    this.close.emit();
  }
}
