import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

export interface PedidoParaCobro {
  pedidoId: string;
  mesaNumero: string;
  meseroNombre: string;
  items: { nombre: string; precio: number; cantidad: number; notas: string }[];
  subtotal: number;
}

@Component({
  selector: 'app-caja-cobro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './caja-cobro.component.html',
  styleUrls: ['./caja-cobro.component.scss'],
})
export class CajaCobroComponent {
  private http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3000/api';

  // Exponer encodeURIComponent para usarlo en la plantilla
  encodeURIComponent = encodeURIComponent;

  @Input() isOpen = false;
  
  pedidoSignal = signal<PedidoParaCobro | null>(null);
  @Input() set pedido(val: PedidoParaCobro | null) {
    this.pedidoSignal.set(val);
    if (val) {
      this.montoRecibido.set(val.subtotal); // Pre-cargar el subtotal como monto recibido sugerido
    }
  }
  get pedido() {
    return this.pedidoSignal();
  }

  @Output() close = new EventEmitter<void>();
  @Output() pagado = new EventEmitter<any>();

  // ── Signals de Estado ──
  metodoPago = signal<'EFECTIVO' | 'TARJETA' | 'QR'>('EFECTIVO');
  montoRecibido = signal<number>(0);
  isProcessing = signal(false);
  errorMsg = signal('');

  // Facturación opcional
  facturaRequerida = signal<boolean>(false);
  nit = signal<string>('');
  razonSocial = signal<string>('');

  // ── Computed Signals ──
  totalConDescuento = computed(() => {
    return this.pedidoSignal()?.subtotal ?? 0;
  });

  cambioCalculado = computed(() => {
    if (this.metodoPago() !== 'EFECTIVO') return 0;
    return Math.max(0, this.montoRecibido() - this.totalConDescuento());
  });

  esMontoSuficiente = computed(() => {
    if (this.metodoPago() !== 'EFECTIVO') return true;
    return this.montoRecibido() >= this.totalConDescuento();
  });


  // ── Acciones ──
  seleccionarMetodo(metodo: 'EFECTIVO' | 'TARJETA' | 'QR') {
    this.metodoPago.set(metodo);
    this.errorMsg.set('');
  }

  onMontoInput(value: string) {
    this.montoRecibido.set(parseFloat(value) || 0);
  }



  toggleFactura(event: any) {
    this.facturaRequerida.set(event.target.checked);
    if (!event.target.checked) {
      this.nit.set('');
      this.razonSocial.set('');
    }
  }

  onNitInput(value: string) {
    this.nit.set(value);
  }

  onRazonSocialInput(value: string) {
    this.razonSocial.set(value);
  }

  confirmarPago() {
    if (!this.pedido) return;
    if (!this.esMontoSuficiente()) {
      this.errorMsg.set('El monto recibido es insuficiente.');
      return;
    }
    if (this.facturaRequerida()) {
      if (!this.nit().trim()) {
        this.errorMsg.set('Por favor, ingrese el NIT o CI.');
        return;
      }
      if (!this.razonSocial().trim()) {
        this.errorMsg.set('Por favor, ingrese la Razón Social.');
        return;
      }
    }

    this.isProcessing.set(true);
    this.errorMsg.set('');

    const payload = {
      pedidoId: this.pedido.pedidoId,
      metodoPago: this.metodoPago(),
      montoRecibido: this.metodoPago() === 'EFECTIVO'
        ? this.montoRecibido()
        : this.totalConDescuento(),
      nit: this.facturaRequerida() ? this.nit().trim() : null,
      razonSocial: this.facturaRequerida() ? this.razonSocial().trim() : null,
    };

    this.http.post<any>(`${this.baseUrl}/caja/registrar-pago`, payload).subscribe({
      next: (res) => {
        this.isProcessing.set(false);
        this.pagado.emit(res.data || res);
      },
      error: (err) => {
        this.isProcessing.set(false);
        this.errorMsg.set(
          err.error?.message || err.error?.data?.message || 'Error al procesar el pago.',
        );
      },
    });
  }

  cerrarModal() {
    if (!this.isProcessing()) {
      this.resetState();
      this.close.emit();
    }
  }

  private resetState() {
    this.metodoPago.set('EFECTIVO');
    this.montoRecibido.set(0);
    this.facturaRequerida.set(false);
    this.nit.set('');
    this.razonSocial.set('');
    this.errorMsg.set('');
  }
}
