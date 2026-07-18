import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DatosRecibo {
  transaccionId: string;
  nroRecibo: string;
  fecha: string;
  mesa: { numero: string };
  mesero: { nombre: string };
  cajero: { nombre: string };
  items: {
    nombre: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
    notas?: string;
  }[];
  subtotal: number;
  total: number;
  metodoPago: string;
  montoRecibido: number;
  cambio: number;
  nit?: string | null;
  razonSocial?: string | null;
}

@Component({
  selector: 'app-comprobante',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './comprobante.component.html',
  styleUrls: ['./comprobante.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class ComprobanteComponent {
  @Input() isOpen = false;
  @Input() datos: DatosRecibo | null = null;
  @Output() close = new EventEmitter<void>();

  get qrControlUrl(): string {
    if (!this.datos) return '';
    const hash = this.generarHashControl();
    const payload = `TKY|${this.datos.nroRecibo}|${hash}|Bs.${this.datos.total}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(payload)}`;
  }

  get hashControl(): string {
    return this.generarHashControl();
  }

  get fechaFormateada(): string {
    if (!this.datos?.fecha) return '';
    const d = new Date(this.datos.fecha);
    return d.toLocaleDateString('es-BO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  get horaFormateada(): string {
    if (!this.datos?.fecha) return '';
    const d = new Date(this.datos.fecha);
    return d.toLocaleTimeString('es-BO', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  get metodoPagoLabel(): string {
    switch (this.datos?.metodoPago) {
      case 'EFECTIVO': return 'Efectivo';
      case 'TARJETA': return 'Tarjeta';
      case 'QR': return 'Transferencia QR';
      default: return this.datos?.metodoPago || '';
    }
  }

  imprimirRecibo() {
    window.print();
  }

  cerrar() {
    this.close.emit();
  }

  private generarHashControl(): string {
    if (!this.datos) return '000000';
    const raw = `${this.datos.transaccionId}-${this.datos.total}-${this.datos.fecha}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const chr = raw.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8);
  }
}
