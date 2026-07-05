import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { SocketService } from '../../core/services/socket.service';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';

interface Mesa {
  id: number;
  numero: string;
  capacidad: number;
  estado: string; // LIBRE, OCUPADA, RESERVADA, POR_COBRAR
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
  selector: 'app-mesas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="mesas-container">
      <div class="header-section glass-panel">
        <div>
          <h1>Distribución de Mesas</h1>
          <p>Plano interactivo del salón en tiempo real. Gestiona comandas instantáneamente.</p>
        </div>
        <div class="legend">
          <div class="legend-item"><span class="dot libre"></span> Libre</div>
          <div class="legend-item"><span class="dot ocupada"></span> Ocupada</div>
          <div class="legend-item"><span class="dot atendiendo"></span> Atendiendo (Por Cobrar)</div>
        </div>
      </div>

      <!-- Grid de Mesas -->
      <div class="tables-map glass-panel">
        <div class="map-grid">
          @for (mesa of mesas(); track mesa.id) {
            <div 
              class="table-card" 
              [ngClass]="getMesaClass(mesa.estado)"
              (click)="onMesaClick(mesa)"
            >
              <span class="table-number">{{ mesa.numero }}</span>
              <span class="table-cap">Cap. {{ mesa.capacidad }}</span>
              <span class="status-pill">{{ getMesaEstadoLabel(mesa.estado) }}</span>
            </div>
          }
        </div>
      </div>

      <!-- MODAL GLASSMORPHIC: CREAR COMANDA -->
      @if (showComandaModal && selectedMesa) {
        <div class="modal-backdrop" (click)="closeModal()">
          <div class="modal-card glass-panel" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2>Crear Comanda — Mesa {{ selectedMesa.numero }}</h2>
              <button class="close-btn" (click)="closeModal()">×</button>
            </div>
            
            <div class="modal-body">
              <!-- Mensajes de Error/Alerta -->
              @if (errorMessage) {
                <div class="error-alert">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span>{{ errorMessage }}</span>
                </div>
              }

              <div class="comanda-grid">
                <!-- Columna Platos Disponibles -->
                <div class="platos-section">
                  <h3>Menú del Día</h3>
                  <div class="platos-list scrollbar-custom">
                    @for (plato of platos(); track plato.id) {
                      <div class="plato-item glass-panel">
                        <div class="plato-info">
                          <h4>{{ plato.nombre }}</h4>
                          <span class="plato-price">$ {{ plato.precioVenta }}</span>
                        </div>
                        <button class="add-btn" (click)="agregarPlatoAComanda(plato)">
                          + Añadir
                        </button>
                      </div>
                    } @empty {
                      <p class="empty-msg">No hay platos disponibles en este momento.</p>
                    }
                  </div>
                </div>

                <!-- Columna Resumen Comanda -->
                <div class="resumen-section">
                  <h3>Detalle de la Comanda</h3>
                  <div class="resumen-list scrollbar-custom">
                    @for (item of comandaItems(); track item.platoId) {
                      <div class="resumen-item">
                        <div class="resumen-item-info">
                          <span><strong>{{ item.nombre }}</strong> x {{ item.cantidad }}</span>
                          <span class="item-subtotal">$ {{ (item.precio * item.cantidad).toFixed(2) }}</span>
                        </div>
                        <div class="resumen-item-actions">
                          <input 
                            type="text" 
                            [(ngModel)]="item.notas" 
                            placeholder="Notas (sin cebolla, término medio...)" 
                            class="item-note-input"
                          />
                          <button class="remove-btn" (click)="quitarPlatoDeComanda(item.platoId)">
                            Eliminar
                          </button>
                        </div>
                      </div>
                    } @empty {
                      <div class="empty-resumen">
                        <p>Selecciona platos del menú para armar la comanda.</p>
                      </div>
                    }
                  </div>

                  <!-- General Notas y Total -->
                  <div class="resumen-footer">
                    <div class="general-notes">
                      <label for="comanda-notes">Notas Generales:</label>
                      <textarea 
                        id="comanda-notes" 
                        [(ngModel)]="generalNotes" 
                        placeholder="Indicaciones adicionales de la comanda..."
                      ></textarea>
                    </div>

                    <div class="total-row">
                      <span>Total:</span>
                      <span class="total-price">$ {{ getComandaTotal().toFixed(2) }}</span>
                    </div>

                    <button 
                      class="submit-btn" 
                      [disabled]="comandaItems().length === 0 || isSubmitting"
                      (click)="enviarComanda()"
                    >
                      @if (isSubmitting) {
                        Enviando...
                      } @else {
                        Enviar Comanda a Cocina
                      }
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .mesas-container {
      display: flex;
      flex-direction: column;
      gap: 30px;
    }

    .header-section {
      padding: 24px 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 20px;

      h1 {
        font-family: var(--font-title);
        font-size: 1.6rem;
        font-weight: 700;
      }
      p {
        color: var(--text-muted);
        font-size: 0.9rem;
      }
    }

    .legend {
      display: flex;
      gap: 20px;
      font-size: 0.85rem;

      .legend-item {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;

        &.libre { background-color: var(--primary); }
        &.ocupada { background-color: var(--danger); }
        &.atendiendo { background-color: var(--accent); }
      }
    }

    .tables-map {
      padding: 40px;
      min-height: 400px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .map-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 30px;
      width: 100%;
      max-width: 900px;
    }

    .table-card {
      aspect-ratio: 1;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      cursor: pointer;
      transition: var(--transition-fast);
      box-shadow: 0 4px 15px rgba(0,0,0,0.25);
      border: 2px solid transparent;

      .table-number {
        font-family: var(--font-title);
        font-size: 1.4rem;
        font-weight: 800;
        color: #ffffff;
      }

      .table-cap {
        font-size: 0.72rem;
        color: rgba(255,255,255,0.7);
      }

      .status-pill {
        font-size: 0.6rem;
        font-weight: 700;
        text-transform: uppercase;
        padding: 2px 6px;
        border-radius: 4px;
        margin-top: 4px;
      }

      &.libre {
        background: rgba(16, 185, 129, 0.08);
        border-color: rgba(16, 185, 129, 0.2);
        .status-pill { background: var(--primary-glow); color: var(--primary); }
        &:hover {
          background: rgba(16, 185, 129, 0.15);
          box-shadow: 0 0 20px var(--primary-glow);
          border-color: var(--primary);
        }
      }

      &.ocupada {
        background: rgba(239, 68, 68, 0.08);
        border-color: rgba(239, 68, 68, 0.2);
        .status-pill { background: var(--danger-glow); color: #fca5a5; }
        &:hover {
          background: rgba(239, 68, 68, 0.15);
          box-shadow: 0 0 20px var(--danger-glow);
          border-color: var(--danger);
        }
      }

      &.por-cobrar {
        background: rgba(245, 158, 11, 0.08);
        border-color: rgba(245, 158, 11, 0.2);
        .status-pill { background: var(--accent-glow); color: #fcd34d; }
        &:hover {
          background: rgba(245, 158, 11, 0.15);
          box-shadow: 0 0 20px var(--accent-glow);
          border-color: var(--accent);
        }
      }
    }

    /* MODAL STYLING */
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(5px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-card {
      width: 90%;
      max-width: 900px;
      height: 80vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 15px 30px rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: var(--radius-md);
      animation: modalFadeIn 0.3s ease;
    }

    @keyframes modalFadeIn {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    .modal-header {
      padding: 20px 30px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;

      h2 {
        font-family: var(--font-title);
        font-size: 1.3rem;
        font-weight: 700;
        color: #ffffff;
      }

      .close-btn {
        background: transparent;
        border: none;
        color: var(--text-muted);
        font-size: 2rem;
        cursor: pointer;
        line-height: 1;
        &:hover { color: #ffffff; }
      }
    }

    .modal-body {
      flex: 1;
      padding: 30px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      gap: 20px;
    }

    .error-alert {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
      padding: 12px 16px;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 0.85rem;

      svg {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
      }
    }

    .comanda-grid {
      display: grid;
      grid-template-columns: 1fr 1.2fr;
      gap: 30px;
      flex: 1;
      overflow: hidden;
    }

    .platos-section, .resumen-section {
      display: flex;
      flex-direction: column;
      overflow: hidden;

      h3 {
        font-family: var(--font-title);
        font-size: 0.95rem;
        color: var(--text-muted);
        margin-bottom: 15px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
    }

    .platos-list, .resumen-list {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 15px;
      padding-right: 8px;
    }

    .plato-item {
      padding: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border: 1px solid rgba(255, 255, 255, 0.03);

      .plato-info {
        h4 {
          font-size: 0.92rem;
          font-weight: 600;
          color: #ffffff;
        }
        .plato-price {
          font-size: 0.85rem;
          color: var(--primary);
          font-weight: 500;
        }
      }

      .add-btn {
        background: rgba(16, 185, 129, 0.15);
        color: var(--primary);
        border: 1px solid rgba(16, 185, 129, 0.3);
        padding: 6px 12px;
        border-radius: var(--radius-sm);
        cursor: pointer;
        font-size: 0.8rem;
        font-weight: 600;
        transition: var(--transition-fast);
        &:hover {
          background: var(--primary);
          color: #102a1e;
        }
      }
    }

    .resumen-item {
      background: rgba(255,255,255,0.02);
      border-radius: var(--radius-sm);
      border: 1px solid rgba(255,255,255,0.05);
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;

      .resumen-item-info {
        display: flex;
        justify-content: space-between;
        font-size: 0.9rem;
      }

      .resumen-item-actions {
        display: flex;
        gap: 10px;

        .item-note-input {
          flex: 1;
          background: rgba(0,0,0,0.25);
          border: 1px solid rgba(255,255,255,0.1);
          color: #ffffff;
          padding: 6px 10px;
          font-size: 0.78rem;
          border-radius: var(--radius-sm);
          outline: none;
          &:focus { border-color: rgba(255,255,255,0.3); }
        }

        .remove-btn {
          background: rgba(239, 68, 68, 0.1);
          color: #fca5a5;
          border: 1px solid rgba(239, 68, 68, 0.2);
          padding: 6px 12px;
          font-size: 0.75rem;
          border-radius: var(--radius-sm);
          cursor: pointer;
          &:hover { background: var(--danger); color: #ffffff; }
        }
      }
    }

    .empty-resumen {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      border: 2px dashed rgba(255, 255, 255, 0.05);
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      font-size: 0.85rem;
      text-align: center;
      padding: 20px;
    }

    .resumen-footer {
      border-top: 1px solid rgba(255,255,255,0.08);
      padding-top: 20px;
      display: flex;
      flex-direction: column;
      gap: 15px;

      .general-notes {
        display: flex;
        flex-direction: column;
        gap: 6px;
        label { font-size: 0.8rem; color: var(--text-muted); }
        textarea {
          background: rgba(0,0,0,0.25);
          border: 1px solid rgba(255,255,255,0.1);
          color: #ffffff;
          border-radius: var(--radius-sm);
          padding: 10px;
          font-size: 0.8rem;
          outline: none;
          resize: none;
          height: 50px;
          &:focus { border-color: rgba(255,255,255,0.3); }
        }
      }

      .total-row {
        display: flex;
        justify-content: space-between;
        font-size: 1.1rem;
        font-weight: 700;
        color: #ffffff;
        .total-price { color: var(--primary); }
      }

      .submit-btn {
        background: var(--primary);
        color: #064e3b;
        border: none;
        padding: 12px;
        border-radius: var(--radius-sm);
        font-weight: 700;
        cursor: pointer;
        transition: var(--transition-fast);
        &:hover:not(:disabled) {
          box-shadow: 0 0 15px var(--primary-glow);
          transform: translateY(-1px);
        }
        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }
    }

    /* Custom Scrollbar */
    .scrollbar-custom::-webkit-scrollbar {
      width: 6px;
    }
    .scrollbar-custom::-webkit-scrollbar-track {
      background: transparent;
    }
    .scrollbar-custom::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.1);
      border-radius: 3px;
    }
    .scrollbar-custom::-webkit-scrollbar-thumb:hover {
      background: rgba(255,255,255,0.25);
    }
  `],
})
export class MesasComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private socketService = inject(SocketService);
  
  private readonly baseUrl = 'http://localhost:3000/api';

  mesas = signal<Mesa[]>([]);
  platos = signal<Plato[]>([]);
  
  // Modal state
  showComandaModal = false;
  selectedMesa: Mesa | null = null;
  comandaItems = signal<ItemComanda[]>([]);
  generalNotes = '';
  errorMessage = '';
  isSubmitting = false;

  private subs: Subscription[] = [];

  ngOnInit() {
    this.cargarMesas();
    this.cargarPlatos();
    this.suscribirAActualizaciones();
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }

  cargarMesas() {
    this.http.get<any>(`${this.baseUrl}/mesas`).subscribe({
      next: (res) => this.mesas.set(res.data || []),
      error: (err) => console.error('Error cargando mesas', err)
    });
  }

  cargarPlatos() {
    this.http.get<any>(`${this.baseUrl}/carta/platos`).subscribe({
      next: (res) => {
        // Filtrar platos disponibles
        const platosLista = res.data || [];
        this.platos.set(platosLista.filter((p: Plato) => p.disponible));
      },
      error: (err) => console.error('Error cargando carta', err)
    });
  }

  suscribirAActualizaciones() {
    // Escuchar el estado de mesas cambiado en tiempo real
    const subMesa = this.socketService
      .onEvent<{ mesaId: number; estado: string }>('mesa:estado-actualizado')
      .subscribe((data) => {
        console.log(`🔌 WebSocket Recibido - Mesa ${data.mesaId} cambió a: ${data.estado}`);
        this.mesas.update((lista) => {
          return lista.map((m) => {
            if (m.id === data.mesaId) {
              return { ...m, estado: data.estado };
            }
            return m;
          });
        });
      });

    // Escuchar si el menú cambió (debido a stock crítico)
    const subMenu = this.socketService
      .onEvent<void>('menu:actualizado')
      .subscribe(() => {
        console.log('🔌 WebSocket Recibido - El menú ha sido actualizado');
        this.cargarPlatos();
      });

    this.subs.push(subMesa, subMenu);
  }

  onMesaClick(mesa: Mesa) {
    if (mesa.estado === 'LIBRE') {
      this.selectedMesa = mesa;
      this.comandaItems.set([]);
      this.generalNotes = '';
      this.errorMessage = '';
      this.showComandaModal = true;
    } else {
      alert(`Mesa ${mesa.numero} está actualmente ${mesa.estado.toLowerCase()}. En el MVP solo se pueden ordenar comandas en mesas Libres.`);
    }
  }

  closeModal() {
    this.showComandaModal = false;
    this.selectedMesa = null;
  }

  agregarPlatoAComanda(plato: Plato) {
    this.comandaItems.update((items) => {
      const idx = items.findIndex((i) => i.platoId === plato.id);
      if (idx > -1) {
        const nuevosItems = [...items];
        nuevosItems[idx].cantidad += 1;
        return nuevosItems;
      } else {
        return [
          ...items,
          {
            platoId: plato.id,
            nombre: plato.nombre,
            precio: Number(plato.precioVenta),
            cantidad: 1,
            notas: ''
          }
        ];
      }
    });
  }

  quitarPlatoDeComanda(platoId: string) {
    this.comandaItems.update((items) => {
      return items.filter((i) => i.platoId !== platoId);
    });
  }

  getComandaTotal(): number {
    return this.comandaItems().reduce((sum, item) => sum + item.precio * item.cantidad, 0);
  }

  enviarComanda() {
    if (!this.selectedMesa) return;

    this.isSubmitting = true;
    this.errorMessage = '';

    const payload = {
      mesaId: this.selectedMesa.id,
      notas: this.generalNotes,
      items: this.comandaItems().map((i) => ({
        platoId: i.platoId,
        cantidad: i.cantidad,
        notas: i.notas
      }))
    };

    this.http.post(`${this.baseUrl}/pedidos`, payload).subscribe({
      next: (response: any) => {
        this.isSubmitting = false;
        this.closeModal();
      },
      error: (err) => {
        this.isSubmitting = false;
        // Capturar error detallado de stock insuficiente del backend
        this.errorMessage = err.error?.message || 'Error al enviar la comanda. Intente de nuevo.';
      }
    });
  }

  getMesaClass(estado: string): string {
    return estado.toLowerCase().replace('_', '-');
  }

  getMesaEstadoLabel(estado: string): string {
    switch (estado) {
      case 'LIBRE': return 'Libre';
      case 'OCUPADA': return 'Ocupada';
      case 'POR_COBRAR': return 'Por Cobrar';
      case 'RESERVADA': return 'Reservada';
      default: return estado;
    }
  }
}
