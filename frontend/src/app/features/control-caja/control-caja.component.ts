import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { SocketService } from '../../core/services/socket.service';
import { AuthService } from '../../core/services/auth.service';
import { ComprobanteComponent, DatosRecibo } from '../mesas/comprobante.component';
import { Subscription } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';

export interface EgresoCaja {
  id: string;
  monto: number;
  motivo: string;
  autoriza: string;
  hora: string;
}

export interface CierreHistorico {
  id: string;
  cajero: string;
  apertura: string;
  cierre: string;
  montoApertura: number;
  montoCierre: number;
  totalVentas: number;
  totalEfectivo: number;
  totalQr: number;
  transaccionesCount: number;
}

@Component({
  selector: 'app-control-caja',
  standalone: true,
  imports: [CommonModule, FormsModule, ComprobanteComponent, LucideAngularModule],
  templateUrl: './control-caja.component.html',
  styleUrls: ['./control-caja.component.scss']
})
export class ControlCajaComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private socketService = inject(SocketService);
  private authService = inject(AuthService);

  private readonly baseUrl = 'http://localhost:3000/api';
  private subscriptions = new Subscription();

  // ── Pestañas de Vista ──
  activeTab = signal<'caja' | 'historial' | 'cierres'>('caja');
  activeCaja = signal<any | null>(null);
  transacciones = signal<any[]>([]);
  historialCajas = signal<CierreHistorico[]>([]);
  loadingCaja = signal(false);
  loadingHistorial = signal(false);
  loadingCierres = signal(false);
  errorMsg = signal('');

  // ── Apertura de Turno ──
  montoAperturaInput = signal<number>(100);
  isAbriendoCaja = signal(false);
  aperturaError = signal('');

  // ── Salidas de Efectivo (Egresos de Caja Chica) ──
  egresoModalOpen = signal(false);
  egresoMonto = signal<number | null>(null);
  egresoMotivo = signal<string>('');
  egresoAutoriza = signal<string>('');
  isRegistrandoEgreso = signal(false);
  egresoError = signal('');

  // ── Arqueo & Cierre de Caja ──
  cerrarCajaModalOpen = signal(false);
  montoCierreFisico = signal<number | null>(null);
  isCerrando = signal(false);
  cierreError = signal('');
  cierreExitosoResult = signal<any | null>(null);

  // Modo de conteo de arqueo
  modoConteo = signal<'directo' | 'calculadora'>('directo');
  conteoBilletes = signal({
    b200: 0,
    b100: 0,
    b50: 0,
    b20: 0,
    b10: 0,
    m5: 0,
    m2: 0,
    m1: 0,
    m05: 0,
  });

  // Ticket de Cierre Z Imprimible
  ticketZModalOpen = signal(false);
  datosTicketZ = signal<any | null>(null);

  // ── Filtros (Historial Tab) ──
  filtroMetodo = signal<string>('TODOS');
  filtroEstado = signal<string>('COMPLETADO');
  searchQuery = signal<string>('');

  // Comprobante Recibo Modal State
  verComprobanteModal = signal(false);
  datosComprobanteSelected = signal<DatosRecibo | null>(null);

  // User Context
  currentUser = this.authService.currentUserSignal;
  isAdmin = computed(() => this.currentUser()?.rol === 'ADMIN');

  // ── Computed Stats de Caja ──
  montoApertura = computed(() => this.activeCaja()?.montoApertura ?? 0);
  ventasEfectivo = computed(() => this.activeCaja()?.totalEfectivo ?? 0);
  ventasTarjeta = computed(() => this.activeCaja()?.totalTarjeta ?? 0);
  ventasQr = computed(() => this.activeCaja()?.totalQr ?? 0);
  ventasTotales = computed(() => this.activeCaja()?.totalVentas ?? 0);
  totalEgresos = computed(() => this.activeCaja()?.totalEgresos ?? 0);
  egresosList = computed<EgresoCaja[]>(() => this.activeCaja()?.egresos ?? []);

  // Balance neto teórico de efectivo físico = Fondo Apertura + Ventas Efectivo - Egresos
  balanceTeorico = computed(() => {
    return Math.max(0, this.montoApertura() + this.ventasEfectivo() - this.totalEgresos());
  });

  // Total acumulado por calculadora de billetes
  totalCalculadora = computed(() => {
    const c = this.conteoBilletes();
    return (
      c.b200 * 200 +
      c.b100 * 100 +
      c.b50 * 50 +
      c.b20 * 20 +
      c.b10 * 10 +
      c.m5 * 5 +
      c.m2 * 2 +
      c.m1 * 1 +
      c.m05 * 0.5
    );
  });

  // Discrepancia calculada dinámicamente en el arqueo
  diferenciaArqueo = computed(() => {
    const fisico = this.montoCierreFisico() ?? 0;
    return Math.round((fisico - this.balanceTeorico()) * 100) / 100;
  });

  diferenciaAbsoluta = computed(() => Math.abs(this.diferenciaArqueo()));

  // ── Transacciones Filtradas ──
  transaccionesFiltradas = computed(() => {
    let list = this.transacciones();
    const metodo = this.filtroMetodo();
    const estado = this.filtroEstado();
    const q = this.searchQuery().toLowerCase().trim();

    if (metodo !== 'TODOS') {
      list = list.filter((t) => t.metodoPago === metodo);
    }

    if (estado === 'COMPLETADO') {
      list = list.filter((t) => t.estado !== 'ANULADO');
    } else if (estado === 'ANULADO') {
      list = list.filter((t) => t.estado === 'ANULADO');
    }

    if (q) {
      list = list.filter((t) =>
        (t.nroRecibo && t.nroRecibo.toLowerCase().includes(q)) ||
        (t.mesero?.nombre && t.mesero.nombre.toLowerCase().includes(q)) ||
        (t.mesa?.numero && t.mesa.numero.toString().includes(q)) ||
        (t.total && t.total.toString().includes(q))
      );
    }

    return list;
  });

  volumenTotalFiltrado = computed(() => {
    return this.transaccionesFiltradas().reduce((sum, t) => sum + (t.total || 0), 0);
  });

  totalTransaccionesCount = computed(() => {
    return this.transaccionesFiltradas().length;
  });

  ngOnInit() {
    this.cargarDatosCaja();
    this.cargarHistorial();
    this.suscribirEventosRealTime();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  // ── Carga de Datos ──
  cargarDatosCaja(silent = false) {
    if (!silent && !this.activeCaja()) {
      this.loadingCaja.set(true);
    }
    this.errorMsg.set('');
    this.http.get<any>(`${this.baseUrl}/caja/resumen-activa`).subscribe({
      next: (res) => {
        this.activeCaja.set(res.data);
        this.loadingCaja.set(false);
      },
      error: (err) => {
        console.error('Error al cargar caja activa:', err);
        if (!silent) this.errorMsg.set('No se pudo obtener el resumen de caja activa.');
        this.loadingCaja.set(false);
      },
    });
  }

  cargarHistorial(silent = false) {
    if (!silent && this.transacciones().length === 0) {
      this.loadingHistorial.set(true);
    }
    this.http.get<any>(`${this.baseUrl}/caja/transacciones-hoy`).subscribe({
      next: (res) => {
        this.transacciones.set(res.data || []);
        this.loadingHistorial.set(false);
      },
      error: (err) => {
        console.error('Error al cargar transacciones:', err);
        this.loadingHistorial.set(false);
      },
    });
  }

  cargarHistorialCajas() {
    this.loadingCierres.set(true);
    this.http.get<any>(`${this.baseUrl}/caja/historial-cajas`).subscribe({
      next: (res) => {
        this.historialCajas.set(res.data || []);
        this.loadingCierres.set(false);
      },
      error: (err) => {
        console.error('Error al cargar historial de cierres:', err);
        this.loadingCierres.set(false);
      },
    });
  }

  // ── Suscripción WebSockets ──
  private suscribirEventosRealTime() {
    const subTransaccion = this.socketService.onEvent<any>('transaccion:creada').subscribe({
      next: (transaccion) => {
        this.transacciones.update((list) => [transaccion, ...list]);
        this.cargarDatosCaja(true);
      },
    });

    const subCajaCerrada = this.socketService.onEvent<any>('caja:cerrada').subscribe({
      next: (data) => {
        if (this.activeCaja()?.id === data.cajaId) {
          this.activeCaja.update((c) => (c ? { ...c, estado: 'CERRADA', montoCierre: data.montoCierre } : null));
        }
        this.cargarDatosCaja(true);
        if (this.activeTab() === 'cierres') {
          this.cargarHistorialCajas();
        }
      },
    });

    this.subscriptions.add(subTransaccion);
    this.subscriptions.add(subCajaCerrada);
  }

  // ── Navegación de Pestañas ──
  cambiarPestana(tab: 'caja' | 'historial' | 'cierres') {
    this.activeTab.set(tab);
    if (tab === 'caja') {
      this.cargarDatosCaja(true);
    } else if (tab === 'historial') {
      this.cargarHistorial(true);
    } else if (tab === 'cierres') {
      this.cargarHistorialCajas();
    }
  }

  // ── Apertura de Turno ──
  seleccionarFondoRapido(monto: number) {
    this.montoAperturaInput.set(monto);
  }

  abrirTurno() {
    const monto = this.montoAperturaInput();
    if (isNaN(monto) || monto < 0) {
      this.aperturaError.set('Ingresa un monto de apertura válido.');
      return;
    }

    this.isAbriendoCaja.set(true);
    this.aperturaError.set('');

    this.http.post<any>(`${this.baseUrl}/caja/abrir`, { montoApertura: monto }).subscribe({
      next: () => {
        this.isAbriendoCaja.set(false);
        this.cargarDatosCaja();
      },
      error: (err) => {
        this.isAbriendoCaja.set(false);
        this.aperturaError.set(err.error?.message || 'Error al abrir el turno de caja.');
      },
    });
  }

  // ── Salidas de Efectivo (Egresos) ──
  abrirEgresoModal() {
    this.egresoMonto.set(null);
    this.egresoMotivo.set('');
    this.egresoAutoriza.set('');
    this.egresoError.set('');
    this.egresoModalOpen.set(true);
  }

  cerrarEgresoModal() {
    if (!this.isRegistrandoEgreso()) {
      this.egresoModalOpen.set(false);
    }
  }

  confirmarEgreso() {
    const monto = this.egresoMonto();
    const motivo = this.egresoMotivo().trim();
    const autoriza = this.egresoAutoriza().trim();

    if (!monto || monto <= 0) {
      this.egresoError.set('Ingresa un monto válido mayor a Bs. 0.');
      return;
    }

    if (!motivo) {
      this.egresoError.set('Debes ingresar el motivo o concepto del gasto.');
      return;
    }

    this.isRegistrandoEgreso.set(true);
    this.egresoError.set('');

    this.http.post<any>(`${this.baseUrl}/caja/egreso`, { monto, motivo, autoriza }).subscribe({
      next: () => {
        this.isRegistrandoEgreso.set(false);
        this.egresoModalOpen.set(false);
        this.cargarDatosCaja(true);
      },
      error: (err) => {
        this.isRegistrandoEgreso.set(false);
        this.egresoError.set(err.error?.message || 'Error al registrar la salida de dinero.');
      },
    });
  }

  // ── Arqueo & Cierre de Turno ──
  abrirCerrarCajaModal() {
    if (!this.activeCaja() || this.activeCaja().estado === 'CERRADA') return;
    this.montoCierreFisico.set(this.balanceTeorico());
    this.cierreError.set('');
    this.cierreExitosoResult.set(null);
    this.modoConteo.set('directo');
    this.limpiarCalculadora();
    this.cerrarCajaModalOpen.set(true);
  }

  setModoConteo(modo: 'directo' | 'calculadora') {
    this.modoConteo.set(modo);
    if (modo === 'calculadora') {
      this.montoCierreFisico.set(this.totalCalculadora());
    }
  }

  onMontoCierreInput(value: string) {
    this.montoCierreFisico.set(parseFloat(value) || 0);
  }

  onBilleteInput(denom: keyof ReturnType<typeof this.conteoBilletes>, value: any) {
    const count = parseInt(value, 10) || 0;
    this.conteoBilletes.update((prev) => ({
      ...prev,
      [denom]: Math.max(0, count),
    }));
    this.montoCierreFisico.set(this.totalCalculadora());
  }

  ajustarBillete(denom: keyof ReturnType<typeof this.conteoBilletes>, delta: number) {
    this.conteoBilletes.update((prev) => ({
      ...prev,
      [denom]: Math.max(0, prev[denom] + delta),
    }));
    this.montoCierreFisico.set(this.totalCalculadora());
  }

  limpiarCalculadora() {
    this.conteoBilletes.set({
      b200: 0,
      b100: 0,
      b50: 0,
      b20: 0,
      b10: 0,
      m5: 0,
      m2: 0,
      m1: 0,
      m05: 0,
    });
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
    const desglose = this.modoConteo() === 'calculadora' ? this.conteoBilletes() : undefined;

    this.isCerrando.set(true);
    this.cierreError.set('');

    this.http.post<any>(`${this.baseUrl}/caja/${cajaId}/cerrar`, {
      montoCierre: monto,
      desgloseBilletes: desglose,
    }).subscribe({
      next: (res) => {
        this.isCerrando.set(false);
        const result = res.data;
        this.cierreExitosoResult.set(result);
        this.datosTicketZ.set(result);
        this.activeCaja.set(null);
        this.cargarDatosCaja();
      },
      error: (err) => {
        this.isCerrando.set(false);
        this.cierreError.set(err.error?.message || 'Error al cerrar la caja');
      },
    });
  }

  // ── Ticket de Cierre Z Imprimible ──
  abrirTicketZ(cierre: any) {
    this.datosTicketZ.set(cierre);
    this.ticketZModalOpen.set(true);
  }

  cerrarTicketZ() {
    this.ticketZModalOpen.set(false);
  }

  imprimirTicketZ() {
    window.print();
  }

  // ── Visualización de Recibo / Comprobante ──
  verRecibo(transaccion: any) {
    this.datosComprobanteSelected.set(transaccion);
    this.verComprobanteModal.set(true);
  }

  cerrarReciboModal() {
    this.verComprobanteModal.set(false);
    this.datosComprobanteSelected.set(null);
  }

  // ── Filtros y Búsqueda ──
  onFiltroMetodoChange(val: string) {
    this.filtroMetodo.set(val);
  }

  onFiltroEstadoChange(val: string) {
    this.filtroEstado.set(val);
  }

  onSearchInput(val: string) {
    this.searchQuery.set(val);
  }

  // ── Helpers Visuales ──
  getMetodoBadgeClass(metodo: string): string {
    switch (metodo) {
      case 'EFECTIVO': return 'badge-efectivo';
      case 'QR': return 'badge-qr';
      case 'TARJETA': return 'badge-tarjeta';
      default: return 'badge-default';
    }
  }

  getMetodoLabel(metodo: string): string {
    switch (metodo) {
      case 'EFECTIVO': return 'EFECTIVO';
      case 'QR': return 'QR';
      case 'TARJETA': return 'TARJETA';
      default: return metodo;
    }
  }

  formatearMesa(num: any): string {
    if (!num) return '-';
    const str = String(num).trim();
    if (str.toUpperCase().startsWith('M')) return str;
    const val = parseInt(str, 10);
    if (!isNaN(val)) {
      return val < 10 ? `M0${val}` : `M${val}`;
    }
    return str;
  }

  formatearFechaHora(fechaStr: string): string {
    if (!fechaStr) return '';
    const d = new Date(fechaStr);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
  }
}
