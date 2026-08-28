import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LucideAngularModule } from 'lucide-angular';
import { CarritoService } from '../../services/carrito.service';
import { FacturaPdfService, FacturaData } from '../../services/factura-pdf.service';
import { SocketPublicoService } from '../../services/socket-publico.service';

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
  private readonly socketPublico = inject(SocketPublicoService);
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

  // ── WhatsApp Modal State ──
  mostrarModalWhatsApp = signal<boolean>(false);
  telefonoWhatsAppInput = signal<string>('');
  errorWhatsApp = signal<string | null>(null);

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
        if (evento.transaccion) {
          this.facturaEmitida.set(this.construirFacturaDesdeTransaccion(evento.transaccion));
        } else {
          this.emitirFacturaAutomatica();
        }
        this.pantallaActual.set('recibo-digital');
        this.carritoService.limpiarCarrito();
        try {
          localStorage.removeItem(`tukuypaj_pedido_activo_${currentMesa}`);
        } catch (e) {}
      }
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
    const raw = (event.target as HTMLInputElement).value;
    const sanitized = raw.replace(/\D/g, '').slice(0, 8);
    this.telefono.set(sanitized);
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

      if (this.metodoPago() === 'qr') {
        // Ir a pantalla de transferencia y subida de comprobante QR
        this.pantallaActual.set('escaneo-qr');
      } else {
        // Pago en efectivo -> Mostrar pantalla de espera segura de garzón
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
      motivo: `Verificación Comprobante Pago QR (${this.nroTransaccion() || 'Sin Ref'}) — Total: Bs. ${this.totalConPropina().toFixed(2)}`,
    }).subscribe({
      next: () => {
        console.log('Notificación de comprobante QR enviada a caja');
        this.verificandoPago.set(false);
        this.notificacionEfectivoEnviada.set(true);
        this.pantallaActual.set('notificacion-efectivo');
      },
      error: (err) => {
        console.error('Error notificando comprobante QR', err);
        this.verificandoPago.set(false);
        this.errorComprobante.set('No se pudo enviar el comprobante. Intenta nuevamente.');
      },
    });
  }

  private construirFacturaDesdeTransaccion(tx: any): FacturaData {
    const items = (tx?.items && Array.isArray(tx.items) && tx.items.length > 0)
      ? tx.items
      : this.obtenerItemsActuales();

    return {
      nroFactura: tx?.nroRecibo || `FAC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      codigoControl: '4B-9F-1A-C8',
      nitEmisor: '394850021',
      razonSocialEmisor: 'Peña Restaurant Tukuypaj S.R.L.',
      casaMatriz: 'Av. Heroínas #456, Zona Central',
      telefonoEmisor: '+591 4 4567890',
      municipio: 'Cochabamba - Bolivia',
      nitCliente: tx?.nit || this.nit() || '0',
      razonSocialCliente: tx?.razonSocial || this.razonSocial() || 'Cliente Final',
      telefonoCliente: this.telefono(),
      mesaNumero: tx?.mesa?.numero || this.mesaNumero() || 'M01',
      fechaEmision: tx?.fecha || new Date().toISOString(),
      items,
      subtotal: Number(tx?.subtotal || this.subtotal()),
      propina: this.propinaMonto(),
      total: Number(tx?.total || this.totalConPropina()),
      metodoPago: tx?.metodoPago || this.metodoPago()?.toUpperCase() || 'EFECTIVO',
      qrCodeUrl: '',
      qrPayload: '',
      leyendaFiscal: 'ESTA FACTURA CONTRIBUYE AL DESARROLLO DEL PAÍS, EL USO ILÍCITO SERÁ SANCIONADO PENALMENTE DE ACUERDO A LEY',
    };
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

    this.http.post<any>(`${this.baseUrl}/caja/emitir-factura`, payload).subscribe({
      next: (res) => {
        this.facturaEmitida.set(res.data);
        this.generandoFactura.set(false);
      },
      error: () => {
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
    const rawTel = (this.telefono() || '').trim().replace(/\D/g, '');
    if (!rawTel || rawTel.length < 8) {
      // Si no tiene número o tiene menos de 8 dígitos, abrir modal para pedirlo
      this.telefonoWhatsAppInput.set(rawTel);
      this.errorWhatsApp.set(null);
      this.mostrarModalWhatsApp.set(true);
      return;
    }

    this.ejecutarEnvioWhatsApp(rawTel);
  }

  confirmarModalWhatsApp(): void {
    const clean = this.telefonoWhatsAppInput().replace(/\D/g, '');
    if (!clean || clean.length < 8) {
      this.errorWhatsApp.set('Por favor, ingresa un número de celular boliviano válido de 8 dígitos (Ej: 71234567 o 61234567).');
      return;
    }

    this.telefono.set(clean);
    this.mostrarModalWhatsApp.set(false);
    this.ejecutarEnvioWhatsApp(clean);
  }

  actualizarTelefonoModal(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const sanitized = raw.replace(/\D/g, '').slice(0, 8);
    this.telefonoWhatsAppInput.set(sanitized);
  }

  cerrarModalWhatsApp(): void {
    this.mostrarModalWhatsApp.set(false);
    this.errorWhatsApp.set(null);
  }

  private ejecutarEnvioWhatsApp(phone8Digits: string): void {
    const factura = this.obtenerFacturaCompleta();
    const phoneWithPrefix = `591${phone8Digits}`;

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

    const url = `https://wa.me/${phoneWithPrefix}?text=${encodeURIComponent(textoMensaje)}`;

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
        nombre: it.nombre + (it.varianteNombre ? ` (${it.varianteNombre})` : ''),
        cantidad: it.cantidad,
        precioUnitario: it.precioUnitario,
        subtotal: it.precioUnitario * it.cantidad,
      }));
    }
    const cItems = this.carritoService.items();
    if (cItems && cItems.length > 0) {
      return cItems.map(it => ({
        nombre: it.nombre + (it.varianteNombre ? ` (${it.varianteNombre})` : ''),
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

  finalizarDirecto(): void {
    this.carritoService.limpiarCarrito();
    try {
      localStorage.removeItem(`tukuypaj_pedido_activo_${this.mesaNumero()}`);
    } catch (e) {}
    this.pantallaActual.set('completado');

    setTimeout(() => {
      this.router.navigate(['/carta'], {
        queryParams: { mesa: this.mesaNumero() },
      });
    }, 2500);
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

  // ── Volver ──
  volver(): void {
    this.router.navigate(['/carta'], {
      queryParams: { mesa: this.mesaNumero() },
    });
  }
}
