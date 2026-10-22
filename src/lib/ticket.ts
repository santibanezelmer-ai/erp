import { formatMoney } from "./format";

export interface TicketItem {
  nombre: string;
  qty: number;
  precio: number;
  subtotal: number;
  nota?: string | null;
}

export interface TicketData {
  negocioNombre: string;
  negocioRut?: string | null;
  negocioGiro?: string | null;
  negocioDireccion?: string | null;
  negocioComuna?: string | null;
  negocioCiudad?: string | null;
  negocioTelefono?: string | null;
  sucursalNombre?: string | null;
  logoUrl?: string | null;
  folio: string;
  fecha?: Date | string;
  cajero?: string | null;
  clienteNombre?: string | null;
  clienteRut?: string | null;
  items: TicketItem[];
  subtotal: number;
  descuento?: number;
  total: number;
  metodoPago: string;
  efectivoRecibido?: number | null;
  vuelto?: number | null;
  mensajePie?: string;
  mesa?: string | null;
  // Propiedades Fiscales Oficiales (SII Chile)
  dteTipo?: number | null; // 39: Boleta Electrónica, 33: Factura Electrónica
  dteFolio?: number | string | null;
  dteEsOficial?: boolean;
  dtePdfUrl?: string | null;
  cdgSIISucur?: number | string | null;
}

/**
 * Imprime un ticket térmico estándar de 58mm / 80mm directamente a la impresora de punto de venta
 */
export function imprimirTicketTermico(data: TicketData, anchoMm: 58 | 80 = 80) {
  const fechaStr = data.fecha
    ? new Date(data.fecha).toLocaleString("es-CL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : new Date().toLocaleString("es-CL");

  const esDteOficial = Boolean(data.dteFolio || data.dteEsOficial);
  const tipoDteNum = Number(data.dteTipo || 39);
  const dteNombre = tipoDteNum === 33 ? "FACTURA ELECTRÓNICA" : "BOLETA ELECTRÓNICA";
  const ivaEstimado = Math.round(data.total - data.total / 1.19);
  const rutEmisor = data.negocioRut || "76.000.000-0";

  const printWindow = window.open("", "_blank", "width=400,height=600");
  if (!printWindow) {
    alert("Por favor habilita las ventanas emergentes (pop-ups) para imprimir el ticket.");
    return;
  }

  const itemsHtml = data.items
    .map(
      (item) => `
      <div style="display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 11px;">
        <div style="flex: 1; padding-right: 6px;">
          <div style="font-weight: 600;">${item.nombre}</div>
          ${item.nota ? `<div style="font-size: 9px; font-style: italic; color: #555;">(${item.nota})</div>` : ""}
          <div style="font-size: 10px; color: #444;">${item.qty} x ${formatMoney(item.precio)}</div>
        </div>
        <div style="text-align: right; font-weight: 600; white-space: nowrap;">
          ${formatMoney(item.subtotal)}
        </div>
      </div>
    `
    )
    .join("");

  const content = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${esDteOficial ? `${dteNombre} N° ${data.dteFolio}` : `Ticket #${data.folio}`}</title>
        <style>
          @page {
            margin: 0;
            size: ${anchoMm}mm auto;
          }
          body {
            font-family: 'Courier New', Courier, monospace, system-ui, sans-serif;
            font-size: 11px;
            line-height: 1.25;
            margin: 0;
            padding: 8px 10px;
            color: #000;
            background: #fff;
            width: ${anchoMm}mm;
            max-width: 100%;
            box-sizing: border-box;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: 700; }
          .divider {
            border-top: 1px dashed #000;
            margin: 6px 0;
          }
          .double-divider {
            border-top: 2px dashed #000;
            margin: 6px 0;
          }
          .title {
            font-size: 14px;
            font-weight: 800;
            text-transform: uppercase;
            margin-bottom: 2px;
          }
          .totals-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
            font-size: 11px;
          }
          .grand-total {
            font-size: 14px;
            font-weight: 800;
            margin: 4px 0;
          }
          .sii-box {
            border: 2px solid #000;
            padding: 6px 4px;
            text-align: center;
            margin: 8px 0 4px 0;
            font-weight: 800;
          }
          .sii-box .sii-rut {
            font-size: 13px;
            letter-spacing: 0.5px;
          }
          .sii-box .sii-tipo {
            font-size: 13px;
            text-transform: uppercase;
            margin: 2px 0;
          }
          .sii-box .sii-folio {
            font-size: 15px;
            font-weight: 900;
          }
          @media print {
            body { padding: 4px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="text-center">
          ${
            data.logoUrl && (data.logoUrl.startsWith("http") || data.logoUrl.startsWith("data:"))
              ? `<img src="${data.logoUrl}" alt="Logo" style="max-height: 48px; max-width: 140px; margin: 0 auto 6px auto; display: block; object-fit: contain;" />`
              : ""
          }
          <div class="title">${data.negocioNombre}</div>
          ${data.negocioGiro ? `<div style="font-size: 10px; color: #222;">${data.negocioGiro}</div>` : ""}
          ${!esDteOficial && data.negocioRut ? `<div>RUT: ${data.negocioRut}</div>` : ""}
          ${data.sucursalNombre ? `<div>Sucursal: ${data.sucursalNombre}</div>` : ""}
          ${data.negocioDireccion ? `<div>${data.negocioDireccion}</div>` : ""}
          ${data.negocioComuna ? `<div>${data.negocioComuna}${data.negocioCiudad ? ` - ${data.negocioCiudad}` : ""}</div>` : ""}
          ${data.negocioTelefono ? `<div>Tel: ${data.negocioTelefono}</div>` : ""}
        </div>

        ${
          esDteOficial
            ? `
          <div class="sii-box">
            <div class="sii-rut">R.U.T.: ${rutEmisor}</div>
            <div class="sii-tipo">${dteNombre}</div>
            <div class="sii-folio">N° ${data.dteFolio}</div>
          </div>
          <div class="text-center" style="font-size: 9px; font-weight: bold; margin-bottom: 6px;">
            S.I.I. - ${data.negocioComuna ? data.negocioComuna.toUpperCase() : "SANTIAGO ORIENTE"}
          </div>
        `
            : `
          <div class="divider"></div>
          <div>
            <div style="display: flex; justify-content: space-between;">
              <span class="font-bold">COMPROBANTE: #${data.folio}</span>
              <span>${fechaStr}</span>
            </div>
          </div>
        `
        }

        <div class="divider"></div>

        <div>
          ${esDteOficial ? `<div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span>Fecha Emisión:</span><span class="font-bold">${fechaStr}</span></div>` : ""}
          ${data.mesa ? `<div class="font-bold" style="font-size: 12px; margin-top: 2px;">MESA / COMANDA: ${data.mesa}</div>` : ""}
          ${data.cajero ? `<div>Atendido por: ${data.cajero}</div>` : ""}
          ${data.clienteNombre ? `<div>Cliente: ${data.clienteNombre}</div>` : ""}
          ${data.clienteRut ? `<div>RUT Cliente: ${data.clienteRut}</div>` : ""}
        </div>

        <div class="divider"></div>

        <div>
          ${itemsHtml}
        </div>

        <div class="double-divider"></div>

        <div>
          <div class="totals-row">
            <span>Subtotal:</span>
            <span>${formatMoney(data.subtotal)}</span>
          </div>
          ${
            data.descuento && data.descuento > 0
              ? `
            <div class="totals-row" style="color: #444;">
              <span>Descuento:</span>
              <span>-${formatMoney(data.descuento)}</span>
            </div>
          `
              : ""
          }
          <div class="totals-row grand-total">
            <span>TOTAL:</span>
            <span>${formatMoney(data.total)}</span>
          </div>
          ${
            esDteOficial && tipoDteNum === 39
              ? `
            <div class="totals-row" style="font-size: 10px; color: #444; margin-top: 1px;">
              <span>(El IVA de esta boleta es: ${formatMoney(ivaEstimado)})</span>
            </div>
          `
              : ""
          }
          <div class="divider"></div>
          <div class="totals-row">
            <span>Forma de Pago:</span>
            <span style="text-transform: capitalize; font-weight: 600;">${data.metodoPago}</span>
          </div>
          ${
            data.efectivoRecibido != null && data.metodoPago === "efectivo"
              ? `
            <div class="totals-row">
              <span>Efectivo recibido:</span>
              <span>${formatMoney(data.efectivoRecibido)}</span>
            </div>
            <div class="totals-row font-bold" style="font-size: 12px;">
              <span>Vuelto (Cambio):</span>
              <span>${formatMoney(data.vuelto || 0)}</span>
            </div>
          `
              : ""
          }
        </div>

        <div class="divider"></div>

        ${
          esDteOficial
            ? `
          <div style="border: 1px solid #000; padding: 6px 4px; text-align: center; margin-top: 8px; font-size: 9px; line-height: 1.3;">
            <div style="font-weight: 800; text-transform: uppercase;">Timbre Electrónico SII</div>
            <div style="font-size: 8px; margin-top: 1px;">Res. N° 80 de 2014 - Verifique documento en www.sii.cl</div>
          </div>
          <div class="text-center" style="margin-top: 6px; font-size: 10px; font-weight: 600;">
            ${data.mensajePie || "¡Gracias por su compra!"}
          </div>
          <div class="text-center" style="font-size: 8px; color: #666; margin-top: 2px;">
            Operix ERP - Facturación eBoleta SII
          </div>
        `
            : `
          <div class="text-center" style="margin-top: 8px; font-size: 10px; color: #333;">
            <div>${data.mensajePie || "¡Gracias por su preferencia!"}</div>
            <div style="font-size: 9px; margin-top: 4px; color: #666;">Documento no válido como factura tributaria</div>
            <div style="font-size: 8px; margin-top: 2px; color: #888;">Operix ERP - Potenciado por IA</div>
          </div>
        `
        }

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            }, 250);
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(content);
  printWindow.document.close();
}

/**
 * Descarga el ticket como archivo PDF
 */
export async function descargarTicketPDF(data: TicketData) {
  const { jsPDF } = await import("jspdf");

  const esDteOficial = Boolean(data.dteFolio || data.dteEsOficial);
  const tipoDteNum = Number(data.dteTipo || 39);
  const dteNombre = tipoDteNum === 33 ? "FACTURA ELECTRÓNICA" : "BOLETA ELECTRÓNICA";
  const ivaEstimado = Math.round(data.total - data.total / 1.19);
  const rutEmisor = data.negocioRut || "76.000.000-0";

  // Formato tipo ticket (80mm de ancho x altura dinámica)
  const doc = new jsPDF({
    unit: "mm",
    format: [80, Math.max(170, 95 + data.items.length * 8)],
  });

  let y = 10;
  doc.setFont("courier", "bold");
  doc.setFontSize(11);
  doc.text(data.negocioNombre, 40, y, { align: "center" });

  y += 4;
  doc.setFont("courier", "normal");
  doc.setFontSize(7.5);
  if (data.negocioGiro) {
    doc.text(data.negocioGiro.slice(0, 36), 40, y, { align: "center" });
    y += 3.5;
  }
  if (!esDteOficial && data.negocioRut) {
    doc.text(`RUT: ${data.negocioRut}`, 40, y, { align: "center" });
    y += 3.5;
  }
  if (data.sucursalNombre) {
    doc.text(`Sucursal: ${data.sucursalNombre}`, 40, y, { align: "center" });
    y += 3.5;
  }
  if (data.negocioDireccion) {
    doc.text(data.negocioDireccion, 40, y, { align: "center" });
    y += 3.5;
  }
  if (data.negocioComuna) {
    doc.text(`${data.negocioComuna}${data.negocioCiudad ? ` - ${data.negocioCiudad}` : ""}`, 40, y, { align: "center" });
    y += 3.5;
  }

  y += 2;

  // Si es DTE oficial, dibujar caja tributaria del SII
  if (esDteOficial) {
    doc.setLineWidth(0.5);
    doc.rect(10, y, 60, 16);
    y += 4.5;
    doc.setFont("courier", "bold");
    doc.setFontSize(9);
    doc.text(`R.U.T.: ${rutEmisor}`, 40, y, { align: "center" });
    y += 4;
    doc.text(dteNombre, 40, y, { align: "center" });
    y += 4.5;
    doc.setFontSize(10);
    doc.text(`N° ${data.dteFolio}`, 40, y, { align: "center" });
    y += 6;

    doc.setFontSize(7);
    doc.text(`S.I.I. - ${data.negocioComuna ? data.negocioComuna.toUpperCase() : "SANTIAGO ORIENTE"}`, 40, y, { align: "center" });
    y += 4;
  } else {
    doc.line(5, y, 75, y);
    y += 4;
    doc.text(`Ticket: #${data.folio}`, 5, y);
    y += 3.5;
  }

  const fechaStr = data.fecha ? new Date(data.fecha).toLocaleString("es-CL") : new Date().toLocaleString("es-CL");
  doc.setFont("courier", "normal");
  doc.setFontSize(7.5);
  doc.text(`Fecha: ${fechaStr}`, 5, y);
  y += 3.5;

  if (data.mesa) {
    doc.setFont("courier", "bold");
    doc.text(`Mesa: ${data.mesa}`, 5, y);
    doc.setFont("courier", "normal");
    y += 3.5;
  }
  if (data.cajero) {
    doc.text(`Cajero: ${data.cajero}`, 5, y);
    y += 3.5;
  }
  if (data.clienteNombre) {
    doc.text(`Cliente: ${data.clienteNombre}`, 5, y);
    y += 3.5;
  }
  if (data.clienteRut) {
    doc.text(`RUT Cli: ${data.clienteRut}`, 5, y);
    y += 3.5;
  }

  y += 2;
  doc.line(5, y, 75, y);
  y += 4;

  doc.setFont("courier", "bold");
  doc.text("CANT  DESCRIPCIÓN         TOTAL", 5, y);
  doc.setFont("courier", "normal");
  y += 4;

  for (const item of data.items) {
    const nombreRecortado = item.nombre.length > 16 ? item.nombre.slice(0, 16) + ".." : item.nombre.padEnd(18, " ");
    const precioStr = formatMoney(item.subtotal);
    doc.text(`${item.qty}x  ${nombreRecortado}`, 5, y);
    doc.text(precioStr, 75, y, { align: "right" });
    y += 3.5;
  }

  y += 2;
  doc.line(5, y, 75, y);
  y += 4;

  doc.text("Subtotal:", 5, y);
  doc.text(formatMoney(data.subtotal), 75, y, { align: "right" });
  y += 3.5;

  if (data.descuento && data.descuento > 0) {
    doc.text("Descuento:", 5, y);
    doc.text(`-${formatMoney(data.descuento)}`, 75, y, { align: "right" });
    y += 3.5;
  }

  doc.setFont("courier", "bold");
  doc.setFontSize(9.5);
  doc.text("TOTAL:", 5, y);
  doc.text(formatMoney(data.total), 75, y, { align: "right" });
  y += 4.5;

  if (esDteOficial && tipoDteNum === 39) {
    doc.setFont("courier", "normal");
    doc.setFontSize(6.5);
    doc.text(`(IVA de esta boleta: ${formatMoney(ivaEstimado)})`, 5, y);
    y += 3.5;
  }

  doc.setFont("courier", "normal");
  doc.setFontSize(7.5);
  doc.text(`Pago: ${data.metodoPago.toUpperCase()}`, 5, y);
  y += 3.5;

  if (data.metodoPago === "efectivo" && data.efectivoRecibido != null) {
    doc.text(`Recibido: ${formatMoney(data.efectivoRecibido)}`, 5, y);
    y += 3.5;
    doc.text(`Vuelto: ${formatMoney(data.vuelto || 0)}`, 5, y);
    y += 3.5;
  }

  y += 3;
  doc.line(5, y, 75, y);
  y += 5;

  if (esDteOficial) {
    doc.rect(10, y, 60, 10);
    y += 3.5;
    doc.setFont("courier", "bold");
    doc.setFontSize(7);
    doc.text("Timbre Electrónico SII", 40, y, { align: "center" });
    y += 3;
    doc.setFont("courier", "normal");
    doc.setFontSize(5.5);
    doc.text("Res. N° 80 de 2014 - Verifique en www.sii.cl", 40, y, { align: "center" });
    y += 7;

    doc.setFontSize(7);
    doc.text(data.mensajePie || "¡Gracias por su compra!", 40, y, { align: "center" });
    y += 3.5;
    doc.text("Operix ERP - eBoleta SII", 40, y, { align: "center" });
    doc.save(`Boleta-SII-${data.dteFolio || data.folio}.pdf`);
  } else {
    doc.setFontSize(7);
    doc.text(data.mensajePie || "¡Gracias por su preferencia!", 40, y, { align: "center" });
    y += 3.5;
    doc.setFontSize(6);
    doc.text("Documento no válido como factura", 40, y, { align: "center" });
    y += 3;
    doc.text("Operix ERP", 40, y, { align: "center" });
    doc.save(`Ticket-${data.folio}.pdf`);
  }
}
