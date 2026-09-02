import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/services/auth.service';

export enum RolUsuario {
  ADMIN = 'ADMIN',
  CAJERO = 'CAJERO',
  MESERO = 'MESERO',
}

export interface MiembroEquipo {
  id: string;
  staffId: string;
  nombre: string;
  email: string;
  telefono: string;
  rol: RolUsuario;
  activo: boolean;
  ultimoAcceso: string;
  avatarUrl: string;
}

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="equipo-wrapper animate-in">
      
      <!-- Toast Notification Notification -->
      @if (toast()) {
        <div class="toast-banner" [class.toast-error]="toast()?.type === 'error'">
          <lucide-icon [name]="toast()?.type === 'error' ? 'alert-circle' : 'check-circle-2'" [size]="18"></lucide-icon>
          <span>{{ toast()?.text }}</span>
        </div>
      }

      <!-- Page Header Bar -->
      <header class="equipo-header">
        <div class="header-titles">
          <div class="badge-role-lead">
            <lucide-icon name="shield-check" [size]="13"></lucide-icon>
            <span>ADMINISTRACIÓN DE PERSONAL</span>
          </div>
          <h1 class="font-playfair">Equipo de Trabajo & Caja</h1>
          <p class="header-desc">
            Gestione las cuentas de acceso del personal de sala y cajeros responsables de turnos y arqueos.
          </p>
        </div>

        <div class="header-actions">
          <button type="button" class="btn-refresh" (click)="cargarUsuariosServidor()" title="Actualizar lista">
            <lucide-icon name="refresh-cw" [size]="15" [class.spinning]="cargando()"></lucide-icon>
            <span>Sincronizar</span>
          </button>

          <button type="button" class="btn-nuevo-personal" (click)="abrirModalCrear()">
            <lucide-icon name="user-plus" [size]="16"></lucide-icon>
            <span>Nuevo Personal</span>
          </button>
        </div>
      </header>

      <!-- KPI Summary Cards (Administración y Operativa de Caja) -->
      <section class="kpi-cards-grid">
        
        <!-- Card 1: Total Personal -->
        <article class="kpi-card">
          <div class="kpi-icon-circle kpi-icon-gold">
            <lucide-icon name="users" [size]="20"></lucide-icon>
          </div>
          <div class="kpi-info">
            <span class="kpi-label">TOTAL PERSONAL</span>
            <strong class="kpi-value font-playfair">{{ totalStaffCount() }}</strong>
            <span class="kpi-subtext">Miembros registrados</span>
          </div>
        </article>

        <!-- Card 2: Cajeros Responsables -->
        <article class="kpi-card">
          <div class="kpi-icon-circle kpi-icon-emerald">
            <lucide-icon name="landmark" [size]="20"></lucide-icon>
          </div>
          <div class="kpi-info">
            <span class="kpi-label">CAJEROS DE SALA</span>
            <strong class="kpi-value font-playfair">{{ cajerosCount() }}</strong>
            <span class="kpi-subtext text-emerald">
              <span class="dot-online"></span> Habilitados para Caja
            </span>
          </div>
        </article>

        <!-- Card 3: Meseros en Sala -->
        <article class="kpi-card">
          <div class="kpi-icon-circle kpi-icon-purple">
            <lucide-icon name="utensils-crossed" [size]="20"></lucide-icon>
          </div>
          <div class="kpi-info">
            <span class="kpi-label">MESEROS DE SALA</span>
            <strong class="kpi-value font-playfair">{{ meserosCount() }}</strong>
            <span class="kpi-subtext">Atención y comandas</span>
          </div>
        </article>

        <!-- Card 4: Personal Activo Ahora -->
        <article class="kpi-card">
          <div class="kpi-icon-circle kpi-icon-blue">
            <lucide-icon name="user-check" [size]="20"></lucide-icon>
          </div>
          <div class="kpi-info">
            <span class="kpi-label">ACTIVOS EN TURNO</span>
            <strong class="kpi-value font-playfair">{{ activosAhoraCount() }}</strong>
            <span class="kpi-subtext">Cuentas con acceso hoy</span>
          </div>
        </article>

      </section>

      <!-- Filter and Search Toolbar -->
      <section class="toolbar-box">
        <div class="toolbar-left">
          
          <!-- Search input -->
          <div class="search-wrapper">
            <lucide-icon name="search" [size]="15" class="search-ico"></lucide-icon>
            <input
              type="text"
              placeholder="Buscar por nombre, email o ID..."
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
              class="input-search"
            />
          </div>

          <!-- Role Filter -->
          <div class="filter-group">
            <label class="filter-label">Rol:</label>
            <select
              [ngModel]="selectedRole()"
              (ngModelChange)="selectedRole.set($event)"
              class="select-custom"
            >
              <option value="TODOS">Todos los roles</option>
              <option value="ADMIN">Administradores</option>
              <option value="CAJERO">Cajeros de Sala</option>
              <option value="MESERO">Meseros</option>
            </select>
          </div>

          <!-- State Filter -->
          <div class="filter-group">
            <label class="filter-label">Estado:</label>
            <select
              [ngModel]="selectedEstado()"
              (ngModelChange)="selectedEstado.set($event)"
              class="select-custom"
            >
              <option value="TODOS">Todos</option>
              <option value="ACTIVO">Solo Activos</option>
              <option value="INACTIVO">Solo Suspendidos</option>
            </select>
          </div>

        </div>

        <div class="toolbar-right">
          <span class="results-count">
            Mostrando <strong>{{ filteredMiembros().length }}</strong> de <strong>{{ totalStaffCount() }}</strong>
          </span>
        </div>
      </section>

      <!-- Main Table Section -->
      <section class="table-container-card">
        <div class="table-responsive-box scrollbar-custom">
          <table class="staff-table">
            <thead>
              <tr>
                <th class="th-usuario">USUARIO</th>
                <th class="th-contacto">CONTACTO</th>
                <th class="th-rol">ROL EN EL SISTEMA</th>
                <th class="th-estado">ESTADO</th>
                <th class="th-acceso">ÚLTIMO ACCESO</th>
                <th class="th-acciones text-right">ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              @for (user of filteredMiembros(); track user.id) {
                <tr [class.row-inactive]="!user.activo">
                  
                  <!-- Usuario (Avatar + Nombre + Código ID) -->
                  <td class="td-usuario">
                    <div class="user-profile-cell">
                      <div class="avatar-ring" [ngClass]="getAvatarRingClass(user.rol)">
                        <img [src]="user.avatarUrl" [alt]="user.nombre" class="avatar-photo" />
                        <span class="online-indicator" [class.is-active]="user.activo"></span>
                      </div>
                      <div class="user-text-info">
                        <div class="user-name-line">
                          <strong class="user-display-name">{{ user.nombre }}</strong>
                          @if (user.id === currentUserId()) {
                            <span class="badge-self-user">Tú (Sesión)</span>
                          }
                        </div>
                        <span class="user-staff-id">{{ user.staffId }}</span>
                      </div>
                    </div>
                  </td>

                  <!-- Contacto (Email + Teléfono bien formateados) -->
                  <td class="td-contacto">
                    <div class="contact-stack">
                      <a [href]="'mailto:' + user.email" class="contact-item email-link" title="Enviar correo">
                        <lucide-icon name="mail" [size]="12"></lucide-icon>
                        <span>{{ user.email }}</span>
                      </a>
                      <span class="contact-item phone-number">
                        <lucide-icon name="phone" [size]="12"></lucide-icon>
                        <span>{{ user.telefono }}</span>
                      </span>
                    </div>
                  </td>

                  <!-- Rol del Sistema (ADMIN / CAJERO / MESERO) -->
                  <td class="td-rol">
                    <div class="role-badge" [ngClass]="getRoleBadgeClass(user.rol)">
                      <lucide-icon [name]="getRoleIcon(user.rol)" [size]="13"></lucide-icon>
                      <span>{{ getRolLabel(user.rol) }}</span>
                    </div>
                  </td>

                  <!-- Estado (Interactivo: Activo / Suspendido) -->
                  <td class="td-estado">
                    <button
                      type="button"
                      class="status-toggle-pill"
                      [class.active-pill]="user.activo"
                      [class.disabled-pill]="user.id === currentUserId()"
                      [disabled]="user.id === currentUserId()"
                      (click)="toggleEstado(user)"
                      [title]="user.id === currentUserId() ? 'Tu sesión actual activa (No puedes suspender tu propia cuenta)' : (user.activo ? 'Clic para suspender acceso' : 'Clic para reactivar cuenta')"
                    >
                      <span class="status-pulse-dot"></span>
                      <span>{{ user.activo ? 'Activo' : 'Suspendido' }}</span>
                    </button>
                  </td>

                  <!-- Último Acceso -->
                  <td class="td-acceso">
                    <div class="access-cell">
                      <lucide-icon name="clock" [size]="12" class="access-clock-icon"></lucide-icon>
                      <span class="access-time-text">{{ user.ultimoAcceso }}</span>
                    </div>
                  </td>

                  <!-- Acciones de Administración -->
                  <td class="td-acciones text-right">
                    <div class="action-buttons-group">
                      <button
                        type="button"
                        class="btn-action-icon btn-edit"
                        (click)="abrirModalEditar(user)"
                        title="Editar datos del empleado"
                      >
                        <lucide-icon name="pencil" [size]="14"></lucide-icon>
                      </button>

                      <button
                        type="button"
                        class="btn-action-icon btn-key"
                        (click)="abrirModalPassword(user)"
                        title="Resetear contraseña"
                      >
                        <lucide-icon name="key" [size]="14"></lucide-icon>
                      </button>

                      <button
                        type="button"
                        class="btn-action-icon btn-delete"
                        [class.disabled-action]="user.id === currentUserId()"
                        [disabled]="user.id === currentUserId()"
                        (click)="abrirModalEliminar(user)"
                        [title]="user.id === currentUserId() ? 'Por seguridad, no puedes darte de baja a ti mismo' : 'Dar de baja'"
                      >
                        <lucide-icon name="trash-2" [size]="14"></lucide-icon>
                      </button>
                    </div>
                  </td>

                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="table-empty-cell">
                    <div class="empty-state-box">
                      <lucide-icon name="users" [size]="32" class="empty-ico"></lucide-icon>
                      <p>No se encontraron miembros del equipo con los criterios de búsqueda.</p>
                      <button type="button" class="btn-clear-search" (click)="limpiarFiltros()">
                        Restablecer Filtros
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <!-- ═══════════════════════════════════════════
           MODAL 1: NUEVO EMPLEADO (CREAR)
           ═══════════════════════════════════════════ -->
      @if (showModalCrear()) {
        <div class="modal-backdrop animate-fade-in" (click)="cerrarModales()">
          <div class="modal-dialog-box animate-scale-up" (click)="$event.stopPropagation()">
            
            <div class="modal-header">
              <div class="modal-header-text">
                <div class="badge-role-lead">NUEVO ACCESO</div>
                <h2 class="modal-title font-playfair">Registrar Miembro del Equipo</h2>
              </div>
              <button type="button" class="btn-close-modal" (click)="cerrarModales()">
                <lucide-icon name="x" [size]="18"></lucide-icon>
              </button>
            </div>

            <form (ngSubmit)="guardarNuevoUsuario()" class="modal-form">
              
              <!-- Nombre Completo -->
              <div class="form-field">
                <label>Nombre y Apellido *</label>
                <input
                  type="text"
                  [(ngModel)]="nuevoUsuario.nombre"
                  name="nombre"
                  placeholder="Ej: Marcelo Quiroga"
                  required
                  class="form-input"
                />
              </div>

              <!-- Correo Electrónico -->
              <div class="form-field">
                <label>Correo Electrónico (Usuario de Acceso) *</label>
                <input
                  type="email"
                  [(ngModel)]="nuevoUsuario.email"
                  name="email"
                  placeholder="Ej: marcelo@tukuypaj.com"
                  required
                  class="form-input"
                />
              </div>

              <!-- Teléfono -->
              <div class="form-field">
                <label>Teléfono Celular *</label>
                <input
                  type="text"
                  [(ngModel)]="nuevoUsuario.telefono"
                  name="telefono"
                  placeholder="Ej: +591 71234567"
                  class="form-input"
                />
              </div>

              <!-- Rol del Sistema (Cards Táctiles) -->
              <div class="form-field">
                <label>Rol Asignado en el Restaurante *</label>
                <div class="roles-selection-grid">
                  
                  <!-- Card Rol: Administrador -->
                  <div
                    class="role-select-card"
                    [class.selected]="nuevoUsuario.rol === RolUsuario.ADMIN"
                    (click)="nuevoUsuario.rol = RolUsuario.ADMIN"
                  >
                    <div class="r-icon r-gold">
                      <lucide-icon name="shield" [size]="18"></lucide-icon>
                    </div>
                    <div class="r-meta">
                      <strong class="r-title">Administrador</strong>
                      <span class="r-desc">Acceso total al sistema, reportes y configuración</span>
                    </div>
                  </div>

                  <!-- Card Rol: Cajero -->
                  <div
                    class="role-select-card"
                    [class.selected]="nuevoUsuario.rol === RolUsuario.CAJERO"
                    (click)="nuevoUsuario.rol = RolUsuario.CAJERO"
                  >
                    <div class="r-icon r-emerald">
                      <lucide-icon name="landmark" [size]="18"></lucide-icon>
                    </div>
                    <div class="r-meta">
                      <strong class="r-title">Cajero de Sala</strong>
                      <span class="r-desc">Apertura y cierre de caja, arqueos y cobros</span>
                    </div>
                  </div>

                  <!-- Card Rol: Mesero -->
                  <div
                    class="role-select-card"
                    [class.selected]="nuevoUsuario.rol === RolUsuario.MESERO"
                    (click)="nuevoUsuario.rol = RolUsuario.MESERO"
                  >
                    <div class="r-icon r-purple">
                      <lucide-icon name="utensils-crossed" [size]="18"></lucide-icon>
                    </div>
                    <div class="r-meta">
                      <strong class="r-title">Mesero de Sala</strong>
                      <span class="r-desc">Toma de pedidos en mesas y estado de platos</span>
                    </div>
                  </div>

                </div>
              </div>

              <!-- Contraseña Inicial -->
              <div class="form-field">
                <label>Contraseña de Acceso *</label>
                <div class="password-input-group">
                  <input
                    [type]="mostrarPassword() ? 'text' : 'password'"
                    [(ngModel)]="nuevoUsuario.password"
                    name="password"
                    placeholder="Mínimo 6 caracteres"
                    required
                    minlength="6"
                    class="form-input"
                  />
                  <button
                    type="button"
                    class="btn-toggle-eye"
                    (click)="mostrarPassword.set(!mostrarPassword())"
                    tabindex="-1"
                  >
                    <lucide-icon [name]="mostrarPassword() ? 'eye-off' : 'eye'" [size]="16"></lucide-icon>
                  </button>
                </div>
              </div>

              <!-- Modal Actions Footer -->
              <div class="modal-footer">
                <button type="button" class="btn-cancel" (click)="cerrarModales()">
                  Cancelar
                </button>
                <button type="submit" class="btn-save-gold" [disabled]="guardando()">
                  @if (guardando()) {
                    <lucide-icon name="refresh-cw" [size]="14" class="spinning"></lucide-icon>
                    <span>Guardando...</span>
                  } @else {
                    <lucide-icon name="check" [size]="15"></lucide-icon>
                    <span>Registrar Empleado</span>
                  }
                </button>
              </div>

            </form>

          </div>
        </div>
      }

      <!-- ═══════════════════════════════════════════
           MODAL 2: EDITAR DATOS DE EMPLEADO
           ═══════════════════════════════════════════ -->
      @if (showModalEditar() && usuarioSeleccionado()) {
        <div class="modal-backdrop animate-fade-in" (click)="cerrarModales()">
          <div class="modal-dialog-box animate-scale-up" (click)="$event.stopPropagation()">
            
            <div class="modal-header">
              <div class="modal-header-text">
                <div class="badge-role-lead">ACTUALIZACIÓN</div>
                <h2 class="modal-title font-playfair">Editar Datos de Empleado</h2>
              </div>
              <button type="button" class="btn-close-modal" (click)="cerrarModales()">
                <lucide-icon name="x" [size]="18"></lucide-icon>
              </button>
            </div>

            <form (ngSubmit)="guardarEdicionUsuario()" class="modal-form">
              
              <div class="form-field">
                <label>Nombre y Apellido *</label>
                <input
                  type="text"
                  [(ngModel)]="formEditar.nombre"
                  name="nombre"
                  required
                  class="form-input"
                />
              </div>

              <div class="form-field">
                <label>Correo Electrónico *</label>
                <input
                  type="email"
                  [(ngModel)]="formEditar.email"
                  name="email"
                  required
                  class="form-input"
                />
              </div>

              <div class="form-field">
                <label>Teléfono Celular *</label>
                <input
                  type="text"
                  [(ngModel)]="formEditar.telefono"
                  name="telefono"
                  class="form-input"
                />
              </div>

              <!-- Selector de Rol -->
              <div class="form-field">
                <label>Rol Asignado *</label>
                <div class="roles-selection-grid">
                  
                  <div
                    class="role-select-card"
                    [class.selected]="formEditar.rol === RolUsuario.ADMIN"
                    (click)="formEditar.rol = RolUsuario.ADMIN"
                  >
                    <div class="r-icon r-gold">
                      <lucide-icon name="shield" [size]="18"></lucide-icon>
                    </div>
                    <div class="r-meta">
                      <strong class="r-title">Administrador</strong>
                      <span class="r-desc">Acceso total al sistema</span>
                    </div>
                  </div>

                  <div
                    class="role-select-card"
                    [class.selected]="formEditar.rol === RolUsuario.CAJERO"
                    (click)="formEditar.rol = RolUsuario.CAJERO"
                  >
                    <div class="r-icon r-emerald">
                      <lucide-icon name="landmark" [size]="18"></lucide-icon>
                    </div>
                    <div class="r-meta">
                      <strong class="r-title">Cajero de Sala</strong>
                      <span class="r-desc">Control de caja y cobros</span>
                    </div>
                  </div>

                  <div
                    class="role-select-card"
                    [class.selected]="formEditar.rol === RolUsuario.MESERO"
                    (click)="formEditar.rol = RolUsuario.MESERO"
                  >
                    <div class="r-icon r-purple">
                      <lucide-icon name="utensils-crossed" [size]="18"></lucide-icon>
                    </div>
                    <div class="r-meta">
                      <strong class="r-title">Mesero de Sala</strong>
                      <span class="r-desc">Toma de pedidos y mesas</span>
                    </div>
                  </div>

                </div>
              </div>

              <div class="modal-footer">
                <button type="button" class="btn-cancel" (click)="cerrarModales()">
                  Cancelar
                </button>
                <button type="submit" class="btn-save-gold" [disabled]="guardando()">
                  @if (guardando()) {
                    <lucide-icon name="refresh-cw" [size]="14" class="spinning"></lucide-icon>
                    <span>Guardando...</span>
                  } @else {
                    <lucide-icon name="check" [size]="15"></lucide-icon>
                    <span>Guardar Cambios</span>
                  }
                </button>
              </div>

            </form>

          </div>
        </div>
      }

      <!-- ═══════════════════════════════════════════
           MODAL 3: RESETEAR CONTRASEÑA
           ═══════════════════════════════════════════ -->
      @if (showModalPassword() && usuarioSeleccionado()) {
        <div class="modal-backdrop animate-fade-in" (click)="cerrarModales()">
          <div class="modal-dialog-box modal-small animate-scale-up" (click)="$event.stopPropagation()">
            
            <div class="modal-header">
              <div class="modal-header-text">
                <div class="badge-role-lead">SEGURIDAD</div>
                <h2 class="modal-title font-playfair">Resetear Contraseña</h2>
              </div>
              <button type="button" class="btn-close-modal" (click)="cerrarModales()">
                <lucide-icon name="x" [size]="18"></lucide-icon>
              </button>
            </div>

            <div class="modal-instruction-text">
              Establezca una nueva clave de acceso para <strong>{{ usuarioSeleccionado()?.nombre }}</strong> ({{ usuarioSeleccionado()?.email }}).
            </div>

            <form (ngSubmit)="guardarNuevoPassword()" class="modal-form">
              
              <div class="form-field">
                <label>Nueva Contraseña *</label>
                <input
                  type="password"
                  [(ngModel)]="nuevoPassword"
                  name="nuevoPassword"
                  placeholder="Mínimo 6 caracteres"
                  required
                  minlength="6"
                  class="form-input"
                />
              </div>

              <div class="modal-footer">
                <button type="button" class="btn-cancel" (click)="cerrarModales()">
                  Cancelar
                </button>
                <button type="submit" class="btn-save-gold" [disabled]="guardando() || !nuevoPassword">
                  @if (guardando()) {
                    <span>Actualizando...</span>
                  } @else {
                    <lucide-icon name="key" [size]="14"></lucide-icon>
                    <span>Actualizar Contraseña</span>
                  }
                </button>
              </div>

            </form>

          </div>
        </div>
      }

      <!-- ═══════════════════════════════════════════
           MODAL 4: CONFIRMAR BAJA / DESACTIVACIÓN
           ═══════════════════════════════════════════ -->
      @if (showModalEliminar() && usuarioSeleccionado()) {
        <div class="modal-backdrop animate-fade-in" (click)="cerrarModales()">
          <div class="modal-dialog-box modal-small animate-scale-up" (click)="$event.stopPropagation()">
            
            <div class="modal-header">
              <div class="modal-header-text">
                <div class="badge-danger-lead">CONFIRMACIÓN</div>
                <h2 class="modal-title font-playfair">Dar de Baja Personal</h2>
              </div>
              <button type="button" class="btn-close-modal" (click)="cerrarModales()">
                <lucide-icon name="x" [size]="18"></lucide-icon>
              </button>
            </div>

            <div class="modal-confirm-body">
              <div class="confirm-icon-box">
                <lucide-icon name="alert-circle" [size]="28"></lucide-icon>
              </div>
              <p>
                ¿Está seguro de que desea retirar el acceso al sistema a 
                <strong>{{ usuarioSeleccionado()?.nombre }}</strong>?
              </p>
              <span class="confirm-note">
                La cuenta será desactivada de forma inmediata impidiendo cualquier nuevo inicio de sesión.
              </span>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-cancel" (click)="cerrarModales()">
                Cancelar
              </button>
              <button type="button" class="btn-danger-confirm" (click)="confirmarEliminarUsuario()" [disabled]="guardando()">
                @if (guardando()) {
                  <span>Procesando...</span>
                } @else {
                  <lucide-icon name="trash-2" [size]="14"></lucide-icon>
                  <span>Confirmar Baja</span>
                }
              </button>
            </div>

          </div>
        </div>
      }

    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      color: #f3ebe2;
    }

    .equipo-wrapper {
      padding: 8px 10px 40px;
      max-width: 1380px;
      margin: 0 auto;
    }

    /* ── Toast Notification Banner ── */
    .toast-banner {
      position: fixed;
      top: 24px;
      right: 28px;
      z-index: 1000;
      background: #181411;
      border: 1px solid rgba(34, 197, 94, 0.4);
      color: #4ade80;
      padding: 12px 18px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.86rem;
      font-weight: 600;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), 0 0 15px rgba(34, 197, 94, 0.15);
      animation: slideInDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);

      &.toast-error {
        border-color: rgba(239, 68, 68, 0.4);
        color: #f87171;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), 0 0 15px rgba(239, 68, 68, 0.15);
      }
    }

    @keyframes slideInDown {
      from { transform: translateY(-20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    /* ── Header Principal ── */
    .equipo-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
      gap: 20px;
      flex-wrap: wrap;

      .header-titles {
        .badge-role-lead {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(229, 193, 88, 0.12);
          border: 1px solid rgba(229, 193, 88, 0.3);
          color: #e5c158;
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.6px;
          padding: 3px 10px;
          border-radius: 20px;
          margin-bottom: 8px;
        }

        h1 {
          font-size: 1.95rem;
          font-weight: 700;
          color: #f7f3ee;
          margin: 0 0 6px 0;
          letter-spacing: -0.3px;
        }

        .header-desc {
          margin: 0;
          font-size: 0.85rem;
          color: #a89f91;
          max-width: 650px;
          line-height: 1.45;
        }
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }
    }

    .btn-refresh {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.09);
      color: #d6cbbf;
      padding: 9px 15px;
      border-radius: 10px;
      font-size: 0.82rem;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.08);
        color: #ffffff;
        border-color: rgba(255, 255, 255, 0.18);
      }
    }

    .btn-nuevo-personal {
      background: linear-gradient(135deg, #e5c158 0%, #c99e32 100%);
      border: 1px solid #e5c158;
      color: #120e0b;
      padding: 9px 18px;
      border-radius: 10px;
      font-size: 0.84rem;
      font-weight: 800;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(229, 193, 88, 0.25);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

      &:hover {
        background: linear-gradient(135deg, #f0d072 0%, #d8ad3b 100%);
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(229, 193, 88, 0.4);
      }
    }

    /* ── KPI Summary Cards ── */
    .kpi-cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .kpi-card {
      background: #171310;
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 14px;
      padding: 16px 18px;
      display: flex;
      align-items: center;
      gap: 14px;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
      transition: transform 0.2s ease, border-color 0.2s ease;

      &:hover {
        border-color: rgba(229, 193, 88, 0.25);
        transform: translateY(-2px);
      }

      .kpi-icon-circle {
        width: 46px;
        height: 46px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        &.kpi-icon-gold {
          background: rgba(229, 193, 88, 0.12);
          color: #e5c158;
          border: 1px solid rgba(229, 193, 88, 0.25);
        }

        &.kpi-icon-emerald {
          background: rgba(34, 197, 94, 0.12);
          color: #4ade80;
          border: 1px solid rgba(34, 197, 94, 0.25);
        }

        &.kpi-icon-purple {
          background: rgba(168, 85, 247, 0.12);
          color: #c084fc;
          border: 1px solid rgba(168, 85, 247, 0.25);
        }

        &.kpi-icon-blue {
          background: rgba(59, 130, 246, 0.12);
          color: #60a5fa;
          border: 1px solid rgba(59, 130, 246, 0.25);
        }
      }

      .kpi-info {
        display: flex;
        flex-direction: column;

        .kpi-label {
          font-size: 0.65rem;
          font-weight: 700;
          color: #8c8277;
          letter-spacing: 0.6px;
        }

        .kpi-value {
          font-size: 1.85rem;
          color: #ffffff;
          line-height: 1.15;
          margin: 2px 0;
        }

        .kpi-subtext {
          font-size: 0.72rem;
          color: #a89f91;

          &.text-emerald {
            color: #4ade80;
            display: inline-flex;
            align-items: center;
            gap: 4px;
          }

          .dot-online {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #4ade80;
            display: inline-block;
          }
        }
      }
    }

    /* ── Toolbar Box ── */
    .toolbar-box {
      background: #171310;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      padding: 12px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
      flex-wrap: wrap;

      .toolbar-left {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
        flex: 1;
      }

      .search-wrapper {
        position: relative;
        display: flex;
        align-items: center;
        min-width: 250px;

        .search-ico {
          position: absolute;
          left: 12px;
          color: #786f64;
        }

        .input-search {
          width: 100%;
          background: #110e0c;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 8px;
          padding: 8px 12px 8px 34px;
          color: #f5ede4;
          font-size: 0.82rem;
          outline: none;
          transition: border-color 0.2s ease;

          &:focus {
            border-color: #e5c158;
          }

          &::placeholder {
            color: #635b50;
          }
        }
      }

      .filter-group {
        display: flex;
        align-items: center;
        gap: 6px;

        .filter-label {
          font-size: 0.74rem;
          color: #8c8277;
          font-weight: 600;
        }

        .select-custom {
          background: #110e0c;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 8px;
          padding: 7px 12px;
          color: #f3ebe2;
          font-size: 0.8rem;
          outline: none;
          cursor: pointer;

          &:focus {
            border-color: #e5c158;
          }
        }
      }

      .toolbar-right {
        .results-count {
          font-size: 0.78rem;
          color: #8c8277;

          strong {
            color: #e5c158;
          }
        }
      }
    }

    /* ── Main Table Card ── */
    .table-container-card {
      background: #171310;
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
    }

    .table-responsive-box {
      overflow-x: auto;
      width: 100%;
    }

    .staff-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;

      th {
        font-size: 0.68rem;
        font-weight: 800;
        letter-spacing: 0.8px;
        color: #8c8277;
        text-transform: uppercase;
        padding: 14px 18px;
        background: rgba(255, 255, 255, 0.015);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        white-space: nowrap;
      }

      td {
        padding: 14px 18px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        vertical-align: middle;
      }

      tr {
        transition: background 0.15s ease;

        &:hover td {
          background: rgba(255, 255, 255, 0.02);
        }

        &.row-inactive td {
          opacity: 0.55;
        }
      }

      .text-right {
        text-align: right;
      }
    }

    /* ── Table Cell Content Styles ── */
    .user-profile-cell {
      display: flex;
      align-items: center;
      gap: 12px;

      .avatar-ring {
        position: relative;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        padding: 2px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        flex-shrink: 0;

        &.ring-admin {
          border-color: rgba(229, 193, 88, 0.6);
        }

        &.ring-cajero {
          border-color: rgba(74, 222, 128, 0.6);
        }

        &.ring-mesero {
          border-color: rgba(192, 132, 252, 0.6);
        }

        .avatar-photo {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
          display: block;
        }

        .online-indicator {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #786f64;
          border: 2px solid #171310;

          &.is-active {
            background: #22c55e;
            box-shadow: 0 0 6px #22c55e;
          }
        }
      }

      .user-text-info {
        display: flex;
        flex-direction: column;

        .user-name-line {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .user-display-name {
          font-size: 0.92rem;
          color: #f7f3ee;
          line-height: 1.25;
        }

        .badge-self-user {
          background: rgba(229, 193, 88, 0.15);
          border: 1px solid rgba(229, 193, 88, 0.4);
          color: #e5c158;
          font-size: 0.62rem;
          font-weight: 800;
          padding: 1px 6px;
          border-radius: 10px;
          letter-spacing: 0.3px;
        }

        .user-staff-id {
          font-size: 0.68rem;
          color: #8c8277;
          font-weight: 600;
          letter-spacing: 0.4px;
        }
      }
    }

    .contact-stack {
      display: flex;
      flex-direction: column;
      gap: 3px;

      .contact-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.78rem;

        lucide-icon {
          color: #786f64;
          flex-shrink: 0;
        }

        &.email-link {
          color: #d6cbbf;
          text-decoration: none;

          &:hover {
            color: #e5c158;
            text-decoration: underline;
          }
        }

        &.phone-number {
          color: #8c8277;
          font-family: monospace;
          font-size: 0.74rem;
        }
      }
    }

    /* ── Badges de Roles ── */
    .role-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.4px;
      white-space: nowrap;

      &.badge-admin {
        background: rgba(229, 193, 88, 0.12);
        color: #e5c158;
        border: 1px solid rgba(229, 193, 88, 0.35);
      }

      &.badge-cajero {
        background: rgba(34, 197, 94, 0.12);
        color: #4ade80;
        border: 1px solid rgba(34, 197, 94, 0.35);
      }

      &.badge-mesero {
        background: rgba(168, 85, 247, 0.12);
        color: #c084fc;
        border: 1px solid rgba(168, 85, 247, 0.35);
      }
    }

    /* ── Botón Toggle Estado ── */
    .status-toggle-pill {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #8c8277;
      border-radius: 20px;
      padding: 4px 10px;
      font-size: 0.72rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      transition: all 0.2s ease;

      .status-pulse-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #786f64;
      }

      &.active-pill {
        background: rgba(34, 197, 94, 0.1);
        border-color: rgba(34, 197, 94, 0.25);
        color: #4ade80;

        .status-pulse-dot {
          background: #4ade80;
          box-shadow: 0 0 6px rgba(74, 222, 128, 0.6);
        }
      }

      &.disabled-pill {
        opacity: 0.75;
        cursor: default;
        border-color: rgba(229, 193, 88, 0.3);

        &:hover {
          transform: none;
        }
      }

      &:hover:not(.disabled-pill) {
        border-color: #e5c158;
        transform: scale(1.03);
      }
    }

    .access-cell {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.76rem;
      color: #a89f91;

      .access-clock-icon {
        color: #786f64;
      }
    }

    /* ── Action Buttons Group ── */
    .action-buttons-group {
      display: inline-flex;
      align-items: center;
      gap: 6px;

      .btn-action-icon {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: #9e9384;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.18s ease;

        &:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
          transform: translateY(-1px);
        }

        &.btn-edit:hover:not(:disabled) {
          border-color: #e5c158;
          color: #e5c158;
        }

        &.btn-key:hover:not(:disabled) {
          border-color: #60a5fa;
          color: #60a5fa;
        }

        &.btn-delete:hover:not(:disabled) {
          border-color: #f87171;
          color: #f87171;
        }

        &.disabled-action, &:disabled {
          opacity: 0.3;
          cursor: not-allowed;

          &:hover {
            transform: none;
            background: rgba(255, 255, 255, 0.03);
            color: #9e9384;
          }
        }
      }
    }

    /* ── Empty State ── */
    .table-empty-cell {
      padding: 48px 20px;
      text-align: center;
    }

    .empty-state-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      color: #8c8277;

      .empty-ico {
        opacity: 0.35;
      }

      p {
        margin: 0;
        font-size: 0.9rem;
      }

      .btn-clear-search {
        background: rgba(229, 193, 88, 0.1);
        border: 1px solid rgba(229, 193, 88, 0.3);
        color: #e5c158;
        padding: 6px 14px;
        border-radius: 8px;
        font-size: 0.78rem;
        font-weight: 700;
        cursor: pointer;
      }
    }

    /* ── Modales Glassmorphic ── */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(10, 8, 6, 0.78);
      backdrop-filter: blur(8px);
      z-index: 1050;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .modal-dialog-box {
      background: #181411;
      border: 1px solid rgba(229, 193, 88, 0.28);
      border-radius: 16px;
      width: 100%;
      max-width: 540px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(229, 193, 88, 0.1);
      overflow: hidden;

      &.modal-small {
        max-width: 440px;
      }
    }

    .modal-header {
      padding: 20px 24px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      align-items: flex-start;
      justify-content: space-between;

      .badge-role-lead {
        font-size: 0.62rem;
        font-weight: 800;
        color: #e5c158;
        letter-spacing: 0.6px;
        margin-bottom: 4px;
      }

      .badge-danger-lead {
        font-size: 0.62rem;
        font-weight: 800;
        color: #f87171;
        letter-spacing: 0.6px;
        margin-bottom: 4px;
      }

      .modal-title {
        font-size: 1.35rem;
        color: #f7f3ee;
        margin: 0;
      }

      .btn-close-modal {
        background: transparent;
        border: none;
        color: #8c8277;
        cursor: pointer;
        padding: 4px;

        &:hover {
          color: #ffffff;
        }
      }
    }

    .modal-instruction-text {
      padding: 16px 24px 0;
      font-size: 0.84rem;
      color: #a89f91;
      line-height: 1.4;

      strong {
        color: #f7f3ee;
      }
    }

    .modal-confirm-body {
      padding: 24px 24px 12px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;

      .confirm-icon-box {
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: rgba(239, 68, 68, 0.12);
        color: #f87171;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      p {
        margin: 0;
        font-size: 0.95rem;
        color: #f3ebe2;
        line-height: 1.4;
      }

      .confirm-note {
        font-size: 0.76rem;
        color: #8c8277;
      }
    }

    .modal-form {
      padding: 20px 24px 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 6px;

      label {
        font-size: 0.74rem;
        font-weight: 700;
        color: #a89f91;
        letter-spacing: 0.3px;
      }

      .form-input {
        background: #110e0c;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 10px 14px;
        color: #f7f3ee;
        font-size: 0.86rem;
        outline: none;
        transition: border-color 0.2s ease;

        &:focus {
          border-color: #e5c158;
        }
      }

      .password-input-group {
        position: relative;
        display: flex;
        align-items: center;

        .form-input {
          width: 100%;
          padding-right: 40px;
        }

        .btn-toggle-eye {
          position: absolute;
          right: 12px;
          background: transparent;
          border: none;
          color: #786f64;
          cursor: pointer;

          &:hover {
            color: #d6cbbf;
          }
        }
      }
    }

    /* ── Roles Selection Cards ── */
    .roles-selection-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
    }

    .role-select-card {
      background: #110e0c;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        border-color: rgba(229, 193, 88, 0.3);
        background: #15110e;
      }

      &.selected {
        border-color: #e5c158;
        background: rgba(229, 193, 88, 0.08);
      }

      .r-icon {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        &.r-gold {
          background: rgba(229, 193, 88, 0.12);
          color: #e5c158;
        }

        &.r-emerald {
          background: rgba(34, 197, 94, 0.12);
          color: #4ade80;
        }

        &.r-purple {
          background: rgba(168, 85, 247, 0.12);
          color: #c084fc;
        }
      }

      .r-meta {
        display: flex;
        flex-direction: column;

        .r-title {
          font-size: 0.84rem;
          color: #ffffff;
        }

        .r-desc {
          font-size: 0.7rem;
          color: #8c8277;
        }
      }
    }

    /* ── Modal Footer ── */
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 10px;
      margin-top: 8px;
    }

    .btn-cancel {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.09);
      color: #a89f91;
      padding: 9px 16px;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;

      &:hover {
        background: rgba(255, 255, 255, 0.08);
        color: #ffffff;
      }
    }

    .btn-save-gold {
      background: linear-gradient(135deg, #e5c158 0%, #c99e32 100%);
      border: 1px solid #e5c158;
      color: #120e0b;
      padding: 9px 18px;
      border-radius: 8px;
      font-size: 0.84rem;
      font-weight: 800;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(229, 193, 88, 0.25);

      &:hover:not(:disabled) {
        background: linear-gradient(135deg, #f0d072 0%, #d8ad3b 100%);
        box-shadow: 0 6px 18px rgba(229, 193, 88, 0.4);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    .btn-danger-confirm {
      background: #dc2626;
      border: 1px solid #ef4444;
      color: #ffffff;
      padding: 9px 18px;
      border-radius: 8px;
      font-size: 0.84rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;

      &:hover:not(:disabled) {
        background: #b91c1c;
      }
    }

    .spinning {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      100% { transform: rotate(360deg); }
    }
  `]
})
export class UsuariosComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private readonly baseUrl = 'http://localhost:3000/api';

  readonly RolUsuario = RolUsuario;

  cargando = signal<boolean>(false);
  guardando = signal<boolean>(false);
  searchQuery = signal<string>('');
  selectedRole = signal<string>('TODOS');
  selectedEstado = signal<string>('TODOS');
  toast = signal<{ text: string; type: 'success' | 'error' } | null>(null);

  // Lista principal de miembros
  miembros = signal<MiembroEquipo[]>([]);

  // Estados de modales
  showModalCrear = signal<boolean>(false);
  showModalEditar = signal<boolean>(false);
  showModalPassword = signal<boolean>(false);
  showModalEliminar = signal<boolean>(false);
  mostrarPassword = signal<boolean>(false);

  currentUserId = computed(() => this.authService.currentUserSignal()?.id);

  usuarioSeleccionado = signal<MiembroEquipo | null>(null);

  // Formularios
  nuevoUsuario = {
    nombre: '',
    email: '',
    telefono: '',
    rol: RolUsuario.MESERO,
    password: '',
  };

  formEditar = {
    nombre: '',
    email: '',
    telefono: '',
    rol: RolUsuario.MESERO,
  };

  nuevoPassword = '';

  // ── Computed Properties ──
  filteredMiembros = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const r = this.selectedRole();
    const e = this.selectedEstado();

    return this.miembros().filter((m) => {
      // Filtrar estrictamente cualquier rol CHEF o cocinero si existiera en BD
      if ((m.rol as string) === 'CHEF' || m.email.includes('ia@tukuypaj.com')) {
        return false;
      }

      const matchQuery =
        !q ||
        m.nombre.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.staffId.toLowerCase().includes(q) ||
        m.telefono.includes(q);

      const matchRole = r === 'TODOS' || m.rol === r;
      const matchEstado =
        e === 'TODOS' ||
        (e === 'ACTIVO' && m.activo) ||
        (e === 'INACTIVO' && !m.activo);

      return matchQuery && matchRole && matchEstado;
    });
  });

  totalStaffCount = computed(() => {
    return this.miembros().filter(m => (m.rol as string) !== 'CHEF' && !m.email.includes('ia@')).length;
  });

  cajerosCount = computed(() => {
    return this.miembros().filter(m => m.rol === RolUsuario.CAJERO && m.activo).length;
  });

  meserosCount = computed(() => {
    return this.miembros().filter(m => m.rol === RolUsuario.MESERO && m.activo).length;
  });

  activosAhoraCount = computed(() => {
    return this.miembros().filter(m => m.activo && (m.rol as string) !== 'CHEF' && !m.email.includes('ia@')).length;
  });

  ngOnInit(): void {
    this.cargarUsuariosServidor();
  }

  cargarUsuariosServidor(): void {
    this.cargando.set(true);
    this.http.get<any>(`${this.baseUrl}/usuarios`).subscribe({
      next: (res) => {
        this.cargando.set(false);
        const users = Array.isArray(res) ? res : res.data || [];
        if (users.length > 0) {
          // Filtrar cocineros y bots
          const filtrados = users.filter((u: any) => u.rol !== 'CHEF' && !u.email.includes('ia@'));
          const mapped: MiembroEquipo[] = filtrados.map((u: any, idx: number) => {
            const prefix = u.rol === 'ADMIN' ? 'ADM' : u.rol === 'CAJERO' ? 'CAJ' : 'MES';
            return {
              id: u.id,
              staffId: `ID-${prefix}-${String(idx + 1).padStart(2, '0')}`,
              nombre: u.nombre,
              email: u.email,
              telefono: u.telefono || this.generarTelefonoMock(u.id),
              rol: u.rol,
              activo: u.activo,
              ultimoAcceso: u.activo ? 'En turno ahora' : 'Ayer, 22:30',
              avatarUrl: this.generarAvatar(u.nombre, u.id),
            };
          });
          this.miembros.set(mapped);
        }
      },
      error: () => {
        this.cargando.set(false);
        this.mostrarToast('No se pudieron sincronizar los usuarios del servidor', 'error');
      },
    });
  }

  generarAvatar(nombre: string, id: string): string {
    const seed = encodeURIComponent(nombre || id);
    return `https://api.dicebear.com/7.x/initials/svg?seed=${seed}&backgroundColor=221c16,1a1511&textColor=e5c158`;
  }

  generarTelefonoMock(id: string): string {
    const num = Math.abs(id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 70000000)) % 10000000;
    return `+591 7${String(num).padStart(7, '0').substring(0, 3)} ${String(num).substring(3, 7)}`;
  }

  getRolLabel(rol: RolUsuario): string {
    switch (rol) {
      case RolUsuario.ADMIN:
        return 'Administrador';
      case RolUsuario.CAJERO:
        return 'Cajero de Sala';
      case RolUsuario.MESERO:
        return 'Mesero de Sala';
      default:
        return rol;
    }
  }

  getRoleIcon(rol: RolUsuario): string {
    switch (rol) {
      case RolUsuario.ADMIN:
        return 'shield';
      case RolUsuario.CAJERO:
        return 'landmark';
      case RolUsuario.MESERO:
        return 'utensils-crossed';
      default:
        return 'user';
    }
  }

  getRoleBadgeClass(rol: RolUsuario): string {
    switch (rol) {
      case RolUsuario.ADMIN:
        return 'badge-admin';
      case RolUsuario.CAJERO:
        return 'badge-cajero';
      case RolUsuario.MESERO:
        return 'badge-mesero';
      default:
        return '';
    }
  }

  getAvatarRingClass(rol: RolUsuario): string {
    switch (rol) {
      case RolUsuario.ADMIN:
        return 'ring-admin';
      case RolUsuario.CAJERO:
        return 'ring-cajero';
      case RolUsuario.MESERO:
        return 'ring-mesero';
      default:
        return '';
    }
  }

  limpiarFiltros(): void {
    this.searchQuery.set('');
    this.selectedRole.set('TODOS');
    this.selectedEstado.set('TODOS');
  }

  // ── Modales ──
  abrirModalCrear(): void {
    this.nuevoUsuario = {
      nombre: '',
      email: '',
      telefono: '+591 ',
      rol: RolUsuario.CAJERO,
      password: '',
    };
    this.mostrarPassword.set(false);
    this.showModalCrear.set(true);
  }

  abrirModalEditar(user: MiembroEquipo): void {
    this.usuarioSeleccionado.set(user);
    this.formEditar = {
      nombre: user.nombre,
      email: user.email,
      telefono: user.telefono,
      rol: user.rol,
    };
    this.showModalEditar.set(true);
  }

  abrirModalPassword(user: MiembroEquipo): void {
    this.usuarioSeleccionado.set(user);
    this.nuevoPassword = '';
    this.showModalPassword.set(true);
  }

  abrirModalEliminar(user: MiembroEquipo): void {
    if (user.id === this.currentUserId()) {
      this.mostrarToast('Por seguridad, no puedes dar de baja tu propia cuenta activa', 'error');
      return;
    }
    this.usuarioSeleccionado.set(user);
    this.showModalEliminar.set(true);
  }

  cerrarModales(): void {
    this.showModalCrear.set(false);
    this.showModalEditar.set(false);
    this.showModalPassword.set(false);
    this.showModalEliminar.set(false);
    this.usuarioSeleccionado.set(null);
  }

  // ── Operaciones CRUD con Validaciones Exhaustivas ──
  guardarNuevoUsuario(): void {
    const nombre = this.nuevoUsuario.nombre?.trim();
    const email = this.nuevoUsuario.email?.trim().toLowerCase();
    const password = this.nuevoUsuario.password;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!nombre || nombre.length < 3) {
      this.mostrarToast('El nombre completo debe tener al menos 3 caracteres', 'error');
      return;
    }
    if (!email || !emailRegex.test(email)) {
      this.mostrarToast('Por favor ingrese un correo electrónico válido', 'error');
      return;
    }
    if (!password || password.length < 6) {
      this.mostrarToast('La contraseña debe tener mínimo 6 caracteres', 'error');
      return;
    }

    this.guardando.set(true);
    const payload = {
      nombre,
      email,
      password,
      rol: this.nuevoUsuario.rol,
    };

    this.http.post<any>(`${this.baseUrl}/usuarios`, payload).subscribe({
      next: () => {
        this.guardando.set(false);
        this.cerrarModales();
        this.mostrarToast(`Colaborador ${payload.nombre} registrado con éxito`, 'success');
        this.cargarUsuariosServidor();
      },
      error: (err) => {
        this.guardando.set(false);
        const msg = err.error?.message || 'Error al registrar el colaborador';
        this.mostrarToast(msg, 'error');
      },
    });
  }

  guardarEdicionUsuario(): void {
    const user = this.usuarioSeleccionado();
    if (!user) return;

    const nombre = this.formEditar.nombre?.trim();
    const email = this.formEditar.email?.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!nombre || nombre.length < 3) {
      this.mostrarToast('El nombre completo debe tener al menos 3 caracteres', 'error');
      return;
    }
    if (!email || !emailRegex.test(email)) {
      this.mostrarToast('Por favor ingrese un correo electrónico válido', 'error');
      return;
    }
    if (user.id === this.currentUserId() && this.formEditar.rol !== RolUsuario.ADMIN) {
      this.mostrarToast('Por seguridad, no puedes revocar tu propio rol de Administrador', 'error');
      return;
    }

    this.guardando.set(true);
    const payload = {
      nombre,
      email,
      rol: this.formEditar.rol,
    };

    this.http.patch<any>(`${this.baseUrl}/usuarios/${user.id}`, payload).subscribe({
      next: () => {
        this.guardando.set(false);
        this.cerrarModales();
        this.mostrarToast('Datos de empleado actualizados correctamente', 'success');
        this.cargarUsuariosServidor();
      },
      error: (err) => {
        this.guardando.set(false);
        const msg = err.error?.message || 'Error al actualizar el usuario';
        this.mostrarToast(msg, 'error');
      },
    });
  }

  guardarNuevoPassword(): void {
    const user = this.usuarioSeleccionado();
    if (!user || !this.nuevoPassword) return;

    if (this.nuevoPassword.length < 6) {
      this.mostrarToast('La contraseña debe tener al menos 6 caracteres', 'error');
      return;
    }

    this.guardando.set(true);
    this.http.patch<any>(`${this.baseUrl}/usuarios/${user.id}`, { password: this.nuevoPassword }).subscribe({
      next: () => {
        this.guardando.set(false);
        this.cerrarModales();
        this.mostrarToast(`Contraseña de ${user.nombre} actualizada correctamente`, 'success');
      },
      error: (err) => {
        this.guardando.set(false);
        const msg = err.error?.message || 'Error al resetear la contraseña';
        this.mostrarToast(msg, 'error');
      },
    });
  }

  toggleEstado(user: MiembroEquipo): void {
    if (user.id === this.currentUserId()) {
      this.mostrarToast('Por seguridad, no puedes suspender tu propia cuenta activa', 'error');
      return;
    }

    this.http.patch<any>(`${this.baseUrl}/usuarios/${user.id}/toggle-active`, {}).subscribe({
      next: (res) => {
        const estadoActualizado = res.activo !== undefined ? res.activo : !user.activo;
        user.activo = estadoActualizado;
        this.miembros.update((arr) =>
          arr.map((item) => (item.id === user.id ? { ...item, activo: estadoActualizado } : item))
        );
        const texto = estadoActualizado ? 'Cuenta activada' : 'Acceso suspendido';
        this.mostrarToast(`${texto} para ${user.nombre}`, 'success');
      },
      error: (err) => {
        const msg = err.error?.message || 'Error al modificar el estado de la cuenta';
        this.mostrarToast(msg, 'error');
      },
    });
  }

  confirmarEliminarUsuario(): void {
    const user = this.usuarioSeleccionado();
    if (!user) return;

    if (user.id === this.currentUserId()) {
      this.mostrarToast('No puedes dar de baja tu propia cuenta de Administrador', 'error');
      return;
    }

    this.guardando.set(true);
    this.http.delete<any>(`${this.baseUrl}/usuarios/${user.id}`).subscribe({
      next: () => {
        this.guardando.set(false);
        this.cerrarModales();
        this.mostrarToast(`El personal ${user.nombre} ha sido retirado del sistema`, 'success');
        this.cargarUsuariosServidor();
      },
      error: (err) => {
        this.guardando.set(false);
        const msg = err.error?.message || 'Error al dar de baja al usuario';
        this.mostrarToast(msg, 'error');
      },
    });
  }

  mostrarToast(text: string, type: 'success' | 'error'): void {
    this.toast.set({ text, type });
    setTimeout(() => {
      this.toast.set(null);
    }, 3500);
  }
}
