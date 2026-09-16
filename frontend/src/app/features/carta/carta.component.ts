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

export interface PlatoAdmin {
  id: string;
  nombre: string;
  precioVenta: number;
  descripcion?: string;
  imagenUrl?: string;
  disponible: boolean;
  categoriaId: number;
  categoriaNombre?: string;
  stockActual?: number | null;
  controlarStock?: boolean;
  stockMinimo?: number;
  variantes?: Variante[];
}

interface Categoria {
  id: number;
  nombre: string;
  descripcion?: string;
  orden?: number;
  platos: PlatoAdmin[];
}

@Component({
  selector: 'app-carta',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="carta-container animate-in">

      <!-- Barra de Navegación de Modos de la Carta -->
      <div class="main-view-nav-tabs">
        <button 
          type="button" 
          class="tab-nav-btn" 
          [class.active]="currentView() === 'list'"
          (click)="currentView.set('list')"
        >
          <lucide-icon name="book-open" class="icon-sm"></lucide-icon>
          <span>Catálogo & Precios</span>
          <span class="tab-count-pill">{{ totalPlatos() }} platos</span>
        </button>

        <button 
          type="button" 
          class="tab-nav-btn" 
          [class.active]="currentView() === 'stock'"
          (click)="currentView.set('stock')"
        >
          <lucide-icon name="utensils" class="icon-sm"></lucide-icon>
          <span>Platos del Día & Disponibilidad</span>
          @if (totalAgotados() > 0) {
            <span class="tab-alert-pill pulse-slow">{{ totalAgotados() }} terminados</span>
          } @else if (totalStockBajo() > 0) {
            <span class="tab-warning-pill">{{ totalStockBajo() }} por agotarse</span>
          } @else {
            <span class="tab-ok-pill">{{ totalPorcionesDisponibles() }} porciones listas</span>
          }
        </button>
      </div>
      
      <!-- VIEW MODE 1: MAIN MENU DASHBOARD GRID -->
      @if (currentView() === 'list') {
        <!-- Top Breadcrumb & Header Bar -->
        <div class="header-admin-bar">
          <div class="header-left">
            <div class="breadcrumb">
              <span class="crumb-brand">Tukuypaj</span>
              <span class="crumb-sep">/</span>
              <span class="crumb-current">Gestión de Carta</span>
            </div>
            <h1 class="font-playfair">Nuestra Carta Gastronómica</h1>
            <p class="subtitle">
              Gestione las categorías, precios y disponibilidad de los platos tradicionales de Cochabamba. Mantenga su menú actualizado para una experiencia premium.
            </p>
          </div>

          @if (isAdmin()) {
            <div class="header-actions">
              <button type="button" class="btn-action-outline-gold" (click)="abrirModalCategoria()">
                <lucide-icon name="plus" class="icon-sm"></lucide-icon>
                Añadir Categoría
              </button>
              <button type="button" class="btn-action-filled-gold" (click)="abrirCrearPlato()">
                <lucide-icon name="utensils" class="icon-sm"></lucide-icon>
                Nuevo Plato
              </button>
            </div>
          }
        </div>

        <!-- Categories Filter Tabs & Search Bar -->
        <div class="filter-search-row">
          <div class="categories-tabs scrollbar-custom">
            <button 
              type="button"
              class="tab-btn" 
              [class.active]="selectedCategoryId() === null"
              (click)="selectedCategoryId.set(null)"
            >
              Todo el Menú
            </button>
            @for (cat of categorias(); track cat.id) {
              <button 
                type="button"
                class="tab-btn" 
                [class.active]="selectedCategoryId() === cat.id"
                (click)="selectedCategoryId.set(cat.id)"
              >
                {{ cat.nombre }}
              </button>
            }
          </div>

          <div class="search-box-wrapper">
            <lucide-icon name="search" class="search-icon"></lucide-icon>
            <input 
              type="text" 
              [ngModel]="searchQuery()" 
              (ngModelChange)="searchQuery.set($event)"
              placeholder="Buscar plato..." 
              class="search-input"
            />
          </div>
        </div>

        <!-- Category Block Sections -->
        <div class="carta-sections">
          @for (cat of filteredCategorias(); track cat.id) {
            <div class="category-block">
              <div class="category-header">
                <div class="category-title-group">
                  <h2 class="font-playfair">{{ cat.nombre }}</h2>
                  <p class="category-desc">{{ cat.descripcion || 'Lo mejor de la gastronomía valluna de nuestra región.' }}</p>
                </div>
                <div class="items-count-badge">
                  {{ countPlatosActivos(cat) }} ÍTEMS ACTIVOS
                </div>
              </div>

              <div class="platos-grid-admin">
                @for (plato of cat.platos; track plato.id) {
                  <div 
                    class="plato-card-admin glass-panel"
                    [class.agotado]="!isPlatoDisponible(plato)"
                    [class.editing-mode]="editingPlatoId() === plato.id"
                  >
                    <!-- Card Image Header -->
                    <div class="card-img-header">
                      @if (uploadingPlatoId() === plato.id) {
                        <div class="upload-spinner-overlay">
                          <div class="micro-spinner"></div>
                          <span class="upload-percent">{{ uploadProgress() }}%</span>
                        </div>
                      } @else {
                        <img 
                          [src]="getPlatoImageUrl(plato)" 
                          [alt]="plato.nombre" 
                          class="plato-cover-img"
                          (error)="handleImageError(plato)"
                        />
                      }

                      <!-- Agotado Top Badge -->
                      @if (!isPlatoDisponible(plato)) {
                        <div class="agotado-top-badge">Agotado</div>
                      }

                      <!-- Edit Pencil Floating Button -->
                      @if (isAdmin()) {
                        <button 
                          type="button"
                          class="btn-pencil-edit" 
                          (click)="activarEdicionRapida(plato, $event)" 
                          title="Editar Precios"
                          id="btn-edit-plato-{{ plato.id }}"
                        >
                          <lucide-icon name="pencil" class="icon-xs"></lucide-icon>
                        </button>

                      }
                    </div>



                    <!-- Card Body -->
                    <div class="card-body-admin">
                      <!-- Title & Price Row -->
                      <div class="dish-title-row">
                        <h3 class="font-playfair">{{ plato.nombre }}</h3>
                        <div class="dish-price font-playfair">
                          @if (plato.variantes && plato.variantes.length > 0) {
                            Bs. {{ getMinPrecio(plato) | number:'1.0-0' }}+
                          } @else {
                            Bs. {{ plato.precioVenta | number:'1.2-2' }}
                          }
                        </div>
                      </div>

                      <!-- Description -->
                      <p class="dish-desc">{{ plato.descripcion || 'Especialidad tradicional de la casa.' }}</p>

                      <!-- Inline Edit Form mode -->
                      @if (editingPlatoId() === plato.id) {
                        <div class="inline-edit-form animate-fade-in" (click)="$event.stopPropagation()">
                          <div class="form-title">Editar Precios</div>
                          @if (plato.variantes && plato.variantes.length > 0) {
                            @for (v of editingVariantes(); track v.id) {
                              <div class="edit-row">
                                <span class="edit-lbl">{{ v.nombre }}</span>
                                <div class="edit-input-box">
                                  <span class="curr">Bs.</span>
                                  <input type="number" [(ngModel)]="v.precio" min="0" step="1" />
                                </div>
                              </div>
                            }
                          } @else {
                            <div class="edit-row">
                              <span class="edit-lbl">Precio Único</span>
                              <div class="edit-input-box">
                                <span class="curr">Bs.</span>
                                <input type="number" [(ngModel)]="editingSinglePrecio" min="0" step="1" />
                              </div>
                            </div>
                          }

                          <div class="form-actions">
                            <button type="button" class="btn-cancel" (click)="cancelarEdicion($event)">Cancelar</button>
                            <button type="button" class="btn-save" (click)="guardarEdicion(plato, $event)">Guardar</button>
                          </div>
                        </div>
                      } @else {
                        <!-- PORCIONES & PRECIOS Box -->
                        <div class="porciones-box">
                          <div class="porciones-header">PORCIONES & PRECIOS</div>
                          
                          @if (plato.variantes && plato.variantes.length > 0) {
                            <div class="variants-list">
                              @for (v of plato.variantes; track v.id) {
                                <div class="variant-item" [class.v-disabled]="!v.disponible">
                                  <span class="v-name">{{ v.nombre }}</span>
                                  <div class="v-meta">
                                    <span class="v-price font-playfair">Bs. {{ v.precio | number:'1.0-0' }}</span>
                                    @if (isAdmin()) {
                                      <label class="switch switch-mini" title="Cambiar disponibilidad de la porción">
                                        <input 
                                          type="checkbox" 
                                          [checked]="v.disponible" 
                                          (change)="toggleDisponibilidadVariante(plato, v.id)"
                                        />
                                        <span class="slider round"></span>
                                      </label>
                                    }
                                  </div>
                                </div>
                              }
                            </div>
                          } @else {
                            <div class="single-plato-badge">
                              <span>PLATO ÚNICO</span>
                            </div>
                          }
                        </div>
                      }
                    </div>

                    <!-- Card Footer -->
                    <div class="card-footer-admin">
                      <div class="status-indicator" [class.disponible]="isPlatoDisponible(plato)">
                        <span class="status-dot"></span>
                        {{ isPlatoDisponible(plato) ? 'DISPONIBLE' : 'AGOTADO' }}
                      </div>

                      @if (isAdmin()) {
                        <div class="footer-actions">
                          <label class="switch switch-master" title="Disponibilidad principal del plato">
                            <input 
                              type="checkbox" 
                              [checked]="isPlatoDisponible(plato)" 
                              (change)="togglePlatoDisponibilidad(plato)"
                            />
                            <span class="slider round"></span>
                          </label>
                        </div>
                      }
                    </div>

                  </div>
                }

                <!-- Dashed Add Dish Card -->
                @if (isAdmin()) {
                  <div class="add-plato-dashed-card" (click)="abrirCrearPlato(cat.id)">
                    <div class="plus-circle-icon">
                      <lucide-icon name="plus" class="icon-md"></lucide-icon>
                    </div>
                    <span class="add-text">Nuevo Plato {{ cat.nombre }}</span>
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <!-- Footer Summary Bar -->
        <div class="footer-summary-bar glass-panel">
          <div class="summary-left">
            <span>TOTAL PLATOS: <strong>{{ totalPlatos() }}</strong></span>
            <span class="sep">|</span>
            <span>BEBIDAS: <strong>{{ totalBebidas() }}</strong></span>
            <span class="sep">|</span>
            <span class="agotados-stat">AGOTADOS: <strong>{{ totalAgotados() }}</strong></span>
          </div>
          <div class="summary-right">
            <lucide-icon name="clock" class="icon-xs"></lucide-icon>
            <span>ÚLTIMA ACTUALIZACIÓN: {{ ultimaActualizacion() }}</span>
          </div>
        </div>
      }

      <!-- VIEW MODE 2: DEDICATED "CREAR NUEVA DELICIA" PANEL -->
      @if (currentView() === 'create') {
        <div class="create-dish-panel animate-in">
          <!-- Header Bar -->
          <div class="create-header-bar">
            <div class="breadcrumb">
              <span class="crumb-brand" (click)="cerrarCrearPlato()" style="cursor: pointer;">Tukuypaj</span>
              <span class="crumb-sep">></span>
              <span class="crumb-current">Añadir Nuevo Plato</span>
            </div>
            <div class="header-status-pill">
              <span class="status-dot-active"></span> SISTEMA OPERATIVO
            </div>
          </div>

          <div class="create-title-section">
            <h1 class="font-playfair brand-title-gold">Crear nueva delicia</h1>
            <p class="subtitle-text">
              Complete la información detallada para registrar un nuevo plato en el sistema. Asegúrese de que las imágenes y descripciones reflejen la calidad de nuestra cocina.
            </p>
          </div>

          <!-- 2-Column Main Form Grid -->
          <div class="create-grid-layout">
            
            <!-- Left Column: Form Cards -->
            <div class="form-col-main">
              
              <!-- Card 1: Información General -->
              <div class="form-panel-card glass-panel">
                <div class="panel-card-header">
                  <lucide-icon name="utensils" class="panel-icon"></lucide-icon>
                  <h2 class="font-playfair">Información General</h2>
                </div>

                <div class="panel-card-body">
                  <div class="form-group-field">
                    <label>NOMBRE DEL PLATO</label>
                    <input 
                      type="text" 
                      [(ngModel)]="formPlato.nombre" 
                      placeholder="Ej: Silpancho Cochabambino Especial" 
                      class="custom-input"
                    />
                  </div>

                  <div class="form-row-2col">
                    <div class="form-group-field">
                      <label>CATEGORÍA</label>
                      <select [(ngModel)]="formPlato.categoriaId" class="custom-select">
                        @for (cat of categorias(); track cat.id) {
                          <option [value]="cat.id">{{ cat.nombre }}</option>
                        }
                      </select>
                    </div>

                    <div class="form-group-field">
                      <label>ESTADO INICIAL</label>
                      <div class="toggle-estado-box">
                        <span>Disponible inmediatamente</span>
                        <label class="switch switch-master">
                          <input 
                            type="checkbox" 
                            [(ngModel)]="formPlato.disponible"
                          />
                          <span class="slider round"></span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div class="form-group-field">
                    <label>DESCRIPCIÓN BREVE</label>
                    <textarea 
                      [(ngModel)]="formPlato.descripcion" 
                      rows="4" 
                      placeholder="Describa los ingredientes principales y el origen del plato..." 
                      class="custom-textarea"
                    ></textarea>
                  </div>
                </div>
              </div>

              <!-- Card 2: Variantes y Precios -->
              <div class="form-panel-card glass-panel">
                <div class="panel-card-header flex-between">
                  <div class="header-left-title">
                    <lucide-icon name="tag" class="panel-icon"></lucide-icon>
                    <h2 class="font-playfair">Variantes y Precios</h2>
                  </div>
                  <button type="button" class="btn-add-variante-text" (click)="agregarVarianteForm()">
                    + AÑADIR VARIANTE
                  </button>
                </div>

                <div class="panel-card-body">
                  @if (formPlato.variantes.length > 0) {
                    <div class="variantes-form-list">
                      @for (v of formPlato.variantes; track $index) {
                        <div class="variant-form-card" [class.v-off]="!v.disponible">
                          <div class="v-left-info">
                            <input 
                              type="text" 
                              [(ngModel)]="v.nombre" 
                              placeholder="Ej. Personal" 
                              class="v-name-input"
                            />
                            <span class="v-sublabel">NOMBRE DE VARIANTE</span>
                          </div>

                          <div class="v-right-price-actions">
                            <div class="v-price-box">
                              <span class="curr-lbl font-playfair">Bs.</span>
                              <input 
                                type="number" 
                                [(ngModel)]="v.precio" 
                                min="0" 
                                step="1"
                                placeholder="45.00" 
                                class="v-price-input"
                              />
                            </div>

                            <button 
                              type="button" 
                              class="icon-action-btn" 
                              [class.active-eye]="v.disponible"
                              (click)="v.disponible = !v.disponible" 
                              title="Alternar disponibilidad"
                            >
                              <lucide-icon name="eye" class="icon-xs"></lucide-icon>
                            </button>

                            <button 
                              type="button" 
                              class="icon-action-btn delete" 
                              (click)="eliminarVarianteForm($index)" 
                              title="Eliminar variante"
                            >
                              <lucide-icon name="trash-2" class="icon-xs"></lucide-icon>
                            </button>
                          </div>
                        </div>
                      }
                    </div>
                  } @else {
                    <div class="single-price-fallback">
                      <p class="fallback-note">No ha añadido variantes. Ingrese el precio base único del plato:</p>
                      <div class="single-price-input-wrapper">
                        <span class="curr font-playfair">Bs.</span>
                        <input type="number" [(ngModel)]="formPlato.precioVenta" min="0" placeholder="45.00" class="custom-input price-input" />
                      </div>
                    </div>
                  }
                </div>
              </div>

            </div>

            <!-- Right Column: Media Upload & Tags -->
            <div class="form-col-sidebar">
              
              <!-- Widget 1: Imagen del Plato -->
              <div class="form-panel-card glass-panel">
                <div class="sidebar-widget-header">IMAGEN DEL PLATO</div>
                <div class="sidebar-widget-body">
                  
                  <div class="upload-dropzone-box" (click)="triggerFormFileInput()">
                    @if (isUploadingFormImage()) {
                      <div class="dropzone-spinner">
                        <div class="micro-spinner"></div>
                        <span>Subiendo {{ uploadProgress() }}%</span>
                      </div>
                    } @else if (formPlato.imagenUrl) {
                      <div class="image-preview-wrapper">
                        <img [src]="formPlato.imagenUrl" alt="Vista previa del plato" class="form-preview-img" />
                        <div class="preview-overlay-btn">Cambiar Imagen</div>
                      </div>
                    } @else {
                      <div class="dropzone-placeholder">
                        <div class="upload-icon-circle">
                          <lucide-icon name="upload" class="icon-md"></lucide-icon>
                        </div>
                        <p class="dropzone-text">
                          Arrastra o haz clic para subir una imagen de alta resolución
                        </p>
                        <span class="dropzone-subtext">PNG O JPG • MAX 5MB</span>
                      </div>
                    }

                    <input 
                      type="file" 
                      id="form-file-input" 
                      accept="image/*" 
                      style="display: none" 
                      (change)="uploadFormImage($event)"
                    />
                  </div>

                  <div class="tip-recommendation-box">
                    <span class="bulb-icon">💡</span>
                    <p>Recomendamos usar fondos oscuros o texturizados para resaltar los colores del plato.</p>
                  </div>

                </div>
              </div>

              <!-- Widget 2: Etiquetas de Menú -->
              <div class="form-panel-card glass-panel">
                <div class="sidebar-widget-header">ETIQUETAS DE MENÚ</div>
                <div class="sidebar-widget-body">
                  <div class="tags-pills-row">
                    @for (tag of availableTags; track tag) {
                      <button 
                        type="button" 
                        class="tag-pill-btn" 
                        [class.selected]="hasTag(tag)"
                        (click)="toggleTag(tag)"
                      >
                        {{ tag }}
                      </button>
                    }
                  </div>
                </div>
              </div>

            </div>

          </div>

          <!-- Bottom Fixed Action Bar -->
          <div class="create-bottom-bar">
            <button type="button" class="btn-cancelar-panel" (click)="cerrarCrearPlato()">
              Cancelar
            </button>
            <button type="button" class="btn-guardar-plato" (click)="guardarNuevoPlatoCompleto()">
              <lucide-icon name="check" class="icon-sm"></lucide-icon>
              Guardar Plato
            </button>
          </div>

        </div>
      }

      <!-- Modal: Añadir Categoría -->
      @if (showCategoriaModal()) {
        <div class="modal-backdrop animate-fade-in" (click)="cerrarModales()">
          <div class="modal-card glass-panel" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3 class="font-playfair">Añadir Nueva Categoría</h3>
              <button type="button" class="btn-close" (click)="cerrarModales()">&times;</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label>Nombre de la Categoría</label>
                <input type="text" [(ngModel)]="nuevaCategoria.nombre" placeholder="Ej. Parrillas & Carnes" class="modal-input" />
              </div>
              <div class="form-group">
                <label>Descripción Subtítulo</label>
                <input type="text" [(ngModel)]="nuevaCategoria.descripcion" placeholder="Ej. Cortes seleccionados a la brasa" class="modal-input" />
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-modal-cancel" (click)="cerrarModales()">Cancelar</button>
              <button type="button" class="btn-modal-save" (click)="guardarCategoria()">Guardar Categoría</button>
            </div>
          </div>
        </div>
      }

      <!-- VIEW MODE 3: CONTROL DE STOCK & BEBIDAS -->
      @if (currentView() === 'stock') {
        <div class="stock-admin-view animate-in">
          
          <!-- Stock Header Bar -->
          <div class="header-admin-bar">
            <div class="header-left">
              <div class="breadcrumb">
                <span class="crumb-brand">Tukuypaj</span>
                <span class="crumb-sep">/</span>
                <span class="crumb-current">Platos del Día & Disponibilidad</span>
              </div>
              <h1 class="font-playfair">¿Qué platos tenemos para hoy?</h1>
              <p class="subtitle">
                Revise cuántas porciones quedan de cada plato para hoy. Cuando un plato se termina, el sistema y Don Beto IA avisan al instante a los clientes y garzones para que no se pida.
              </p>
            </div>

            <div class="header-actions">
              <button type="button" class="btn-action-outline-gold" (click)="cargarCarta()" title="Actualizar lista">
                <lucide-icon name="refresh-cw" class="icon-sm"></lucide-icon>
                Refrescar
              </button>
              @if (canManageStock()) {
                <button type="button" class="btn-action-filled-gold" (click)="abrirModalApertura()">
                  <lucide-icon name="sparkles" class="icon-sm"></lucide-icon>
                  Preparación del Día
                </button>
              }
            </div>
          </div>

          <!-- Role Access Notice -->
          @if (canManageStock()) {
            <div class="role-badge-panel success glass-panel">
              <div class="role-badge-left">
                <lucide-icon name="shield-check" class="icon-md text-emerald"></lucide-icon>
                <div>
                  <div class="role-badge-title">PERMISO PARA MODIFICAR CANTIDADES ACTIVO ({{ currentUser()?.rol }})</div>
                  <div class="role-badge-sub">
                    Operador: <strong>{{ currentUser()?.nombre || 'Administración' }}</strong>. Puede aumentar porciones, descontar o marcar platos terminados.
                  </div>
                </div>
              </div>
              <span class="live-sync-indicator">
                <span class="live-pulse"></span>
                Actualizando a todos en vivo
              </span>
            </div>
          } @else {
            <div class="role-badge-panel warning glass-panel">
              <div class="role-badge-left">
                <lucide-icon name="lock" class="icon-md text-amber"></lucide-icon>
                <div>
                  <div class="role-badge-title">VISTA INFORMATIVA PARA GARZONES</div>
                  <div class="role-badge-sub">
                    Rol: <strong>MESERO</strong>. Vea con exactitud qué platos quedan y cuáles ya se terminaron para informar con seguridad a los clientes en las mesas.
                  </div>
                </div>
              </div>
              <span class="readonly-tag">SÓLO LECTURA</span>
            </div>
          }

          <!-- Stock KPI Cards -->
          <div class="stock-kpi-grid">
            <div class="stock-kpi-card glass-panel">
              <div class="kpi-icon-wrap bg-blue-subtle">
                <lucide-icon name="sliders-horizontal" class="icon-lg text-blue"></lucide-icon>
              </div>
              <div class="kpi-content">
                <div class="kpi-label">Total en la Carta</div>
                <div class="kpi-number">{{ totalPlatos() }}</div>
                <div class="kpi-hint">Platos y bebidas registrados</div>
              </div>
            </div>

            <div class="stock-kpi-card glass-panel" [class.danger-glow]="totalAgotados() > 0">
              <div class="kpi-icon-wrap bg-red-subtle">
                <lucide-icon name="alert-triangle" class="icon-lg text-red"></lucide-icon>
              </div>
              <div class="kpi-content">
                <div class="kpi-label">Ya se Terminaron</div>
                <div class="kpi-number text-red">{{ totalAgotados() }}</div>
                <div class="kpi-hint">No se pueden pedir hoy</div>
              </div>
            </div>

            <div class="stock-kpi-card glass-panel" [class.warning-glow]="totalStockBajo() > 0">
              <div class="kpi-icon-wrap bg-amber-subtle">
                <lucide-icon name="clock" class="icon-lg text-amber"></lucide-icon>
              </div>
              <div class="kpi-content">
                <div class="kpi-label">Quedan Pocos</div>
                <div class="kpi-number text-amber">{{ totalStockBajo() }}</div>
                <div class="kpi-hint">Por terminarse pronto</div>
              </div>
            </div>

            <div class="stock-kpi-card glass-panel">
              <div class="kpi-icon-wrap bg-emerald-subtle">
                <lucide-icon name="utensils" class="icon-lg text-emerald"></lucide-icon>
              </div>
              <div class="kpi-content">
                <div class="kpi-label">Porciones Disponibles</div>
                <div class="kpi-number text-emerald">{{ totalPorcionesDisponibles() }}</div>
                <div class="kpi-hint">Listas para servir a los comensales</div>
              </div>
            </div>
          </div>

          <!-- Filters Row: Category & Search -->
          <div class="stock-filter-toolbar glass-panel">
            <div class="stock-search-wrap">
              <lucide-icon name="search" class="search-icon"></lucide-icon>
              <input 
                type="text" 
                [ngModel]="stockSearchQuery()" 
                (ngModelChange)="stockSearchQuery.set($event)"
                placeholder="Buscar plato o bebida en carta..." 
                class="stock-search-input"
              />
            </div>

            <div class="stock-filter-select-wrap">
              <label class="filter-mini-label">Categoría:</label>
              <select 
                class="stock-select" 
                [ngModel]="stockCategoryFilter()" 
                (ngModelChange)="stockCategoryFilter.set($event)"
              >
                <option [ngValue]="null">Todas las Categorías</option>
                @for (cat of categorias(); track cat.id) {
                  <option [ngValue]="cat.id">{{ cat.nombre }} ({{ cat.platos.length }})</option>
                }
              </select>
            </div>

            <div class="stock-status-chips">
              <button 
                type="button" 
                class="chip-btn" 
                [class.active]="stockFilterState() === 'todos'"
                (click)="stockFilterState.set('todos')"
              >
                Todos ({{ totalPlatos() }})
              </button>
              <button 
                type="button" 
                class="chip-btn chip-danger" 
                [class.active]="stockFilterState() === 'agotados'"
                (click)="stockFilterState.set('agotados')"
              >
                🔴 Terminados ({{ totalAgotados() }})
              </button>
              <button 
                type="button" 
                class="chip-btn chip-warning" 
                [class.active]="stockFilterState() === 'bajo'"
                (click)="stockFilterState.set('bajo')"
              >
                🟡 Quedan Pocos ({{ totalStockBajo() }})
              </button>
              <button 
                type="button" 
                class="chip-btn chip-success" 
                [class.active]="stockFilterState() === 'disponibles'"
                (click)="stockFilterState.set('disponibles')"
              >
                🟢 Disponibles ({{ totalConStock() }})
              </button>
            </div>
          </div>

          <!-- Stock Table Card -->
          <div class="stock-table-card glass-panel">
            <div class="stock-table-header">
              <div class="col-item">Plato o Bebida</div>
              <div class="col-status">Estado Actual</div>
              <div class="col-qty">¿Cuántos Quedan?</div>
              <div class="col-actions">Cambiar Cantidad</div>
            </div>

            <div class="stock-table-body">
              @for (item of filteredStockPlatos(); track item.id) {
                <div 
                  class="stock-table-row" 
                  [class.is-agotado]="isItemAgotado(item)"
                  [class.is-bajo]="isItemBajoStock(item)"
                >
                  <!-- Item Info -->
                  <div class="col-item">
                    <img 
                      [src]="getPlatoImageUrl(item)" 
                      [alt]="item.nombre" 
                      class="stock-thumb-img"
                      (error)="handleImageError(item)"
                    />
                    <div class="stock-item-details">
                      <span class="stock-cat-pill">{{ item.categoriaNombre }}</span>
                      <h3 class="stock-item-name">{{ item.nombre }}</h3>
                      <span class="stock-price">Bs. {{ item.precioVenta }}</span>
                    </div>
                  </div>

                  <!-- Current Status Pill -->
                  <div class="col-status">
                    @if (isItemAgotado(item)) {
                      <span class="badge-status-red pulse-slow">
                        <lucide-icon name="alert-triangle" class="icon-xs"></lucide-icon>
                        SE TERMINÓ (0)
                      </span>
                    } @else if (isItemBajoStock(item)) {
                      <span class="badge-status-amber">
                        <lucide-icon name="clock" class="icon-xs"></lucide-icon>
                        QUEDAN SOLO {{ item.stockActual }}
                      </span>
                    } @else {
                      <span class="badge-status-emerald">
                        <lucide-icon name="check-circle-2" class="icon-xs"></lucide-icon>
                        {{ item.stockActual }} DISPONIBLES
                      </span>
                    }
                  </div>

                  <!-- Quantity / Min Level -->
                  <div class="col-qty">
                    <div class="qty-control-box">
                      <span class="qty-big-number">{{ item.stockActual ?? 0 }}</span>
                      <span class="qty-unit">porciones listas</span>
                      <div class="min-alert-box" title="Avisar cuando queden pocas porciones">
                        <label>Avisar al quedar:</label>
                        @if (canManageStock()) {
                          <input 
                            type="number" 
                            min="1" 
                            max="50"
                            class="input-min-stock"
                            [ngModel]="item.stockMinimo || 3"
                            (change)="actualizarStockMinimo(item, $any($event.target).value)"
                          />
                        } @else {
                          <span class="min-readonly">{{ item.stockMinimo || 3 }}</span>
                        }
                      </div>
                    </div>
                  </div>

                  <!-- Quick Action Buttons -->
                  <div class="col-actions">
                    @if (canManageStock()) {
                      <div class="action-btn-group">
                        <button 
                          type="button" 
                          class="btn-stock-micro btn-minus" 
                          (click)="ajustarStockDelta(item, -5)"
                          title="Restar 5 porciones"
                          [disabled]="(item.stockActual ?? 0) <= 0"
                        >
                          -5
                        </button>
                        <button 
                          type="button" 
                          class="btn-stock-micro btn-minus" 
                          (click)="ajustarStockDelta(item, -1)"
                          title="Restar 1 porción"
                          [disabled]="(item.stockActual ?? 0) <= 0"
                        >
                          -1
                        </button>

                        <button 
                          type="button" 
                          class="btn-stock-micro btn-plus" 
                          (click)="ajustarStockDelta(item, 1)"
                          title="Añadir 1 porción"
                        >
                          +1
                        </button>
                        <button 
                          type="button" 
                          class="btn-stock-micro btn-plus" 
                          (click)="ajustarStockDelta(item, 5)"
                          title="Añadir 5 porciones"
                        >
                          +5
                        </button>

                        <button 
                          type="button" 
                          class="btn-stock-pill btn-batch" 
                          (click)="ajustarStockDelta(item, 10)"
                          title="Añadir 10 porciones preparadas"
                        >
                          +10 porciones
                        </button>

                        <button 
                          type="button" 
                          class="btn-stock-pill btn-danger-mini" 
                          (click)="fijarStockDirecto(item, 0)"
                          title="Marcar como terminado"
                          [disabled]="item.stockActual === 0"
                        >
                          Se Terminó (0)
                        </button>
                      </div>
                    } @else {
                      <div class="readonly-badge-cell">
                        <lucide-icon name="lock" class="icon-xs"></lucide-icon>
                        <span>Solo Lectura (Caja / Admin)</span>
                      </div>
                    }
                  </div>
                </div>
              } @empty {
                <div class="empty-stock-state">
                  <lucide-icon name="info" class="icon-xl text-muted"></lucide-icon>
                  <p>No se encontraron platos con los filtros seleccionados.</p>
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- MODAL PREPARACIÓN DEL DÍA -->
      @if (modalAperturaOpen()) {
        <div class="modal-backdrop-custom animate-in" (click)="modalAperturaOpen.set(false)">
          <div class="modal-card-custom glass-panel" (click)="$event.stopPropagation()">
            <div class="modal-header-custom">
              <div class="modal-title-wrap">
                <lucide-icon name="sparkles" class="icon-md text-gold"></lucide-icon>
                <div>
                  <h2 class="modal-title font-playfair">Preparación del Día: ¿Cuántos platos se hicieron hoy?</h2>
                  <p class="modal-sub">Indique cuántas porciones o unidades prepararon hoy en el restaurante para saber con claridad qué se puede servir.</p>
                </div>
              </div>
              <button type="button" class="btn-close-custom" (click)="modalAperturaOpen.set(false)">
                <lucide-icon name="x" class="icon-sm"></lucide-icon>
              </button>
            </div>

            <div class="modal-body-custom scrollbar-custom">
              <div class="apertura-quick-presets">
                <span class="preset-title">Poner a todos:</span>
                <button type="button" class="btn-preset" (click)="aplicarPresetMasivo(15)">
                  15 a todos
                </button>
                <button type="button" class="btn-preset" (click)="aplicarPresetMasivo(20)">
                  20 a todos
                </button>
                <button type="button" class="btn-preset" (click)="aplicarPresetMasivo(30)">
                  30 a todos
                </button>
                <button type="button" class="btn-preset" (click)="aplicarPresetMasivo(50)">
                  50 a todos
                </button>
              </div>

              <div class="apertura-items-list">
                @for (item of aperturaItems(); track item.platoId) {
                  <div class="apertura-row">
                    <div class="apertura-info">
                      <span class="apertura-cat">{{ item.categoria }}</span>
                      <strong class="apertura-name">{{ item.nombre }}</strong>
                    </div>

                    <div class="apertura-qty-input-wrap">
                      <label>Listos hoy:</label>
                      <input 
                        type="number" 
                        min="0" 
                        max="999"
                        class="apertura-input"
                        [(ngModel)]="item.stockActual"
                      />
                      <span class="apertura-unit">porc.</span>
                    </div>

                    <div class="apertura-min-wrap">
                      <label>Avisar al quedar:</label>
                      <input 
                        type="number" 
                        min="1" 
                        max="50"
                        class="apertura-input-min"
                        [(ngModel)]="item.stockMinimo"
                      />
                    </div>
                  </div>
                }
              </div>
            </div>

            <div class="modal-footer-custom">
              <button type="button" class="btn-action-outline-gold" (click)="modalAperturaOpen.set(false)">
                Cancelar
              </button>
              <button type="button" class="btn-action-filled-gold" (click)="guardarAperturaMasiva()" [disabled]="guardandoApertura()">
                <lucide-icon name="check" class="icon-sm"></lucide-icon>
                {{ guardandoApertura() ? 'Guardando...' : 'Guardar Platos de Hoy' }}
              </button>
            </div>
          </div>
        </div>
      }

    </div>
  `,
  styles: [`
    .carta-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
      padding-bottom: 30px;
    }

    .font-playfair {
      font-family: 'Playfair Display', Georgia, serif !important;
    }

    /* ── Header Admin Bar ── */
    .header-admin-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 20px;

      .breadcrumb {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.78rem;
        color: #8c8277;
        margin-bottom: 8px;

        .crumb-brand { color: #8c8277; }
        .crumb-sep { color: #5a5248; }
        .crumb-current { color: #f3ebe2; font-weight: 600; }
      }

      h1 {
        font-size: 1.85rem;
        font-weight: 700;
        color: #f3ebe2;
        margin-bottom: 6px;
      }

      .subtitle {
        color: #9c9285;
        font-size: 0.88rem;
        max-width: 720px;
        line-height: 1.45;
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }
    }

    .btn-action-outline-gold {
      background: rgba(212, 168, 83, 0.06);
      border: 1px solid rgba(212, 168, 83, 0.35);
      color: #d4af37;
      padding: 10px 18px;
      border-radius: 8px;
      font-family: var(--font-title, sans-serif);
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.25s ease;

      &:hover {
        background: rgba(212, 168, 83, 0.14);
        border-color: rgba(212, 168, 83, 0.6);
        transform: translateY(-1px);
      }
    }

    .btn-action-filled-gold {
      background: #eab308;
      border: none;
      color: #140f0b;
      padding: 10px 20px;
      border-radius: 8px;
      font-family: var(--font-title, sans-serif);
      font-size: 0.82rem;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 14px rgba(234, 179, 8, 0.25);
      transition: all 0.25s ease;

      &:hover {
        background: #facc15;
        transform: translateY(-1px);
        box-shadow: 0 6px 18px rgba(234, 179, 8, 0.35);
      }
    }

    /* ── Filter & Search Row ── */
    .filter-search-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      background: rgba(25, 20, 15, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.05);
      padding: 12px 18px;
      border-radius: 12px;
    }

    .categories-tabs {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      flex: 1;

      .tab-btn {
        background: transparent;
        border: none;
        color: #9c9285;
        padding: 8px 16px;
        border-radius: 6px;
        font-family: var(--font-title, sans-serif);
        font-size: 0.82rem;
        font-weight: 600;
        white-space: nowrap;
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover {
          color: #f3ebe2;
          background: rgba(255, 255, 255, 0.03);
        }

        &.active {
          background: #eab308;
          color: #140f0b;
          font-weight: 700;
        }
      }
    }

    .search-box-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      width: 240px;

      .search-icon {
        position: absolute;
        left: 12px;
        width: 15px;
        height: 15px;
        color: #8c8277;
      }

      .search-input {
        width: 100%;
        background: rgba(18, 14, 11, 0.8);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 6px;
        padding: 7px 12px 7px 34px;
        color: #f3ebe2;
        font-size: 0.82rem;
        outline: none;
        transition: border-color 0.2s ease;

        &:focus {
          border-color: #d4af37;
        }

        &::placeholder {
          color: #6b6257;
        }
      }
    }

    /* ── Category Header & Section ── */
    .category-block {
      margin-bottom: 36px;
    }

    .category-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 20px;
      border-left: 3px solid #d4af37;
      padding-left: 16px;

      h2 {
        font-size: 1.45rem;
        font-weight: 700;
        color: #f3ebe2;
      }

      .category-desc {
        font-size: 0.82rem;
        color: #8c8277;
        margin-top: 3px;
      }

      .items-count-badge {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.8px;
        color: #a3988c;
        text-transform: uppercase;
      }
    }

    /* ── Platos Grid ── */
    .platos-grid-admin {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 22px;
    }

    .plato-card-admin {
      border: 1px solid rgba(255, 255, 255, 0.06);
      background: #16120e;
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: all 0.3s ease;

      &:hover {
        border-color: rgba(212, 168, 83, 0.3);
        transform: translateY(-3px);
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.3), 0 0 12px rgba(212, 168, 83, 0.08);

        .img-hover-actions {
          opacity: 1;
          transform: translateY(0);
        }
      }

      &.agotado {
        opacity: 0.72;
      }

      &.editing-mode {
        border-color: #d4af37;
        box-shadow: 0 0 18px rgba(212, 168, 83, 0.2);
      }
    }

    /* Card Image Header */
    .card-img-header {
      height: 160px;
      position: relative;
      background: #1a1410;
      overflow: hidden;

      .plato-cover-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.4s ease;
      }

      .camera-fallback {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        background: radial-gradient(circle, rgba(212, 168, 83, 0.12) 0%, rgba(20, 16, 12, 0.9) 100%);
        color: #8c8277;

        .camera-icon {
          width: 26px;
          height: 26px;
          color: #d4af37;
          opacity: 0.8;
        }

        span {
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
      }

      .agotado-top-badge {
        position: absolute;
        top: 12px;
        left: 12px;
        background: rgba(220, 38, 38, 0.9);
        color: #fff;
        font-size: 0.65rem;
        font-weight: 800;
        text-transform: uppercase;
        padding: 3px 8px;
        border-radius: 4px;
        letter-spacing: 0.5px;
      }

      .btn-pencil-edit {
        position: absolute;
        top: 12px;
        right: 12px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(18, 14, 11, 0.75);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #f3ebe2;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        z-index: 5;

        &:hover {
          background: #d4af37;
          border-color: #d4af37;
          color: #140f0b;
          transform: scale(1.08);
        }
      }

      .img-hover-actions {
        position: absolute;
        bottom: 8px;
        left: 8px;
        right: 8px;
        display: flex;
        justify-content: center;
        gap: 6px;
        opacity: 0;
        transform: translateY(6px);
        transition: all 0.25s ease;

        .hover-btn {
          background: rgba(18, 14, 11, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #f3ebe2;
          font-size: 0.68rem;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 12px;
          cursor: pointer;
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          gap: 4px;

          &:hover {
            background: #d4af37;
            color: #140f0b;
            border-color: #d4af37;
          }
        }
      }
    }

    .upload-spinner-overlay {
      position: absolute;
      inset: 0;
      background: rgba(18, 14, 11, 0.85);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      z-index: 6;

      .upload-percent {
        font-size: 0.7rem;
        font-weight: 800;
        color: #d4af37;
      }
    }

    .micro-spinner {
      width: 22px;
      height: 22px;
      border: 2px solid rgba(212, 168, 83, 0.2);
      border-top-color: #d4af37;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .url-input-popover {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: rgba(28, 22, 17, 0.98);
      border-bottom: 1px solid rgba(212, 168, 83, 0.3);

      .url-icon { color: #8c8277; }

      .url-input-text {
        flex: 1;
        background: rgba(14, 11, 8, 0.8);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        padding: 4px 8px;
        color: #f3ebe2;
        font-size: 0.75rem;
        outline: none;
      }

      .btn-save-url {
        background: #d4af37;
        color: #140f0b;
        border: none;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 0.7rem;
        font-weight: 700;
        cursor: pointer;
      }

      .btn-cancel-url {
        background: transparent;
        border: none;
        color: #8c8277;
        font-size: 1rem;
        cursor: pointer;
      }
    }

    /* Card Body */
    .card-body-admin {
      padding: 16px;
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .dish-title-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;

      h3 {
        font-size: 1.1rem;
        font-weight: 700;
        color: #f3ebe2;
        line-height: 1.25;
      }

      .dish-price {
        font-size: 1.15rem;
        font-weight: 800;
        color: #d4af37;
        white-space: nowrap;
      }
    }

    .dish-desc {
      font-size: 0.78rem;
      color: #8c8277;
      line-height: 1.4;
      margin-top: 6px;
      margin-bottom: 12px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /* PORCIONES & PRECIOS Box */
    .porciones-box {
      background: rgba(255, 255, 255, 0.025);
      border: 1px solid rgba(255, 255, 255, 0.04);
      border-radius: 8px;
      padding: 10px 12px;
      margin-top: auto;

      .porciones-header {
        font-size: 0.65rem;
        font-weight: 700;
        color: #8c8277;
        letter-spacing: 0.8px;
        text-transform: uppercase;
        margin-bottom: 8px;
      }

      .variants-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .variant-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.8rem;

        &.v-disabled {
          opacity: 0.5;
        }

        .v-name {
          color: #d6cbbf;
          font-weight: 500;
        }

        .v-meta {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .v-price {
          font-size: 0.88rem;
          font-weight: 700;
          color: #f3ebe2;
        }
      }

      .single-plato-badge {
        span {
          display: inline-block;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 0.68rem;
          font-weight: 700;
          color: #a3988c;
          letter-spacing: 0.5px;
        }
      }
    }

    /* Inline Edit Form */
    .inline-edit-form {
      background: rgba(212, 168, 83, 0.06);
      border: 1px solid rgba(212, 168, 83, 0.25);
      border-radius: 8px;
      padding: 10px 12px;
      margin-top: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;

      .form-title {
        font-size: 0.72rem;
        font-weight: 700;
        color: #d4af37;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .edit-row {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .edit-lbl {
          font-size: 0.78rem;
          color: #f3ebe2;
        }

        .edit-input-box {
          display: flex;
          align-items: center;
          background: #140f0b;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 4px;
          padding: 2px 6px;
          width: 80px;

          .curr {
            font-size: 0.75rem;
            color: #8c8277;
            margin-right: 4px;
          }

          input {
            width: 100%;
            background: transparent;
            border: none;
            outline: none;
            color: #d4af37;
            font-size: 0.82rem;
            font-weight: 700;
            text-align: right;
          }
        }
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 6px;
        margin-top: 4px;

        .btn-cancel {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #8c8277;
          border-radius: 4px;
          padding: 3px 8px;
          font-size: 0.7rem;
          cursor: pointer;
        }

        .btn-save {
          background: #d4af37;
          color: #140f0b;
          border: none;
          border-radius: 4px;
          padding: 3px 8px;
          font-size: 0.7rem;
          font-weight: 700;
          cursor: pointer;
        }
      }
    }

    /* Card Footer */
    .card-footer-admin {
      padding: 12px 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      display: flex;
      justify-content: space-between;
      align-items: center;

      .status-indicator {
        font-size: 0.72rem;
        font-weight: 700;
        color: #f87171;
        letter-spacing: 0.5px;
        display: flex;
        align-items: center;
        gap: 6px;

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #f87171;
        }

        &.disponible {
          color: #4ade80;

          .status-dot {
            background: #4ade80;
            box-shadow: 0 0 6px rgba(74, 222, 128, 0.6);
          }
        }
      }

      .footer-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }

    /* Toggle Switches */
    .switch {
      position: relative;
      display: inline-block;
      width: 38px;
      height: 20px;

      input { opacity: 0; width: 0; height: 0; }

      .slider {
        position: absolute;
        cursor: pointer;
        inset: 0;
        background-color: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.15);
        transition: 0.3s;

        &:before {
          position: absolute;
          content: "";
          height: 12px;
          width: 12px;
          left: 3px;
          bottom: 3px;
          background-color: #8c8277;
          transition: 0.3s;
        }

        &.round {
          border-radius: 20px;
          &:before { border-radius: 50%; }
        }
      }

      input:checked + .slider {
        background-color: rgba(234, 179, 8, 0.2);
        border-color: #eab308;

        &:before {
          transform: translateX(18px);
          background-color: #eab308;
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

    /* Dashed Add Dish Card */
    .add-plato-dashed-card {
      border: 2px dashed rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      min-height: 380px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      cursor: pointer;
      transition: all 0.3s ease;

      &:hover {
        border-color: rgba(212, 168, 83, 0.4);
        background: rgba(212, 168, 83, 0.02);

        .plus-circle-icon {
          background: rgba(212, 168, 83, 0.15);
          border-color: rgba(212, 168, 83, 0.4);
          color: #d4af37;
          transform: scale(1.08);
        }

        .add-text {
          color: #f3ebe2;
        }
      }

      .plus-circle-icon {
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #8c8277;
        transition: all 0.3s ease;
      }

      .add-text {
        font-size: 0.88rem;
        font-weight: 600;
        color: #8c8277;
        transition: color 0.3s ease;
      }
    }

    /* Footer Summary Bar */
    .footer-summary-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      padding: 14px 24px;
      border: 1px solid rgba(255, 255, 255, 0.05);

      .summary-left {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 0.76rem;
        font-weight: 700;
        color: #8c8277;
        letter-spacing: 0.8px;
        text-transform: uppercase;

        strong { color: #f3ebe2; }
        .sep { color: #403830; }
        .agotados-stat strong { color: #f87171; }
      }

      .summary-right {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.76rem;
        font-weight: 600;
        color: #8c8277;
      }
    }

    /* ── DEDICATED PANEL: CREAR NUEVA DELICIA ── */
    .create-dish-panel {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .create-header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .breadcrumb {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.8rem;
        color: #8c8277;

        .crumb-brand { color: #8c8277; }
        .crumb-sep { color: #5a5248; }
        .crumb-current { color: #f3ebe2; font-weight: 600; }
      }

      .header-status-pill {
        background: rgba(34, 197, 94, 0.08);
        border: 1px solid rgba(34, 197, 94, 0.2);
        color: #4ade80;
        font-size: 0.68rem;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 20px;
        letter-spacing: 0.5px;
        display: flex;
        align-items: center;
        gap: 6px;

        .status-dot-active {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #4ade80;
          box-shadow: 0 0 6px #4ade80;
        }
      }
    }

    .create-title-section {
      .brand-title-gold {
        font-size: 2.1rem;
        font-weight: 700;
        color: #d4af37;
        margin-bottom: 6px;
      }

      .subtitle-text {
        color: #8c8277;
        font-size: 0.88rem;
        max-width: 760px;
        line-height: 1.45;
      }
    }

    /* 2-Column Layout */
    .create-grid-layout {
      display: grid;
      grid-template-columns: 1fr 340px;
      gap: 22px;

      @media (max-width: 992px) {
        grid-template-columns: 1fr;
      }
    }

    .form-col-main {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .form-col-sidebar {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .form-panel-card {
      background: #15100c;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      padding: 22px 26px;

      .panel-card-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 20px;
        padding-bottom: 14px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);

        &.flex-between {
          justify-content: space-between;
        }

        .header-left-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .panel-icon {
          color: #d4af37;
          width: 20px;
          height: 20px;
        }

        h2 {
          font-size: 1.3rem;
          font-weight: 700;
          color: #f3ebe2;
        }

        .btn-add-variante-text {
          background: transparent;
          border: none;
          color: #d4af37;
          font-size: 0.76rem;
          font-weight: 700;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: color 0.2s;

          &:hover {
            color: #facc15;
          }
        }
      }

      .panel-card-body {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
    }

    /* Form Inputs */
    .form-group-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1;

      label {
        font-size: 0.68rem;
        font-weight: 700;
        color: #8c8277;
        letter-spacing: 0.8px;
        text-transform: uppercase;
      }

      .custom-input, .custom-select, .custom-textarea {
        background: #0d0a07;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        padding: 10px 14px;
        color: #f3ebe2;
        font-size: 0.88rem;
        outline: none;
        transition: border-color 0.2s;

        &:focus {
          border-color: #d4af37;
        }

        &::placeholder {
          color: #554c42;
        }
      }

      .custom-select option {
        background: #140f0b;
        color: #f3ebe2;
      }
    }

    .form-row-2col {
      display: flex;
      gap: 18px;

      @media (max-width: 600px) {
        flex-direction: column;
      }
    }

    .toggle-estado-box {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #0d0a07;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 8px 14px;
      height: 42px;

      span {
        font-size: 0.82rem;
        color: #d6cbbf;
      }
    }

    /* Variantes Form Cards */
    .variantes-form-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .variant-form-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0d0a07;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 10px;
      padding: 12px 16px;
      transition: all 0.2s;

      &.v-off {
        opacity: 0.55;
      }

      .v-left-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;

        .v-name-input {
          background: transparent;
          border: none;
          outline: none;
          color: #f3ebe2;
          font-size: 0.95rem;
          font-weight: 700;
          padding: 0;

          &::placeholder { color: #554c42; }
        }

        .v-sublabel {
          font-size: 0.62rem;
          font-weight: 700;
          color: #6b6257;
          letter-spacing: 0.8px;
          text-transform: uppercase;
        }
      }

      .v-right-price-actions {
        display: flex;
        align-items: center;
        gap: 12px;

        .v-price-box {
          display: flex;
          align-items: center;
          background: #140f0b;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 6px;
          padding: 4px 10px;
          width: 130px;

          .curr-lbl {
            font-size: 0.85rem;
            color: #d4af37;
            font-weight: 700;
            margin-right: 6px;
          }

          .v-price-input {
            width: 100%;
            background: transparent;
            border: none;
            outline: none;
            color: #f3ebe2;
            font-family: var(--font-title, sans-serif);
            font-size: 0.95rem;
            font-weight: 700;
            text-align: right;
          }
        }

        .icon-action-btn {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #8c8277;
          width: 30px;
          height: 30px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;

          &:hover, &.active-eye {
            color: #f3ebe2;
            border-color: rgba(255, 255, 255, 0.2);
          }

          &.delete:hover {
            color: #f87171;
            border-color: rgba(248, 113, 113, 0.3);
          }
        }
      }
    }

    .single-price-fallback {
      display: flex;
      flex-direction: column;
      gap: 8px;

      .fallback-note {
        font-size: 0.8rem;
        color: #8c8277;
      }

      .single-price-input-wrapper {
        display: flex;
        align-items: center;
        gap: 8px;

        .curr {
          font-size: 1.1rem;
          color: #d4af37;
          font-weight: 700;
        }

        .price-input {
          max-width: 160px;
        }
      }
    }

    /* Sidebar Widgets */
    .sidebar-widget-header {
      font-size: 0.72rem;
      font-weight: 700;
      color: #8c8277;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      margin-bottom: 14px;
    }

    .sidebar-widget-body {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .upload-dropzone-box {
      border: 2px dashed rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      padding: 24px 16px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s;
      background: #0d0a07;

      &:hover {
        border-color: rgba(212, 168, 83, 0.4);
        background: rgba(212, 168, 83, 0.02);

        .upload-icon-circle {
          background: rgba(212, 168, 83, 0.12);
          color: #d4af37;
        }
      }

      .dropzone-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
      }

      .upload-icon-circle {
        width: 46px;
        height: 46px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.03);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #8c8277;
        transition: all 0.3s;
      }

      .dropzone-text {
        font-size: 0.82rem;
        color: #d6cbbf;
        line-height: 1.35;
        max-width: 220px;
      }

      .dropzone-subtext {
        font-size: 0.65rem;
        font-weight: 700;
        color: #6b6257;
        letter-spacing: 0.8px;
      }

      .image-preview-wrapper {
        position: relative;
        height: 180px;
        border-radius: 8px;
        overflow: hidden;

        .form-preview-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .preview-overlay-btn {
          position: absolute;
          bottom: 10px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(18, 14, 11, 0.85);
          color: #f3ebe2;
          font-size: 0.72rem;
          font-weight: 600;
          padding: 4px 12px;
          border-radius: 12px;
          backdrop-filter: blur(4px);
        }
      }

      .dropzone-spinner {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        color: #d4af37;
        font-size: 0.78rem;
      }
    }

    .tip-recommendation-box {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 12px 14px;
      display: flex;
      align-items: flex-start;
      gap: 10px;

      .bulb-icon { font-size: 1rem; }

      p {
        font-size: 0.76rem;
        color: #8c8277;
        line-height: 1.4;
      }
    }

    /* Tags Pills */
    .tags-pills-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;

      .tag-pill-btn {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #8c8277;
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 0.78rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
          border-color: rgba(212, 168, 83, 0.4);
          color: #f3ebe2;
        }

        &.selected {
          background: rgba(212, 168, 83, 0.12);
          border-color: #d4af37;
          color: #d4af37;
        }
      }
    }

    /* Bottom Fixed Action Bar */
    .create-bottom-bar {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 14px;
      padding-top: 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);

      .btn-cancelar-panel {
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #f3ebe2;
        padding: 10px 22px;
        border-radius: 8px;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
          background: rgba(255, 255, 255, 0.04);
        }
      }

      .btn-guardar-plato {
        background: #eab308;
        color: #140f0b;
        border: none;
        padding: 10px 24px;
        border-radius: 8px;
        font-size: 0.85rem;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 4px 14px rgba(234, 179, 8, 0.25);
        transition: all 0.25s;

        &:hover {
          background: #facc15;
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(234, 179, 8, 0.35);
        }
      }
    }

    /* Modal Backdrop & Dialogs */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .modal-card {
      width: 100%;
      max-width: 480px;
      background: #18130e;
      border: 1px solid rgba(212, 168, 83, 0.3);
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
      overflow: hidden;

      .modal-header {
        padding: 18px 22px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        justify-content: space-between;
        align-items: center;

        h3 {
          font-size: 1.25rem;
          font-weight: 700;
          color: #d4af37;
        }

        .btn-close {
          background: transparent;
          border: none;
          color: #8c8277;
          font-size: 1.4rem;
          cursor: pointer;

          &:hover { color: #f3ebe2; }
        }
      }

      .modal-body {
        padding: 22px;
        display: flex;
        flex-direction: column;
        gap: 16px;

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;

          label {
            font-size: 0.78rem;
            font-weight: 600;
            color: #d6cbbf;
          }

          .modal-input, .modal-select, .modal-textarea {
            background: #100c08;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 6px;
            padding: 8px 12px;
            color: #f3ebe2;
            font-size: 0.85rem;
            outline: none;

            &:focus {
              border-color: #d4af37;
            }
          }
        }
      }

      .modal-footer {
        padding: 16px 22px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        justify-content: flex-end;
        gap: 10px;

        .btn-modal-cancel {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #8c8277;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 0.8rem;
          cursor: pointer;
        }

        .btn-modal-save {
          background: #eab308;
          color: #140f0b;
          border: none;
          padding: 8px 18px;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
        }
      }
    }

    /* ── Barra Superior de Navegación de Modos ── */
    .main-view-nav-tabs {
      display: flex;
      gap: 12px;
      padding: 6px;
      background: rgba(22, 16, 12, 0.7);
      border: 1px solid rgba(212, 175, 55, 0.18);
      border-radius: 12px;
      backdrop-filter: blur(12px);
      width: fit-content;
      margin-bottom: 8px;

      .tab-nav-btn {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 20px;
        border-radius: 8px;
        border: 1px solid transparent;
        background: transparent;
        color: #a89f91;
        font-size: 0.88rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.25s ease;

        &:hover {
          color: #f3ebe2;
          background: rgba(255, 255, 255, 0.04);
        }

        &.active {
          background: linear-gradient(135deg, rgba(212, 175, 55, 0.18), rgba(184, 134, 11, 0.08));
          color: #d4af37;
          border-color: rgba(212, 175, 55, 0.4);
          box-shadow: 0 4px 16px rgba(212, 175, 55, 0.12);
        }

        .tab-count-pill {
          background: rgba(255, 255, 255, 0.08);
          color: #d6cbbf;
          font-size: 0.75rem;
          padding: 2px 8px;
          border-radius: 999px;
        }

        .tab-alert-pill {
          background: rgba(239, 68, 68, 0.25);
          color: #fca5a5;
          border: 1px solid rgba(239, 68, 68, 0.4);
          font-size: 0.72rem;
          padding: 2px 8px;
          border-radius: 999px;
          font-weight: 700;
        }

        .tab-warning-pill {
          background: rgba(245, 158, 11, 0.25);
          color: #fde68a;
          border: 1px solid rgba(245, 158, 11, 0.4);
          font-size: 0.72rem;
          padding: 2px 8px;
          border-radius: 999px;
          font-weight: 700;
        }

        .tab-ok-pill {
          background: rgba(16, 185, 129, 0.18);
          color: #6ee7b7;
          font-size: 0.72rem;
          padding: 2px 8px;
          border-radius: 999px;
        }
      }
    }

    /* ── Stock Admin View ── */
    .stock-admin-view {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* ── Role Badge Panel ── */
    .role-badge-panel {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 16px 22px;
      border-radius: 12px;
      background: rgba(18, 13, 10, 0.85);

      &.success {
        border: 1px solid rgba(16, 185, 129, 0.3);
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(18, 13, 10, 0.95));
      }

      &.warning {
        border: 1px solid rgba(245, 158, 11, 0.3);
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(18, 13, 10, 0.95));
      }

      .role-badge-left {
        display: flex;
        align-items: center;
        gap: 14px;

        .role-badge-title {
          font-size: 0.82rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          color: #f3ebe2;
          margin-bottom: 2px;
        }

        .role-badge-sub {
          font-size: 0.78rem;
          color: #a89f91;
          strong {
            color: #d4af37;
          }
        }
      }

      .live-sync-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.75rem;
        font-weight: 700;
        color: #34d399;
        background: rgba(16, 185, 129, 0.12);
        padding: 6px 12px;
        border-radius: 999px;
        border: 1px solid rgba(16, 185, 129, 0.25);
        white-space: nowrap;

        .live-pulse {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 10px #10b981;
          animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
      }

      .readonly-tag {
        font-size: 0.72rem;
        font-weight: 800;
        background: rgba(245, 158, 11, 0.2);
        color: #fbbf24;
        padding: 6px 12px;
        border-radius: 6px;
        border: 1px solid rgba(245, 158, 11, 0.35);
        letter-spacing: 0.08em;
      }
    }

    /* ── Stock KPI Grid ── */
    .stock-kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;

      @media (max-width: 1024px) {
        grid-template-columns: repeat(2, 1fr);
      }
      @media (max-width: 640px) {
        grid-template-columns: 1fr;
      }

      .stock-kpi-card {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 20px;
        border-radius: 12px;
        background: rgba(22, 16, 12, 0.75);
        border: 1px solid rgba(255, 255, 255, 0.08);
        transition: transform 0.2s ease, border-color 0.2s ease;

        &:hover {
          transform: translateY(-2px);
          border-color: rgba(212, 175, 55, 0.3);
        }

        &.danger-glow {
          border-color: rgba(239, 68, 68, 0.4);
          box-shadow: 0 0 20px rgba(239, 68, 68, 0.1);
        }

        &.warning-glow {
          border-color: rgba(245, 158, 11, 0.35);
        }

        .kpi-icon-wrap {
          width: 52px;
          height: 52px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;

          &.bg-blue-subtle {
            background: rgba(59, 130, 246, 0.15);
          }
          &.bg-red-subtle {
            background: rgba(239, 68, 68, 0.15);
          }
          &.bg-amber-subtle {
            background: rgba(245, 158, 11, 0.15);
          }
          &.bg-emerald-subtle {
            background: rgba(16, 185, 129, 0.15);
          }
        }

        .kpi-content {
          display: flex;
          flex-direction: column;
          gap: 2px;

          .kpi-label {
            font-size: 0.76rem;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: #8c8277;
            font-weight: 700;
          }

          .kpi-number {
            font-size: 1.8rem;
            font-weight: 800;
            color: #f3ebe2;
            line-height: 1.1;
          }

          .kpi-hint {
            font-size: 0.72rem;
            color: #a89f91;
          }
        }
      }
    }

    /* ── Stock Toolbar & Filters ── */
    .stock-filter-toolbar {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      padding: 16px 20px;
      border-radius: 12px;
      background: rgba(22, 16, 12, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.08);

      .stock-search-wrap {
        position: relative;
        flex: 1;
        min-width: 240px;

        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #8c8277;
          width: 16px;
          height: 16px;
        }

        .stock-search-input {
          width: 100%;
          background: #100c08;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 10px 14px 10px 38px;
          color: #f3ebe2;
          font-size: 0.84rem;
          outline: none;
          transition: border-color 0.2s ease;

          &:focus {
            border-color: #d4af37;
          }
        }
      }

      .stock-filter-select-wrap {
        display: flex;
        align-items: center;
        gap: 8px;

        .filter-mini-label {
          font-size: 0.76rem;
          font-weight: 700;
          color: #8c8277;
          text-transform: uppercase;
        }

        .stock-select {
          background: #100c08;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 9px 14px;
          color: #f3ebe2;
          font-size: 0.84rem;
          outline: none;
          cursor: pointer;

          &:focus {
            border-color: #d4af37;
          }
        }
      }

      .stock-status-chips {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;

        .chip-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #a89f91;
          padding: 7px 14px;
          border-radius: 8px;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;

          &:hover {
            color: #f3ebe2;
            background: rgba(255, 255, 255, 0.08);
          }

          &.active {
            background: #d4af37;
            color: #120d09;
            border-color: #d4af37;
            font-weight: 700;
          }

          &.chip-danger.active {
            background: #ef4444;
            color: #ffffff;
            border-color: #ef4444;
          }

          &.chip-warning.active {
            background: #f59e0b;
            color: #120d09;
            border-color: #f59e0b;
          }

          &.chip-success.active {
            background: #10b981;
            color: #ffffff;
            border-color: #10b981;
          }
        }
      }
    }

    /* ── Stock Table Layout ── */
    .stock-table-card {
      border-radius: 14px;
      overflow: hidden;
      background: rgba(22, 16, 12, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.08);

      .stock-table-header {
        display: grid;
        grid-template-columns: 2.5fr 1.5fr 1.4fr 2.6fr;
        padding: 16px 24px;
        background: rgba(14, 10, 7, 0.9);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        font-size: 0.74rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #8c8277;

        @media (max-width: 1024px) {
          display: none;
        }
      }

      .stock-table-body {
        display: flex;
        flex-direction: column;

        .stock-table-row {
          display: grid;
          grid-template-columns: 2.5fr 1.5fr 1.4fr 2.6fr;
          align-items: center;
          padding: 16px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          transition: background 0.2s ease;

          &:hover {
            background: rgba(255, 255, 255, 0.02);
          }

          &.is-agotado {
            background: rgba(239, 68, 68, 0.04);
          }

          &.is-bajo {
            background: rgba(245, 158, 11, 0.03);
          }

          @media (max-width: 1024px) {
            display: flex;
            flex-direction: column;
            gap: 12px;
            align-items: flex-start;
          }

          .col-item {
            display: flex;
            align-items: center;
            gap: 14px;

            .stock-thumb-img {
              width: 52px;
              height: 52px;
              border-radius: 8px;
              object-fit: cover;
              border: 1px solid rgba(255, 255, 255, 0.1);
              flex-shrink: 0;
            }

            .stock-item-details {
              display: flex;
              flex-direction: column;
              gap: 2px;

              .stock-cat-pill {
                font-size: 0.68rem;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: #d4af37;
                font-weight: 700;
              }

              .stock-item-name {
                font-size: 0.95rem;
                font-weight: 700;
                color: #f3ebe2;
                margin: 0;
              }

              .stock-price {
                font-size: 0.8rem;
                font-weight: 600;
                color: #a89f91;
              }
            }
          }

          .col-status {
            display: flex;
            align-items: center;

            .badge-status-slate {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 4px 10px;
              border-radius: 6px;
              font-size: 0.74rem;
              font-weight: 700;
              background: rgba(148, 163, 184, 0.15);
              color: #cbd5e1;
              border: 1px solid rgba(148, 163, 184, 0.25);
            }

            .badge-status-red {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 4px 10px;
              border-radius: 6px;
              font-size: 0.74rem;
              font-weight: 700;
              background: rgba(239, 68, 68, 0.18);
              color: #f87171;
              border: 1px solid rgba(239, 68, 68, 0.35);
            }

            .badge-status-amber {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 4px 10px;
              border-radius: 6px;
              font-size: 0.74rem;
              font-weight: 700;
              background: rgba(245, 158, 11, 0.18);
              color: #fbbf24;
              border: 1px solid rgba(245, 158, 11, 0.35);
            }

            .badge-status-emerald {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 4px 10px;
              border-radius: 6px;
              font-size: 0.74rem;
              font-weight: 700;
              background: rgba(16, 185, 129, 0.18);
              color: #34d399;
              border: 1px solid rgba(16, 185, 129, 0.35);
            }
          }

          .col-qty {
            .qty-control-box {
              display: flex;
              flex-direction: column;
              gap: 4px;

              .qty-big-number {
                font-size: 1.4rem;
                font-weight: 800;
                color: #f3ebe2;
                line-height: 1;
              }

              .qty-unit {
                font-size: 0.72rem;
                color: #8c8277;
                text-transform: uppercase;
              }

              .min-alert-box {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 0.72rem;
                color: #a89f91;

                .input-min-stock {
                  width: 44px;
                  background: #100c08;
                  border: 1px solid rgba(255, 255, 255, 0.15);
                  border-radius: 4px;
                  padding: 2px 4px;
                  color: #f3ebe2;
                  font-size: 0.75rem;
                  text-align: center;
                  outline: none;

                  &:focus {
                    border-color: #d4af37;
                  }
                }

                .min-readonly {
                  font-weight: 700;
                  color: #d4af37;
                }
              }
            }

            .text-muted-italic {
              font-size: 0.78rem;
              color: #6e6459;
              font-style: italic;
            }
          }

          .col-actions {
            .action-btn-group {
              display: flex;
              align-items: center;
              gap: 6px;
              flex-wrap: wrap;

              .btn-stock-micro {
                padding: 6px 10px;
                border-radius: 6px;
                font-size: 0.78rem;
                font-weight: 700;
                cursor: pointer;
                border: none;
                transition: all 0.2s ease;

                &:disabled {
                  opacity: 0.3;
                  cursor: not-allowed;
                }

                &.btn-minus {
                  background: rgba(239, 68, 68, 0.15);
                  color: #fca5a5;
                  border: 1px solid rgba(239, 68, 68, 0.3);

                  &:hover:not(:disabled) {
                    background: #ef4444;
                    color: #ffffff;
                  }
                }

                &.btn-plus {
                  background: rgba(16, 185, 129, 0.15);
                  color: #6ee7b7;
                  border: 1px solid rgba(16, 185, 129, 0.3);

                  &:hover:not(:disabled) {
                    background: #10b981;
                    color: #ffffff;
                  }
                }
              }

              .btn-stock-pill {
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 0.76rem;
                font-weight: 700;
                cursor: pointer;
                border: none;
                transition: all 0.2s ease;

                &:disabled {
                  opacity: 0.3;
                  cursor: not-allowed;
                }

                &.btn-batch {
                  background: rgba(212, 175, 55, 0.15);
                  color: #fde047;
                  border: 1px solid rgba(212, 175, 55, 0.4);

                  &:hover:not(:disabled) {
                    background: #d4af37;
                    color: #120d09;
                  }
                }


                &.btn-danger-mini {
                  background: rgba(239, 68, 68, 0.15);
                  color: #f87171;
                  border: 1px solid rgba(239, 68, 68, 0.3);

                  &:hover:not(:disabled) {
                    background: #dc2626;
                    color: #ffffff;
                  }
                }
              }
            }

            .readonly-badge-cell {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              font-size: 0.75rem;
              color: #8c8277;
              background: rgba(255, 255, 255, 0.04);
              padding: 6px 12px;
              border-radius: 6px;
            }
          }
        }

        .empty-stock-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 60px 20px;
          color: #8c8277;
          font-size: 0.9rem;
        }
      }
    }

    /* ── Modal Apertura Masiva ── */
    .modal-backdrop-custom {
      position: fixed;
      inset: 0;
      background: rgba(8, 5, 3, 0.85);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;

      .modal-card-custom {
        width: 100%;
        max-width: 680px;
        max-height: 85vh;
        background: #18110c;
        border: 1px solid rgba(212, 175, 55, 0.3);
        border-radius: 16px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);

        .modal-header-custom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);

          .modal-title-wrap {
            display: flex;
            align-items: center;
            gap: 12px;

            .modal-title {
              font-size: 1.15rem;
              font-weight: 700;
              color: #f3ebe2;
              margin: 0;
            }

            .modal-sub {
              font-size: 0.78rem;
              color: #8c8277;
              margin: 2px 0 0 0;
            }
          }

          .btn-close-custom {
            background: transparent;
            border: none;
            color: #8c8277;
            cursor: pointer;
            padding: 6px;
            border-radius: 6px;
            &:hover {
              color: #f3ebe2;
              background: rgba(255, 255, 255, 0.05);
            }
          }
        }

        .modal-body-custom {
          padding: 20px 24px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;

          .apertura-quick-presets {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
            padding: 12px 16px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.06);
            border-radius: 10px;

            .preset-title {
              font-size: 0.76rem;
              font-weight: 700;
              color: #d4af37;
              text-transform: uppercase;
            }

            .btn-preset {
              background: rgba(212, 175, 55, 0.12);
              border: 1px solid rgba(212, 175, 55, 0.25);
              color: #f3ebe2;
              padding: 5px 12px;
              border-radius: 6px;
              font-size: 0.76rem;
              font-weight: 600;
              cursor: pointer;

              &:hover {
                background: #d4af37;
                color: #120d09;
              }

              &.btn-preset-subtle {
                background: rgba(255, 255, 255, 0.05);
                border-color: rgba(255, 255, 255, 0.12);
                color: #d6cbbf;

                &:hover {
                  background: rgba(255, 255, 255, 0.1);
                  color: #ffffff;
                }
              }
            }
          }

          .apertura-items-list {
            display: flex;
            flex-direction: column;
            gap: 10px;

            .apertura-row {
              display: grid;
              grid-template-columns: 2.4fr 1.4fr 1fr;
              align-items: center;
              gap: 12px;
              padding: 12px 16px;
              border-radius: 8px;
              background: rgba(255, 255, 255, 0.02);
              border: 1px solid rgba(255, 255, 255, 0.04);

              @media (max-width: 600px) {
                display: flex;
                flex-direction: column;
                align-items: flex-start;
              }

              .apertura-info {
                display: flex;
                flex-direction: column;
                gap: 2px;

                .apertura-cat {
                  font-size: 0.68rem;
                  color: #d4af37;
                  text-transform: uppercase;
                  font-weight: 700;
                }

                .apertura-name {
                  font-size: 0.88rem;
                  color: #f3ebe2;
                }
              }

              .apertura-qty-input-wrap, .apertura-min-wrap {
                display: flex;
                align-items: center;
                gap: 6px;

                label {
                  font-size: 0.74rem;
                  color: #8c8277;
                  font-weight: 600;
                }

                .apertura-input {
                  width: 58px;
                  background: #100c08;
                  border: 1px solid rgba(255, 255, 255, 0.15);
                  border-radius: 6px;
                  padding: 6px 8px;
                  color: #f3ebe2;
                  font-size: 0.84rem;
                  font-weight: 700;
                  text-align: center;
                  outline: none;

                  &:focus {
                    border-color: #d4af37;
                  }

                  &:disabled {
                    opacity: 0.4;
                  }
                }

                .apertura-input-min {
                  width: 44px;
                  background: #100c08;
                  border: 1px solid rgba(255, 255, 255, 0.15);
                  border-radius: 6px;
                  padding: 6px 6px;
                  color: #f3ebe2;
                  font-size: 0.8rem;
                  text-align: center;
                  outline: none;

                  &:disabled {
                    opacity: 0.4;
                  }
                }

                .apertura-unit {
                  font-size: 0.72rem;
                  color: #8c8277;
                }
              }
            }
          }
        }

        .modal-footer-custom {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(14, 10, 7, 0.9);
        }
      }
    }
  `]
})
export class CartaComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  authService = inject(AuthService);
  currentUser = computed(() => this.authService.currentUserSignal());
  private socketService = inject(SocketService);
  private uploadService = inject(UploadCloudinaryService);
  private readonly baseUrl = 'http://localhost:3000/api';

  isItemAgotado(item: PlatoAdmin): boolean {
    return item.stockActual == null || item.stockActual <= 0;
  }

  isItemBajoStock(item: PlatoAdmin): boolean {
    return (
      typeof item.stockActual === 'number' &&
      item.stockActual > 0 &&
      item.stockActual <= (item.stockMinimo || 3)
    );
  }

  getUnidadMedida(item: PlatoAdmin): string {
    const cat = (item.categoriaNombre || '').toLowerCase();
    if (cat.includes('bebida') || cat.includes('cerveza') || cat.includes('refresco')) {
      return 'unid.';
    }
    return 'porc.';
  }

  getAreaInfo(item: PlatoAdmin): { label: string; icon: string; esBar: boolean; tipo: 'cocina' | 'bar' } {
    const cat = (item.categoriaNombre || '').toLowerCase();
    const nombre = (item.nombre || '').toLowerCase();
    const esBar = cat.includes('bebida') || cat.includes('cerveza') || cat.includes('trago') || cat.includes('gaseosa') || cat.includes('refresco') || cat.includes('vino') || cat.includes('coctel') || nombre.includes('huari') || nombre.includes('paceña') || nombre.includes('coca') || nombre.includes('sprite');
    if (esBar) {
      return { label: 'Bar & Bebidas', icon: 'beer', esBar: true, tipo: 'bar' };
    }
    return { label: 'Cocina & Caldos', icon: 'soup', esBar: false, tipo: 'cocina' };
  }

  categorias = signal<Categoria[]>([]);
  selectedCategoryId = signal<number | null>(null);
  searchQuery = signal<string>('');

  // View state: 'list' (menu dashboard) vs 'create' (full panel for new dish) vs 'stock' (daily stock control)
  currentView = signal<'list' | 'create' | 'stock'>('list');

  // Filtros y modales de gestión operativa de stock (100% finito)
  stockFilterState = signal<'todos' | 'agotados' | 'bajo' | 'disponibles'>('todos');
  stockCategoryFilter = signal<number | null>(null);
  stockSearchQuery = signal<string>('');
  modalAperturaOpen = signal<boolean>(false);
  guardandoApertura = signal<boolean>(false);
  aperturaItems = signal<Array<{
    platoId: string;
    nombre: string;
    categoria: string;
    stockActual: number;
    stockMinimo: number;
    esBar: boolean;
    unidad: string;
  }>>([]);

  // Modales adicionales
  showCategoriaModal = signal(false);
  nuevaCategoria = { nombre: '', descripcion: '' };

  // Dedicated Form Model for "Crear nueva delicia"
  formPlato = {
    nombre: '',
    categoriaId: 1,
    disponible: true,
    descripcion: '',
    precioVenta: 45,
    imagenUrl: '',
    etiquetas: ['Más Vendido'] as string[],
    variantes: [
      { nombre: 'Personal', precio: 45, disponible: true },
      { nombre: 'Familiar', precio: 120, disponible: true }
    ]
  };

  availableTags = ['Más Vendido', 'Nuevo', 'Picante', 'Especialidad'];
  isUploadingFormImage = signal(false);

  // Inline Price Editing States (Grid View)
  editingPlatoId = signal<string | null>(null);
  editingVariantes = signal<Variante[]>([]);
  editingSinglePrecio = 0;

  // Cloudinary Upload & Image Editing States
  uploadingPlatoId = signal<string | null>(null);
  uploadProgress = computed(() => this.uploadService.progress());
  activeUrlInputPlatoId = signal<string | null>(null);
  pastedUrl = '';

  isAdmin = computed(() => this.authService.currentUserSignal()?.rol === 'ADMIN');
  canManageStock = computed(() => {
    const rol = this.authService.currentUserSignal()?.rol;
    return rol === 'ADMIN' || rol === 'CAJERO';
  });
  private wsSubscription?: Subscription;
  private stockSub?: Subscription;

  // Computed properties
  filteredCategorias = computed(() => {
    const catId = this.selectedCategoryId();
    const query = this.searchQuery().trim().toLowerCase();
    let list = this.categorias();

    if (catId !== null) {
      list = list.filter((c) => c.id === catId);
    }

    if (!query) return list;

    return list.map((cat) => ({
      ...cat,
      platos: cat.platos.filter((p) => 
        p.nombre.toLowerCase().includes(query) || 
        (p.descripcion && p.descripcion.toLowerCase().includes(query))
      )
    })).filter((cat) => cat.platos.length > 0);
  });

  totalPlatos = computed(() => {
    return this.categorias().reduce((acc, cat) => acc + cat.platos.length, 0);
  });

  totalBebidas = computed(() => {
    const bebidasCat = this.categorias().find((c) => c.nombre.toLowerCase().includes('bebida'));
    return bebidasCat ? bebidasCat.platos.length : 0;
  });

  todosLosPlatos = computed(() => {
    const list: PlatoAdmin[] = [];
    for (const cat of this.categorias()) {
      for (const p of cat.platos) {
        list.push({
          ...p,
          categoriaNombre: cat.nombre,
          controlarStock: true,
        });
      }
    }
    return list;
  });

  totalAgotados = computed(() => {
    return this.todosLosPlatos().filter((p) => p.stockActual == null || p.stockActual <= 0).length;
  });

  totalStockBajo = computed(() => {
    return this.todosLosPlatos().filter(
      (p) =>
        typeof p.stockActual === 'number' &&
        p.stockActual > 0 &&
        p.stockActual <= (p.stockMinimo || 3),
    ).length;
  });

  totalConStock = computed(() => {
    return this.todosLosPlatos().filter(
      (p) => typeof p.stockActual === 'number' && p.stockActual > (p.stockMinimo || 3),
    ).length;
  });

  totalPorcionesDisponibles = computed(() => {
    return this.todosLosPlatos()
      .filter((p) => typeof p.stockActual === 'number' && p.stockActual > 0)
      .reduce((acc, p) => acc + (p.stockActual || 0), 0);
  });

  filteredStockPlatos = computed(() => {
    let items = this.todosLosPlatos();
    const query = this.stockSearchQuery().trim().toLowerCase();
    const catId = this.stockCategoryFilter();
    const state = this.stockFilterState();

    if (catId !== null) {
      items = items.filter((i) => i.categoriaId === catId);
    }

    if (query) {
      items = items.filter(
        (i) =>
          i.nombre.toLowerCase().includes(query) ||
          (i.categoriaNombre && i.categoriaNombre.toLowerCase().includes(query)),
      );
    }

    if (state === 'agotados') {
      items = items.filter((i) => i.stockActual == null || i.stockActual <= 0);
    } else if (state === 'bajo') {
      items = items.filter(
        (i) =>
          typeof i.stockActual === 'number' &&
          i.stockActual > 0 &&
          i.stockActual <= (i.stockMinimo || 3),
      );
    } else if (state === 'disponibles') {
      items = items.filter(
        (i) => typeof i.stockActual === 'number' && i.stockActual > (i.stockMinimo || 3),
      );
    }

    return items;
  });

  readonly CLOUDINARY_DISHES_MAP: Record<string, string> = {
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

  getPlatoImageUrl(plato: any): string {
    const raw = plato?.nombre || '';
    const n = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['`’\s-]/g, '');

    if (n.includes('coca')) return this.CLOUDINARY_DISHES_MAP['cocacola'];
    if (n.includes('cascada')) return this.CLOUDINARY_DISHES_MAP['cascada'];
    if (n.includes('fanta')) return this.CLOUDINARY_DISHES_MAP['fanta'];
    if (n.includes('simba')) return this.CLOUDINARY_DISHES_MAP['simba'];
    if (n.includes('sprite')) return this.CLOUDINARY_DISHES_MAP['sprite'];
    if (n.includes('acuari') || n.includes('aquari')) return this.CLOUDINARY_DISHES_MAP['acuarius'];
    if (n.includes('valle')) return this.CLOUDINARY_DISHES_MAP['delvalle'];
    if (n.includes('puravida')) return this.CLOUDINARY_DISHES_MAP['puravida'];
    if (n.includes('hervido')) return this.CLOUDINARY_DISHES_MAP['hervido'];
    if (n.includes('huari')) return this.CLOUDINARY_DISHES_MAP['huari'];
    if (n.includes('pacen')) return this.CLOUDINARY_DISHES_MAP['pacena'];

    if (n.includes('perol')) return this.CLOUDINARY_DISHES_MAP['rinonperol'];
    if (n.includes('rinon')) return this.CLOUDINARY_DISHES_MAP['rinon'];
    if (n.includes('cola')) return this.CLOUDINARY_DISHES_MAP['caldocola'];
    if (n.includes('chanka')) return this.CLOUDINARY_DISHES_MAP['chankapollo'];
    if (n.includes('kawi')) return this.CLOUDINARY_DISHES_MAP['kawi'];
    if (n.includes('pulpito')) return this.CLOUDINARY_DISHES_MAP['pulpitos'];

    if (n.includes('pique')) return this.CLOUDINARY_DISHES_MAP['pique'];
    if (n.includes('charque')) return this.CLOUDINARY_DISHES_MAP['charque'];
    if (n.includes('matambre')) return this.CLOUDINARY_DISHES_MAP['matambre'];
    if (n.includes('planch')) return this.CLOUDINARY_DISHES_MAP['planchita'];
    if (n.includes('lapp')) return this.CLOUDINARY_DISHES_MAP['lapping'];
    if (n.includes('pamp')) return this.CLOUDINARY_DISHES_MAP['pampa'];
    if (n.includes('picant')) return this.CLOUDINARY_DISHES_MAP['picante'];
    if (n.includes('mixto')) return this.CLOUDINARY_DISHES_MAP['mixto'];

    return plato?.imagenUrl || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=80';
  }

  ultimaActualizacion = signal<string>('HOY ' + new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }));

  ngOnInit() {
    this.cargarCarta();
    
    // Subscribe to real-time menu events
    this.wsSubscription = this.socketService
      .onEvent<any>('menu:actualizado')
      .subscribe(() => {
        this.cargarCarta();
      });

    this.stockSub = this.socketService
      .onEvent<any>('plato:stock-actualizado')
      .subscribe((data) => {
        if (data && data.platoId) {
          this.actualizarPlatoStockLocal(
            data.platoId,
            data.stockActual,
            data.disponible,
          );
        }
      });
  }

  ngOnDestroy() {
    this.wsSubscription?.unsubscribe();
    this.stockSub?.unsubscribe();
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
            if (categoriesWithFullPlatos.length > 0 && !this.formPlato.categoriaId) {
              this.formPlato.categoriaId = categoriesWithFullPlatos[0].id;
            }
            this.ultimaActualizacion.set('HOY ' + new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }));
          },
          error: () => {
            this.categorias.set(data);
          },
        });
      },
      error: (err) => console.error('Error cargando la carta', err),
    });
  }

  countPlatosActivos(cat: Categoria): number {
    return cat.platos.filter((p) => this.isPlatoDisponible(p)).length;
  }

  isPlatoDisponible(plato: any): boolean {
    if (!plato) return false;
    if (plato.stockActual == null || plato.stockActual <= 0) {
      return false;
    }
    if (plato.variantes && plato.variantes.length > 0) {
      return plato.variantes.some((v: any) => v.disponible);
    }
    return plato.disponible;
  }

  // ── MÉTODOS OPERATIVOS DE CONTROL DE STOCK (100% FINITO) ──

  ajustarStockDelta(plato: PlatoAdmin, delta: number) {
    if (!this.canManageStock()) return;
    const actual = plato.stockActual ?? 0;
    const nuevo = Math.max(0, actual + delta);
    this.fijarStockDirecto(plato, nuevo);
  }

  fijarStockDirecto(plato: PlatoAdmin, nuevoStock: number) {
    if (!this.canManageStock()) return;
    const valor = Math.max(0, Number(nuevoStock));
    
    // Actualización optimista inmediata
    this.actualizarPlatoStockLocal(plato.id, valor, valor > 0);

    this.http
      .patch<any>(`${this.baseUrl}/carta/platos/${plato.id}/stock`, {
        stockActual: valor,
      })
      .subscribe({
        next: () => {
          this.ultimaActualizacion.set(
            'HOY ' + new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
          );
        },
        error: (err) => {
          console.error('Error al actualizar stock:', err);
          this.cargarCarta();
        },
      });
  }

  actualizarStockMinimo(plato: PlatoAdmin, min: any) {
    if (!this.canManageStock()) return;
    const num = Math.max(0, parseInt(min) || 3);
    plato.stockMinimo = num;

    this.http
      .patch<any>(`${this.baseUrl}/carta/platos/${plato.id}/stock`, {
        stockMinimo: num,
      })
      .subscribe({
        error: (err) => console.error('Error al actualizar alerta mínima:', err),
      });
  }

  actualizarPlatoStockLocal(
    platoId: string,
    stockActual: number | null,
    disponible: boolean,
  ) {
    const cats = this.categorias();
    const updated = cats.map((c) => ({
      ...c,
      platos: c.platos.map((p) => {
        if (p.id === platoId) {
          return {
            ...p,
            stockActual: stockActual,
            disponible: disponible,
            controlarStock: true,
          };
        }
        return p;
      }),
    }));
    this.categorias.set(updated);
  }

  abrirModalApertura() {
    const items = this.todosLosPlatos().map((p) => {
      return {
        platoId: p.id,
        nombre: p.nombre,
        categoria: p.categoriaNombre || 'Carta',
        stockActual: p.stockActual ?? 15,
        stockMinimo: p.stockMinimo || 3,
        esBar: false,
        unidad: 'porc.',
      };
    });
    this.aperturaItems.set(items);
    this.modalAperturaOpen.set(true);
  }

  aplicarPresetMasivo(cantidad: number) {
    const items = this.aperturaItems().map((i) => ({
      ...i,
      stockActual: cantidad,
    }));
    this.aperturaItems.set(items);
  }

  guardarAperturaMasiva() {
    if (!this.canManageStock()) return;
    this.guardandoApertura.set(true);

    const payload = {
      items: this.aperturaItems().map((i) => ({
        platoId: i.platoId,
        stockActual: Math.max(0, Number(i.stockActual)),
        stockMinimo: Math.max(0, Number(i.stockMinimo)),
      })),
      motivo: 'Preparación del día por ' + (this.authService.currentUserSignal()?.nombre || 'Caja/Administración'),
    };

    this.http.post<any>(`${this.baseUrl}/carta/stock/bulk`, payload).subscribe({
      next: () => {
        this.guardandoApertura.set(false);
        this.modalAperturaOpen.set(false);
        this.cargarCarta();
      },
      error: (err) => {
        console.error('Error guardando apertura masiva:', err);
        this.guardandoApertura.set(false);
      },
    });
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
    const targetState = !this.isPlatoDisponible(plato);
    plato.disponible = targetState;
    if (plato.variantes && plato.variantes.length > 0) {
      plato.variantes.forEach((v: any) => (v.disponible = targetState));
    }
    this.http.patch<any>(`${this.baseUrl}/carta/platos/${plato.id}/toggle-disponible`, {}).subscribe({
      next: () => {
        this.cargarCarta();
      },
      error: (err) => console.error('Error al cambiar disponibilidad del plato', err),
    });
  }

  toggleDisponibilidadVariante(plato: any, varianteId: string) {
    const variante = plato.variantes?.find((v: any) => v.id === varianteId);
    if (variante) {
      variante.disponible = !variante.disponible;
      plato.disponible = plato.variantes.some((v: any) => v.disponible);
    }
    this.http.patch<any>(`${this.baseUrl}/carta/variantes/${varianteId}/toggle`, {}).subscribe({
      next: () => {
        this.cargarCarta();
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

  /* Navigation View Controller */
  abrirCrearPlato(catId?: number) {
    const selectedCat = catId || (this.categorias().length > 0 ? this.categorias()[0].id : 1);
    this.formPlato = {
      nombre: '',
      categoriaId: selectedCat,
      disponible: true,
      descripcion: '',
      precioVenta: 45,
      imagenUrl: '',
      etiquetas: ['Más Vendido'],
      variantes: [
        { nombre: 'Personal', precio: 45, disponible: true },
        { nombre: 'Familiar', precio: 120, disponible: true }
      ]
    };
    this.currentView.set('create');
  }

  cerrarCrearPlato() {
    this.currentView.set('list');
  }

  /* Form Actions */
  agregarVarianteForm() {
    this.formPlato.variantes.push({
      nombre: '',
      precio: 0,
      disponible: true
    });
  }

  eliminarVarianteForm(index: number) {
    this.formPlato.variantes.splice(index, 1);
  }

  hasTag(tag: string): boolean {
    return this.formPlato.etiquetas.includes(tag);
  }

  toggleTag(tag: string) {
    const idx = this.formPlato.etiquetas.indexOf(tag);
    if (idx >= 0) {
      this.formPlato.etiquetas.splice(idx, 1);
    } else {
      this.formPlato.etiquetas.push(tag);
    }
  }

  triggerFormFileInput() {
    const fileInput = document.getElementById('form-file-input') as HTMLInputElement;
    fileInput?.click();
  }

  uploadFormImage(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    this.isUploadingFormImage.set(true);
    this.uploadService.uploadImage(file).subscribe({
      next: (secureUrl) => {
        this.formPlato.imagenUrl = secureUrl;
        this.isUploadingFormImage.set(false);
      },
      error: (err) => {
        console.error('Error al subir imagen:', err);
        this.isUploadingFormImage.set(false);
      }
    });
  }

  guardarNuevoPlatoCompleto() {
    if (!this.formPlato.nombre.trim()) return;

    // Determine min base price
    let precioFinal = Number(this.formPlato.precioVenta);
    if (this.formPlato.variantes.length > 0) {
      const validPrecios = this.formPlato.variantes.map((v) => Number(v.precio));
      precioFinal = Math.min(...validPrecios);
    }

    const payload = {
      nombre: this.formPlato.nombre.trim(),
      categoriaId: Number(this.formPlato.categoriaId),
      precioVenta: precioFinal,
      descripcion: this.formPlato.descripcion.trim(),
      imagenUrl: this.formPlato.imagenUrl,
      disponible: this.formPlato.disponible,
      variantes: this.formPlato.variantes.filter((v) => v.nombre.trim() !== '')
    };

    this.http.post<any>(`${this.baseUrl}/carta/platos`, payload).subscribe({
      next: () => {
        this.cargarCarta();
        this.cerrarCrearPlato();
      },
      error: (err) => console.error('Error al guardar plato completo', err)
    });
  }

  /* Modales de Gestión de Categoría */
  abrirModalCategoria() {
    this.nuevaCategoria = { nombre: '', descripcion: '' };
    this.showCategoriaModal.set(true);
  }

  cerrarModales() {
    this.showCategoriaModal.set(false);
  }

  guardarCategoria() {
    if (!this.nuevaCategoria.nombre.trim()) return;
    this.http.post<any>(`${this.baseUrl}/carta/categorias`, this.nuevaCategoria).subscribe({
      next: () => {
        this.cerrarModales();
        this.cargarCarta();
      },
      error: (err) => console.error('Error al crear categoría', err)
    });
  }

  /* Subida de imágenes en vista de grilla */
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
