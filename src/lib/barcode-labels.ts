import JsBarcode from "jsbarcode";

export interface EtiquetaItem {
  nombre: string;
  codigo: string;
  precio: number;
  cantidad: number;
}

/**
 * Genera e imprime una hoja de etiquetas con códigos de barras lista para papel adhesivo o impresora térmica
 */
export function imprimirHojaEtiquetas(
  items: EtiquetaItem[],
  nombreNegocio: string = "Operix"
) {
  const printWindow = window.open("", "_blank", "width=800,height=900");
  if (!printWindow) {
    alert("Por favor habilita las ventanas emergentes (pop-ups) para imprimir las etiquetas.");
    return;
  }

  // Pre-generar SVG de códigos de barras en un contenedor virtual
  const svgMap = new Map<string, string>();
  for (const item of items) {
    if (!svgMap.has(item.codigo)) {
      try {
        const svgNode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        JsBarcode(svgNode, item.codigo, {
          format: "CODE128",
          width: 1.5,
          height: 38,
          displayValue: true,
          fontSize: 11,
          margin: 4,
        });
        svgMap.set(item.codigo, svgNode.outerHTML);
      } catch (e) {
        // Fallback genérico si el código tiene caracteres inválidos
        svgMap.set(
          item.codigo,
          `<div style="font-size: 11px; font-weight: bold; padding: 10px 0;">*${item.codigo}*</div>`
        );
      }
    }
  }

  // Generar tarjetas repetidas según la cantidad solicitada
  const etiquetasHtml: string[] = [];
  for (const item of items) {
    const svgContent = svgMap.get(item.codigo) || "";
    for (let i = 0; i < item.cantidad; i++) {
      etiquetasHtml.push(`
        <div class="etiqueta-card">
          <div class="negocio-header">${nombreNegocio}</div>
          <div class="producto-nombre">${item.nombre}</div>
          <div class="barcode-container">
            ${svgContent}
          </div>
          <div class="precio-tag">$${Math.round(item.precio).toLocaleString("es-CL")}</div>
        </div>
      `);
    }
  }

  const content = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Etiquetas de Código de Barras - ${nombreNegocio}</title>
        <style>
          @page {
            size: auto;
            margin: 8mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: system-ui, -apple-system, sans-serif;
            margin: 0;
            padding: 8px;
            background: #fff;
            color: #000;
          }
          .grid-container {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(48mm, 1fr));
            gap: 4mm;
            width: 100%;
          }
          .etiqueta-card {
            border: 1px dashed #ccc;
            padding: 4px;
            border-radius: 4px;
            text-align: center;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: center;
            height: 38mm;
            overflow: hidden;
            background: #fff;
            page-break-inside: avoid;
          }
          .negocio-header {
            font-size: 8px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #555;
          }
          .producto-nombre {
            font-size: 9px;
            font-weight: 700;
            line-height: 1.1;
            max-height: 20px;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            margin: 1px 0;
          }
          .barcode-container {
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100%;
          }
          .barcode-container svg {
            max-width: 100%;
            height: auto;
            max-height: 18mm;
          }
          .precio-tag {
            font-size: 13px;
            font-weight: 900;
            color: #000;
            margin-top: 1px;
          }
          @media print {
            .no-print { display: none; }
            .etiqueta-card { border: 1px solid #ddd; }
          }
        </style>
      </head>
      <body>
        <div class="grid-container">
          ${etiquetasHtml.join("")}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(content);
  printWindow.document.close();
}
