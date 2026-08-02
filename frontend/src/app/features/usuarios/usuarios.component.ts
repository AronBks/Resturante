import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { UploadCloudinaryService } from '../../core/services/upload-cloudinary.service';
import { AuthService } from '../../core/services/auth.service';
import { LucideAngularModule } from 'lucide-angular';

export enum RolUsuario {
  ADMIN = 'ADMIN',
  CAJERO = 'CAJERO',
  CHEF = 'CHEF',
  MESERO = 'MESERO'
}

interface MiembroEquipo {
  id: string;
  staffId: string;
  nombre: string;
  email: string;
  telefono: string;
  rol: RolUsuario;
  activo: boolean;
  ultimoAcceso: string;
  avatarUrl: string;
  permisos?: {
    anularComandas: boolean;
    abrirCaja: boolean;
    gestionarInventario: boolean;
    aplicarDescuentos: boolean;
  };
}

interface PermisosModulo {
  ventas: {
    crearEditarPedidos: boolean;
    aplicarDescuentosCortesias: boolean;
    anularFacturasEmitidas: boolean;
  };
  inventario: {
    gestionStockCritico: boolean;
    ajusteManualInventario: boolean;
  };
  personal: {
    controlAsistencia: boolean;
    editarFichasEmpleados: boolean;
  };
}

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="equipo-container animate-in">
      
      <!-- Top Header & Sub-navigation -->
      <div class="top-nav-bar">
        <div class="nav-left">
          <h1 class="font-playfair page-title">Equipo de Trabajo</h1>
          <div class="sub-nav-tabs">
            <button 
              type="button" 
              class="tab-link" 
              [class.active]="activeTab() === 'personal'" 
              (click)="activeTab.set('personal')"
            >
              Personal Activo
            </button>
            <button 
              type="button" 
              class="tab-link" 
              [class.active]="activeTab() === 'permisos'" 
              (click)="activeTab.set('permisos')"
            >
              Permisos y Roles
            </button>
          </div>
        </div>

        <div class="nav-right">
          <!-- System Status Pill -->
          <div class="system-status-pill">
            <span class="dot-green"></span>
            <span>SYSTEM ACTIVE</span>
          </div>

          <!-- Quick Search -->
          <div class="search-pill-box">
            <lucide-icon name="search" class="search-icon"></lucide-icon>
            <input 
              type="text" 
              [ngModel]="searchQuery()" 
              (ngModelChange)="searchQuery.set($event)"
              placeholder="Buscar personal..." 
              class="search-input"
            />
          </div>

          <!-- Notification Bell -->
          <div class="bell-icon-wrapper" title="Notificaciones de equipo">
            <lucide-icon name="bell" class="bell-icon"></lucide-icon>
            <span class="bell-dot"></span>
          </div>

          <!-- Current Admin Profile Pill -->
          <div class="admin-profile-pill">
            <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" alt="Admin Avatar" class="profile-avatar" />
            <div class="profile-meta">
              <span class="profile-name font-playfair">Admin Tukuypaj</span>
              <span class="profile-role">ROOT ACCESS</span>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 1: PERSONAL ACTIVO VIEW -->
      @if (activeTab() === 'personal') {
        
        <!-- KPI Summary Cards Bar -->
        <div class="metrics-cards-grid">
          
          <!-- Card 1: TOTAL STAFF -->
          <div class="metric-card glass-panel">
            <div class="card-top-row">
              <div class="icon-circle">
                <lucide-icon name="users" class="card-icon"></lucide-icon>
              </div>
              <span class="badge-pill muted">+2 este mes</span>
            </div>
            <div class="card-body">
              <span class="metric-lbl">TOTAL STAFF</span>
              <div class="metric-num font-playfair">{{ totalStaffCount() }}</div>
            </div>
          </div>

          <!-- Card 2: ACTIVOS AHORA -->
          <div class="metric-card glass-panel">
            <div class="card-top-row">
              <div class="icon-circle">
                <lucide-icon name="user-check" class="card-icon"></lucide-icon>
              </div>
              <span class="badge-pill success">
                <span class="dot-live"></span> En Turno
              </span>
            </div>
            <div class="card-body">
              <span class="metric-lbl">ACTIVOS AHORA</span>
              <div class="metric-num font-playfair">{{ activosAhoraCount() }}</div>
            </div>
          </div>

          <!-- Card 3: INVITACIONES -->
          <div class="metric-card glass-panel">
            <div class="card-top-row">
              <div class="icon-circle">
                <lucide-icon name="mail" class="card-icon"></lucide-icon>
              </div>
              <span class="badge-pill muted">Por expirar</span>
            </div>
            <div class="card-body">
              <span class="metric-lbl">INVITACIONES</span>
              <div class="metric-num font-playfair">03</div>
            </div>
          </div>

          <!-- Card 4: AÑADIR NUEVO MIEMBRO (Gold Primary Action Card) -->
          <div class="action-card-gold" (click)="abrirModalCrear()">
            <div class="action-icon-circle">
              <lucide-icon name="user-plus" class="action-icon"></lucide-icon>
            </div>
            <div class="action-text-group">
              <span class="action-title">AÑADIR NUEVO MIEMBRO</span>
              <span class="action-sub">Gestionar accesos del sistema</span>
            </div>
          </div>

        </div>

        <!-- Filters & Actions Header Bar -->
        <div class="filters-bar-wrapper glass-panel">
          <div class="filters-left">
            <span class="filter-lbl">Filtrar por:</span>
            
            <select [ngModel]="selectedRole()" (ngModelChange)="selectedRole.set($event)" class="filter-select">
              <option value="TODOS">Roles (Todos)</option>
              <option value="ADMIN">Administrador</option>
              <option value="CAJERO">Cajero</option>
              <option value="CHEF">Jefe de Cocina</option>
              <option value="MESERO">Mesero</option>
            </select>

            <select [ngModel]="selectedEstado()" (ngModelChange)="selectedEstado.set($event)" class="filter-select">
              <option value="TODOS">Estado (Todos)</option>
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
            </select>
          </div>

          <div class="filters-right">
            <button type="button" class="icon-btn-tool" title="Exportar reporte" (click)="exportarReporte()">
              <lucide-icon name="download" class="tool-icon"></lucide-icon>
            </button>
            <button type="button" class="icon-btn-tool" title="Imprimir lista" (click)="imprimirLista()">
              <lucide-icon name="printer" class="tool-icon"></lucide-icon>
            </button>
          </div>
        </div>

        <!-- Main Team Table Panel -->
        <div class="table-panel-card glass-panel">
          <div class="table-scroll-wrapper scrollbar-custom">
            <table class="equipo-table">
              <thead>
                <tr>
                  <th>USUARIO</th>
                  <th>CONTACTO</th>
                  <th>ROL DEL SISTEMA</th>
                  <th>ESTADO</th>
                  <th>ÚLTIMO ACCESO</th>
                  <th class="text-right">ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                @for (user of filteredMiembros(); track user.id) {
                  <tr [class.row-inactive]="!user.activo">
                    <!-- Usuario Column -->
                    <td class="user-col">
                      <div class="user-avatar-wrapper">
                        <img [src]="user.avatarUrl" [alt]="user.nombre" class="user-avatar-img" />
                        <span class="user-status-dot" [class.online]="user.activo"></span>
                      </div>
                      <div class="user-info">
                        <span class="user-name font-playfair">{{ user.nombre }}</span>
                        <span class="user-id-code">{{ user.staffId }}</span>
                      </div>
                    </td>

                    <!-- Contacto Column -->
                    <td class="contacto-col">
                      <span class="user-email">{{ user.email }}</span>
                      <span class="user-phone">{{ user.telefono }}</span>
                    </td>

                    <!-- Rol del Sistema Column -->
                    <td>
                      <span class="role-badge-pill" [ngClass]="getRoleBadgeClass(user.rol)">
                        {{ getRolLabel(user.rol) }}
                      </span>
                    </td>

                    <!-- Estado Column -->
                    <td>
                      <div class="status-indicator-pill" [class.activo]="user.activo">
                        <span class="indicator-dot"></span>
                        <span>{{ user.activo ? 'Activo' : 'Inactivo' }}</span>
                      </div>
                    </td>

                    <!-- Último Acceso Column -->
                    <td class="access-col">
                      <span class="time-text">{{ user.ultimoAcceso }}</span>
                    </td>

                    <!-- Acciones Column -->
                    <td class="actions-col text-right">
                      <button type="button" class="btn-more-options" (click)="toggleEstado(user)" title="Cambiar estado">
                        <lucide-icon name="more-vertical" class="icon-xs"></lucide-icon>
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6" class="empty-table-msg">
                      No se encontraron miembros del equipo con los filtros seleccionados.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Table Pagination Footer -->
          <div class="table-pagination-footer">
            <div class="pagination-info">
              Mostrando <strong>1-{{ filteredMiembros().length }}</strong> de <strong>{{ totalStaffCount() }}</strong> miembros
            </div>
            <div class="pagination-controls">
              <button type="button" class="pag-btn">&lt;</button>
              <button type="button" class="pag-btn active">1</button>
              <button type="button" class="pag-btn">2</button>
              <button type="button" class="pag-btn">3</button>
              <button type="button" class="pag-btn">&gt;</button>
            </div>
          </div>
        </div>

        <!-- Bottom Visual System Reference Card -->
        <div class="system-reference-card glass-panel">
          <div class="ref-content">
            <h3 class="font-playfair ref-title">Referencia Visual de Sistema</h3>
            <p class="ref-sub">Consolidación de roles y flujos operativos basados en la arquitectura premium de Tukuypaj.</p>
          </div>
        </div>

      }

      <!-- TAB 2: PERMISOS Y ROLES VIEW -->
      @if (activeTab() === 'permisos') {
        <div class="permisos-view-container animate-fade-in">
          
          <!-- Access Management Header Row -->
          <div class="access-header-row">
            <div class="access-title-group">
              <h2 class="font-playfair section-title">Gestión de Acceso</h2>
              <p class="section-sub">Define qué acciones puede realizar cada miembro de tu equipo según su rango.</p>
            </div>
            <button type="button" class="btn-save-gold-header" (click)="guardarPermisos()">
              <lucide-icon name="check" class="icon-xs"></lucide-icon>
              Guardar Cambios
            </button>
          </div>

          <!-- 2 Column Layout: Roles List vs Permission Modules Grid -->
          <div class="permisos-grid-layout">
            
            <!-- Left Column: ROLES DEL SISTEMA Cards -->
            <div class="roles-sidebar-col">
              <div class="roles-card-box glass-panel">
                <span class="sidebar-lbl-gold">ROLES DEL SISTEMA</span>

                <div class="roles-list-wrapper">
                  
                  <!-- ADMIN Card -->
                  <div 
                    class="role-item-card" 
                    [class.active]="selectedRolePerms() === RolUsuario.ADMIN"
                    (click)="selectedRolePerms.set(RolUsuario.ADMIN)"
                  >
                    <div class="role-icon-box gold">
                      <lucide-icon name="shield" class="r-icon"></lucide-icon>
                    </div>
                    <div class="role-meta">
                      <span class="r-title font-playfair">Administrador</span>
                      <span class="r-desc">Acceso Total</span>
                    </div>
                    <div class="role-user-count">
                      <span class="count-num">2</span>
                      <span class="count-lbl">USUARIOS</span>
                    </div>
                  </div>

                  <!-- CAJERO Card -->
                  <div 
                    class="role-item-card" 
                    [class.active]="selectedRolePerms() === RolUsuario.CAJERO"
                    (click)="selectedRolePerms.set(RolUsuario.CAJERO)"
                  >
                    <div class="role-icon-box blue">
                      <lucide-icon name="landmark" class="r-icon"></lucide-icon>
                    </div>
                    <div class="role-meta">
                      <span class="r-title font-playfair">Cajero</span>
                      <span class="r-desc">Ventas y Cierres</span>
                    </div>
                    <div class="role-user-count">
                      <span class="count-num">4</span>
                      <span class="count-lbl">USUARIOS</span>
                    </div>
                  </div>

                  <!-- CHEF Card -->
                  <div 
                    class="role-item-card" 
                    [class.active]="selectedRolePerms() === RolUsuario.CHEF"
                    (click)="selectedRolePerms.set(RolUsuario.CHEF)"
                  >
                    <div class="role-icon-box green">
                      <lucide-icon name="utensils-crossed" class="r-icon"></lucide-icon>
                    </div>
                    <div class="role-meta">
                      <span class="r-title font-playfair">Chef</span>
                      <span class="r-desc">Pedidos e Inventario</span>
                    </div>
                    <div class="role-user-count">
                      <span class="count-num">3</span>
                      <span class="count-lbl">USUARIOS</span>
                    </div>
                  </div>

                  <!-- MESERO Card -->
                  <div 
                    class="role-item-card" 
                    [class.active]="selectedRolePerms() === RolUsuario.MESERO"
                    (click)="selectedRolePerms.set(RolUsuario.MESERO)"
                  >
                    <div class="role-icon-box purple">
                      <lucide-icon name="users" class="r-icon"></lucide-icon>
                    </div>
                    <div class="role-meta">
                      <span class="r-title font-playfair">Mesero</span>
                      <span class="r-desc">Atención Mesas</span>
                    </div>
                    <div class="role-user-count">
                      <span class="count-num">12</span>
                      <span class="count-lbl">USUARIOS</span>
                    </div>
                  </div>

                </div>

                <!-- Add New Role Dotted Button -->
                <button type="button" class="btn-add-role-dashed" (click)="abrirModalCrear()">
                  <lucide-icon name="plus" class="icon-xs"></lucide-icon>
                  Añadir Nuevo Rol
                </button>

              </div>

              <!-- Banner Card: Tukuypaj Experience -->
              <div class="banner-card-experience glass-panel">
                <div class="exp-content">
                  <h4 class="font-playfair exp-title">Tukuypaj Experience</h4>
                  <span class="exp-sub">La excelencia en cada detalle</span>
                </div>
              </div>
            </div>

            <!-- Right Column: PERMISSIONS MODULES -->
            <div class="permissions-content-col glass-panel">
              
              <!-- Search & Expand Bar -->
              <div class="perm-search-bar">
                <div class="perm-input-box">
                  <lucide-icon name="search" class="p-search-icon"></lucide-icon>
                  <input 
                    type="text" 
                    placeholder="Buscar permiso por nombre o categoría..." 
                    class="p-search-input"
                  />
                </div>
                <div class="expand-btn-box">
                  <span>Expandir todo</span>
                  <lucide-icon name="chevron-right" class="icon-rotate-down"></lucide-icon>
                </div>
              </div>

              <!-- Permission Modules List -->
              <div class="modules-stack">
                
                <!-- MODULE 1: VENTAS -->
                <div class="module-group">
                  <div class="module-title-row">
                    <lucide-icon name="wallet" class="mod-icon-gold"></lucide-icon>
                    <h3 class="mod-title">MÓDULO DE VENTAS</h3>
                  </div>

                  <div class="permission-item-row">
                    <div class="perm-info">
                      <span class="perm-name">Crear y Editar Pedidos</span>
                      <span class="perm-desc">Permite abrir mesas, añadir productos y modificar comandas activas.</span>
                    </div>
                    <label class="switch">
                      <input type="checkbox" [(ngModel)]="currentRolePerms.ventas.crearEditarPedidos" />
                      <span class="slider round"></span>
                    </label>
                  </div>

                  <div class="permission-item-row">
                    <div class="perm-info">
                      <span class="perm-name">Aplicar Descuentos y Cortesías</span>
                      <span class="perm-desc">Capacidad para reducir el monto de la factura o invitar productos específicos.</span>
                    </div>
                    <label class="switch">
                      <input type="checkbox" [(ngModel)]="currentRolePerms.ventas.aplicarDescuentosCortesias" />
                      <span class="slider round"></span>
                    </label>
                  </div>

                  <div class="permission-item-row">
                    <div class="perm-info">
                      <span class="perm-name">Anular Facturas Emitidas</span>
                      <span class="perm-desc">Acceso sensible para revertir transacciones finalizadas en el sistema fiscal.</span>
                    </div>
                    <label class="switch">
                      <input type="checkbox" [(ngModel)]="currentRolePerms.ventas.anularFacturasEmitidas" />
                      <span class="slider round"></span>
                    </label>
                  </div>
                </div>

                <!-- MODULE 2: INVENTARIO -->
                <div class="module-group">
                  <div class="module-title-row">
                    <lucide-icon name="grid" class="mod-icon-gold"></lucide-icon>
                    <h3 class="mod-title">MÓDULO DE INVENTARIO</h3>
                  </div>

                  <div class="permission-item-row">
                    <div class="perm-info">
                      <span class="perm-name">Gestión de Stock Crítico</span>
                      <span class="perm-desc">Ver niveles de insumos y recibir alertas automáticas de reposición.</span>
                    </div>
                    <label class="switch">
                      <input type="checkbox" [(ngModel)]="currentRolePerms.inventario.gestionStockCritico" />
                      <span class="slider round"></span>
                    </label>
                  </div>

                  <div class="permission-item-row">
                    <div class="perm-info">
                      <span class="perm-name">Ajuste Manual de Inventario</span>
                      <span class="perm-desc">Registrar mermas, desperdicios o ingresos manuales de productos.</span>
                    </div>
                    <label class="switch">
                      <input type="checkbox" [(ngModel)]="currentRolePerms.inventario.ajusteManualInventario" />
                      <span class="slider round"></span>
                    </label>
                  </div>
                </div>

                <!-- MODULE 3: PERSONAL -->
                <div class="module-group">
                  <div class="module-title-row">
                    <lucide-icon name="users" class="mod-icon-gold"></lucide-icon>
                    <h3 class="mod-title">MÓDULO DE PERSONAL</h3>
                  </div>

                  <div class="permission-item-row">
                    <div class="perm-info">
                      <span class="perm-name">Control de Asistencia</span>
                      <span class="perm-desc">Revisar registros de entrada y salida del personal operativo.</span>
                    </div>
                    <label class="switch">
                      <input type="checkbox" [(ngModel)]="currentRolePerms.personal.controlAsistencia" />
                      <span class="slider round"></span>
                    </label>
                  </div>

                  <div class="permission-item-row">
                    <div class="perm-info">
                      <span class="perm-name">Editar Fichas de Empleados</span>
                      <span class="perm-desc">Modificar salarios, roles o información personal de contacto.</span>
                    </div>
                    <label class="switch">
                      <input type="checkbox" [(ngModel)]="currentRolePerms.personal.editarFichasEmpleados" />
                      <span class="slider round"></span>
                    </label>
                  </div>
                </div>

              </div>

              <!-- Footer Summary Stats Bar -->
              <div class="permissions-footer-bar">
                <div class="stats-left">
                  <div class="stat-box">
                    <span class="s-lbl">ACTIVOS</span>
                    <span class="s-val font-playfair">18</span>
                  </div>
                  <div class="stat-box">
                    <span class="s-lbl">RESTRINGIDOS</span>
                    <span class="s-val font-playfair">04</span>
                  </div>
                </div>

                <div class="actions-right">
                  <button type="button" class="btn-cancel-perm" (click)="cancelarPermisos()">Cancelar</button>
                  <button type="button" class="btn-apply-gold" (click)="guardarPermisos()">
                    Aplicar a {{ getRolLabel(selectedRolePerms()) }}
                  </button>
                </div>
              </div>

            </div>

          </div>

        </div>
      }

      <!-- MODAL AVANZADO: AÑADIR NUEVO MIEMBRO -->
      @if (showModal()) {
        <div class="modal-backdrop animate-fade-in" (click)="cerrarModal()">
          <div class="modal-card-advanced glass-panel" (click)="$event.stopPropagation()">
            
            <!-- Modal Header -->
            <div class="modal-adv-header">
              <div class="header-title-box">
                <lucide-icon name="user-plus" class="modal-icon-gold"></lucide-icon>
                <h3 class="font-playfair">Añadir Nuevo Miembro</h3>
              </div>
              <button type="button" class="btn-close-adv" (click)="cerrarModal()">&times;</button>
            </div>

            <!-- Modal Body -->
            <div class="modal-adv-body scrollbar-custom">
              
              <!-- Section 1: Avatar & Basic Info -->
              <div class="avatar-info-row">
                <!-- Avatar Upload Zone -->
                <div class="avatar-upload-wrapper">
                  <div class="avatar-upload-box" (click)="triggerAvatarFileInput()">
                    @if (isUploadingAvatar()) {
                      <div class="avatar-spinner">
                        <div class="micro-spinner"></div>
                      </div>
                    } @else if (nuevoMiembro.avatarUrl) {
                      <img [src]="nuevoMiembro.avatarUrl" alt="Avatar Previo" class="avatar-prev-img" />
                    } @else {
                      <div class="avatar-placeholder">
                        <lucide-icon name="camera" class="cam-icon"></lucide-icon>
                        <span class="up-lbl">Subir Avatar</span>
                      </div>
                    }
                    <input type="file" id="avatar-input" accept="image/*" style="display: none" (change)="uploadAvatar($event)" />
                  </div>
                  <span class="subtext-fmt">FORMATOS: JPG, PNG • MÁX 2MB</span>
                </div>

                <!-- Right Inputs: Nombre & Email -->
                <div class="inputs-col-right">
                  <div class="form-group-adv">
                    <label>NOMBRE COMPLETO</label>
                    <input 
                      type="text" 
                      [(ngModel)]="nuevoMiembro.nombre" 
                      placeholder="Ej. Ana Belén Rojas" 
                      class="adv-input"
                    />
                  </div>

                  <div class="form-group-adv">
                    <label>CORREO ELECTRÓNICO</label>
                    <input 
                      type="email" 
                      [(ngModel)]="nuevoMiembro.email" 
                      placeholder="ejemplo@tukuypaj.com" 
                      class="adv-input"
                    />
                  </div>
                </div>
              </div>

              <!-- Section 2: Contact & Initial Status -->
              <div class="row-2col-adv">
                <div class="form-group-adv">
                  <label>TELÉFONO DE CONTACTO</label>
                  <input 
                    type="text" 
                    [(ngModel)]="nuevoMiembro.telefono" 
                    placeholder="+591 700 00000" 
                    class="adv-input"
                  />
                </div>

                <div class="form-group-adv">
                  <label>ESTADO INICIAL</label>
                  <select [(ngModel)]="nuevoMiembro.activo" class="adv-select">
                    <option [ngValue]="true">Activo (Acceso Inmediato)</option>
                    <option [ngValue]="false">Inactivo (Sin Acceso)</option>
                  </select>
                </div>
              </div>

              <!-- Section 3: Visual Role Selection Cards -->
              <div class="section-block-adv">
                <label class="block-lbl-gold">ROL DEL SISTEMA</label>
                <div class="roles-cards-grid">
                  
                  <div 
                    class="role-card-select" 
                    [class.selected]="nuevoMiembro.rol === RolUsuario.ADMIN"
                    (click)="seleccionarRol(RolUsuario.ADMIN)"
                  >
                    <lucide-icon name="shield" class="r-icon"></lucide-icon>
                    <span class="r-name">ADMIN</span>
                  </div>

                  <div 
                    class="role-card-select" 
                    [class.selected]="nuevoMiembro.rol === RolUsuario.CHEF"
                    (click)="seleccionarRol(RolUsuario.CHEF)"
                  >
                    <lucide-icon name="utensils-crossed" class="r-icon"></lucide-icon>
                    <span class="r-name">CHEF</span>
                  </div>

                  <div 
                    class="role-card-select" 
                    [class.selected]="nuevoMiembro.rol === RolUsuario.CAJERO"
                    (click)="seleccionarRol(RolUsuario.CAJERO)"
                  >
                    <lucide-icon name="landmark" class="r-icon"></lucide-icon>
                    <span class="r-name">CAJERO</span>
                  </div>

                  <div 
                    class="role-card-select" 
                    [class.selected]="nuevoMiembro.rol === RolUsuario.MESERO"
                    (click)="seleccionarRol(RolUsuario.MESERO)"
                  >
                    <lucide-icon name="users" class="r-icon"></lucide-icon>
                    <span class="r-name">MESERO</span>
                  </div>

                </div>
              </div>

              <!-- Section 4: Quick Permissions (Permisos Rápidos) -->
              <div class="section-block-adv">
                <div class="permisos-header-lbl">
                  <lucide-icon name="shield" class="shield-mini"></lucide-icon>
                  <span>PERMISOS RÁPIDOS</span>
                </div>

                <div class="permisos-cards-grid">
                  <div class="permiso-card">
                    <div class="p-text">
                      <span class="p-title">Puede anular comandas</span>
                      <span class="p-desc">Permite borrar platos ya pedidos</span>
                    </div>
                    <label class="switch switch-mini">
                      <input 
                        type="checkbox" 
                        [(ngModel)]="nuevoMiembro.permisos.anularComandas" 
                      />
                      <span class="slider round"></span>
                    </label>
                  </div>

                  <div class="permiso-card">
                    <div class="p-text">
                      <span class="p-title">Puede abrir caja</span>
                      <span class="p-desc">Acceso a arqueo y efectivo</span>
                    </div>
                    <label class="switch switch-mini">
                      <input 
                        type="checkbox" 
                        [(ngModel)]="nuevoMiembro.permisos.abrirCaja" 
                      />
                      <span class="slider round"></span>
                    </label>
                  </div>

                  <div class="permiso-card">
                    <div class="p-text">
                      <span class="p-title">Gestionar inventario</span>
                      <span class="p-desc">Edición de stock e insumos</span>
                    </div>
                    <label class="switch switch-mini">
                      <input 
                        type="checkbox" 
                        [(ngModel)]="nuevoMiembro.permisos.gestionarInventario" 
                      />
                      <span class="slider round"></span>
                    </label>
                  </div>

                  <div class="permiso-card">
                    <div class="p-text">
                      <span class="p-title">Aplicar descuentos</span>
                      <span class="p-desc">Modificar precios en cobro</span>
                    </div>
                    <label class="switch switch-mini">
                      <input 
                        type="checkbox" 
                        [(ngModel)]="nuevoMiembro.permisos.aplicarDescuentos" 
                      />
                      <span class="slider round"></span>
                    </label>
                  </div>
                </div>
              </div>

            </div>

            <!-- Modal Footer Actions -->
            <div class="modal-adv-footer">
              <button type="button" class="btn-cancel-adv" (click)="cerrarModal()">
                Cancelar
              </button>
              <button type="button" class="btn-save-gold-adv" (click)="guardarMiembro()">
                <lucide-icon name="check" class="icon-sm"></lucide-icon>
                Guardar Miembro
              </button>
            </div>

          </div>
        </div>
      }

    </div>
  `,
  styles: [`
    .equipo-container {
      display: flex;
      flex-direction: column;
      gap: 22px;
      padding-bottom: 40px;
    }

    .font-playfair {
      font-family: 'Playfair Display', Georgia, serif !important;
    }

    /* ── Top Header & Navigation ── */
    .top-nav-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);

      .nav-left {
        display: flex;
        align-items: center;
        gap: 28px;

        .page-title {
          font-size: 1.8rem;
          font-weight: 700;
          color: #f3ebe2;
        }

        .sub-nav-tabs {
          display: flex;
          align-items: center;
          gap: 16px;

          .tab-link {
            background: transparent;
            border: none;
            color: #8c8277;
            font-size: 0.85rem;
            font-weight: 600;
            padding: 8px 4px;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            transition: all 0.2s ease;

            &:hover {
              color: #f3ebe2;
            }

            &.active {
              color: #eab308;
              border-bottom-color: #eab308;
              font-weight: 700;
            }
          }
        }
      }

      .nav-right {
        display: flex;
        align-items: center;
        gap: 14px;
      }
    }

    .system-status-pill {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(74, 222, 128, 0.25);
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.68rem;
      font-weight: 800;
      color: #4ade80;
      letter-spacing: 0.5px;

      .dot-green {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #4ade80;
        box-shadow: 0 0 6px rgba(74, 222, 128, 0.6);
      }
    }

    .search-pill-box {
      position: relative;
      display: flex;
      align-items: center;

      .search-icon {
        position: absolute;
        left: 12px;
        width: 14px;
        height: 14px;
        color: #8c8277;
      }

      .search-input {
        background: rgba(18, 14, 11, 0.8);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 20px;
        padding: 6px 14px 6px 34px;
        color: #f3ebe2;
        font-size: 0.8rem;
        width: 180px;
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

    .bell-icon-wrapper {
      position: relative;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;

      .bell-icon {
        width: 16px;
        height: 16px;
        color: #d6cbbf;
      }

      .bell-dot {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #ef4444;
      }
    }

    .admin-profile-pill {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 4px 12px 4px 6px;
      border-radius: 20px;

      .profile-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        object-fit: cover;
      }

      .profile-meta {
        display: flex;
        flex-direction: column;

        .profile-name {
          font-size: 0.78rem;
          font-weight: 700;
          color: #f3ebe2;
          line-height: 1.1;
        }

        .profile-role {
          font-size: 0.6rem;
          font-weight: 800;
          color: #8c8277;
          letter-spacing: 0.5px;
        }
      }
    }

    /* ── Metrics Cards Grid ── */
    .metrics-cards-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;

      @media (max-width: 1024px) {
        grid-template-columns: repeat(2, 1fr);
      }

      @media (max-width: 600px) {
        grid-template-columns: 1fr;
      }
    }

    .metric-card {
      background: #15100c;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;

      .card-top-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;

        .icon-circle {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: rgba(212, 168, 83, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;

          .card-icon {
            width: 18px;
            height: 18px;
            color: #d4af37;
          }
        }

        .badge-pill {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 10px;

          &.muted {
            background: rgba(255, 255, 255, 0.05);
            color: #8c8277;
          }

          &.success {
            background: rgba(34, 197, 94, 0.1);
            color: #4ade80;
            display: flex;
            align-items: center;
            gap: 4px;

            .dot-live {
              width: 5px;
              height: 5px;
              border-radius: 50%;
              background: #4ade80;
            }
          }
        }
      }

      .card-body {
        .metric-lbl {
          font-size: 0.65rem;
          font-weight: 700;
          color: #8c8277;
          letter-spacing: 0.8px;
          text-transform: uppercase;
        }

        .metric-num {
          font-size: 2.1rem;
          font-weight: 700;
          color: #f3ebe2;
          line-height: 1.1;
          margin-top: 2px;
        }
      }
    }

    /* Action Card Gold Button */
    .action-card-gold {
      background: linear-gradient(135deg, #eab308 0%, #ca8a04 100%);
      border-radius: 12px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 14px;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(234, 179, 8, 0.25);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

      &:hover {
        background: linear-gradient(135deg, #facc15 0%, #eab308 100%);
        transform: translateY(-2px);
        box-shadow: 0 6px 22px rgba(234, 179, 8, 0.4);
      }

      &:active {
        transform: translateY(0);
      }

      .action-icon-circle {
        width: 42px;
        height: 42px;
        border-radius: 10px;
        background: rgba(20, 15, 11, 0.18);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;

        .action-icon {
          width: 22px;
          height: 22px;
          color: #140f0b;
        }
      }

      .action-text-group {
        display: flex;
        flex-direction: column;

        .action-title {
          font-size: 0.82rem;
          font-weight: 800;
          color: #140f0b;
          letter-spacing: 0.5px;
          line-height: 1.2;
        }

        .action-sub {
          font-size: 0.68rem;
          font-weight: 600;
          color: rgba(20, 15, 11, 0.8);
          margin-top: 2px;
        }
      }
    }

    /* ── Filters Bar ── */
    .filters-bar-wrapper {
      background: rgba(20, 16, 12, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 10px;
      padding: 12px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;

      .filters-left {
        display: flex;
        align-items: center;
        gap: 12px;

        .filter-lbl {
          font-size: 0.78rem;
          color: #8c8277;
          font-weight: 600;
        }

        .filter-select {
          background: #120e0b;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          padding: 6px 12px;
          color: #f3ebe2;
          font-size: 0.78rem;
          outline: none;

          &:focus {
            border-color: #d4af37;
          }
        }
      }

      .filters-right {
        display: flex;
        align-items: center;
        gap: 8px;

        .icon-btn-tool {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #8c8277;
          width: 32px;
          height: 32px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;

          &:hover {
            color: #f3ebe2;
            border-color: rgba(255, 255, 255, 0.2);
          }

          .tool-icon {
            width: 15px;
            height: 15px;
          }
        }
      }
    }

    /* ── Team Table ── */
    .table-panel-card {
      background: #140f0b;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      overflow: hidden;
    }

    .table-scroll-wrapper {
      overflow-x: auto;
    }

    .equipo-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;

      th {
        font-size: 0.68rem;
        font-weight: 700;
        color: #8c8277;
        letter-spacing: 0.8px;
        text-transform: uppercase;
        padding: 14px 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(255, 255, 255, 0.015);
      }

      td {
        padding: 14px 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        vertical-align: middle;
      }

      tr.row-inactive {
        opacity: 0.55;
      }

      .text-right {
        text-align: right;
      }
    }

    .user-col {
      display: flex;
      align-items: center;
      gap: 12px;

      .user-avatar-wrapper {
        position: relative;

        .user-avatar-img {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          object-fit: cover;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .user-status-dot {
          position: absolute;
          bottom: 2px;
          right: 0;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #6b6257;
          border: 2px solid #140f0b;

          &.online {
            background: #4ade80;
          }
        }
      }

      .user-info {
        display: flex;
        flex-direction: column;

        .user-name {
          font-size: 0.95rem;
          font-weight: 700;
          color: #f3ebe2;
          line-height: 1.2;
        }

        .user-id-code {
          font-size: 0.65rem;
          color: #8c8277;
          font-weight: 600;
        }
      }
    }

    .contacto-col {
      display: flex;
      flex-direction: column;

      .user-email {
        font-size: 0.8rem;
        color: #d6cbbf;
      }

      .user-phone {
        font-size: 0.68rem;
        color: #8c8277;
      }
    }

    .role-badge-pill {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;

      &.badge-admin {
        background: rgba(212, 168, 83, 0.1);
        border: 1px solid rgba(212, 168, 83, 0.4);
        color: #d4af37;
      }

      &.badge-cajero {
        background: rgba(59, 130, 246, 0.1);
        border: 1px solid rgba(59, 130, 246, 0.4);
        color: #60a5fa;
      }

      &.badge-chef {
        background: rgba(16, 185, 129, 0.1);
        border: 1px solid rgba(16, 185, 129, 0.4);
        color: #34d399;
      }

      &.badge-mesero {
        background: rgba(139, 92, 246, 0.1);
        border: 1px solid rgba(139, 92, 246, 0.4);
        color: #c084fc;
      }
    }

    .status-indicator-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.78rem;
      color: #8c8277;

      .indicator-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #8c8277;
      }

      &.activo {
        color: #f3ebe2;

        .indicator-dot {
          background: #4ade80;
          box-shadow: 0 0 6px rgba(74, 222, 128, 0.6);
        }
      }
    }

    .access-col {
      .time-text {
        font-size: 0.78rem;
        font-style: italic;
        color: #8c8277;
      }
    }

    .btn-more-options {
      background: transparent;
      border: none;
      color: #8c8277;
      cursor: pointer;
      padding: 6px;
      border-radius: 4px;
      transition: color 0.2s;

      &:hover {
        color: #f3ebe2;
        background: rgba(255, 255, 255, 0.05);
      }
    }

    .empty-table-msg {
      text-align: center;
      color: #8c8277;
      padding: 30px;
      font-size: 0.85rem;
    }

    .table-pagination-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);

      .pagination-info {
        font-size: 0.75rem;
        color: #8c8277;
        strong { color: #f3ebe2; }
      }

      .pagination-controls {
        display: flex;
        gap: 6px;

        .pag-btn {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #8c8277;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;

          &:hover {
            color: #f3ebe2;
            border-color: rgba(255, 255, 255, 0.2);
          }

          &.active {
            background: #eab308;
            color: #140f0b;
            border-color: #eab308;
          }
        }
      }
    }

    .system-reference-card {
      background: #120d09;
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      padding: 22px 26px;

      .ref-title {
        font-size: 1.35rem;
        font-weight: 700;
        color: #f3ebe2;
        margin-bottom: 4px;
      }

      .ref-sub {
        font-size: 0.82rem;
        color: #8c8277;
      }
    }

    /* ── TAB 2: PERMISOS Y ROLES VIEW ── */
    .permisos-view-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .access-header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;

      .access-title-group {
        display: flex;
        flex-direction: column;
        gap: 4px;

        .section-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #f3ebe2;
        }

        .section-sub {
          font-size: 0.85rem;
          color: #8c8277;
        }
      }

      .btn-save-gold-header {
        background: #eab308;
        color: #140f0b;
        border: none;
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 0.85rem;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 4px 14px rgba(234, 179, 8, 0.2);
        transition: all 0.2s ease;

        &:hover {
          background: #facc15;
          transform: translateY(-1px);
        }
      }
    }

    .permisos-grid-layout {
      display: grid;
      grid-template-columns: 310px 1fr;
      gap: 20px;

      @media (max-width: 900px) {
        grid-template-columns: 1fr;
      }
    }

    /* Roles Sidebar */
    .roles-sidebar-col {
      display: flex;
      flex-direction: column;
      gap: 16px;

      .roles-card-box {
        background: #140f0b;
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 12px;
        padding: 18px;
        display: flex;
        flex-direction: column;
        gap: 14px;

        .sidebar-lbl-gold {
          font-size: 0.68rem;
          font-weight: 700;
          color: #d4af37;
          letter-spacing: 0.8px;
          text-transform: uppercase;
        }

        .roles-list-wrapper {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .role-item-card {
          background: #0d0a07;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          transition: all 0.2s ease;

          .role-icon-box {
            width: 36px;
            height: 36px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;

            &.gold { background: rgba(212, 168, 83, 0.12); color: #d4af37; }
            &.blue { background: rgba(59, 130, 246, 0.12); color: #60a5fa; }
            &.green { background: rgba(16, 185, 129, 0.12); color: #34d399; }
            &.purple { background: rgba(139, 92, 246, 0.12); color: #c084fc; }

            .r-icon { width: 18px; height: 18px; }
          }

          .role-meta {
            flex: 1;
            display: flex;
            flex-direction: column;

            .r-title {
              font-size: 0.9rem;
              font-weight: 700;
              color: #f3ebe2;
              line-height: 1.2;
            }

            .r-desc {
              font-size: 0.68rem;
              color: #8c8277;
            }
          }

          .role-user-count {
            display: flex;
            flex-direction: column;
            align-items: flex-end;

            .count-num {
              font-size: 0.95rem;
              font-weight: 700;
              color: #f3ebe2;
            }

            .count-lbl {
              font-size: 0.58rem;
              font-weight: 800;
              color: #8c8277;
              letter-spacing: 0.5px;
            }
          }

          &:hover {
            border-color: rgba(212, 168, 83, 0.3);
          }

          &.active {
            background: rgba(212, 168, 83, 0.1);
            border-color: #d4af37;
            box-shadow: 0 0 14px rgba(212, 168, 83, 0.15);
          }
        }

        .btn-add-role-dashed {
          background: transparent;
          border: 1px dashed rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          padding: 10px;
          color: #8c8277;
          font-size: 0.8rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.2s ease;

          &:hover {
            border-color: #d4af37;
            color: #d4af37;
          }
        }
      }

      .banner-card-experience {
        background: url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&auto=format&fit=crop&q=80') center/cover no-repeat;
        border-radius: 12px;
        height: 130px;
        position: relative;
        overflow: hidden;

        &:before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(16, 12, 8, 0.92) 20%, rgba(16, 12, 8, 0.4));
        }

        .exp-content {
          position: relative;
          z-index: 1;
          padding: 16px;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;

          .exp-title {
            font-size: 1.15rem;
            font-weight: 700;
            color: #d4af37;
          }

          .exp-sub {
            font-size: 0.72rem;
            color: #d6cbbf;
            font-style: italic;
          }
        }
      }
    }

    /* Permissions Content Column */
    .permissions-content-col {
      background: #140f0b;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 20px;

      .perm-search-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        padding-bottom: 14px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);

        .perm-input-box {
          flex: 1;
          position: relative;
          display: flex;
          align-items: center;

          .p-search-icon {
            position: absolute;
            left: 12px;
            width: 14px;
            height: 14px;
            color: #8c8277;
          }

          .p-search-input {
            width: 100%;
            background: #0d0a07;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 20px;
            padding: 7px 14px 7px 34px;
            color: #f3ebe2;
            font-size: 0.8rem;
            outline: none;

            &:focus { border-color: #d4af37; }
            &::placeholder { color: #554c42; }
          }
        }

        .expand-btn-box {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          color: #8c8277;
          cursor: pointer;

          .icon-rotate-down {
            width: 14px;
            height: 14px;
            transform: rotate(90deg);
          }
        }
      }

      .modules-stack {
        display: flex;
        flex-direction: column;
        gap: 22px;
      }

      .module-group {
        display: flex;
        flex-direction: column;
        gap: 12px;

        .module-title-row {
          display: flex;
          align-items: center;
          gap: 8px;

          .mod-icon-gold {
            width: 16px;
            height: 16px;
            color: #d4af37;
          }

          .mod-title {
            font-size: 0.75rem;
            font-weight: 800;
            color: #d4af37;
            letter-spacing: 0.8px;
            text-transform: uppercase;
          }
        }

        .permission-item-row {
          background: #0d0a07;
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 8px;
          padding: 12px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;

          .perm-info {
            display: flex;
            flex-direction: column;
            gap: 2px;

            .perm-name {
              font-size: 0.88rem;
              font-weight: 700;
              color: #f3ebe2;
            }

            .perm-desc {
              font-size: 0.72rem;
              color: #8c8277;
            }
          }
        }
      }

      /* Footer Stats Bar */
      .permissions-footer-bar {
        margin-top: auto;
        padding-top: 16px;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 14px;

        .stats-left {
          display: flex;
          gap: 20px;

          .stat-box {
            display: flex;
            flex-direction: column;

            .s-lbl {
              font-size: 0.6rem;
              font-weight: 800;
              color: #8c8277;
              letter-spacing: 0.5px;
            }

            .s-val {
              font-size: 1.25rem;
              font-weight: 700;
              color: #f3ebe2;
              line-height: 1.1;
            }
          }
        }

        .actions-right {
          display: flex;
          align-items: center;
          gap: 10px;

          .btn-cancel-perm {
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #8c8277;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 0.8rem;
            cursor: pointer;
          }

          .btn-apply-gold {
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
    }

    /* ── MODAL AVANZADO: AÑADIR NUEVO MIEMBRO ── */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(8px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .modal-card-advanced {
      width: 100%;
      max-width: 580px;
      max-height: calc(100vh - 60px);
      background: #16120e;
      border: 1px solid rgba(212, 168, 83, 0.4);
      border-radius: 14px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8), 0 0 25px rgba(212, 168, 83, 0.15);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      margin: auto;
    }

    .modal-adv-header {
      flex-shrink: 0;
      padding: 14px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      background: #18130e;
      display: flex;
      justify-content: space-between;
      align-items: center;

      .header-title-box {
        display: flex;
        align-items: center;
        gap: 8px;

        .modal-icon-gold {
          width: 20px;
          height: 20px;
          color: #d4af37;
        }

        h3 {
          font-size: 1.15rem;
          font-weight: 700;
          color: #d4af37;
          margin: 0;
        }
      }

      .btn-close-adv {
        background: transparent;
        border: none;
        color: #8c8277;
        font-size: 1.4rem;
        cursor: pointer;
        transition: color 0.2s;
        line-height: 1;

        &:hover { color: #f3ebe2; }
      }
    }

    .modal-adv-body {
      flex: 1;
      min-height: 0;
      padding: 16px 20px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .avatar-info-row {
      display: flex;
      gap: 16px;
      align-items: flex-start;
    }

    .avatar-upload-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      width: 90px;
      flex-shrink: 0;

      .subtext-fmt {
        font-size: 0.52rem;
        font-weight: 700;
        color: #8c8277;
        letter-spacing: 0.4px;
        text-align: center;
        white-space: nowrap;
      }
    }

    .avatar-upload-box {
      width: 90px;
      height: 90px;
      border: 2px dashed rgba(255, 255, 255, 0.14);
      border-radius: 10px;
      background: #0d0a07;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 6px;
      cursor: pointer;
      position: relative;
      transition: all 0.25s ease;

      &:hover {
        border-color: rgba(212, 168, 83, 0.5);
        background: rgba(212, 168, 83, 0.04);

        .cam-icon { color: #d4af37; }
        .up-lbl { color: #f3ebe2; }
      }

      .avatar-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;

        .cam-icon {
          width: 20px;
          height: 20px;
          color: #8c8277;
        }

        .up-lbl {
          font-size: 0.65rem;
          font-weight: 600;
          color: #d6cbbf;
        }
      }

      .avatar-prev-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 8px;
      }
    }

    .avatar-spinner {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .micro-spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(212, 168, 83, 0.2);
      border-top-color: #d4af37;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .inputs-col-right {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .form-group-adv {
      display: flex;
      flex-direction: column;
      gap: 4px;

      label {
        font-size: 0.62rem;
        font-weight: 700;
        color: #d4af37;
        letter-spacing: 0.6px;
        text-transform: uppercase;
      }

      .adv-input, .adv-select {
        background: #0d0a07;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        padding: 7px 10px;
        color: #f3ebe2;
        font-size: 0.8rem;
        outline: none;
        transition: border-color 0.2s ease;

        &:focus {
          border-color: #d4af37;
        }

        &::placeholder {
          color: #554c42;
        }
      }

      .adv-select option {
        background: #140f0b;
        color: #f3ebe2;
      }
    }

    .row-2col-adv {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .section-block-adv {
      display: flex;
      flex-direction: column;
      gap: 6px;

      .block-lbl-gold {
        font-size: 0.62rem;
        font-weight: 700;
        color: #d4af37;
        letter-spacing: 0.6px;
        text-transform: uppercase;
      }
    }

    .roles-cards-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;

      @media (max-width: 500px) {
        grid-template-columns: repeat(2, 1fr);
      }

      .role-card-select {
        background: #0d0a07;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        padding: 9px 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 5px;
        cursor: pointer;
        transition: all 0.2s ease;

        lucide-icon, .r-icon {
          display: inline-flex !important;
          align-items: center;
          justify-content: center;
          width: 18px !important;
          height: 18px !important;
          color: #8c8277;
          transition: color 0.2s ease;

          svg {
            width: 18px !important;
            height: 18px !important;
            display: block;
          }
        }

        .r-name {
          font-size: 0.7rem;
          font-weight: 800;
          color: #8c8277;
          letter-spacing: 0.5px;
          transition: color 0.2s ease;
        }

        &:hover {
          border-color: rgba(212, 168, 83, 0.3);
          lucide-icon svg, .r-icon, .r-name { color: #f3ebe2; }
        }

        &.selected {
          background: rgba(212, 168, 83, 0.12);
          border-color: #d4af37;

          lucide-icon svg, .r-icon, .r-name {
            color: #d4af37;
          }
        }
      }
    }

    .permisos-header-lbl {
      display: flex;
      align-items: center;
      gap: 8px;

      lucide-icon, .shield-mini {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        width: 16px !important;
        height: 16px !important;
        flex-shrink: 0;

        svg {
          width: 16px !important;
          height: 16px !important;
          color: #d4af37;
          display: block;
        }
      }

      span {
        font-size: 0.68rem;
        font-weight: 800;
        color: #d4af37;
        letter-spacing: 0.8px;
        line-height: 1;
      }
    }

    .permisos-cards-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;

      @media (max-width: 550px) {
        grid-template-columns: 1fr;
      }
    }

    .permiso-card {
      background: #0d0a07;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 10px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;

      .p-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;

        .p-title {
          font-size: 0.8rem;
          font-weight: 700;
          color: #f3ebe2;
          line-height: 1.2;
        }

        .p-desc {
          font-size: 0.68rem;
          color: #8c8277;
          line-height: 1.2;
        }
      }
    }

    /* Switch Mini */
    .switch {
      position: relative;
      display: inline-block;
      width: 34px;
      height: 18px;

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
          left: 2px;
          bottom: 2px;
          background-color: #8c8277;
          transition: 0.3s;
        }

        &.round {
          border-radius: 20px;
          &:before { border-radius: 50%; }
        }
      }

      input:checked + .slider {
        background-color: rgba(234, 179, 8, 0.25);
        border-color: #eab308;

        &:before {
          transform: translateX(14px);
          background-color: #eab308;
        }
      }
    }

    .modal-adv-footer {
      flex-shrink: 0;
      padding: 12px 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      background: #18130e;
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 10px;
      z-index: 10;

      .btn-cancel-adv {
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #f3ebe2;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        padding: 7px 16px;
        border-radius: 6px;
        transition: all 0.2s ease;

        &:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.2);
        }
      }

      .btn-save-gold-adv {
        background: linear-gradient(135deg, #eab308 0%, #ca8a04 100%);
        color: #140f0b;
        border: none;
        padding: 8px 18px;
        border-radius: 6px;
        font-size: 0.8rem;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        box-shadow: 0 3px 12px rgba(234, 179, 8, 0.25);
        transition: all 0.25s ease;

        &:hover {
          background: linear-gradient(135deg, #facc15 0%, #eab308 100%);
          transform: translateY(-1px);
          box-shadow: 0 5px 16px rgba(234, 179, 8, 0.35);
        }
      }
    }
  `]
})
export class UsuariosComponent implements OnInit {
  private http = inject(HttpClient);
  private uploadService = inject(UploadCloudinaryService);
  private authService = inject(AuthService);
  private readonly baseUrl = 'http://localhost:3000/api';

  currentUser = this.authService.currentUserSignal;

  RolUsuario = RolUsuario;

  activeTab = signal<'personal' | 'permisos'>('personal');
  searchQuery = signal<string>('');
  selectedRole = signal<string>('TODOS');
  selectedEstado = signal<string>('TODOS');
  showModal = signal<boolean>(false);
  isUploadingAvatar = signal<boolean>(false);

  selectedRolePerms = signal<RolUsuario>(RolUsuario.ADMIN);

  // System Roles Permission State Store
  rolePermissionsStore: Record<RolUsuario, PermisosModulo> = {
    [RolUsuario.ADMIN]: {
      ventas: { crearEditarPedidos: true, aplicarDescuentosCortesias: true, anularFacturasEmitidas: false },
      inventario: { gestionStockCritico: true, ajusteManualInventario: true },
      personal: { controlAsistencia: true, editarFichasEmpleados: false }
    },
    [RolUsuario.CAJERO]: {
      ventas: { crearEditarPedidos: true, aplicarDescuentosCortesias: true, anularFacturasEmitidas: false },
      inventario: { gestionStockCritico: false, ajusteManualInventario: false },
      personal: { controlAsistencia: true, editarFichasEmpleados: false }
    },
    [RolUsuario.CHEF]: {
      ventas: { crearEditarPedidos: false, aplicarDescuentosCortesias: false, anularFacturasEmitidas: false },
      inventario: { gestionStockCritico: true, ajusteManualInventario: true },
      personal: { controlAsistencia: true, editarFichasEmpleados: false }
    },
    [RolUsuario.MESERO]: {
      ventas: { crearEditarPedidos: true, aplicarDescuentosCortesias: false, anularFacturasEmitidas: false },
      inventario: { gestionStockCritico: false, ajusteManualInventario: false },
      personal: { controlAsistencia: true, editarFichasEmpleados: false }
    }
  };

  get currentRolePerms(): PermisosModulo {
    return this.rolePermissionsStore[this.selectedRolePerms()];
  }

  // Mock list initialized with default Tukuypaj team members matching user mockup
  miembros = signal<MiembroEquipo[]>([
    {
      id: '1',
      staffId: 'ID-2024-01-ADM',
      nombre: 'Martina Valenzuela',
      email: 'm.valenzuela@tukuypaj.com',
      telefono: '+591700 45678',
      rol: RolUsuario.ADMIN,
      activo: true,
      ultimoAcceso: 'Hace 5 min',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80'
    },
    {
      id: '2',
      staffId: 'ID-2024-12-CAJ',
      nombre: 'Roberto Choque',
      email: 'r.choque@tukuypaj.com',
      telefono: '+591721 98321',
      rol: RolUsuario.CAJERO,
      activo: true,
      ultimoAcceso: 'Hace 12 min',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80'
    },
    {
      id: '3',
      staffId: 'ID-2024-05-CKC',
      nombre: 'Sebastián Murillo',
      email: 's.murillo@tukuypaj.com',
      telefono: '+591765 11223',
      rol: RolUsuario.CHEF,
      activo: true,
      ultimoAcceso: 'Hace 2 horas',
      avatarUrl: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=100&auto=format&fit=crop&q=80'
    },
    {
      id: '4',
      staffId: 'ID-2024-18-MES',
      nombre: 'Lucía Arze',
      email: 'l.arze@tukuypaj.com',
      telefono: '+591678 44556',
      rol: RolUsuario.MESERO,
      activo: false,
      ultimoAcceso: 'Ayer, 23:45',
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80'
    },
    {
      id: '5',
      staffId: 'ID-2024-22-MES',
      nombre: 'Ana Belén Rojas',
      email: 'a.rojas@tukuypaj.com',
      telefono: '+591712 34567',
      rol: RolUsuario.MESERO,
      activo: true,
      ultimoAcceso: 'Hace 30 min',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
    },
    {
      id: '6',
      staffId: 'ID-2024-03-CKC',
      nombre: 'Chef Miguel Ángel Torres',
      email: 'chef.miguel@tukuypaj.com',
      telefono: '+591789 01234',
      rol: RolUsuario.CHEF,
      activo: true,
      ultimoAcceso: 'Hace 1 hora',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80'
    }
  ]);

  nuevoMiembro = {
    nombre: '',
    email: '',
    telefono: '',
    rol: RolUsuario.MESERO,
    activo: true,
    avatarUrl: '',
    permisos: {
      anularComandas: false,
      abrirCaja: false,
      gestionarInventario: false,
      aplicarDescuentos: false
    }
  };

  // Computeds
  filteredMiembros = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const role = this.selectedRole();
    const estado = this.selectedEstado();

    return this.miembros().filter((m) => {
      const matchQuery = !query || 
        m.nombre.toLowerCase().includes(query) || 
        m.email.toLowerCase().includes(query) ||
        m.staffId.toLowerCase().includes(query);

      const matchRole = role === 'TODOS' || m.rol === role;
      const matchEstado = estado === 'TODOS' || 
        (estado === 'ACTIVO' && m.activo) || 
        (estado === 'INACTIVO' && !m.activo);

      return matchQuery && matchRole && matchEstado;
    });
  });

  totalStaffCount = computed(() => this.miembros().length);
  activosAhoraCount = computed(() => this.miembros().filter((m) => m.activo).length);

  ngOnInit() {
    this.cargarUsuariosServidor();
  }

  cargarUsuariosServidor() {
    this.http.get<any>(`${this.baseUrl}/usuarios`).subscribe({
      next: (res) => {
        const usersFromDb = res.data || [];
        if (usersFromDb.length > 0) {
          const mapped: MiembroEquipo[] = usersFromDb.map((u: any, idx: number) => ({
            id: u.id,
            staffId: `ID-2024-${String(idx + 1).padStart(2, '0')}-${u.rol.substring(0, 3)}`,
            nombre: u.nombre,
            email: u.email,
            telefono: '+591 ' + Math.floor(70000000 + Math.random() * 9999999),
            rol: u.rol,
            activo: u.activo,
            ultimoAcceso: u.activo ? 'Hace momentos' : 'Ayer, 22:15',
            avatarUrl: `https://i.pravatar.cc/100?u=${u.id}`
          }));
          this.miembros.set(mapped);
        }
      },
      error: (err) => console.error('Error al cargar usuarios desde API', err),
    });
  }

  getRolLabel(rol: RolUsuario): string {
    switch (rol) {
      case RolUsuario.ADMIN: return 'ADMINISTRADOR';
      case RolUsuario.CAJERO: return 'CAJERO';
      case RolUsuario.CHEF: return 'JEFE DE COCINA';
      case RolUsuario.MESERO: return 'MESERO';
      default: return rol;
    }
  }

  getRoleBadgeClass(rol: RolUsuario): string {
    switch (rol) {
      case RolUsuario.ADMIN: return 'badge-admin';
      case RolUsuario.CAJERO: return 'badge-cajero';
      case RolUsuario.CHEF: return 'badge-chef';
      case RolUsuario.MESERO: return 'badge-mesero';
      default: return '';
    }
  }

  toggleEstado(user: MiembroEquipo) {
    this.http.patch<any>(`${this.baseUrl}/usuarios/${user.id}/toggle-activo`, {}).subscribe({
      next: () => {
        user.activo = !user.activo;
      },
      error: () => {
        user.activo = !user.activo;
      }
    });
  }

  abrirModalCrear() {
    const user = this.currentUser();
    if (user && user.rol !== RolUsuario.ADMIN) {
      alert('Acceso restringido: Solo los administradores pueden añadir o gestionar miembros del equipo.');
      return;
    }

    this.nuevoMiembro = {
      nombre: '',
      email: '',
      telefono: '',
      rol: RolUsuario.MESERO,
      activo: true,
      avatarUrl: '',
      permisos: {
        anularComandas: false,
        abrirCaja: false,
        gestionarInventario: false,
        aplicarDescuentos: false
      }
    };
    this.showModal.set(true);
  }

  cerrarModal() {
    this.showModal.set(false);
  }

  seleccionarRol(rol: RolUsuario) {
    this.nuevoMiembro.rol = rol;
    
    // Configurar permisos por defecto según el rol seleccionado
    if (rol === RolUsuario.ADMIN) {
      this.nuevoMiembro.permisos = {
        anularComandas: true,
        abrirCaja: true,
        gestionarInventario: true,
        aplicarDescuentos: true
      };
    } else if (rol === RolUsuario.CAJERO) {
      this.nuevoMiembro.permisos = {
        anularComandas: false,
        abrirCaja: true,
        gestionarInventario: false,
        aplicarDescuentos: true
      };
    } else if (rol === RolUsuario.CHEF) {
      this.nuevoMiembro.permisos = {
        anularComandas: false,
        abrirCaja: false,
        gestionarInventario: true,
        aplicarDescuentos: false
      };
    } else {
      this.nuevoMiembro.permisos = {
        anularComandas: false,
        abrirCaja: false,
        gestionarInventario: false,
        aplicarDescuentos: false
      };
    }
  }

  triggerAvatarFileInput() {
    const fileInput = document.getElementById('avatar-input') as HTMLInputElement;
    fileInput?.click();
  }

  uploadAvatar(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    this.isUploadingAvatar.set(true);
    this.uploadService.uploadImage(file).subscribe({
      next: (secureUrl) => {
        this.nuevoMiembro.avatarUrl = secureUrl;
        this.isUploadingAvatar.set(false);
      },
      error: (err) => {
        console.error('Error al subir avatar:', err);
        this.isUploadingAvatar.set(false);
      }
    });
  }

  guardarMiembro() {
    if (!this.nuevoMiembro.nombre.trim() || !this.nuevoMiembro.email.trim()) return;

    const newId = String(Date.now());
    const avatar = this.nuevoMiembro.avatarUrl || `https://i.pravatar.cc/100?u=${newId}`;
    
    const nuevo: MiembroEquipo = {
      id: newId,
      staffId: `ID-2024-${String(this.miembros().length + 1).padStart(2, '0')}-${this.nuevoMiembro.rol.substring(0, 3)}`,
      nombre: this.nuevoMiembro.nombre.trim(),
      email: this.nuevoMiembro.email.trim(),
      telefono: this.nuevoMiembro.telefono.trim() || '+591 700 00000',
      rol: this.nuevoMiembro.rol,
      activo: this.nuevoMiembro.activo,
      ultimoAcceso: 'Recién registrado',
      avatarUrl: avatar,
      permisos: { ...this.nuevoMiembro.permisos }
    };

    this.miembros.update((list) => [nuevo, ...list]);
    this.cerrarModal();
  }

  guardarPermisos() {
    alert(`Permisos guardados con éxito para el rol: ${this.getRolLabel(this.selectedRolePerms())}`);
  }

  cancelarPermisos() {
    this.selectedRolePerms.set(RolUsuario.ADMIN);
  }

  exportarReporte() {
    alert('Exportando listado de personal en formato PDF/Excel...');
  }

  imprimirLista() {
    window.print();
  }
}
