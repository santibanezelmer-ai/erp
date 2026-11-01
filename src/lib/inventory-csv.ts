import type { Database } from "@/types/database.types";
import { slugify } from "@/lib/format";

type Producto = Database["public"]["Tables"]["productos"]["Row"];
type Variante = Database["public"]["Tables"]["producto_variantes"]["Row"];

export const INVENTORY_CSV_HEADERS = [
  "Handle",
  "Title",
  "Option1 Name",
  "Option1 Value",
  "Option2 Name",
  "Option2 Value",
  "Option3 Name",
  "Option3 Value",
  "SKU",
  "HS Code",
  "COO",
  "Location",
  "Bin name",
  "Incoming (not editable)",
  "Unavailable (not editable)",
  "Committed (not editable)",
  "Available (not editable)",
  "On hand (current)",
  "On hand (new)",
  "Variant Packed Length",
  "Variant Packed Width",
  "Variant Packed Height",
  "Variant Packed Dimension Unit",
];

/**
 * Escapa valores para formato CSV estándar RFC 4180
 */
export function escapeCSV(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Desglosa los nombres de variantes para mapear a Option1/Option2/Option3
 */
export function parsearOpcionesVariante(nombreVariante?: string | null): {
  opt1Name: string;
  opt1Value: string;
  opt2Name: string;
  opt2Value: string;
  opt3Name: string;
  opt3Value: string;
} {
  const res = {
    opt1Name: "",
    opt1Value: "",
    opt2Name: "",
    opt2Value: "",
    opt3Name: "",
    opt3Value: "",
  };

  if (!nombreVariante || !nombreVariante.trim()) {
    res.opt1Name = "Title";
    res.opt1Value = "Default Title";
    return res;
  }

  const str = nombreVariante.trim();

  // Caso 1: "Size: Medium, Filling: Custard" o "Talla: M / Color: Rojo"
  if (str.includes(":") && (str.includes(",") || str.includes("/"))) {
    const partes = str.split(/[,/]/).map((s) => s.trim()).filter(Boolean);
    partes.forEach((p, idx) => {
      const [k, ...vParts] = p.split(":");
      const key = k.trim();
      const val = vParts.join(":").trim();
      if (idx === 0) {
        res.opt1Name = key;
        res.opt1Value = val || key;
      } else if (idx === 1) {
        res.opt2Name = key;
        res.opt2Value = val || key;
      } else if (idx === 2) {
        res.opt3Name = key;
        res.opt3Value = val || key;
      }
    });
    return res;
  }

  // Caso 2: Un solo par "Size: Medium"
  if (str.includes(":") && !str.includes(",") && !str.includes("/")) {
    const [k, ...vParts] = str.split(":");
    res.opt1Name = k.trim();
    res.opt1Value = vParts.join(":").trim();
    return res;
  }

  // Caso 3: "Medium / Custard" o "Talla M / Azul / Algodon"
  if (str.includes("/")) {
    const partes = str.split("/").map((s) => s.trim()).filter(Boolean);
    partes.forEach((val, idx) => {
      const defaultNames = ["Size", "Color", "Material"];
      if (idx === 0) {
        res.opt1Name = defaultNames[0] || "Option 1";
        res.opt1Value = val;
      } else if (idx === 1) {
        res.opt2Name = defaultNames[1] || "Option 2";
        res.opt2Value = val;
      } else if (idx === 2) {
        res.opt3Name = defaultNames[2] || "Option 3";
        res.opt3Value = val;
      }
    });
    return res;
  }

  // Caso 4: "04 - Bronze" o "S - Negro"
  if (str.includes(" — ") || str.includes(" - ")) {
    const partes = str.split(/\s*[-—]\s*/).map((s) => s.trim()).filter(Boolean);
    if (partes.length > 1) {
      partes.forEach((val, idx) => {
        if (idx === 0) {
          res.opt1Name = "Option 1";
          res.opt1Value = val;
        } else if (idx === 1) {
          res.opt2Name = "Option 2";
          res.opt2Value = val;
        } else if (idx === 2) {
          res.opt3Name = "Option 3";
          res.opt3Value = val;
        }
      });
      return res;
    }
  }

  // Caso 5: Valor simple ("Medium", "500ml", "Dark")
  if (/^\d+\s*(ml|l|cc|g|kg|cm|mm|oz)$/i.test(str)) {
    res.opt1Name = "Volume";
  } else if (/^(xs|s|m|l|xl|xxl|small|medium|large)$/i.test(str)) {
    res.opt1Name = "Size";
  } else {
    res.opt1Name = "Option";
  }
  res.opt1Value = str;

  return res;
}

/**
 * Genera la cadena de texto CSV con el formato exacto de inventario
 */
export function generarCSVInventario(
  productos: Producto[],
  variantes: Variante[],
  config?: {
    nombreNegocio?: string;
    sucursalNombre?: string;
    direccion?: string;
  }
): string {
  const location =
    config?.sucursalNombre ||
    config?.direccion ||
    config?.nombreNegocio ||
    "Casa Matriz";

  const rows: string[] = [];
  rows.push(INVENTORY_CSV_HEADERS.join(","));

  // Agrupar variantes por producto_id
  const variantesPorProd = new Map<string, Variante[]>();
  variantes.forEach((v) => {
    const list = variantesPorProd.get(v.producto_id) || [];
    list.push(v);
    variantesPorProd.set(v.producto_id, list);
  });

  for (const p of productos) {
    const handle = slugify(p.nombre) || `prod-${p.id.slice(0, 8)}`;
    const prodVars = variantesPorProd.get(p.id) || [];

    if (prodVars.length > 0) {
      // Un registro CSV por cada variante
      for (const v of prodVars) {
        const opts = parsearOpcionesVariante(v.nombre);
        const sku = v.codigo || p.codigo || p.codigo_interno || "";
        const stockActual = Math.max(0, Number(v.stock ?? p.stock ?? 0));

        const fila = [
          escapeCSV(handle),
          escapeCSV(p.nombre),
          escapeCSV(opts.opt1Name),
          escapeCSV(opts.opt1Value),
          escapeCSV(opts.opt2Name),
          escapeCSV(opts.opt2Value),
          escapeCSV(opts.opt3Name),
          escapeCSV(opts.opt3Value),
          escapeCSV(sku),
          escapeCSV(""), // HS Code
          escapeCSV(""), // COO
          escapeCSV(location), // Location
          escapeCSV(""), // Bin name
          "0", // Incoming
          "0", // Unavailable
          "0", // Committed
          escapeCSV(stockActual), // Available
          escapeCSV(stockActual), // On hand (current)
          "", // On hand (new)
          "", // Variant Packed Length
          "", // Variant Packed Width
          "", // Variant Packed Height
          "", // Variant Packed Dimension Unit
        ];
        rows.push(fila.join(","));
      }
    } else {
      // Producto único sin variantes
      const sku = p.codigo || p.codigo_interno || "";
      const stockActual = p.sin_control_stock ? 999 : Math.max(0, Number(p.stock || 0));

      const fila = [
        escapeCSV(handle),
        escapeCSV(p.nombre),
        "Title", // Option1 Name
        "Default Title", // Option1 Value
        "", // Option2 Name
        "", // Option2 Value
        "", // Option3 Name
        "", // Option3 Value
        escapeCSV(sku),
        "", // HS Code
        "", // COO
        escapeCSV(location), // Location
        "", // Bin name
        "0", // Incoming
        "0", // Unavailable
        "0", // Committed
        escapeCSV(stockActual), // Available
        escapeCSV(stockActual), // On hand (current)
        "", // On hand (new)
        "", // Variant Packed Length
        "", // Variant Packed Width
        "", // Variant Packed Height
        "", // Variant Packed Dimension Unit
      ];
      rows.push(fila.join(","));
    }
  }

  return rows.join("\r\n");
}

/**
 * Descarga en el navegador un archivo de texto con extensión especificada
 */
export function descargarArchivoCSV(contenido: string, nombreArchivo: string) {
  const blob = new Blob(["\uFEFF" + contenido], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", nombreArchivo);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exporta y descarga el inventario en formato CSV
 */
export function exportarInventarioCSV(
  productos: Producto[],
  variantes: Variante[],
  config?: {
    nombreNegocio?: string;
    sucursalNombre?: string;
    direccion?: string;
  }
) {
  const csvContent = generarCSVInventario(productos, variantes, config);
  const nombreNegocio = (config?.nombreNegocio || "tienda").replace(/[^a-zA-Z0-9_\-]+/g, "_");
  const fecha = new Date().toISOString().slice(0, 10);
  descargarArchivoCSV(csvContent, `inventario_${nombreNegocio}_${fecha}.csv`);
}

/**
 * Descarga la plantilla de ejemplo de inventario exactamente con el modelo provisto
 */
export function descargarPlantillaInventarioCSV() {
  const contenido = [
    "Handle,Title,Option1 Name,Option1 Value,Option2 Name,Option2 Value,Option3 Name,Option3 Value,SKU,HS Code,COO,Location,Bin name,Incoming (not editable),Unavailable (not editable),Committed (not editable),Available (not editable),On hand (current),On hand (new),Variant Packed Length,Variant Packed Width,Variant Packed Height,Variant Packed Dimension Unit",
    "custard-buns,Custard Buns with Filling,Size,Medium,Filling,Custard,,,,,,123 William Street,A1-01-001,0,0,1,7,8,,12,9,5,cm",
    "custard-buns,Custard Buns with Filling,Size,Large,Filling,Custard,,,,,,123 William Street,A1-01-002,0,0,0,8,8,,14,10,6,cm",
    "butterfly-ginkgo-bowl,Butterfly Ginkgo Decorative Bowl,Material,Metallic,Style,Butterfly Ginkgo,,,17575MA,,,123 William Street,,0,0,0,80,80,,16,11,7,cm",
    "maple-syrup,Organic Maple Syrup,Volume,500ml,Grade,Amber,,,,987654,123456,123 William Street,A1-03-001,0,0,0,50,50,,18,12,8,cm",
    "maple-syrup,Organic Maple Syrup,Volume,1000ml,Grade,Dark,,,,987655,123457,123 William Street,A1-03-002,0,0,0,30,30,,,,,",
    "stainless-steel-bottle,Insulated Bottle,Size,500ml,Finish,Matte,Color,Black,SSB500BLK,,,123 William Street,A1-04-001,0,0,0,120,120,,22,14,10,cm",
    "stainless-steel-bottle,Insulated Bottle,Size,750ml,Finish,Gloss,Color,Silver,SSB750SLV,,,123 William Street,A1-04-002,0,0,0,90,90,,24,15,11,cm",
    "yoga-mat,Premium Yoga Mat,Thickness,5mm,Material,Natural Rubber,Color,Purple,PMY5PRP,,,123 William Street,A1-05-001,0,0,0,70,70,,26,16,12,cm",
    "yoga-mat,Premium Yoga Mat,Thickness,3mm,Material,TPE,Color,Green,PMY3GRN,,,123 William Street,A1-05-002,0,0,0,85,85,,28,17,13,cm",
    "ceramic-vase,Artisan Ceramic Vase,Height,25cm,Pattern,Geometric,Color,Blue,CV25GEO,,,123 William Street,A1-06-001,0,0,0,45,45,,,,,",
  ].join("\r\n");

  descargarArchivoCSV(contenido, "plantilla_inventario_tienda.csv");
}
