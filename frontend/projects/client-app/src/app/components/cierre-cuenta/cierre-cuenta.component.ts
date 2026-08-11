import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { CarritoService } from '../../services/carrito.service';

type MetodoPago = 'efectivo' | 'qr' | null;
type CalificacionRapida = 'excelente' | 'regular' | 'a-mejorar' | null;
type PantallaActual = 'pago' | 'escaneo-qr' | 'recibo-digital' | 'feedback' | 'completado';
type VarianteRecibo = 'cinematografica' | 'minimalista';

@Component({
  selector: 'client-cierre-cuenta',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './cierre-cuenta.component.html',
  styleUrl: './cierre-cuenta.component.scss',
})
export class CierreCuentaComponent {
  readonly carritoService = inject(CarritoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // ── Estado de la Pantalla ──
  pantallaActual = signal<PantallaActual>('pago');
  varianteRecibo = signal<VarianteRecibo>('cinematografica');

  // ── Mesa ──
  mesaNumero = signal<string>('M01');

  // ── Propina ──
  propinaPorcentaje = signal<number>(5);

  // ── Facturación ──
  nit = signal<string>('');
  razonSocial = signal<string>('');

  // ── Método de Pago ──
  metodoPago = signal<MetodoPago>('qr');

  // ── Confirmación ──
  confirmandoPago = signal(false);
  pagoConfirmado = signal(false);
  errorPago = signal<string | null>(null);

  // ── Calificación ──
  estrellas = signal<number>(0);
  calificacionRapida = signal<CalificacionRapida>(null);
  enviandoFeedback = signal(false);

  // ── Fecha Actual Formateada ──
  fechaHoraActual = computed(() => {
    const now = new Date();
    const meses = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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
    return p ? p.total : 125;
  });

  propinaMonto = computed(() => {
    return Math.round(this.subtotal() * this.propinaPorcentaje() / 100 * 100) / 100;
  });

  totalConPropina = computed(() => {
    return this.subtotal() + this.propinaMonto();
  });

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      const mesa = params.get('mesa');
      if (mesa) this.mesaNumero.set(mesa);
    });
  }

  // ── Acciones de Propina ──
  seleccionarPropina(porcentaje: number): void {
    this.propinaPorcentaje.set(porcentaje);
  }

  // ── Facturación ──
  actualizarNit(event: Event): void {
    this.nit.set((event.target as HTMLInputElement).value);
  }

  actualizarRazonSocial(event: Event): void {
    this.razonSocial.set((event.target as HTMLInputElement).value);
  }

  // ── Método de Pago ──
  seleccionarMetodo(metodo: MetodoPago): void {
    this.metodoPago.set(metodo);
  }

  // ── Confirmar Pago ──
  confirmarPago(): void {
    if (!this.metodoPago()) {
      this.errorPago.set('Selecciona un método de pago para continuar.');
      return;
    }

    this.confirmandoPago.set(true);
    this.errorPago.set(null);

    setTimeout(() => {
      this.confirmandoPago.set(false);
      this.pagoConfirmado.set(true);

      if (this.metodoPago() === 'qr') {
        // Ir a pantalla inmersiva de escaneo QR
        this.pantallaActual.set('escaneo-qr');
      } else {
        // Pago en efectivo -> notificar mesero y pasar a recibo digital
        alert(`Se notificó al mesero: El cliente de la Mesa ${this.mesaNumero()} desea pagar en efectivo.\n\nTotal: Bs. ${this.totalConPropina().toFixed(2)}`);
        this.pantallaActual.set('recibo-digital');
      }
    }, 800);
  }

  // ── QR Scanner Actions ──
  simularPagoExitoso(): void {
    this.pantallaActual.set('recibo-digital');
  }

  cancelarQR(): void {
    this.pantallaActual.set('pago');
  }

  // ── Recibo Digital Actions ──
  cambiarVarianteRecibo(variante: VarianteRecibo): void {
    this.varianteRecibo.set(variante);
  }

  descargarPDF(): void {
    alert(`Descargando Recibo Digital PDF de Tukuypaj para Mesa ${this.mesaNumero()} (Total: Bs. ${this.totalConPropina().toFixed(2)})`);
  }

  compartirReciboDigital(): void {
    const text = `Recibo Digital Tukuypaj - Mesa ${this.mesaNumero()}: Total Bs. ${this.totalConPropina().toFixed(2)}`;
    if (navigator.share) {
      navigator.share({ title: 'Recibo Tukuypaj', text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      alert('Recibo copiado al portapapeles.');
    }
  }

  irAFeedback(): void {
    this.pantallaActual.set('feedback');
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
      this.pantallaActual.set('completado');

      setTimeout(() => {
        this.carritoService.limpiarCarrito();
        this.router.navigate(['/carta'], {
          queryParams: { mesa: this.mesaNumero() },
        });
      }, 3000);
    }, 1200);
  }

  // ── Volver ──
  volver(): void {
    this.router.navigate(['/carta'], {
      queryParams: { mesa: this.mesaNumero() },
    });
  }
}
