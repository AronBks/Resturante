import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LucideAngularModule } from 'lucide-angular';
import { CarritoService } from '../../services/carrito.service';
import { FacturaPdfService, FacturaData } from '../../services/factura-pdf.service';

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
  private readonly facturaPdfService = inject(FacturaPdfService);
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
  telefono = signal<string>('');
  facturaEmitida = signal<FacturaData | null>(null);
  generandoFactura = signal<boolean>(false);
  enlaceCopiado = signal<boolean>(false);

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

  // ── Facturación Input Handlers ──
  actualizarNit(event: Event): void {
    this.nit.set((event.target as HTMLInputElement).value);
  }

  actualizarRazonSocial(event: Event): void {
    this.razonSocial.set((event.target as HTMLInputElement).value);
  }

  actualizarTelefono(event: Event): void {
    this.telefono.set((event.target as HTMLInputElement).value);
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
        this.emitirFacturaAutomatica();
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

  // ── Copiar Datos de Cuenta Bancaria ──
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

    // Emisión automática de la factura
    this.emitirFacturaAutomatica();

    setTimeout(() => {
      this.verificandoPago.set(false);
      this.pantallaActual.set('recibo-digital');
    }, 1200);
  }

  // ── Emisión de Factura Digital Automática ──
  emitirFacturaAutomatica(): void {
    this.generandoFactura.set(true);

    const items = this.pedido()?.items.map(it => ({
      nombre: it.nombre,
      cantidad: it.cantidad,
      precioUnitario: it.precioUnitario,
      subtotal: it.precioUnitario * it.cantidad,
    })) || [
      { nombre: 'Chicharrón de Cerdo', cantidad: 1, precioUnitario: 85, subtotal: 85 },
      { nombre: 'Mocochinchi', cantidad: 2, precioUnitario: 20, subtotal: 40 },
    ];

    const payload = {
      mesaNumero: this.mesaNumero(),
      nit: this.nit().trim() || '0',
      razonSocial: this.razonSocial().trim() || 'Cliente Final',
      telefono: this.telefono().trim(),
      metodoPago: this.metodoPago() || 'qr',
      propinaPorcentaje: this.propinaPorcentaje(),
      propinaMonto: this.propinaMonto(),
      items,
    };

    this.http.post<FacturaData>(`${this.baseUrl}/caja/factura-digital`, payload).subscribe({
      next: (factura) => {
        this.facturaEmitida.set(factura);
        this.generandoFactura.set(false);
      },
      error: (err) => {
        console.warn('Fallback a factura generada en frontend:', err);
        // Fallback robusto en el frontend si el servidor no responde
        const fallbackFactura: FacturaData = {
          nroFactura: `FAC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          codigoControl: '4B-9F-1A-C8',
          nitEmisor: '394850021',
          razonSocialEmisor: 'Peña Restaurant Tukuypaj S.R.L.',
          casaMatriz: 'Av. Heroínas #456, Zona Central',
          telefonoEmisor: '+591 4 4567890',
          municipio: 'Cochabamba - Bolivia',
          nitCliente: payload.nit,
          razonSocialCliente: payload.razonSocial,
          telefonoCliente: payload.telefono,
          mesaNumero: payload.mesaNumero,
          fechaEmision: new Date().toISOString(),
          items,
          subtotal: this.subtotal(),
          propina: this.propinaMonto(),
          total: this.totalConPropina(),
          metodoPago: payload.metodoPago,
          qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent('TUKUYPAJ|' + payload.nit + '|' + this.totalConPropina())}`,
        };
        this.facturaEmitida.set(fallbackFactura);
        this.generandoFactura.set(false);
      },
    });
  }

  // ── QR Actions ──
  simularPagoExitoso(): void {
    this.verificarYConfirmarPago();
  }

  cancelarQR(): void {
    this.pantallaActual.set('pago');
  }

  // ── Recibo Digital & Facturación Actions ──
  cambiarVarianteRecibo(variante: VarianteRecibo): void {
    this.varianteRecibo.set(variante);
  }

  descargarFacturaPDF(): void {
    const factura = this.obtenerFacturaCompleta();
    this.facturaPdfService.descargarFacturaPDF(factura);
  }

  enviarFacturaWhatsApp(): void {
    const factura = this.obtenerFacturaCompleta();
    const telefono = this.telefono() || factura.telefonoCliente || '';
    const cleanPhone = telefono.replace(/\D/g, '');
    const phoneWithPrefix = cleanPhone.length >= 7
      ? (cleanPhone.startsWith('591') ? cleanPhone : `591${cleanPhone}`)
      : '';

    const fecha = new Date(factura.fechaEmision || new Date());
    const fechaFormateada = fecha.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const horaFormateada = fecha.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
    const total = Number(factura.total) || 0;
    const subtotal = Number(factura.subtotal) || total;
    const propina = Number(factura.propina) || 0;
    const baseCreditoFiscal = subtotal;

    const facturaId = factura.id || factura.nroFactura;
    const pdfUrl = `${window.location.protocol}//${window.location.hostname}:3000/api/caja/factura/${facturaId}/pdf`;

    let itemsTexto = '';
    factura.items.forEach(it => {
      const cant = it.cantidad || 1;
      const sub = Number(it.subtotal || it.precioUnitario || 0);
      itemsTexto += `• ${cant}x ${it.nombre} — Bs. ${sub.toFixed(2)}\n`;
    });

    const textoMensaje =
`━━━━━━━━━━━━━━━━━━━━━━
*PEÑA RESTAURANT TUKUYPAJ S.R.L.*
*COMPROBANTE FISCAL DIGITAL*
━━━━━━━━━━━━━━━━━━━━━━
*N° Factura:* ${factura.nroFactura}
*Fecha:* ${fechaFormateada} - ${horaFormateada}
*Mesa:* Mesa ${factura.mesaNumero}
*Señor(es):* ${factura.razonSocialCliente || 'Cliente Final'}
*NIT/CI:* ${factura.nitCliente || '0'}
*Forma de Pago:* ${(factura.metodoPago || 'EFECTIVO').toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━
*DETALLE DEL CONSUMO:*
${itemsTexto.trim()}
━━━━━━━━━━━━━━━━━━━━━━
*Subtotal:* Bs. ${subtotal.toFixed(2)}
${propina > 0 ? `*Propina Voluntaria:* Bs. ${propina.toFixed(2)}\n` : ''}*TOTAL PAGADO:* Bs. ${total.toFixed(2)}
*Importe Base Crédito Fiscal:* Bs. ${baseCreditoFiscal.toFixed(2)}
━━━━━━━━━━━━━━━━━━━━━━
*Código de Control:* ${factura.codigoControl}
*Descargar Factura PDF:* ${pdfUrl}
━━━━━━━━━━━━━━━━━━━━━━
_"ESTA FACTURA CONTRIBUYE AL DESARROLLO DEL PAÍS, EL USO ILÍCITO DE ÉSTA SERÁ SANCIONADO PENALMENTE DE ACUERDO A LEY."_`;

    const url = phoneWithPrefix
      ? `https://wa.me/${phoneWithPrefix}?text=${encodeURIComponent(textoMensaje)}`
      : `https://wa.me/?text=${encodeURIComponent(textoMensaje)}`;

    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 200);
  }

  private obtenerFacturaCompleta(): FacturaData {
    const base = this.facturaEmitida() || this.construirFacturaLocal();
    const items = (base.items && Array.isArray(base.items) && base.items.length > 0)
      ? base.items
      : this.obtenerItemsActuales();

    return {
      nroFactura: base.nroFactura || `FAC-${new Date().getFullYear()}-0042`,
      codigoControl: base.codigoControl || '4B-9F-1A-C8',
      nitEmisor: base.nitEmisor || '394850021',
      razonSocialEmisor: base.razonSocialEmisor || 'Peña Restaurant Tukuypaj S.R.L.',
      casaMatriz: base.casaMatriz || 'Av. Heroínas #456, Zona Central',
      telefonoEmisor: base.telefonoEmisor || '+591 4 4567890',
      municipio: base.municipio || 'Cochabamba - Bolivia',
      nitCliente: base.nitCliente || this.nit() || '0',
      razonSocialCliente: base.razonSocialCliente || this.razonSocial() || 'Cliente Final',
      telefonoCliente: base.telefonoCliente || this.telefono() || '',
      mesaNumero: base.mesaNumero || this.mesaNumero() || 'M01',
      fechaEmision: base.fechaEmision || new Date().toISOString(),
      items,
      subtotal: base.subtotal || this.subtotal() || 80,
      propina: base.propina !== undefined ? base.propina : this.propinaMonto(),
      total: base.total || this.totalConPropina() || 84,
      metodoPago: base.metodoPago || this.metodoPago() || 'EFECTIVO',
      qrCodeUrl: base.qrCodeUrl,
      qrPayload: base.qrPayload,
      leyendaFiscal: base.leyendaFiscal,
    };
  }

  private obtenerItemsActuales(): Array<{ nombre: string; cantidad: number; precioUnitario: number; subtotal: number }> {
    const pItems = this.pedido()?.items;
    if (pItems && pItems.length > 0) {
      return pItems.map(it => ({
        nombre: it.nombre,
        cantidad: it.cantidad,
        precioUnitario: it.precioUnitario,
        subtotal: it.precioUnitario * it.cantidad,
      }));
    }
    const cItems = this.carritoService.items();
    if (cItems && cItems.length > 0) {
      return cItems.map(it => ({
        nombre: it.nombre,
        cantidad: it.cantidad,
        precioUnitario: it.precioUnitario,
        subtotal: it.precioUnitario * it.cantidad,
      }));
    }
    return [
      { nombre: 'Charque Tradicional', cantidad: 1, precioUnitario: this.subtotal() || 80, subtotal: this.subtotal() || 80 }
    ];
  }

  private construirFacturaLocal(): FacturaData {
    const items = this.obtenerItemsActuales();

    return {
      nroFactura: `FAC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      codigoControl: '4B-9F-1A-C8',
      nitEmisor: '394850021',
      razonSocialEmisor: 'Peña Restaurant Tukuypaj S.R.L.',
      casaMatriz: 'Av. Heroínas #456, Zona Central',
      telefonoEmisor: '+591 4 4567890',
      municipio: 'Cochabamba - Bolivia',
      nitCliente: this.nit() || '0',
      razonSocialCliente: this.razonSocial() || 'Cliente Final',
      telefonoCliente: this.telefono(),
      mesaNumero: this.mesaNumero(),
      fechaEmision: new Date().toISOString(),
      items,
      subtotal: this.subtotal(),
      propina: this.propinaMonto(),
      total: this.totalConPropina(),
      metodoPago: this.metodoPago() || 'EFECTIVO',
    };
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
