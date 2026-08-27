import { Injectable } from '@angular/core';
import * as QRCode from 'qrcode';

export interface FacturaData {
  id?: string;
  nroFactura: string;
  codigoControl: string;
  nitEmisor: string;
  razonSocialEmisor: string;
  casaMatriz: string;
  telefonoEmisor: string;
  municipio: string;
  nitCliente: string;
  razonSocialCliente: string;
  telefonoCliente?: string;
  mesaNumero: string;
  fechaEmision: string;
  items: Array<{
    nombre: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
  }>;
  subtotal: number;
  propina: number;
  total: number;
  metodoPago: string;
  qrCodeUrl?: string;
  qrPayload?: string;
  leyendaFiscal?: string;
}

@Injectable({
  providedIn: 'root',
})
export class FacturaPdfService {

  /**
   * Convierte un número en su representación literal en bolivianos (ej. CIENTO VEINTICINCO 00/100 BOLIVIANOS).
   */
  numeroALetras(monto: number): string {
    const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const especiales = ['ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
    const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    const parteEntera = Math.floor(monto || 0);
    const centavos = Math.round(((monto || 0) - parteEntera) * 100).toString().padStart(2, '0');

    if (parteEntera === 0) return `CERO ${centavos}/100 BOLIVIANOS`;
    if (parteEntera === 100) return `CIEN ${centavos}/100 BOLIVIANOS`;

    let texto = '';

    if (parteEntera >= 1000) {
      const miles = Math.floor(parteEntera / 1000);
      texto += (miles === 1 ? 'MIL ' : `${unidades[miles]} MIL `);
    }

    const restoMil = parteEntera % 1000;
    if (restoMil > 0) {
      const c = Math.floor(restoMil / 100);
      const restoC = restoMil % 100;
      if (c > 0) texto += centenas[c] + ' ';

      if (restoC >= 11 && restoC <= 19) {
        texto += especiales[restoC - 11] + ' ';
      } else {
        const d = Math.floor(restoC / 10);
        const u = restoC % 10;
        if (d > 0) texto += decenas[d] + (u > 0 ? ' Y ' : ' ');
        if (u > 0 && !(d === 2 && u > 0)) texto += unidades[u] + ' ';
      }
    }

    return `${texto.trim()} ${centavos}/100 BOLIVIANOS`;
  }

  /**
   * Genera e imprime/descarga la Factura en PDF estampando el Código QR en Base64 e incluyendo la base de crédito fiscal.
   */
  async descargarFacturaPDF(factura: FacturaData): Promise<void> {
    if (!factura) return;

    const fecha = new Date(factura.fechaEmision || new Date());
    const fechaStr = fecha.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const horaStr = fecha.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
    const total = Number(factura.total) || 0;
    const subtotal = Number(factura.subtotal) || total;
    const propina = Number(factura.propina) || 0;
    const importeBaseCreditoFiscal = subtotal; // Excluye la propina voluntaria
    const montoLiteral = this.numeroALetras(total);

    // Protección total contra items undefined
    const items = (factura.items && Array.isArray(factura.items) && factura.items.length > 0)
      ? factura.items
      : [{ nombre: 'Consumo Peña Tukuypaj', cantidad: 1, precioUnitario: subtotal, subtotal: subtotal }];

    const itemsHtml = items.map(it => `
      <tr>
        <td style="padding: 7px 0; border-bottom: 1px dashed #cbd5e1; font-size: 13px; color: #1e293b;">
          <strong>${it.cantidad || 1}x</strong> ${it.nombre || 'Plato'}
        </td>
        <td style="padding: 7px 0; border-bottom: 1px dashed #cbd5e1; font-size: 13px; text-align: right; color: #475569;">
          Bs. ${Number(it.precioUnitario || it.subtotal || 0).toFixed(2)}
        </td>
        <td style="padding: 7px 0; border-bottom: 1px dashed #cbd5e1; font-size: 13px; text-align: right; font-weight: 700; color: #0f172a;">
          Bs. ${Number(it.subtotal || it.precioUnitario || 0).toFixed(2)}
        </td>
      </tr>
    `).join('');

    const nroFactura = factura.nroFactura || `FAC-${new Date().getFullYear()}-0042`;
    const codigoControl = factura.codigoControl || '4B-9F-1A-C8';
    const nitCliente = factura.nitCliente || '0';
    const qrPayload = factura.qrPayload || `394850021|${nroFactura}|4928301948|${fecha.toISOString().slice(0, 10)}|${total.toFixed(2)}|${nitCliente}|${codigoControl}`;

    // Generar imagen QR en Base64 con la librería 'qrcode'
    let qrBase64 = '';
    try {
      qrBase64 = await QRCode.toDataURL(qrPayload, {
        width: 180,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
    } catch (e) {
      console.warn('Error generando QR con qrcode, usando fallback:', e);
      qrBase64 = factura.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrPayload)}`;
    }

    const contenidoHtml = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Factura ${nroFactura} - Peña Tukuypaj</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 4mm;
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: #ffffff;
            color: #0f172a;
            width: 100%;
            max-width: 320px;
            margin: 0 auto;
            padding: 12px 10px;
            font-size: 12px;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 10px;
            margin-bottom: 12px;
          }
          .brand-title {
            font-size: 22px;
            font-weight: 800;
            letter-spacing: 1px;
            color: #b45309;
            margin-bottom: 2px;
          }
          .brand-sub {
            font-size: 11px;
            color: #475569;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
          }
          .nit-box {
            font-size: 11px;
            line-height: 1.4;
            color: #334155;
          }
          .badge-factura {
            display: inline-block;
            background: #0f172a;
            color: #ffffff;
            padding: 4px 12px;
            border-radius: 4px;
            font-weight: 800;
            font-size: 12px;
            letter-spacing: 1px;
            margin: 8px 0 4px 0;
          }
          .nro-factura {
            font-size: 14px;
            font-weight: 800;
            color: #0f172a;
          }
          .info-section {
            border-bottom: 1px dashed #94a3b8;
            padding-bottom: 8px;
            margin-bottom: 10px;
            font-size: 11px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
          }
          .info-label { color: #64748b; font-weight: 600; }
          .info-val { font-weight: 700; color: #0f172a; text-align: right; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
          }
          .totals-section {
            border-top: 1px solid #0f172a;
            border-bottom: 2px solid #0f172a;
            padding: 8px 0;
            margin-bottom: 10px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            margin-bottom: 4px;
          }
          .total-highlight {
            font-size: 16px;
            font-weight: 800;
            color: #b45309;
            padding-top: 4px;
            border-top: 1px dashed #cbd5e1;
          }
          .base-credito-row {
            font-size: 11px;
            font-weight: 700;
            color: #0f172a;
            padding-top: 4px;
            border-top: 1px dashed #cbd5e1;
            margin-top: 3px;
          }
          .literal-box {
            font-size: 10px;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            padding: 6px;
            border-radius: 4px;
            margin-bottom: 10px;
            text-align: center;
            font-weight: 700;
            color: #334155;
          }
          .qr-section {
            text-align: center;
            margin-bottom: 10px;
          }
          .qr-img {
            width: 140px;
            height: 140px;
            margin: 0 auto 4px auto;
            border: 1px solid #cbd5e1;
            padding: 4px;
            border-radius: 6px;
            display: block;
            background: #ffffff;
          }
          .control-code {
            font-family: monospace;
            font-size: 12px;
            font-weight: 800;
            color: #0f172a;
            background: #f1f5f9;
            padding: 4px 8px;
            border-radius: 4px;
            display: inline-block;
            margin-top: 2px;
          }
          .footer-legal {
            text-align: center;
            font-size: 9px;
            color: #64748b;
            line-height: 1.3;
            border-top: 1px dashed #cbd5e1;
            padding-top: 8px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="brand-title">TUKUYPAJ</h1>
          <p class="brand-sub">Peña Restaurant Tradicional</p>
          <div class="nit-box">
            <strong>${factura.razonSocialEmisor || 'Peña Restaurant Tukuypaj S.R.L.'}</strong><br>
            NIT: ${factura.nitEmisor || '394850021'}<br>
            Casa Matriz: ${factura.casaMatriz || 'Av. Heroínas #456, Zona Central'}<br>
            ${factura.municipio || 'Cochabamba - Bolivia'} • Tel: ${factura.telefonoEmisor || '+591 4 4567890'}
          </div>
          <div class="badge-factura">FACTURA ELECTRÓNICA</div>
          <div class="nro-factura">N° ${nroFactura}</div>
        </div>

        <div class="info-section">
          <div class="info-row">
            <span class="info-label">FECHA Y HORA:</span>
            <span class="info-val">${fechaStr} - ${horaStr}</span>
          </div>
          <div class="info-row">
            <span class="info-label">MESA:</span>
            <span class="info-val">Mesa ${factura.mesaNumero || 'M01'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">SEÑOR(ES):</span>
            <span class="info-val">${factura.razonSocialCliente || 'Cliente Final'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">NIT / CI:</span>
            <span class="info-val">${nitCliente}</span>
          </div>
          <div class="info-row">
            <span class="info-label">FORMA DE PAGO:</span>
            <span class="info-val">${(factura.metodoPago || 'EFECTIVO').toUpperCase()}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr style="border-bottom: 1px solid #0f172a; font-size: 11px; text-align: left; color: #475569;">
              <th style="padding-bottom: 4px;">DETALLE</th>
              <th style="padding-bottom: 4px; text-align: right;">P.UNIT</th>
              <th style="padding-bottom: 4px; text-align: right;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="totals-section">
          <div class="total-row">
            <span>SUBTOTAL</span>
            <span>Bs. ${subtotal.toFixed(2)}</span>
          </div>
          ${propina > 0 ? `
            <div class="total-row">
              <span>PROPINA VOLUNTARIA</span>
              <span>Bs. ${propina.toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="total-row total-highlight">
            <span>TOTAL A PAGAR</span>
            <span>Bs. ${total.toFixed(2)}</span>
          </div>
          <div class="total-row base-credito-row">
            <span>IMPORTE BASE CRÉDITO FISCAL</span>
            <span>Bs. ${importeBaseCreditoFiscal.toFixed(2)}</span>
          </div>
        </div>

        <div class="literal-box">
          SON: ${montoLiteral}
        </div>

        <div class="qr-section">
          <img src="${qrBase64}" alt="QR Tributario" class="qr-img" />
          <div style="font-size: 10px; color: #64748b; margin-bottom: 2px;">CÓDIGO DE CONTROL:</div>
          <div class="control-code">${codigoControl}</div>
        </div>

        <div class="footer-legal">
          <p><strong>"ESTA FACTURA CONTRIBUYE AL DESARROLLO DEL PAÍS, EL USO ILÍCITO DE ÉSTA SERÁ SANCIONADO PENALMENTE DE ACUERDO A LEY."</strong></p>
          <p style="margin-top: 6px;">¡Gracias por su preferencia en Peña Tukuypaj!</p>
        </div>
      </body>
      </html>
    `;

    // Usar iframe embebido seguro para invocar la impresión / guardado PDF
    const existingIframe = document.getElementById('factura-print-iframe');
    if (existingIframe) {
      existingIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'factura-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(contenidoHtml);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }, 350);
    }
  }

  /**
   * Abre directamente WhatsApp con un enlace infalible.
   */
  enviarFacturaWhatsApp(factura: FacturaData, telefonoInput?: string): void {
    if (!factura) return;

    const telefono = telefonoInput || factura.telefonoCliente || '';
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

    const items = (factura.items && Array.isArray(factura.items) && factura.items.length > 0)
      ? factura.items
      : [{ nombre: 'Consumo Peña Tukuypaj', cantidad: 1, precioUnitario: subtotal, subtotal: subtotal }];

    let itemsTexto = '';
    items.forEach(it => {
      const cant = it.cantidad || 1;
      const sub = Number(it.subtotal || it.precioUnitario || 0);
      itemsTexto += `• ${cant}x ${it.nombre} — Bs. ${sub.toFixed(2)}\n`;
    });

    const textoMensaje =
`━━━━━━━━━━━━━━━━━━━━━━
*PEÑA RESTAURANT TUKUYPAJ S.R.L.*
*COMPROBANTE FISCAL DIGITAL*
━━━━━━━━━━━━━━━━━━━━━━
*N° Factura:* ${factura.nroFactura || 'FAC-2026-0042'}
*Fecha:* ${fechaFormateada} - ${horaFormateada}
*Mesa:* Mesa ${factura.mesaNumero || 'M01'}
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
*Código de Control:* ${factura.codigoControl || '4B-9F-1A-C8'}
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
}
