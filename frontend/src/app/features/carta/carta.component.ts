import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-carta',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="carta-container">
      <div class="header-section glass-panel">
        <div>
          <h1>Menú y Carta Gastronómica</h1>
          <p>Visualización y administración de los platos vigentes.</p>
        </div>
      </div>

      <div class="carta-grid">
        @for (plato of platos; track plato.nombre) {
          <div class="plato-card glass-panel">
            <div class="plato-img">
              <!-- Placeholder culinary graphic -->
              <div class="img-placeholder">🍽️</div>
            </div>
            <div class="plato-info">
              <h3>{{ plato.nombre }}</h3>
              <p class="desc">{{ plato.desc }}</p>
              <div class="price-row">
                <span class="price">\${{ plato.precio.toFixed(2) }}</span>
                <span class="badge" [ngClass]="{ disponible: plato.disponible }">
                  {{ plato.disponible ? 'Disponible' : 'Agotado' }}
                </span>
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .carta-container {
      display: flex;
      flex-direction: column;
      gap: 30px;
    }

    .header-section {
      padding: 24px 30px;
      h1 { font-family: var(--font-title); font-size: 1.6rem; font-weight: 700; }
      p { color: var(--text-muted); font-size: 0.9rem; }
    }

    .carta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 20px;
    }

    .plato-card {
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .plato-img {
      height: 140px;
      background: rgba(255,255,255,0.02);
      border-bottom: 1px solid var(--border-glass);
      display: flex;
      align-items: center;
      justify-content: center;

      .img-placeholder {
        font-size: 3rem;
      }
    }

    .plato-info {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;

      h3 {
        font-family: var(--font-title);
        font-size: 1.1rem;
        font-weight: 700;
        color: #ffffff;
      }

      .desc {
        font-size: 0.8rem;
        color: var(--text-muted);
        line-height: 1.4;
        flex: 1;
      }
    }

    .price-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 10px;

      .price {
        font-family: var(--font-title);
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--accent);
      }

      .badge {
        font-size: 0.65rem;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        background: var(--danger-glow);
        color: #fca5a5;
        border: 1px solid rgba(239, 68, 68, 0.2);

        &.disponible {
          background: var(--primary-glow);
          color: #a7f3d0;
          border-color: rgba(16, 185, 129, 0.2);
        }
      }
    }
  `],
})
export class CartaComponent {
  platos = [
    { nombre: 'Lomo Saltado', desc: 'Lomo de res salteado con cebolla, tomate y papas fritas', precio: 45, disponible: true },
    { nombre: 'Ensalada César', desc: 'Lechuga, crotones, queso parmesano y aderezo César', precio: 25, disponible: true },
    { nombre: 'Pollo a la Plancha', desc: 'Pechuga de pollo con arroz y ensalada', precio: 35, disponible: true },
    { nombre: 'Parrillada para 2', desc: 'Lomo, costilla, chorizo con papas', precio: 120, disponible: true },
  ];
}
