import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Subscription } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { SocketService } from '../../core/services/socket.service';
import { UploadCloudinaryService } from '../../core/services/upload-cloudinary.service';
import { LucideAngularModule } from 'lucide-angular';

interface Variante {
  id: string;
  nombre: string;
  precio: number;
  disponible: boolean;
}

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
    variantes?: Variante[];
  }[];
}

@Component({
  selector: 'app-carta',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
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
                  <div 
                    class="plato-card glass-panel glass-panel-hover" 
                    [class.agotado]="!plato.disponible && (!plato.variantes || plato.variantes.length === 0)"
                    [class.editing-mode]="editingPlatoId() === plato.id"
                  >
                    <div class="plato-img-wrapper">
                      <!-- Central Circle Image / Warm Corporative Camera Placeholder -->
                      <div class="plato-img-circle" [class.has-image]="!!plato.imagenUrl">
                        @if (uploadingPlatoId() === plato.id) {
                          <div class="upload-spinner-overlay">
                            <div class="micro-spinner"></div>
                            <span class="upload-percent">{{ uploadProgress() }}%</span>
                          </div>
                        } @else if (plato.imagenUrl) {
                          <img 
                            [src]="plato.imagenUrl" 
                            [alt]="plato.nombre" 
                            class="plato-real-img" 
                            (error)="handleImageError(plato)"
                          />
                        } @else {
                          <div class="camera-placeholder" title="Sin fotografía asignada">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="camera-icon">
                              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                              <circle cx="12" cy="13" r="4"/>
                            </svg>
                            <span class="placeholder-text">Sin foto</span>
                          </div>
                        }
                      </div>
                      
                      @if (!plato.disponible && (!plato.variantes || plato.variantes.length === 0)) {
                        <div class="agotado-badge">Agotado</div>
                      }

                      <!-- Quick Action Buttons for Photo Upload / Paste Link -->
                      @if (isAdmin()) {
                        <div class="quick-img-actions">
                          <button 
                            type="button" 
                            class="quick-btn btn-file" 
                            (click)="triggerFileInput(plato.id, $event)" 
                            title="Subir foto desde tu dispositivo"
                          >
                            <lucide-icon name="upload" class="icon-sm"></lucide-icon> Cargar Foto Local
                          </button>
                          <button 
                            type="button" 
                            class="quick-btn btn-url" 
                            (click)="toggleUrlInput(plato.id, $event)" 
                            title="Pegar enlace HTTPS directo"
                          >
                            <lucide-icon name="link" class="icon-sm"></lucide-icon> Pegar Enlace
                          </button>
                          <input 
                            type="file" 
                            [id]="'file-input-' + plato.id" 
                            accept="image/*" 
                            style="display: none" 
                            (change)="onFileSelected($event, plato)"
                          />
                        </div>

                        <!-- Edit Button (Pencil Icon) -->
                        <button 
                          class="edit-icon-wrapper" 
                          (click)="activarEdicionRapida(plato, $event)" 
                          title="Editar Precios"
                          id="btn-edit-plato-{{ plato.id }}"
                        >
                          <lucide-icon name="pencil" class="icon-sm"></lucide-icon>
                        </button>
                      }
                    </div>

                    <!-- Popover for pasting URL -->
                    @if (activeUrlInputPlatoId() === plato.id) {
                      <div class="url-input-popover animate-fade-in" (click)="$event.stopPropagation()">
                        <div class="url-input-field-wrapper">
                          <lucide-icon name="link" class="url-icon icon-sm icon-muted"></lucide-icon>
                          <input 
                            type="text" 
                            [(ngModel)]="pastedUrl" 
                            placeholder="https://..." 
                            class="url-input-text" 
                            (keyup.enter)="guardarImagenUrlPasted(plato)"
                          />
                          <button class="btn-save-url" (click)="guardarImagenUrlPasted(plato)">Guardar</button>
                          <button class="btn-cancel-url" (click)="cancelarUrlInput()"><lucide-icon name="x" class="icon-sm"></lucide-icon></button>
                        </div>
                      </div>
                    }

                    <div class="plato-info">
                      <div class="plato-title-row">
                        <h3>{{ plato.nombre }}</h3>
                        @if (plato.variantes && plato.variantes.length > 0) {
                          <span class="price-tag range">Desde Bs. {{ getMinPrecio(plato) | number:'1.2-2' }}</span>
                        } @else {
                          <span class="price-tag">Bs. {{ plato.precioVenta | number:'1.2-2' }}</span>
                        }
                      </div>
                      <p class="desc">{{ plato.descripcion || 'Especialidad tradicional de la casa.' }}</p>
                      
                      @if (editingPlatoId() === plato.id) {
                        <!-- Inline Edit Form (Formulario de Edición en Línea) -->
                        <div class="inline-edit-form animate-fade-in" (click)="$event.stopPropagation()">
                          <h4>Editar Precios</h4>
                          
                          @if (plato.variantes && plato.variantes.length > 0) {
                            @for (v of editingVariantes(); track v.id) {
                              <div class="edit-row">
                                <span class="edit-label">{{ v.nombre }}</span>
                                <div class="edit-input-wrapper">
                                  <span class="currency">Bs.</span>
                                  <input 
                                    type="number" 
                                    [(ngModel)]="v.precio" 
                                    min="0" 
                                    step="0.5"
                                    class="edit-input"
                                  >
                                </div>
                              </div>
                            }
                          } @else {
                            <div class="edit-row">
                              <span class="edit-label">Precio Único</span>
                              <div class="edit-input-wrapper">
                                <span class="currency">Bs.</span>
                                <input 
                                  type="number" 
                                  [(ngModel)]="editingSinglePrecio" 
                                  min="0" 
                                  step="0.5"
                                  class="edit-input"
                                >
                              </div>
                            </div>
                          }

                          <div class="form-actions">
                            <button class="btn-action cancel" (click)="cancelarEdicion($event)">Cancelar</button>
                            <button class="btn-action save" (click)="guardarEdicion(plato, $event)" id="btn-save-edit-{{ plato.id }}">Guardar</button>
                          </div>
                        </div>
                      } @else {
                        <!-- Normal View -->
                        @if (plato.variantes && plato.variantes.length > 0) {
                          <!-- Sizes and Portions List -->
                          <div class="variants-list-admin">
                            <span class="variants-title">Tamaños / Porciones:</span>
                            @for (v of plato.variantes; track v.id) {
                              <div class="variant-item-row" [class.v-agotado]="!v.disponible">
                                <span class="v-name">{{ v.nombre }}</span>
                                <div class="v-meta">
                                  <span class="v-price">Bs. {{ v.precio | number:'1.2-2' }}</span>
                                  @if (isAdmin()) {
                                    <label class="switch switch-mini" title="Cambiar disponibilidad de la porción">
                                      <input 
                                        type="checkbox" 
                                        [checked]="v.disponible" 
                                        (change)="toggleDisponibilidadVariante(plato.id, v.id)"
                                        id="switch-variante-{{ v.id }}"
                                      >
                                      <span class="slider round"></span>
                                    </label>
                                  }
                                </div>
                              </div>
                            }
                          </div>
                        } @else {
                          <!-- Single Availability Switch -->
                          @if (isAdmin()) {
                            <div class="availability-toggle">
                              <span class="toggle-label" [class.label-disponible]="plato.disponible">
                                {{ plato.disponible ? 'Disponible' : 'Agotado' }}
                              </span>
                              <label class="switch">
                                <input 
                                  type="checkbox" 
                                  [checked]="plato.disponible" 
                                  (change)="togglePlatoDisponibilidad(plato)"
                                  id="switch-plato-{{ plato.id }}"
                                >
                                <span class="slider round"></span>
                              </label>
                            </div>
                          }
                        }
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
      grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
      gap: 20px;
    }

    .plato-card {
      overflow: hidden;
      display: flex;
      flex-direction: column;
      border-color: rgba(210, 170, 120, 0.05);
      background: var(--bg-card);
      transition: opacity 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease;

      &.agotado {
        opacity: 0.65;
      }

      &.editing-mode {
        border-color: var(--primary);
        box-shadow: 0 8px 30px rgba(200, 149, 108, 0.15);
        transform: scale(1.01);
      }
    }

    .plato-img-wrapper {
      height: 140px;
      background: linear-gradient(180deg, rgba(35, 30, 24, 0.6) 0%, rgba(20, 16, 12, 0.85) 100%);
      border-bottom: 1px solid var(--border-glass);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;

      &:hover {
        .quick-img-actions {
          opacity: 1;
          transform: translateY(0);
        }
      }
    }

    /* ── Central Circle Image Container ── */
    .plato-img-circle {
      width: 90px;
      height: 90px;
      border-radius: 50%;
      border: 2px solid var(--border-warm);
      background: var(--bg-surface);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4), 0 0 12px rgba(200, 149, 108, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
      transition: transform 0.3s ease, border-color 0.3s ease;

      &.has-image {
        border-color: rgba(200, 149, 108, 0.4);
      }
    }

    .plato-real-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
      transition: transform 0.4s ease;

      &:hover {
        transform: scale(1.08);
      }
    }

    /* ── Warm Corporative Fallback (Camera Placeholder) ── */
    .camera-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      color: var(--primary);
      width: 100%;
      height: 100%;
      background: radial-gradient(circle, rgba(200, 149, 108, 0.18) 0%, rgba(35, 28, 20, 0.7) 100%);

      .camera-icon {
        width: 24px;
        height: 24px;
        opacity: 0.85;
      }

      .placeholder-text {
        font-family: var(--font-title);
        font-size: 0.62rem;
        font-weight: 700;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        color: var(--text-muted);
      }
    }

    /* ── Micro Spinner Uploading Overlay ── */
    .upload-spinner-overlay {
      position: absolute;
      inset: 0;
      background: rgba(20, 16, 12, 0.85);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      z-index: 10;

      .upload-percent {
        font-family: var(--font-title);
        font-size: 0.65rem;
        font-weight: 800;
        color: var(--accent);
      }
    }

    .micro-spinner {
      width: 22px;
      height: 22px;
      border: 2px solid rgba(200, 149, 108, 0.2);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* ── Quick Action Overlay Buttons ── */
    .quick-img-actions {
      position: absolute;
      bottom: 8px;
      left: 8px;
      right: 8px;
      display: flex;
      justify-content: center;
      gap: 6px;
      z-index: 8;
      opacity: 0;
      transform: translateY(4px);
      transition: opacity 0.25s ease, transform 0.25s ease;
    }

    .quick-btn {
      background: rgba(26, 20, 16, 0.9);
      border: 1px solid var(--border-glass-hover);
      color: var(--text-warm);
      font-family: var(--font-title);
      font-size: 0.68rem;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 12px;
      cursor: pointer;
      backdrop-filter: blur(4px);
      transition: var(--transition-fast);

      &:hover {
        background: var(--gradient-brand);
        color: #1a1410;
        border-color: transparent;
        transform: translateY(-1px);
        box-shadow: 0 4px 10px rgba(200, 149, 108, 0.3);
      }
    }

    /* ── Popover Input Text (Pegar Enlace) ── */
    .url-input-popover {
      padding: 8px 12px;
      background: rgba(35, 28, 20, 0.95);
      border-bottom: 1px solid var(--border-warm);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .url-input-field-wrapper {
      display: flex;
      align-items: center;
      gap: 6px;

      .url-icon {
        font-size: 0.8rem;
      }

      .url-input-text {
        flex: 1;
        background: rgba(18, 14, 11, 0.8);
        border: 1px solid var(--border-glass);
        border-radius: var(--radius-xs);
        padding: 4px 8px;
        color: var(--text-warm);
        font-size: 0.75rem;
        outline: none;

        &:focus {
          border-color: var(--primary);
        }
      }

      .btn-save-url {
        background: var(--gradient-brand);
        color: #1a1410;
        border: none;
        border-radius: var(--radius-xs);
        padding: 4px 8px;
        font-family: var(--font-title);
        font-size: 0.7rem;
        font-weight: 700;
        cursor: pointer;

        &:hover {
          opacity: 0.9;
        }
      }

      .btn-cancel-url {
        background: transparent;
        border: none;
        color: var(--text-muted);
        font-size: 0.8rem;
        cursor: pointer;
        padding: 2px 4px;

        &:hover {
          color: var(--text-warm);
        }
      }
    }

    .agotado-badge {
      position: absolute;
      top: 10px;
      left: 10px;
      background: rgba(201, 74, 74, 0.9);
      color: #fff;
      font-size: 0.65rem;
      font-weight: 800;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: var(--radius-xs);
      letter-spacing: 0.5px;
      z-index: 5;
    }

    .edit-icon-wrapper {
      position: absolute;
      top: 10px;
      right: 10px;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(26, 20, 16, 0.6);
      border: 1px solid var(--border-glass);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: var(--text-muted);
      transition: var(--transition-fast);
      z-index: 10;
      padding: 0;

      svg {
        width: 15px;
        height: 15px;
      }

      &:hover {
        background: var(--primary);
        border-color: transparent;
        color: #1a1410;
        transform: scale(1.08);
      }
    }

    .plato-info {
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
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

        &.range {
          font-size: 0.8rem;
          color: var(--primary);
          background: rgba(200, 149, 108, 0.08);
          padding: 2px 8px;
          border-radius: var(--radius-xs);
          border: 1px solid rgba(200, 149, 108, 0.15);
        }
      }
    }

    .desc {
      font-size: 0.8rem;
      color: var(--text-muted);
      line-height: 1.45;
      flex: 1;
    }

    /* ── Compact Variants List ── */
    .variants-list-admin {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-top: 12px;
      border-top: 1px solid var(--border-glass);

      .variants-title {
        font-family: var(--font-title);
        font-size: 0.72rem;
        font-weight: 700;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
    }

    .variant-item-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 8px;
      background: rgba(255, 255, 255, 0.01);
      border: 1px solid rgba(200, 149, 108, 0.04);
      border-radius: var(--radius-xs);
      transition: background 0.3s;

      &:hover {
        background: rgba(200, 149, 108, 0.03);
      }

      &.v-agotado {
        opacity: 0.55;
      }

      .v-name {
        font-family: var(--font-body);
        font-size: 0.78rem;
        color: var(--text-warm);
        font-weight: 550;
      }

      .v-meta {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .v-price {
        font-family: var(--font-title);
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--accent);
      }
    }

    /* ── Availability Toggle (Single Dish) ── */
    .availability-toggle {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 4px;
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

    /* ── Switches (Toggle Buttons) ── */
    .switch {
      position: relative;
      display: inline-block;
      width: 36px;
      height: 20px;
      flex-shrink: 0;

      input {
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

        &:before {
          position: absolute;
          content: "";
          height: 12px;
          width: 12px;
          left: 3px;
          bottom: 3px;
          background-color: var(--text-muted);
          transition: .4s;
        }

        &.round {
          border-radius: 20px;
          &:before {
            border-radius: 50%;
          }
        }
      }

      input:checked + .slider {
        background-color: rgba(90, 158, 111, 0.2);
        border-color: var(--success);
        
        &:before {
          transform: translateX(16px);
          background-color: var(--success);
        }
      }
    }

    .switch-mini {
      width: 30px;
      height: 16px;

      .slider {
        &:before {
          height: 10px;
          width: 10px;
          left: 2px;
          bottom: 2px;
        }
      }

      input:checked + .slider {
        &:before {
          transform: translateX(14px);
        }
      }
    }

    /* ── Inline Edit Form ── */
    .inline-edit-form {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px;
      background: rgba(200, 149, 108, 0.05);
      border: 1px solid rgba(200, 149, 108, 0.15);
      border-radius: var(--radius-sm);
      margin-top: 8px;

      h4 {
        font-family: var(--font-title);
        font-size: 0.76rem;
        font-weight: 700;
        color: var(--primary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 4px;
      }
    }

    .edit-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;

      .edit-label {
        font-size: 0.78rem;
        color: var(--text-warm);
        font-weight: 550;
      }
    }

    .edit-input-wrapper {
      display: flex;
      align-items: center;
      background: rgba(26, 20, 16, 0.8);
      border: 1.5px solid var(--border-glass);
      border-radius: var(--radius-xs);
      padding: 2px 8px;
      width: 90px;
      transition: border-color 0.2s;

      &:focus-within {
        border-color: var(--primary);
      }

      .currency {
        font-size: 0.75rem;
        color: var(--text-muted);
        margin-right: 4px;
        font-weight: 600;
      }

      .edit-input {
        width: 100%;
        background: transparent;
        border: none;
        outline: none;
        color: var(--accent);
        font-family: var(--font-title);
        font-size: 0.85rem;
        font-weight: 700;
        text-align: right;
        padding: 2px 0;
      }
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px dashed rgba(200, 149, 108, 0.15);
    }

    .btn-action {
      padding: 6px 14px;
      border-radius: var(--radius-xs);
      font-family: var(--font-title);
      font-size: 0.72rem;
      font-weight: 700;
      cursor: pointer;
      transition: var(--transition-fast);
      border: 1px solid transparent;

      &.cancel {
        background: transparent;
        border-color: var(--border-glass);
        color: var(--text-muted);

        &:hover {
          background: rgba(255, 255, 255, 0.02);
          color: var(--text-warm);
        }
      }

      &.save {
        background: var(--gradient-brand);
        color: #1a1410;
        box-shadow: 0 2px 8px rgba(200, 149, 108, 0.2);

        &:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(200, 149, 108, 0.3);
        }
      }
    }

    .empty-state {
      padding: 40px;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    /* ── Micro Animations ── */
    .animate-fade-in {
      animation: fadeIn 0.25s ease-out forwards;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `],
})
export class CartaComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private socketService = inject(SocketService);
  private uploadService = inject(UploadCloudinaryService);
  private readonly baseUrl = 'http://localhost:3000/api';

  categorias = signal<Categoria[]>([]);
  selectedCategoryId = signal<number | null>(null);

  // Inline Price Editing States
  editingPlatoId = signal<string | null>(null);
  editingVariantes = signal<Variante[]>([]);
  editingSinglePrecio = 0;

  // Cloudinary Upload & Image Editing States
  uploadingPlatoId = signal<string | null>(null);
  uploadProgress = computed(() => this.uploadService.progress());
  activeUrlInputPlatoId = signal<string | null>(null);
  pastedUrl = '';

  isAdmin = computed(() => this.authService.currentUserSignal()?.rol === 'ADMIN');
  private wsSubscription?: Subscription;

  ngOnInit() {
    this.cargarCarta();
    
    // Subscribe to real-time menu events
    this.wsSubscription = this.socketService
      .onEvent<any>('menu:actualizado')
      .subscribe(() => {
        this.cargarCarta();
      });
  }

  ngOnDestroy() {
    this.wsSubscription?.unsubscribe();
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

  getMinPrecio(plato: any): number {
    if (!plato.variantes || plato.variantes.length === 0) return Number(plato.precioVenta);
    const disponibles = plato.variantes.filter((v: any) => v.disponible);
    if (disponibles.length === 0) {
      const precios = plato.variantes.map((v: any) => Number(v.precio));
      return Math.min(...precios);
    }
    const precios = disponibles.map((v: any) => Number(v.precio));
    return Math.min(...precios);
  }

  togglePlatoDisponibilidad(plato: any) {
    this.http.patch<any>(`${this.baseUrl}/carta/platos/${plato.id}/toggle-disponible`, {}).subscribe({
      next: () => {
        plato.disponible = !plato.disponible;
      },
      error: (err) => console.error('Error al cambiar disponibilidad del plato', err),
    });
  }

  toggleDisponibilidadVariante(platoId: string, varianteId: string) {
    this.http.patch<any>(`${this.baseUrl}/carta/variantes/${varianteId}/toggle`, {}).subscribe({
      next: () => {
        // State will reload automatically via WebSocket listener
      },
      error: (err) => console.error('Error al cambiar disponibilidad de variante', err),
    });
  }

  activarEdicionRapida(plato: any, event: Event) {
    event.stopPropagation();
    this.editingPlatoId.set(plato.id);
    if (plato.variantes && plato.variantes.length > 0) {
      this.editingVariantes.set(
        plato.variantes.map((v: any) => ({ ...v, precio: Number(v.precio) }))
      );
    } else {
      this.editingSinglePrecio = Number(plato.precioVenta);
    }
  }

  cancelarEdicion(event: Event) {
    event.stopPropagation();
    this.editingPlatoId.set(null);
    this.editingVariantes.set([]);
  }

  guardarEdicion(plato: any, event: Event) {
    event.stopPropagation();
    const platoId = plato.id;

    if (plato.variantes && plato.variantes.length > 0) {
      const updates = this.editingVariantes().map((ev) =>
        this.http.put<any>(`${this.baseUrl}/carta/variantes/${ev.id}/precio`, {
          precio: Number(ev.precio),
        })
      );

      forkJoin(updates).subscribe({
        next: () => {
          this.editingPlatoId.set(null);
          this.editingVariantes.set([]);
          this.cargarCarta();
        },
        error: (err) => console.error('Error al actualizar precios de variantes', err),
      });
    } else {
      this.http
        .patch<any>(`${this.baseUrl}/carta/platos/${platoId}`, {
          precioVenta: Number(this.editingSinglePrecio),
        })
        .subscribe({
          next: () => {
            this.editingPlatoId.set(null);
            this.cargarCarta();
          },
          error: (err) => console.error('Error al actualizar precio único', err),
        });
    }
  }

  /* ── Métodos de subida y gestión de imágenes ── */

  triggerFileInput(platoId: string, event: Event) {
    event.stopPropagation();
    const fileInput = document.getElementById('file-input-' + platoId) as HTMLInputElement;
    fileInput?.click();
  }

  onFileSelected(event: Event, plato: any) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    this.uploadingPlatoId.set(plato.id);
    this.uploadService.uploadImage(file).subscribe({
      next: (secureUrl) => {
        this.actualizarImagenPlato(plato, secureUrl);
      },
      error: (err) => {
        console.error('Error al subir imagen a Cloudinary:', err);
        this.uploadingPlatoId.set(null);
      },
    });
  }

  toggleUrlInput(platoId: string, event: Event) {
    event.stopPropagation();
    if (this.activeUrlInputPlatoId() === platoId) {
      this.activeUrlInputPlatoId.set(null);
      this.pastedUrl = '';
    } else {
      this.activeUrlInputPlatoId.set(platoId);
      const currentPlato = this.categorias()
        .flatMap((c) => c.platos)
        .find((p) => p.id === platoId);
      this.pastedUrl = currentPlato?.imagenUrl || '';
    }
  }

  guardarImagenUrlPasted(plato: any) {
    if (!this.pastedUrl.trim()) return;
    this.actualizarImagenPlato(plato, this.pastedUrl.trim());
    this.activeUrlInputPlatoId.set(null);
    this.pastedUrl = '';
  }

  cancelarUrlInput() {
    this.activeUrlInputPlatoId.set(null);
    this.pastedUrl = '';
  }

  actualizarImagenPlato(plato: any, imagenUrl: string) {
    this.http.patch<any>(`${this.baseUrl}/carta/platos/${plato.id}/imagen`, { imagenUrl }).subscribe({
      next: () => {
        plato.imagenUrl = imagenUrl;
        this.uploadingPlatoId.set(null);
      },
      error: (err) => {
        console.error('Error al actualizar URL de imagen:', err);
        this.uploadingPlatoId.set(null);
      },
    });
  }

  handleImageError(plato: any) {
    plato.imagenUrl = undefined;
  }
}
