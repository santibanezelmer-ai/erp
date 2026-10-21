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
  negocioTelefono?: string | null;
  negocioDireccion?: string | null;
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
        <title>Ticket #${data.folio}</title>
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
            font-size: 15px;
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
          ${data.negocioRut ? `<div>RUT / NIF: ${data.negocioRut}</div>` : ""}
          ${data.sucursalNombre ? `<div>Sucursal: ${data.sucursalNombre}</div>` : ""}
          ${data.negocioDireccion ? `<div>${data.negocioDireccion}</div>` : ""}
          ${data.negocioTelefono ? `<div>Tel: ${data.negocioTelefono}</div>` : ""}
        </div>

        <div class="divider"></div>

        <div>
          <div style="display: flex; justify-content: space-between;">
            <span class="font-bold">TICKET: #${data.folio}</span>
            <span>${fechaStr}</span>
          </div>
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

        <div class="text-center" style="margin-top: 8px; font-size: 10px; color: #333;">
          <div>${data.mensajePie || "¡Gracias por su preferencia!"}</div>
          <div style="font-size: 9px; margin-top: 4px; color: #666;">Documento no válido como factura tributaria</div>
          <div style="font-size: 8px; margin-top: 2px; color: #888;">Operix ERP - Potenciado por IA</div>
        </div>

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

  // Formato tipo ticket (80mm de ancho x 160mm altura variable)
  const doc = new jsPDF({
    unit: "mm",
    format: [80, Math.max(160, 80 + data.items.length * 10)],
  });

  let y = 10;
  doc.setFont("courier", "bold");
  doc.setFontSize(12);
  doc.text(data.negocioNombre, 40, y, { align: "center" });

  y += 5;
  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  if (data.negocioRut) {
    doc.text(`RUT: ${data.negocioRut}`, 40, y, { align: "center" });
    y += 4;
  }
  if (data.sucursalNombre) {
    doc.text(`Sucursal: ${data.sucursalNombre}`, 40, y, { align: "center" });
    y += 4;
  }
  if (data.negocioDireccion) {
    doc.text(data.negocioDireccion, 40, y, { align: "center" });
    y += 4;
  }

  y += 2;
  doc.line(5, y, 75, y);
  y += 5;

  doc.text(`Ticket: #${data.folio}`, 5, y);
  y += 4;
  const fechaStr = data.fecha ? new Date(data.fecha).toLocaleString("es-CL") : new Date().toLocaleString("es-CL");
  doc.text(`Fecha: ${fechaStr}`, 5, y);
  y += 4;

  if (data.mesa) {
    doc.setFont("courier", "bold");
    doc.text(`Mesa: ${data.mesa}`, 5, y);
    doc.setFont("courier", "normal");
    y += 4;
  }
  if (data.cajero) {
    doc.text(`Cajero: ${data.cajero}`, 5, y);
    y += 4;
  }
  if (data.clienteNombre) {
    doc.text(`Cliente: ${data.clienteNombre}`, 5, y);
    y += 4;
  }

  y += 2;
  doc.line(5, y, 75, y);
  y += 5;

  doc.setFont("courier", "bold");
  doc.text("CANT  DESCRIPCIÓN         TOTAL", 5, y);
  doc.setFont("courier", "normal");
  y += 4;

  for (const item of data.items) {
    const nombreRecortado = item.nombre.length > 16 ? item.nombre.slice(0, 16) + ".." : item.nombre.padEnd(18, " ");
    const precioStr = formatMoney(item.subtotal);
    doc.text(`${item.qty}x  ${nombreRecortado}`, 5, y);
    doc.text(precioStr, 75, y, { align: "right" });
    y += 4;
  }

  y += 2;
  doc.line(5, y, 75, y);
  y += 5;

  doc.text("Subtotal:", 5, y);
  doc.text(formatMoney(data.subtotal), 75, y, { align: "right" });
  y += 4;

  if (data.descuento && data.descuento > 0) {
    doc.text("Descuento:", 5, y);
    doc.text(`-${formatMoney(data.descuento)}`, 75, y, { align: "right" });
    y += 4;
  }

  doc.setFont("courier", "bold");
  doc.setFontSize(10);
  doc.text("TOTAL:", 5, y);
  doc.text(formatMoney(data.total), 75, y, { align: "right" });
  y += 5;

  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  doc.text(`Pago: ${data.metodoPago.toUpperCase()}`, 5, y);
  y += 4;

  if (data.metodoPago === "efectivo" && data.efectivoRecibido != null) {
    doc.text(`Recibido: ${formatMoney(data.efectivoRecibido)}`, 5, y);
    y += 4;
    doc.text(`Vuelto: ${formatMoney(data.vuelto || 0)}`, 5, y);
    y += 4;
  }

  y += 4;
  doc.line(5, y, 75, y);
  y += 6;

  doc.setFontSize(7);
  doc.text(data.mensajePie || "¡Gracias por su preferencia!", 40, y, { align: "center" });
  y += 4;
  doc.text("Operix ERP", 40, y, { align: "center" });

  doc.save(`Ticket-${data.folio}.pdf`);
}
