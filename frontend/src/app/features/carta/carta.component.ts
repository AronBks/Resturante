import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';

interface Categoria {
  id: number;
  nombre: string;
  descripcion?: string;
  platos: {
    id: string;
    nombre: string;
    precioVenta: number;
    descripcion?: string;
    imagenUrl?: string;
    disponible: boolean;
  }[];
}

@Component({
  selector: 'app-carta',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="carta-container">
      <div class="header-section glass-panel animate-in">
        <div>
          <h1>Nuestra Carta Gastronómica</h1>
          <p>Explora el menú tradicional de <strong>Peña Restaurant Tukuypaj</strong>. Sabores cochabambinos preparados con ingredientes frescos.</p>
        </div>
      </div>

      <!-- Categories Filter Tabs -->
      <div class="categories-tabs animate-in" style="animation-delay: 0.05s">
        <button 
          class="tab-btn" 
          [class.active]="selectedCategoryId() === null"
          (click)="selectedCategoryId.set(null)"
        >
          Todo el Menú
        </button>
        @for (cat of categorias(); track cat.id) {
          <button 
            class="tab-btn" 
            [class.active]="selectedCategoryId() === cat.id"
            (click)="selectedCategoryId.set(cat.id)"
          >
            {{ cat.nombre }}
          </button>
        }
      </div>

      <!-- Platos Grid -->
      <div class="carta-sections animate-in" style="animation-delay: 0.1s">
        @for (cat of filteredCategorias(); track cat.id) {
          @if (cat.platos.length > 0) {
            <div class="category-block">
              <div class="category-header">
                <h2>{{ cat.nombre }}</h2>
                <p>{{ cat.descripcion }}</p>
              </div>
              
              <div class="platos-grid">
                @for (plato of cat.platos; track plato.id) {
                  <div class="plato-card glass-panel glass-panel-hover" [class.agotado]="!plato.disponible">
                    <div class="plato-img-wrapper">
                      <!-- Beautiful background gradient/pattern representing traditional clay dishes -->
                      <div class="clay-pot-bg">
                        <span class="food-emoji">{{ getFoodEmoji(plato.nombre) }}</span>
                      </div>
                      @if (!plato.disponible) {
                        <div class="agotado-badge">Agotado</div>
                      }
                    </div>
                    <div class="plato-info">
                      <div class="plato-title-row">
                        <h3>{{ plato.nombre }}</h3>
                        <span class="price-tag">Bs. {{ plato.precioVenta | number:'1.2-2' }}</span>
                      </div>
                      <p class="desc">{{ plato.descripcion || 'Especialidad tradicional de la casa.' }}</p>
                      
                      <!-- Toggle manual de disponibilidad (solo Admin) -->
                      @if (isAdmin()) {
                        <div class="availability-toggle">
                          <span class="toggle-label" [class.label-disponible]="plato.disponible">{{ plato.disponible ? 'Disponible' : 'Agotado' }}</span>
                          <label class="switch">
                            <input type="checkbox" [checked]="plato.disponible" (change)="togglePlatoDisponibilidad(plato)">
                            <span class="slider round"></span>
                          </label>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        } @empty {
          <div class="empty-state glass-panel">
            <p>Cargando menú de la peña...</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .carta-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .header-section {
      padding: 24px 30px;
      background: var(--gradient-brand-subtle);
      border: 1px solid var(--border-warm);

      h1 {
        font-family: var(--font-display);
        font-size: 1.55rem;
        font-weight: 700;
        color: var(--text-warm);
      }

      p {
        color: var(--text-muted);
        font-size: 0.88rem;
        margin-top: 4px;
        strong { color: var(--primary); }
      }
    }

    /* ── Categories Tabs ── */
    .categories-tabs {
      display: flex;
      gap: 10px;
      overflow-x: auto;
      padding-bottom: 8px;
      
      &::-webkit-scrollbar {
        height: 4px;
      }
      &::-webkit-scrollbar-thumb {
        background: rgba(200, 149, 108, 0.1);
        border-radius: 2px;
      }
    }

    .tab-btn {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border-glass);
      color: var(--text-muted);
      padding: 10px 18px;
      border-radius: var(--radius-sm);
      font-family: var(--font-title);
      font-size: 0.85rem;
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
      transition: var(--transition-fast);

      &:hover {
        background: rgba(200, 149, 108, 0.04);
        color: var(--text-warm);
        border-color: var(--border-glass-hover);
      }

      &.active {
        background: var(--gradient-brand);
        color: #1a1410;
        border-color: transparent;
        box-shadow: 0 4px 12px var(--primary-glow);
      }
    }

    /* ── Category Block ── */
    .category-block {
      margin-bottom: 32px;
    }

    .category-header {
      margin-bottom: 18px;
      border-left: 3px solid var(--primary);
      padding-left: 14px;

      h2 {
        font-family: var(--font-display);
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--text-warm);
      }

      p {
        font-size: 0.8rem;
        color: var(--text-muted);
        margin-top: 2px;
      }
    }

    /* ── Platos Grid ── */
    .platos-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
    }

    .plato-card {
      overflow: hidden;
      display: flex;
      flex-direction: column;
      border-color: rgba(210, 170, 120, 0.05);
      background: var(--bg-card);
      transition: opacity 0.3s ease, transform 0.3s ease;

      &.agotado {
        opacity: 0.65;
      }
    }

    .plato-img-wrapper {
      height: 120px;
      background: linear-gradient(180deg, rgba(35, 30, 24, 0.4) 0%, rgba(20, 16, 12, 0.6) 100%);
      border-bottom: 1px solid var(--border-glass);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .agotado-badge {
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(201, 74, 74, 0.9);
      color: #fff;
      font-size: 0.65rem;
      font-weight: 800;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: var(--radius-xs);
      letter-spacing: 0.5px;
    }

    .clay-pot-bg {
      width: 72px;
      height: 72px;
      background: radial-gradient(circle, rgba(200, 149, 108, 0.15) 0%, rgba(35, 28, 20, 0) 70%);
      border: 1px dashed rgba(200, 149, 108, 0.2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .food-emoji {
      font-size: 2.2rem;
      filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4));
    }

    .plato-info {
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
    }

    .plato-title-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;

      h3 {
        font-family: var(--font-title);
        font-size: 0.95rem;
        font-weight: 700;
        color: var(--text-warm);
        line-height: 1.3;
      }

      .price-tag {
        font-family: var(--font-title);
        font-size: 0.95rem;
        font-weight: 700;
        color: var(--accent);
        white-space: nowrap;
      }
    }

    .desc {
      font-size: 0.8rem;
      color: var(--text-muted);
      line-height: 1.45;
      flex: 1;
    }

    .availability-toggle {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--border-glass);
      .toggle-label {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--text-muted);
        transition: color 0.3s ease;
        &.label-disponible {
          color: var(--success);
        }
      }
    }

    .switch {
      position: relative;
      display: inline-block;
      width: 36px;
      height: 20px;
    }

    .switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(255, 255, 255, 0.08);
      transition: .4s;
      border: 1px solid var(--border-glass);
    }

    .slider:before {
      position: absolute;
      content: "";
      height: 12px;
      width: 12px;
      left: 3px;
      bottom: 3px;
      background-color: var(--text-muted);
      transition: .4s;
    }

    input:checked + .slider {
      background-color: rgba(90, 158, 111, 0.2);
      border-color: var(--success);
    }

    input:checked + .slider:before {
      transform: translateX(16px);
      background-color: var(--success);
    }

    .slider.round {
      border-radius: 20px;
    }

    .slider.round:before {
      border-radius: 50%;
    }

    .empty-state {
      padding: 40px;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.9rem;
    }
  `],
})
export class CartaComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private readonly baseUrl = 'http://localhost:3000/api';

  categorias = signal<Categoria[]>([]);
  selectedCategoryId = signal<number | null>(null);

  isAdmin = computed(() => this.authService.currentUserSignal()?.rol === 'ADMIN');

  ngOnInit() {
    this.cargarCarta();
  }

  cargarCarta() {
    this.http.get<any>(`${this.baseUrl}/carta/categorias`).subscribe({
      next: (res) => {
        const data = res.data || [];
        this.http.get<any>(`${this.baseUrl}/carta/platos`).subscribe({
          next: (platosRes) => {
            const allPlatos = platosRes.data || [];
            const categoriesWithFullPlatos = data.map((cat: any) => {
              const catPlatos = allPlatos.filter((p: any) => p.categoriaId === cat.id);
              return {
                ...cat,
                platos: catPlatos,
              };
            });
            this.categorias.set(categoriesWithFullPlatos);
          },
          error: () => {
            this.categorias.set(data);
          },
        });
      },
      error: (err) => console.error('Error cargando la carta', err),
    });
  }

  filteredCategorias() {
    const catId = this.selectedCategoryId();
    const list = this.categorias();
    if (catId === null) return list;
    return list.filter((c) => c.id === catId);
  }

  togglePlatoDisponibilidad(plato: any) {
    this.http.patch<any>(`${this.baseUrl}/carta/platos/${plato.id}/toggle-disponible`, {}).subscribe({
      next: () => {
        plato.disponible = !plato.disponible;
      },
      error: (err) => console.error('Error al cambiar disponibilidad', err),
    });
  }

  getFoodEmoji(nombre: string): string {
    const n = nombre.toLowerCase();
    if (n.includes('pique')) return '🥩';
    if (n.includes('silpancho')) return '🍳';
    if (n.includes('chicharrón') || n.includes('cerdo')) return '🐖';
    if (n.includes('chanka') || n.includes('pollo')) return '🍗';
    if (n.includes('parrillada') || n.includes('lomo')) return '🍖';
    if (n.includes('anticucho')) return '🍢';
    if (n.includes('ranga')) return '🍲';
    if (n.includes('sopa')) return '🥣';
    if (n.includes('chicha')) return '🥛';
    if (n.includes('limonada') || n.includes('refresco')) return '🍹';
    if (n.includes('helado')) return '🍨';
    if (n.includes('buñuelo')) return '🍩';
    return '🍽️';
  }
}
