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
  nombre: string;
  precio: number;
  cantidad: number;
  notas: string;
}

@Component({
  selector: 'app-comanda-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, CajaCobroComponent, ComprobanteComponent],
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

  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

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
    
    this.platos.forEach(p => {
      if (p.categoriaId && !ids.has(p.categoriaId)) {
        ids.add(p.categoriaId);
        list.push({ id: p.categoriaId, nombre: this.getCategoryName(p.categoriaId) });
      }
    });
    return list;
  });

  // Filtered dishes for quick search (flattened with variants)
  filteredPlatos = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const catId = this.selectedCategoryId();
    
    const matchedDishes = this.platos.filter(plato => {
      const matchesQuery = !query || plato.nombre.toLowerCase().includes(query) || (plato.descripcion && plato.descripcion.toLowerCase().includes(query));
      const matchesCat = catId === null || plato.categoriaId === catId;
      return matchesQuery && matchesCat;
    });

    const list: any[] = [];
    matchedDishes.forEach(plato => {
      if (plato.variantes && plato.variantes.length > 0) {
        plato.variantes.forEach(v => {
          list.push({
            id: plato.id,
            varianteId: v.id,
            nombre: `${plato.nombre} (${v.nombre})`,
            precioVenta: v.precio,
            disponible: v.disponible && plato.disponible,
            categoriaId: plato.categoriaId,
            descripcion: plato.descripcion
          });
        });
      } else {
        list.push({
          id: plato.id,
          varianteId: null,
          nombre: plato.nombre,
          precioVenta: plato.precioVenta,
          disponible: plato.disponible,
          categoriaId: plato.categoriaId,
          descripcion: plato.descripcion
        });
      }
    });

    return list;
  });

  constructor() {
    this.cargarWaiters();
  }

  ngOnChanges(changes: SimpleChanges) {
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
      } else {
        this.cargarPedidoActivo();
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
            varianteNombre: d.varianteNombreSnapshot || undefined,
            nombre: d.varianteNombreSnapshot ? `${d.plato?.nombre} (${d.varianteNombreSnapshot})` : (d.plato?.nombre || 'Plato'),
            precio: Number(d.precioUnitario || d.plato?.precioVenta),
            cantidad: d.cantidad,
            notas: d.notas || ''
          }));
          this.comandaItems.set(items);
        } else {
          this.comandaItems.set([]);
          this.generalNotes.set('');
        }
      },
      error: (err) => {
        console.error('Error cargando pedido activo', err);
        this.errorMessage.set('No se pudo cargar la comanda activa.');
      }
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
      default: return `Cat ${catId}`;
    }
  }

  agregarPlato(plato: any) {
    this.comandaItems.update(items => {
      const idx = items.findIndex(i => i.platoId === plato.id && i.varianteId === (plato.varianteId || undefined));
      if (idx > -1) {
        const n = [...items];
        n[idx].cantidad += 1;
        return n;
      }
      return [...items, {
        platoId: plato.id,
        varianteId: plato.varianteId || undefined,
        varianteNombre: plato.varianteId ? plato.nombre.split('(')[1]?.replace(')', '') : undefined,
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

    this.http.post(`${this.baseUrl}/pedidos`, payload).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.saved.emit();
        this.close.emit();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err.error?.message || 'Error al guardar la comanda.');
      }
    });
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

  abrirCajaModal() {
    const pedidoId = this.activePedidoId();
    if (!pedidoId || !this.mesa) {
      this.errorMessage.set('No hay un pedido activo para cobrar.');
      return;
    }

    this.pedidoParaCobro.set({
      pedidoId,
      mesaNumero: this.mesa.numero,
      meseroNombre: this.activeMeseroNombre(),
      items: this.comandaItems().map(i => ({
        nombre: i.nombre,
        precio: i.precio,
        cantidad: i.cantidad,
        notas: i.notas
      })),
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
