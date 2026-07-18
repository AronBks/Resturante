import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { SocketService } from '../../core/services/socket.service';
import { AuthService } from '../../core/services/auth.service';
import { ComprobanteComponent, DatosRecibo } from '../mesas/comprobante.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-control-caja',
  standalone: true,
  imports: [CommonModule, FormsModule, ComprobanteComponent],
  templateUrl: './control-caja.component.html',
  styleUrls: ['./control-caja.component.scss']
})
export class ControlCajaComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private socketService = inject(SocketService);
  private authService = inject(AuthService);

  private readonly baseUrl = 'http://localhost:3000/api';
  private subscriptions = new Subscription();

  // ── Signals de Estado ──
  activeTab = signal<'caja' | 'historial'>('caja');
  activeCaja = signal<any | null>(null);
  transacciones = signal<any[]>([]);
  loadingCaja = signal(false);
  loadingHistorial = signal(false);
  errorMsg = signal('');

  // Arqueo & Cierre Modal State
  cerrarCajaModalOpen = signal(false);
  montoCierreFisico = signal<number | null>(null);
  isCerrando = signal(false);
  cierreError = signal('');
  cierreExitosoResult = signal<any | null>(null);

  // Comprobante Modal State
  verComprobanteModal = signal(false);
  datosComprobanteSelected = signal<DatosRecibo | null>(null);

  // User Context
  currentUser = this.authService.currentUserSignal;
  isAdmin = computed(() => this.currentUser()?.rol === 'ADMIN');

  // ── Computed Stats ──
  montoApertura = computed(() => this.activeCaja()?.montoApertura ?? 0);
  ventasEfectivo = computed(() => this.activeCaja()?.totalEfectivo ?? 0);
  ventasTarjeta = computed(() => this.activeCaja()?.totalTarjeta ?? 0);
  ventasQr = computed(() => this.activeCaja()?.totalQr ?? 0);
  ventasTotales = computed(() => this.activeCaja()?.totalVentas ?? 0);
  
  // Balance neto teórico de efectivo físico = Apertura + Ventas en Efectivo
  balanceTeorico = computed(() => {
    return this.montoApertura() + this.ventasEfectivo();
  });

  // Discrepancia calculada dinámicamente en el modal de arqueo
  diferenciaArqueo = computed(() => {
    const fisico = this.montoCierreFisico() ?? 0;
    return fisico - this.balanceTeorico();
  });

  diferenciaAbsoluta = computed(() => Math.abs(this.diferenciaArqueo()));


  ngOnInit() {
    this.cargarDatosCaja();
    this.cargarHistorial();
    this.suscribirEventosRealTime();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  // ── Carga de Datos (APIs) ──
  cargarDatosCaja() {
    this.loadingCaja.set(true);
    this.errorMsg.set('');
    this.http.get<any>(`${this.baseUrl}/caja/resumen-activa`).subscribe({
      next: (res) => {
        this.activeCaja.set(res.data);
        this.loadingCaja.set(false);
      },
      error: (err) => {
        console.error('Error al cargar caja activa:', err);
        this.errorMsg.set('No se pudo obtener el resumen de caja activa.');
        this.loadingCaja.set(false);
      }
    });
  }

  cargarHistorial() {
    this.loadingHistorial.set(true);
    this.http.get<any>(`${this.baseUrl}/caja/transacciones-hoy`).subscribe({
      next: (res) => {
        this.transacciones.set(res.data || []);
        this.loadingHistorial.set(false);
      },
      error: (err) => {
        console.error('Error al cargar transacciones:', err);
        this.loadingHistorial.set(false);
      }
    });
  }

  // ── Suscripción WebSockets (Tiempo Real) ──
  private suscribirEventosRealTime() {
    // 1. Nueva transacción cobrada en salón
    const subTransaccion = this.socketService.onEvent<any>('transaccion:creada').subscribe({
      next: (transaccion) => {
        console.log('🔌 WebSocket: Nueva transacción recibida:', transaccion);
        
        // Agregar al feed de transacciones del día
        this.transacciones.update((list) => [transaccion, ...list]);
        
        // Recargar los acumuladores de caja de forma segura
        this.cargarDatosCaja();
      }
    });

    // 2. Cierre de caja realizado
    const subCajaCerrada = this.socketService.onEvent<any>('caja:cerrada').subscribe({
      next: (data) => {
        console.log('🔌 WebSocket: Caja cerrada en el sistema:', data);
        
        // Si la caja cerrada coincide con la que tenemos cargada, la marcamos como cerrada o recargamos
        if (this.activeCaja()?.id === data.cajaId) {
          this.activeCaja.update((c) => {
            if (!c) return null;
            return {
              ...c,
              estado: 'CERRADA',
              montoCierre: data.montoCierre
            };
          });
        }
        
        // Recargar para sincronizar
        this.cargarDatosCaja();
      }
    });

    this.subscriptions.add(subTransaccion);
    this.subscriptions.add(subCajaCerrada);
  }

  // ── Acciones de Interfaz ──
  cambiarPestana(tab: 'caja' | 'historial') {
    this.activeTab.set(tab);
    if (tab === 'caja') {
      this.cargarDatosCaja();
    } else {
      this.cargarHistorial();
    }
  }

  // Comprobante
  verRecibo(transaccion: any) {
    this.datosComprobanteSelected.set(transaccion);
    this.verComprobanteModal.set(true);
  }

  cerrarReciboModal() {
    this.verComprobanteModal.set(false);
    this.datosComprobanteSelected.set(null);
  }

  // Arqueo & Cierre
  abrirCerrarCajaModal() {
    if (!this.activeCaja() || this.activeCaja().estado === 'CERRADA') return;
    this.montoCierreFisico.set(this.balanceTeorico()); // Valor por defecto sugerido
    this.cierreError.set('');
    this.cierreExitosoResult.set(null);
    this.cerrarCajaModalOpen.set(true);
  }

  onMontoCierreInput(value: string) {
    this.montoCierreFisico.set(parseFloat(value) || 0);
  }

  cerrarCajaModal() {
    if (!this.isCerrando()) {
      this.cerrarCajaModalOpen.set(false);
      this.cierreExitosoResult.set(null);
    }
  }

  confirmarCerrarCaja() {
    if (!this.activeCaja()) return;
    const cajaId = this.activeCaja().id;
    const monto = this.montoCierreFisico() ?? 0;

    this.isCerrando.set(true);
    this.cierreError.set('');

    this.http.post<any>(`${this.baseUrl}/caja/${cajaId}/cerrar`, { montoCierre: monto }).subscribe({
      next: (res) => {
        this.isCerrando.set(false);
        this.cierreExitosoResult.set(res.data);
        this.activeCaja.set(null); // Limpiar caja activa localmente
        this.cargarDatosCaja();   // Intentar recargar
      },
      error: (err) => {
        this.isCerrando.set(false);
        this.cierreError.set(err.error?.message || 'Error al cerrar la caja');
      }
    });
  }

  // Helper formatting classes
  getMetodoBadgeClass(metodo: string): string {
    switch (metodo) {
      case 'EFECTIVO': return 'badge-success';
      case 'QR': return 'badge-vip';
      case 'TARJETA': return 'badge-info';
      default: return '';
    }
  }

  getMetodoLabel(metodo: string): string {
    switch (metodo) {
      case 'EFECTIVO': return 'Efectivo';
      case 'QR': return 'QR';
      case 'TARJETA': return 'Tarjeta';
      default: return metodo;
    }
  }

  formatearFechaHora(fechaStr: string): string {
    const d = new Date(fechaStr);
    return d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
  }
}
