import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LucideAngularModule } from 'lucide-angular';
import { CarritoService } from '../../services/carrito.service';
import { SocketPublicoService } from '../../services/socket-publico.service';
import { formatearMesaParaBackend } from '../../services/don-beto.service';
import { Subscription } from 'rxjs';

type MetodoPago = 'efectivo' | 'qr' | null;
type CalificacionRapida = 'excelente' | 'regular' | 'a-mejorar' | null;
export type PantallaActual =
  | 'esperando-cuenta'
  | 'cuenta-entregada'
  | 'esperando-confirmacion-caja'
  | 'recibo-digital'
  | 'feedback'
  | 'completado';

@Component({
  selector: 'client-cierre-cuenta',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './cierre-cuenta.component.html',
  styleUrl: './cierre-cuenta.component.scss',
})
export class CierreCuentaComponent implements OnInit, OnDestroy {
  readonly carritoService = inject(CarritoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly socketPublico = inject(SocketPublicoService);
  private readonly baseUrl = 'http://localhost:3000/api';

  // Helper para resolver la mesa inicial de manera síncrona
  private static getMesaInicial(): string {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('mesa') || localStorage.getItem('tukuypaj_mesa_asignada') || 'M01';
    } catch {
      return 'M01';
    }
  }

  // ── Mesa ──
  mesaNumero = signal<string>(CierreCuentaComponent.getMesaInicial());

  // ── Estado de la Pantalla (Inicializado con persistencia segura en F5) ──
  pantallaActual = signal<PantallaActual>((() => {
    try {
      const mesa = CierreCuentaComponent.getMesaInicial();
      const esperando = localStorage.getItem(`tukuypaj_esperando_caja_${mesa}`) === 'true';
      return esperando ? 'esperando-confirmacion-caja' : 'cuenta-entregada';
    } catch {
      return 'cuenta-entregada';
    }
  })());

  // ── Método de Pago ──
  metodoPago = signal<MetodoPago>((() => {
    try {
      const mesa = CierreCuentaComponent.getMesaInicial();
      const m = localStorage.getItem(`tukuypaj_metodo_pago_${mesa}`);
      return m === 'qr' ? 'qr' : 'efectivo';
    } catch {
      return 'efectivo';
    }
  })());

  // ── Selección Rápida de Efectivo y Cambio ──
  opcionEfectivoSeleccionada = signal<string>((() => {
    try {
      const mesa = CierreCuentaComponent.getMesaInicial();
      return localStorage.getItem(`tukuypaj_paga_con_${mesa}`) || 'exacto';
    } catch {
      return 'exacto';
    }
  })());

  montoEfectivoPersonalizado = signal<number | null>((() => {
    try {
      const mesa = CierreCuentaComponent.getMesaInicial();
      const v = localStorage.getItem(`tukuypaj_paga_con_${mesa}`);
      return v ? parseFloat(v) || null : null;
    } catch {
      return null;
    }
  })());

  // ── Confirmación ──
  confirmandoPago = signal(false);
  pagoConfirmado = signal(false);
  errorPago = signal<string | null>(null);
  notificacionEnviada = signal(false);

  // ── Auto-Cierre de Seguridad (solo tras confirmación de caja) ──
  segundosAutoCierre = signal<number>(60);
  private autoCierreTimer: any = null;

  // ── Calificación (Legacy / Opcional) ──
  estrellas = signal<number>(0);
  calificacionRapida = signal<CalificacionRapida>(null);
  enviandoFeedback = signal(false);

  // ── Suscripciones y Polling de Respaldo ──
  private subs = new Subscription();
  private pollingIntervalId: any = null;

  // ── Fecha Actual Formateada ──
  fechaHoraActual = computed(() => {
    const now = new Date();
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const dia = now.getDate();
    const mes = meses[now.getMonth()];
    const anio = now.getFullYear();
    const hor = now.getHours().toString().padStart(2, '0');
    const min = now.getMinutes().toString().padStart(2, '0');
    return `${dia} ${mes} ${anio}, ${hor}:${min}`;
  });

  // ── Computed: Pedido y Totales ──
  pedido = computed(() => this.carritoService.ultimoPedido());

  meseroAsignado = computed(() => {
    return (this.pedido() as any)?.meseroAsignadoNombre || 'Personal de Salón';
  });

  subtotal = computed(() => {
    const p = this.pedido();
    if (p && p.total) return p.total;
    const cartTotal = this.carritoService.totalAcumulado();
    if (cartTotal > 0) return cartTotal;
    return 0;
  });

  total = computed(() => this.subtotal());
  totalConPropina = computed(() => this.subtotal());
  propinaMonto = computed(() => 0);
  propinaPorcentaje = signal<number>(0);

  // Billetes bolivianos sugeridos mayores o iguales al total
  billetesSugeridos = computed(() => {
    const tot = Math.ceil(this.subtotal());
    if (tot <= 0) return [50, 100, 200];
    const opciones: number[] = [];
    const billetesDisponibles = [50, 100, 200];
    for (const b of billetesDisponibles) {
      if (b >= tot) {
        opciones.push(b);
      }
    }
    if (opciones.length === 0) {
      const siguienteCien = Math.ceil(tot / 100) * 100;
      opciones.push(siguienteCien);
      opciones.push(siguienteCien + 100);
    }
    return opciones;
  });

  // Monto final con el que pagará en efectivo
  montoPagaConFinal = computed(() => {
    const op = this.opcionEfectivoSeleccionada();
    const tot = this.subtotal();
    if (op === 'exacto') {
      return tot;
    }
    if (op === 'otro') {
      const custom = this.montoEfectivoPersonalizado();
      return custom && custom >= tot ? custom : tot;
    }
    const valorNum = parseFloat(op);
    return !isNaN(valorNum) && valorNum >= tot ? valorNum : tot;
  });

  // Cambio a devolver calculado en tiempo real
  cambioEstimado = computed(() => {
    const pagaCon = this.montoPagaConFinal();
    const tot = this.subtotal();
    return Math.max(0, Math.round((pagaCon - tot) * 100) / 100);
  });

  // URL del QR Dinámico oficial
  qrCodeUrl = computed(() => {
    const totalStr = this.totalConPropina().toFixed(2);
    const mesa = this.mesaNumero();
    const data = `TUKUYPAJ|MESA=${mesa}|TOTAL_BOB=${totalStr}|TIMESTAMP=${Date.now()}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=12&data=${encodeURIComponent(data)}`;
  });

  ngOnInit() {
    // 1. Resolver parámetro de Mesa
    const subRoute = this.route.queryParamMap.subscribe((params) => {
      let mesa = params.get('mesa');
      if (mesa) {
        try { localStorage.setItem('tukuypaj_mesa_asignada', mesa); } catch (e) {}
      } else {
        try { mesa = localStorage.getItem('tukuypaj_mesa_asignada') || 'M01'; } catch (e) { mesa = 'M01'; }
      }
      this.mesaNumero.set(mesa);

      // Verificar si ya estaba en estado de espera en caja persistido en localStorage
      const yaEsperandoEnCaja = localStorage.getItem(`tukuypaj_esperando_caja_${mesa}`) === 'true';
      const metodoGuardado = (localStorage.getItem(`tukuypaj_metodo_pago_${mesa}`) as MetodoPago) || null;
      const pagaConGuardado = localStorage.getItem(`tukuypaj_paga_con_${mesa}`);

      if (metodoGuardado) {
        this.metodoPago.set(metodoGuardado);
      }
      if (pagaConGuardado) {
        this.opcionEfectivoSeleccionada.set(pagaConGuardado);
        this.montoEfectivoPersonalizado.set(parseFloat(pagaConGuardado) || null);
      }

      if (yaEsperandoEnCaja) {
        this.pantallaActual.set('esperando-confirmacion-caja');
      }

      // 2. Solo solicitar automáticamente la cuenta al backend si NO estaba ya esperando en caja
      if (!yaEsperandoEnCaja) {
        this.carritoService.solicitarCuenta(mesa).subscribe({
          next: () => console.log('Cuenta solicitada al servidor para', mesa),
          error: (err) => console.warn('Aviso de solicitud de cuenta:', err),
        });
      }

      // 3. Consultar estado activo persistido en DB
      this.carritoService.consultarPedidoActivoMesa(mesa).subscribe((p) => {
        if (p) {
          const tieneMetodoDB = !!p.metodoPagoPreferido;
          const sigueEsperando = yaEsperandoEnCaja || tieneMetodoDB;

          if (sigueEsperando) {
            if (p.metodoPagoPreferido) {
              const met = p.metodoPagoPreferido.toLowerCase() === 'qr' ? 'qr' : 'efectivo';
              this.metodoPago.set(met);
              if (p.montoPagaCon) {
                this.opcionEfectivoSeleccionada.set(p.montoPagaCon.toString());
                this.montoEfectivoPersonalizado.set(Number(p.montoPagaCon));
              }
              try {
                localStorage.setItem(`tukuypaj_esperando_caja_${mesa}`, 'true');
                localStorage.setItem(`tukuypaj_metodo_pago_${mesa}`, met);
                if (p.montoPagaCon) {
                  localStorage.setItem(`tukuypaj_paga_con_${mesa}`, p.montoPagaCon.toString());
                }
              } catch (e) {}
            }
            this.pantallaActual.set('esperando-confirmacion-caja');
          } else {
            this.pantallaActual.set('cuenta-entregada');
          }
        }
      });
    });
    this.subs.add(subRoute);

    // 4. WebSocket: Escuchar cuando el garzón entrega físicamente la cuenta
    const subCuentaEntregada = this.socketPublico.onCuentaEntregada().subscribe((ev) => {
      const currentMesa = localStorage.getItem('tukuypaj_mesa_asignada') || this.mesaNumero();
      if (formatearMesaParaBackend(ev?.mesaNumero) === formatearMesaParaBackend(currentMesa)) {
        // Solo pasar a cuenta-entregada si no está ya en espera de caja o en recibo
        if (this.pantallaActual() !== 'esperando-confirmacion-caja' && this.pantallaActual() !== 'recibo-digital') {
          this.pantallaActual.set('cuenta-entregada');
        }
      }
    });
    this.subs.add(subCuentaEntregada);

    // 5. WebSocket: Escuchar confirmación oficial de cobro en caja
    const subPago = this.socketPublico.onPagoConfirmado().subscribe((evento) => {
      const currentMesa = localStorage.getItem('tukuypaj_mesa_asignada') || this.mesaNumero();
      if (formatearMesaParaBackend(evento?.mesaNumero) === formatearMesaParaBackend(currentMesa)) {
        this.pagoConfirmado.set(true);
        this.detenerPolling();
        this.pantallaActual.set('recibo-digital');
        this.iniciarAutoCierre();
        this.limpiarSesionMesaSegura(false);
      }
    });
    this.subs.add(subPago);

    // 6. WebSocket: Escuchar si el garzón o admin reabrió la comanda
    const subReabierta = this.socketPublico.onComandaReabierta().subscribe((ev) => {
      const currentMesa = localStorage.getItem('tukuypaj_mesa_asignada') || this.mesaNumero();
      if (formatearMesaParaBackend(ev?.mesaNumero) === formatearMesaParaBackend(currentMesa)) {
        this.detenerPolling();
        this.detenerAutoCierre();
        try {
          localStorage.removeItem(`tukuypaj_esperando_caja_${currentMesa}`);
          localStorage.removeItem(`tukuypaj_metodo_pago_${currentMesa}`);
          localStorage.removeItem(`tukuypaj_paga_con_${currentMesa}`);
        } catch (e) {}
        alert('Tu garzón ha reabierto la comanda. Ya puedes continuar ordenando.');
        this.router.navigate(['/carta'], { queryParams: { mesa: currentMesa } });
      }
    });
    this.subs.add(subReabierta);

    // 7. Polling de Respaldo cada 5 segundos (Respaldo contra desconexión WebSocket)
    this.iniciarPollingRespaldo();
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
    this.detenerPolling();
    this.detenerAutoCierre();
  }

  /**
   * Detiene de inmediato el timer de polling si está activo
   */
  private detenerPolling(): void {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
  }

  /**
   * Polling de respaldo cada 5s por si el comensal sufre pérdida temporal de WebSocket
   */
  private iniciarPollingRespaldo() {
    this.pollingIntervalId = setInterval(() => {
      const currentMesa = localStorage.getItem('tukuypaj_mesa_asignada') || this.mesaNumero();
      if (!currentMesa) return;

      // Si ya está en recibo, feedback o completado, detener el polling de inmediato
      const st = this.pantallaActual();
      if (st === 'recibo-digital' || st === 'feedback' || st === 'completado') {
        this.detenerPolling();
        return;
      }

      const mesaBackend = formatearMesaParaBackend(currentMesa);
      this.http.get<any>(`${this.baseUrl}/pedidos/publica/mesa/${mesaBackend}/activo`).subscribe({
        next: (res) => {
          // Extraer pedido correctamente tolerando envoltorio de NestJS { success: true, data: { pedidoActivo } }
          const p = res?.data?.pedidoActivo ?? res?.pedidoActivo ?? (res?.id ? res : null);
          if (!p) {
            // El pedido ya no existe como activo en el backend.
            // OJO CRUCIAL: Solo darlo por pagado si el comensal YA NOTIFICÓ su método de pago y estaba esperando en caja.
            // Si sigue en 'cuenta-entregada' eligiendo billete, NO pasar a recibo digital!
            if (st === 'esperando-confirmacion-caja') {
              this.pagoConfirmado.set(true);
              this.detenerPolling();
              this.pantallaActual.set('recibo-digital');
              this.iniciarAutoCierre();
              this.limpiarSesionMesaSegura(false);
            }
            return;
          }

          // Si el garzón reabrió la comanda desde su panel operativo:
          if (!p.cuentaSolicitada && !p.cuentaEntregada && p.estado !== 'POR_COBRAR') {
            this.detenerPolling();
            alert('Tu garzón ha reabierto la comanda. Ya puedes continuar ordenando.');
            this.router.navigate(['/carta'], { queryParams: { mesa: currentMesa } });
            return;
          }

          if (st === 'esperando-cuenta') {
            this.pantallaActual.set('cuenta-entregada');
          }
        },
        error: () => {},
      });
    }, 5000);
  }

  // ── Reintentar llamar al garzón ──
  llamarGarzonNuevamente(): void {
    this.carritoService.solicitarCuenta(this.mesaNumero()).subscribe({
      next: () => alert('Aviso reenviado a tu garzón asignado.'),
    });
  }

  // ── Selección de Propina (eliminada) ──
  seleccionarPropina(porcentaje: number): void {
    // Sin propina
  }

  // ── Selección de Método de Pago ──
  seleccionarMetodo(metodo: MetodoPago): void {
    this.metodoPago.set(metodo);
    this.errorPago.set(null);
  }

  // ── Selección de Billete con el que paga ──
  seleccionarOpcionEfectivo(opcion: string): void {
    this.opcionEfectivoSeleccionada.set(opcion);
  }

  onMontoPersonalizadoInput(ev: Event): void {
    const val = parseFloat((ev.target as HTMLInputElement).value);
    this.montoEfectivoPersonalizado.set(!isNaN(val) ? val : null);
  }

  // ── Confirmar Pago y Notificar al Personal ──
  confirmarPago(): void {
    if (!this.metodoPago()) {
      this.errorPago.set('Selecciona un método de pago para continuar.');
      return;
    }

    this.confirmandoPago.set(true);
    this.errorPago.set(null);

    const mesa = this.mesaNumero();
    const metodo = this.metodoPago();

    if (metodo === 'efectivo') {
      const montoPagaCon = this.montoPagaConFinal();
      this.carritoService.notificarPagoEfectivo(mesa, montoPagaCon).subscribe({
        next: () => {
          this.confirmandoPago.set(false);
          this.notificacionEnviada.set(true);
          this.pantallaActual.set('esperando-confirmacion-caja');
          try {
            localStorage.setItem(`tukuypaj_esperando_caja_${mesa}`, 'true');
            localStorage.setItem(`tukuypaj_metodo_pago_${mesa}`, 'efectivo');
            localStorage.setItem(`tukuypaj_paga_con_${mesa}`, montoPagaCon.toString());
          } catch (e) {}
        },
        error: () => {
          this.confirmandoPago.set(false);
          this.errorPago.set('No se pudo enviar la notificación. Intenta de nuevo.');
        },
      });
    } else {
      // Método QR
      this.carritoService.solicitarCuenta(mesa, 'QR', this.totalConPropina()).subscribe({
        next: () => {
          this.confirmandoPago.set(false);
          this.notificacionEnviada.set(true);
          this.pantallaActual.set('esperando-confirmacion-caja');
          try {
            localStorage.setItem(`tukuypaj_esperando_caja_${mesa}`, 'true');
            localStorage.setItem(`tukuypaj_metodo_pago_${mesa}`, 'qr');
          } catch (e) {}
        },
        error: () => {
          this.confirmandoPago.set(false);
          this.errorPago.set('No se pudo notificar el pago QR. Intenta de nuevo.');
        },
      });
    }
  }

  /**
   * Permite al cliente volver a la pantalla de selección para corregir billete o método si lo necesita
   */
  modificarMetodoPago(): void {
    const mesa = this.mesaNumero();
    try {
      localStorage.removeItem(`tukuypaj_esperando_caja_${mesa}`);
    } catch (e) {}
    this.pantallaActual.set('cuenta-entregada');
  }

  // ── Auto-Cierre de Seguridad y Limpieza de Mesa ──
  iniciarAutoCierre(): void {
    this.detenerAutoCierre();
    this.segundosAutoCierre.set(45);
    this.autoCierreTimer = setInterval(() => {
      const seg = this.segundosAutoCierre();
      if (seg <= 1) {
        this.detenerAutoCierre();
        this.finalizarYSalir();
      } else {
        this.segundosAutoCierre.set(seg - 1);
      }
    }, 1000);
  }

  detenerAutoCierre(): void {
    if (this.autoCierreTimer) {
      clearInterval(this.autoCierreTimer);
      this.autoCierreTimer = null;
    }
  }

  /**
   * Purgado de seguridad: limpia de inmediato carritos, comanda activa,
   * borradores y chats de IA para que ningún tercero o comensal posterior
   * pueda manipular o consultar la comanda de la persona que ya pagó.
   */
  limpiarSesionMesaSegura(limpiarMesaAsignada = false): void {
    this.detenerPolling();
    this.carritoService.limpiarCarrito();

    const mesa = this.mesaNumero();
    const mesaBackend = formatearMesaParaBackend(mesa);

    try {
      localStorage.removeItem(`tukuypaj_pedido_activo_${mesa}`);
      localStorage.removeItem(`tukuypaj_pedido_activo_${mesaBackend}`);
      localStorage.removeItem(`tukuypaj_esperando_caja_${mesa}`);
      localStorage.removeItem(`tukuypaj_esperando_caja_${mesaBackend}`);
      localStorage.removeItem(`tukuypaj_metodo_pago_${mesa}`);
      localStorage.removeItem(`tukuypaj_metodo_pago_${mesaBackend}`);
      localStorage.removeItem(`tukuypaj_paga_con_${mesa}`);
      localStorage.removeItem(`tukuypaj_paga_con_${mesaBackend}`);
      localStorage.removeItem('tukuypaj_carrito');
      localStorage.removeItem(`tukuypaj_comanda_borrador_${mesa}`);
      localStorage.removeItem(`tukuypaj_comanda_borrador_${mesaBackend}`);
      sessionStorage.removeItem(`tukuypaj_chat_sesion_${mesa}`);
      sessionStorage.removeItem(`tukuypaj_chat_sesion_${mesaBackend}`);
      if (limpiarMesaAsignada) {
        localStorage.removeItem('tukuypaj_mesa_asignada');
      }
    } catch (e) {}
  }

  /**
   * Cierra definitivamente la sesión del comensal y muestra pantalla segura de mesa liberada
   */
  finalizarYSalir(): void {
    this.detenerAutoCierre();
    this.limpiarSesionMesaSegura(false);
    this.pantallaActual.set('completado');

    // Redirigir a la carta limpia tras 3 segundos
    setTimeout(() => {
      this.router.navigate(['/carta'], {
        queryParams: { mesa: this.mesaNumero() },
      });
    }, 3000);
  }

  /**
   * Inicia una nueva atención 100% limpia para un nuevo cliente en la misma mesa
   */
  iniciarNuevaAtencion(): void {
    this.detenerAutoCierre();
    const mesa = this.mesaNumero();
    this.limpiarSesionMesaSegura(false);
    this.router.navigate(['/carta'], {
      queryParams: { mesa },
    });
  }

  // Alias compatibles con plantillas existentes
  finalizarDirecto(): void {
    this.finalizarYSalir();
  }

  irAFeedback(): void {
    this.iniciarNuevaAtencion();
  }

  // Métodos de calificación preservados por retrocompatibilidad
  seleccionarEstrellas(n: number): void {
    this.estrellas.set(n);
  }

  seleccionarCalificacion(tipo: CalificacionRapida): void {
    this.calificacionRapida.set(tipo);
  }

  enviarFeedback(): void {
    this.enviandoFeedback.set(true);
    setTimeout(() => {
      this.enviandoFeedback.set(false);
      this.finalizarYSalir();
    }, 600);
  }
}
