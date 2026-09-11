import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LucideAngularModule } from 'lucide-angular';
import { CarritoService } from '../../services/carrito.service';
import { SocketPublicoService } from '../../services/socket-publico.service';

type MetodoPago = 'efectivo' | 'qr' | null;
type CalificacionRapida = 'excelente' | 'regular' | 'a-mejorar' | null;
type PantallaActual = 'pago' | 'notificacion-efectivo' | 'recibo-digital' | 'feedback' | 'completado';

@Component({
  selector: 'client-cierre-cuenta',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './cierre-cuenta.component.html',
  styleUrl: './cierre-cuenta.component.scss',
})
export class CierreCuentaComponent {
  readonly carritoService = inject(CarritoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly socketPublico = inject(SocketPublicoService);
  private readonly baseUrl = 'http://localhost:3000/api';

  // ── Estado de la Pantalla ──
  pantallaActual = signal<PantallaActual>('pago');

  // ── Mesa ──
  mesaNumero = signal<string>('M01');

  // ── Propina ──
  propinaPorcentaje = signal<number>(5);

  // ── Método de Pago ──
  metodoPago = signal<MetodoPago>('efectivo');

  // ── Confirmación ──
  confirmandoPago = signal(false);
  pagoConfirmado = signal(false);
  errorPago = signal<string | null>(null);
  notificacionEnviada = signal(false);

  // ── Calificación ──
  estrellas = signal<number>(0);
  calificacionRapida = signal<CalificacionRapida>(null);
  enviandoFeedback = signal(false);

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

  subtotal = computed(() => {
    const p = this.pedido();
    if (p && p.total) return p.total;
    const cartTotal = this.carritoService.totalAcumulado();
    if (cartTotal > 0) return cartTotal;
    return 80;
  });

  propinaMonto = computed(() => {
    return Math.round(this.subtotal() * this.propinaPorcentaje() / 100 * 100) / 100;
  });

  totalConPropina = computed(() => {
    return this.subtotal() + this.propinaMonto();
  });

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      let mesa = params.get('mesa');
      if (mesa) {
        try { localStorage.setItem('tukuypaj_mesa_asignada', mesa); } catch (e) {}
      } else {
        try { mesa = localStorage.getItem('tukuypaj_mesa_asignada') || 'M01'; } catch (e) { mesa = 'M01'; }
      }
      this.mesaNumero.set(mesa);
      this.carritoService.consultarPedidoActivoMesa(mesa).subscribe();
    });

    // Escuchar confirmación oficial de cobro en caja en tiempo real
    this.socketPublico.onPagoConfirmado().subscribe((evento) => {
      const currentMesa = localStorage.getItem('tukuypaj_mesa_asignada') || this.mesaNumero();
      if (evento?.mesaNumero === currentMesa) {
        this.pagoConfirmado.set(true);
        this.pantallaActual.set('recibo-digital');
        this.carritoService.limpiarCarrito();
        try {
          localStorage.removeItem(`tukuypaj_pedido_activo_${currentMesa}`);
          sessionStorage.removeItem(`tukuypaj_chat_sesion_${currentMesa}`);
        } catch (e) {}
      }
    });
  }

  // ── Acciones de Propina ──
  seleccionarPropina(porcentaje: number): void {
    this.propinaPorcentaje.set(porcentaje);
  }

  // ── Método de Pago ──
  seleccionarMetodo(metodo: MetodoPago): void {
    this.metodoPago.set(metodo);
  }

  // ── Confirmar Pago: Notifica al garzón y espera confirmación de caja ──
  confirmarPago(): void {
    if (!this.metodoPago()) {
      this.errorPago.set('Selecciona un método de pago para continuar.');
      return;
    }

    this.confirmandoPago.set(true);
    this.errorPago.set(null);

    const motivoTexto = this.metodoPago() === 'efectivo'
      ? `Solicitud de Pago en EFECTIVO — Total: Bs. ${this.totalConPropina().toFixed(2)}`
      : `Solicitud de Pago QR — Total: Bs. ${this.totalConPropina().toFixed(2)}`;

    this.http.post(`${this.baseUrl}/pedidos/llamar-mesero`, {
      mesaNumero: this.mesaNumero(),
      motivo: motivoTexto,
    }).subscribe({
      next: () => console.log('Notificación de cobro enviada a administración'),
      error: (err) => console.error('Error al notificar cobro', err),
    });

    setTimeout(() => {
      this.confirmandoPago.set(false);
      this.notificacionEnviada.set(true);
      this.pantallaActual.set('notificacion-efectivo');
    }, 600);
  }

  // ── Navegar a Calificación ──
  irAFeedback(): void {
    this.pantallaActual.set('feedback');
  }

  // ── Finalizar sesión y volver a la carta ──
  finalizarDirecto(): void {
    this.carritoService.limpiarCarrito();
    try {
      localStorage.removeItem(`tukuypaj_pedido_activo_${this.mesaNumero()}`);
      sessionStorage.removeItem(`tukuypaj_chat_sesion_${this.mesaNumero()}`);
    } catch (e) {}
    this.pantallaActual.set('completado');

    setTimeout(() => {
      this.router.navigate(['/carta'], {
        queryParams: { mesa: this.mesaNumero() },
      });
    }, 2000);
  }

  // ── Calificación ──
  seleccionarEstrellas(n: number): void {
    this.estrellas.set(n);
  }

  seleccionarCalificacion(tipo: CalificacionRapida): void {
    this.calificacionRapida.set(tipo);
  }

  // ── Enviar Feedback y Cerrar ──
  enviarFeedback(): void {
    this.enviandoFeedback.set(true);
    setTimeout(() => {
      this.enviandoFeedback.set(false);
      this.finalizarDirecto();
    }, 800);
  }

  // ── Volver a la carta ──
  volver(): void {
    this.router.navigate(['/carta'], {
      queryParams: { mesa: this.mesaNumero() },
    });
  }
}
