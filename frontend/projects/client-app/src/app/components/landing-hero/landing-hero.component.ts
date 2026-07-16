import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'client-landing-hero',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="hero" id="hero">
      <!-- Decorative grain overlay -->
      <div class="hero__grain"></div>

      <!-- Brand content -->
      <div class="hero__content animate-in">
        <div class="hero__brand-badge">
          <span class="hero__brand-icon">🍽️</span>
        </div>

        <p class="hero__eyebrow">Peña & Restaurant</p>
        <h1 class="hero__title">Tukuypaj</h1>
        <p class="hero__subtitle">Sabores Cochabambinos desde el Corazón</p>

        <div class="hero__divider">
          <span class="hero__divider-dot"></span>
          <span class="hero__divider-line"></span>
          <span class="hero__divider-dot"></span>
        </div>

        <p class="hero__description">
          Descubre nuestra carta gastronómica con los platos más auténticos
          de la cocina cochabambina, preparados con ingredientes frescos cada día.
        </p>

        <a routerLink="/carta" class="hero__cta" id="cta-ver-carta">
          <svg class="hero__cta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          Ver Nuestra Carta
        </a>
      </div>

      <!-- Scroll indicator -->
      <div class="hero__scroll-indicator">
        <div class="hero__scroll-mouse">
          <div class="hero__scroll-wheel"></div>
        </div>
      </div>
    </section>

    <!-- Info Section inline -->
    <section class="info" id="info">
      <div class="info__container animate-in">
        <h2 class="info__title">Visítanos</h2>

        <div class="info__grid">
          <!-- Horarios -->
          <div class="info__card">
            <div class="info__card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <h3>Horarios</h3>
            <p class="info__detail">Lunes a Domingo</p>
            <p class="info__highlight">11:30 — 22:00</p>
          </div>

          <!-- Ubicación -->
          <div class="info__card">
            <div class="info__card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <h3>Ubicación</h3>
            <p class="info__detail">Av. Capitán Victor Ustariz</p>
            <p class="info__highlight">Km 3.5, Cochabamba</p>
            <a
              href="https://maps.google.com/?q=Av+Capitan+Victor+Ustariz+Km+3.5+Cochabamba+Bolivia"
              target="_blank"
              rel="noopener noreferrer"
              class="info__link"
              id="link-google-maps"
            >
              Abrir en Google Maps →
            </a>
          </div>

          <!-- Contacto -->
          <div class="info__card">
            <div class="info__card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </div>
            <h3>Contacto</h3>
            <p class="info__detail">WhatsApp / Llamadas</p>
            <p class="info__highlight">(+591) 71727374</p>
            <a
              href="https://wa.me/59171727374"
              target="_blank"
              rel="noopener noreferrer"
              class="info__link"
              id="link-whatsapp"
            >
              Escribir por WhatsApp →
            </a>
          </div>
        </div>

        <!-- Social -->
        <div class="info__social">
          <a
            href="https://facebook.com/PeñaTukuypaj"
            target="_blank"
            rel="noopener noreferrer"
            class="info__social-link"
            id="link-facebook"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
            </svg>
            <span>/PeñaTukuypaj</span>
          </a>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="footer">
      <p>© 2026 Peña Restaurant Tukuypaj — Cochabamba, Bolivia</p>
    </footer>
  `,
  styleUrl: './landing-hero.component.scss',
})
export class LandingHeroComponent {}
