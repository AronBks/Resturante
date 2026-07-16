import { Component, Input, Output, EventEmitter, inject, signal, computed, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';

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
}

interface ItemComanda {
  platoId: string;
  nombre: string;
  precio: number;
  cantidad: number;
  notas: string;
}

@Component({
  selector: 'app-comanda-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  // Search & Filter
  searchQuery = signal('');
  selectedCategoryId = signal<number | null>(null);

  // Users / Waiters
  waiters = signal<any[]>([]);

  // Computed Categories from inputs
  categories = computed(() => {
    const list: { id: number; nombre: string }[] = [];
    const ids = new Set<number>();
    
    // We can infer categories from the dishes list or fetch them.
    // Inferring is safer as it uses the active dishes in context.
    this.platos.forEach(p => {
      if (p.categoriaId && !ids.has(p.categoriaId)) {
        ids.add(p.categoriaId);
        list.push({ id: p.categoriaId, nombre: this.getCategoryName(p.categoriaId) });
      }
    });
    return list;
  });

  // Filtered dishes for quick search
  filteredPlatos = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const catId = this.selectedCategoryId();
    
    return this.platos.filter(plato => {
      const matchesQuery = !query || plato.nombre.toLowerCase().includes(query) || (plato.descripcion && plato.descripcion.toLowerCase().includes(query));
      const matchesCat = catId === null || plato.categoriaId === catId;
      return matchesQuery && matchesCat;
    });
  });

  constructor() {
    this.cargarWaiters();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['mesa'] && this.mesa) {
      this.errorMessage.set('');
      this.activePedidoId.set(null);
      
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
        // Fallback waitstaff
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
          
          const items: ItemComanda[] = (pedido.detalles || []).map((d: any) => ({
            platoId: d.platoId,
            nombre: d.plato?.nombre || 'Plato',
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

  agregarPlato(plato: Plato) {
    this.comandaItems.update(items => {
      const idx = items.findIndex(i => i.platoId === plato.id);
      if (idx > -1) {
        const n = [...items];
        n[idx].cantidad += 1;
        return n;
      }
      return [...items, {
        platoId: plato.id,
        nombre: plato.nombre,
        precio: Number(plato.precioVenta),
        cantidad: 1,
        notas: ''
      }];
    });
  }

  incrementarCantidad(item: ItemComanda) {
    this.comandaItems.update(items => {
      return items.map(i => i.platoId === item.platoId ? { ...i, cantidad: i.cantidad + 1 } : i);
    });
  }

  decrementarCantidad(item: ItemComanda) {
    this.comandaItems.update(items => {
      return items.map(i => {
        if (i.platoId === item.platoId) {
          const newQty = i.cantidad - 1;
          return { ...i, cantidad: newQty };
        }
        return i;
      }).filter(i => i.cantidad > 0);
    });
  }

  quitarItem(platoId: string) {
    this.comandaItems.update(items => items.filter(i => i.platoId !== platoId));
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

  cobrarLiberar() {
    if (!this.mesa) return;
    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.http.patch(`${this.baseUrl}/mesas/${this.mesa.id}/estado`, { estado: 'LIBRE' }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.saved.emit();
        this.close.emit();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err.error?.message || 'Error al liberar la mesa.');
      }
    });
  }
}
