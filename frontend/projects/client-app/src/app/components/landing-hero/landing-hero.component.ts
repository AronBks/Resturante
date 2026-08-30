import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { CarritoService } from '../../services/carrito.service';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'client-landing-hero',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule],
  template: `
    <div class="landing-page">
      <!-- HERO SECTION -->
      <section class="hero" id="hero">
        <!-- Ambient radial glow behind the title -->
        <div class="hero__ambient-glow"></div>
        <div class="hero__grain"></div>

        <!-- Top Table Badge (Si está en salón o tiene mesa) -->
        <div class="hero__table-pill animate-in">
          <lucide-icon name="map-pin" [size]="14" class="pill-ico"></lucide-icon>
          <span>Mesa Asignada: <strong>{{ mesaNumero() }}</strong></span>
        </div>

        <!-- Brand content -->
        <div class="hero__content animate-in">
          <p class="hero__eyebrow">PEÑA & RESTAURANT</p>
          <h1 class="hero__title">TUKUYPAJ</h1>
          <p class="hero__subtitle">Sabores Cochabambinos desde el Corazón</p>

          <!-- Banner de Estado de Comanda Activa si ya ordenó -->
          @if (carritoService.ultimoPedido()) {
            <div class="hero__active-order-badge animate-in">
              <span class="pulse-dot"></span>
              <span>Comanda Activa: <strong>#{{ carritoService.ultimoPedido()?.codigo }}</strong> ({{ carritoService.ultimoPedido()?.items?.length || 0 }} productos)</span>
            </div>
          } @else if (carritoService.cantidadTotalItems() > 0) {
            <div class="hero__active-order-badge animate-in">
              <lucide-icon name="shopping-bag" [size]="14"></lucide-icon>
              <span>Tienes <strong>{{ carritoService.cantidadTotalItems() }} platos</strong> en tu comanda</span>
            </div>
          }

          <div class="hero__actions">
            <a
              routerLink="/carta"
              [queryParams]="{ mesa: mesaNumero() }"
              class="hero__cta"
              id="cta-ver-carta"
            >
              <svg class="hero__cta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
                <path d="M7 2v20"/>
                <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
              </svg>
              <span>{{ ctaText() }}</span>
            </a>

            <a
              routerLink="/pedido-ia"
              [queryParams]="{ mesa: mesaNumero() }"
              class="hero__secondary-cta"
              id="cta-pedir-ia"
            >
              <lucide-icon name="bot" [size]="16"></lucide-icon>
              <span>Pedir con Don Beto (IA)</span>
            </a>
          </div>
        </div>

        <!-- Scroll indicator -->
        <div class="hero__scroll-indicator">
          <div class="hero__scroll-mouse">
            <div class="hero__scroll-wheel"></div>
          </div>
          <span class="scroll-lbl">Información & Concierge</span>
        </div>
      </section>

      <!-- CONCIERGE / INFO SECTION -->
      <section class="concierge" id="info">
        <div class="concierge__container animate-in">
          <div class="concierge__header">
            <h2 class="concierge__title">Concierge</h2>
            <div class="concierge__divider">
              <span class="concierge__divider-line"></span>
              <span class="concierge__divider-diamond">◆</span>
              <span class="concierge__divider-line"></span>
            </div>
            <p class="concierge__subtitle">INFORMACIÓN PARA SU VISITA</p>
          </div>

          <div class="concierge__grid">
            <!-- Horarios -->
            <div class="concierge__card">
              <div class="concierge__card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <h3 class="concierge__card-title">Horarios</h3>
              <p class="concierge__card-detail">Lunes a Domingo</p>
              <p class="concierge__card-highlight">11:30 — 23:00</p>
            </div>

            <!-- Ubicación -->
            <div class="concierge__card">
              <div class="concierge__card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
              <h3 class="concierge__card-title">Ubicación</h3>
              <p class="concierge__card-detail">Av. Capitán Victor Ustariz</p>
              <p class="concierge__card-highlight">Km 3.5, Cochabamba</p>
              <a
                href="https://maps.google.com/?q=Av+Capitan+Victor+Ustariz+Km+3.5+Cochabamba+Bolivia"
                target="_blank"
                rel="noopener noreferrer"
                class="concierge__card-link"
                id="link-google-maps"
              >
                ABRIR EN GOOGLE MAPS →
              </a>
            </div>

            <!-- Contacto -->
            <div class="concierge__card">
              <div class="concierge__card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </div>
              <h3 class="concierge__card-title">Contacto</h3>
              <p class="concierge__card-detail">WhatsApp / Llamadas</p>
              <p class="concierge__card-highlight">(+591) 71727374</p>
              <a
                href="https://wa.me/59171727374"
                target="_blank"
                rel="noopener noreferrer"
                class="concierge__card-link"
                id="link-whatsapp"
              >
                ESCRIBIR POR WHATSAPP →
              </a>
            </div>
          </div>
        </div>
      </section>

      <!-- FOOTER -->
      <footer class="footer">
        <div class="footer__brand">TUKUYPAJ</div>
        <div class="footer__links">
          <a
            href="https://facebook.com/PeñaTukuypaj"
            target="_blank"
            rel="noopener noreferrer"
            class="footer__link"
            id="link-facebook"
          >
            FACEBOOK
          </a>
          <a
            href="https://instagram.com/PeñaTukuypaj"
            target="_blank"
            rel="noopener noreferrer"
            class="footer__link"
            id="link-instagram"
          >
            INSTAGRAM
          </a>
          <a
            href="https://wa.me/59171727374"
            target="_blank"
            rel="noopener noreferrer"
            class="footer__link"
            id="link-footer-whatsapp"
          >
            WHATSAPP
          </a>
        </div>
        <p class="footer__copyright">© 2026 Tukuypaj Restaurant. Cochabamba, Bolivia.</p>
      </footer>
    </div>
  `,
  styleUrl: './landing-hero.component.scss',
})
export class LandingHeroComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly carritoService = inject(CarritoService);

  mesaNumero = signal<string>('M01');

  ctaText = computed(() => {
    if (this.carritoService.ultimoPedido()) {
      return 'CONTINUAR CON MI COMANDA';
    }
    if (this.carritoService.cantidadTotalItems() > 0) {
      return `VER COMANDA (${this.carritoService.cantidadTotalItems()} PLATOS)`;
    }
    return 'VER NUESTRA CARTA';
  });

  ngOnInit(): void {
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
  }
}

