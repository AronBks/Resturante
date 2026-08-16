import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LucideAngularModule } from 'lucide-angular';
import { CarritoService } from '../../services/carrito.service';

type MetodoPago = 'efectivo' | 'qr' | null;
type CalificacionRapida = 'excelente' | 'regular' | 'a-mejorar' | null;
type PantallaActual = 'pago' | 'escaneo-qr' | 'notificacion-efectivo' | 'recibo-digital' | 'feedback' | 'completado';
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
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3000/api';

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

  notificacionEfectivoEnviada = signal(false);

  // ── Confirmar Pago ──
  confirmarPago(): void {
    if (!this.metodoPago()) {
      this.errorPago.set('Selecciona un método de pago para continuar.');
      return;
    }

    this.confirmandoPago.set(true);
    this.errorPago.set(null);

    // Emitir notificación en tiempo real a la parte administrativa vía backend
    const motivoTexto = this.metodoPago() === 'efectivo'
      ? `Solicitud Pago en EFECTIVO — Total: Bs. ${this.totalConPropina().toFixed(2)}`
      : `Iniciando Pago QR — Total: Bs. ${this.totalConPropina().toFixed(2)}`;

    this.http.post(`${this.baseUrl}/pedidos/llamar-mesero`, {
      mesaNumero: this.mesaNumero(),
      motivo: motivoTexto,
    }).subscribe({
      next: () => console.log('Notificación de solicitud de pago emitida exitosamente a administración'),
      error: (err) => console.error('Error notificando solicitud de pago', err),
    });

    setTimeout(() => {
      this.confirmandoPago.set(false);
      this.pagoConfirmado.set(true);

      if (this.metodoPago() === 'qr') {
        // Ir a pantalla de transferencia y subida de comprobante QR
        this.pantallaActual.set('escaneo-qr');
      } else {
        // Pago en efectivo -> Mostrar pantalla/modal elegante de notificación enviada
        this.notificacionEfectivoEnviada.set(true);
        this.pantallaActual.set('notificacion-efectivo');
      }
    }, 600);
  }

  // ── Comprobante de Pago QR ──
  comprobanteFile = signal<File | null>(null);
  comprobantePreviewUrl = signal<string | null>(null);
  nroTransaccion = signal<string>('');
  copiadoExito = signal<boolean>(false);
  verificandoPago = signal<boolean>(false);
  errorComprobante = signal<string | null>(null);

  // ── Copiar Datos de Cuenta ──
  copiarDatosCuenta(): void {
    const text = `Peña Restaurant Tukuypaj S.R.L.\nBanco: Banco Nacional de Bolivia (BNB)\nNro. Cuenta: 1029384756 (Simple QR)\nNIT: 394850021\nMonto: Bs. ${this.totalConPropina().toFixed(2)}\nConcepto: Mesa ${this.mesaNumero()}`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.copiadoExito.set(true);
        setTimeout(() => this.copiadoExito.set(false), 2500);
      }).catch(() => {
        alert('Datos de cuenta copiados al portapapeles.');
      });
    } else {
      alert('Datos de cuenta copiados al portapapeles.');
    }
  }

  // ── Descargar QR ──
  descargarQRImage(): void {
    const svgElement = document.querySelector('.qr-svg') as SVGElement;
    if (svgElement) {
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `QR_Pago_Tukuypaj_Mesa_${this.mesaNumero()}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      alert(`Imagen del Código QR guardada para transferir Bs. ${this.totalConPropina().toFixed(2)}.`);
    }
  }

  // ── Selección de Comprobante ──
  onComprobanteSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      if (!file.type.startsWith('image/')) {
        this.errorComprobante.set('Por favor selecciona un archivo de imagen (JPG, PNG).');
        return;
      }
      this.errorComprobante.set(null);
      this.comprobanteFile.set(file);

      const reader = new FileReader();
      reader.onload = () => {
        this.comprobantePreviewUrl.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  quitarComprobante(event?: Event): void {
    if (event) event.stopPropagation();
    this.comprobanteFile.set(null);
    this.comprobantePreviewUrl.set(null);
  }

  // ── Verificar y Confirmar Pago ──
  verificarYConfirmarPago(): void {
    this.verificandoPago.set(true);
    this.errorComprobante.set(null);

    // Emitir evento al backend para alertar a la administración
    this.http.post(`${this.baseUrl}/pedidos/llamar-mesero`, {
      mesaNumero: this.mesaNumero(),
      motivo: `Verificación Comprobante Pago QR — Total: Bs. ${this.totalConPropina().toFixed(2)}`,
    }).subscribe({
      next: () => console.log('Notificación de comprobante QR enviada'),
      error: (err) => console.error('Error notificando comprobante QR', err),
    });

    setTimeout(() => {
      this.verificandoPago.set(false);
      this.pantallaActual.set('recibo-digital');
    }, 1200);
  }

  // ── QR Actions ──
  simularPagoExitoso(): void {
    this.verificarYConfirmarPago();
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
