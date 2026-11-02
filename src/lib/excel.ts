import * as XLSX from "xlsx";
import type { Database } from "@/types/database.types";

type Producto = Database["public"]["Tables"]["productos"]["Row"];
type Venta = Database["public"]["Tables"]["ventas"]["Row"];

export interface ProductoImportRow {
  nombre: string;
  codigo?: string | null;
  categoria?: string | null;
  precio_venta: number;
  precio_costo?: number;
  stock?: number;
  stock_minimo?: number;
  descripcion?: string | null;
}

/**
 * Genera y descarga una plantilla vacía con ejemplos para importar productos
 */
export function descargarPlantillaProductos() {
  const data = [
    {
      "Nombre Producto *": "Coca Cola 1.5L",
      "Código de Barras": "7801610001234",
      "Categoría": "Bebidas",
      "Precio Venta *": 2000,
      "Precio Costo": 1200,
      "Stock Inicial": 24,
      "Stock Mínimo": 5,
      "Descripción": "Bebida desechable clásica",
    },
    {
      "Nombre Producto *": "Hamburguesa Doble Queso",
      "Código de Barras": "HAM-002",
      "Categoría": "Comida",
      "Precio Venta *": 6500,
      "Precio Costo": 2800,
      "Stock Inicial": 50,
      "Stock Mínimo": 10,
      "Descripción": "Con carne de res y cheddar",
    },
    {
      "Nombre Producto *": "Café Americano",
      "Código de Barras": "",
      "Categoría": "Cafetería",
      "Precio Venta *": 1800,
      "Precio Costo": 400,
      "Stock Inicial": 100,
      "Stock Mínimo": 15,
      "Descripción": "Café de grano tostado",
    },
  ];

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Plantilla Productos");
  XLSX.writeFile(wb, "plantilla_productos_operix.xlsx");
}

/**
 * Lee un archivo Excel o CSV y extrae la lista de productos validada
 */
export async function parsearProductosDesdeArchivo(file: File): Promise<ProductoImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

  const productos: ProductoImportRow[] = [];

  for (const row of rawRows) {
    // Detectar campos buscando variaciones comunes de encabezados (incluyendo formato estándar CSV de tienda / Shopify)
    const nombre = (
      row["Nombre Producto *"] ||
      row["Nombre"] ||
      row["nombre"] ||
      row["Producto"] ||
      row["Title"] ||
      row["title"] ||
      row["Handle"] ||
      ""
    ).toString().trim();
    if (!nombre) continue; // Si no tiene nombre se salta

    const codigo = (
      row["Código de Barras"] ||
      row["Codigo"] ||
      row["codigo"] ||
      row["Barcode"] ||
      row["SKU"] ||
      row["sku"] ||
      ""
    ).toString().trim() || null;

    const categoria = (
      row["Categoría"] ||
      row["Categoria"] ||
      row["categoria"] ||
      row["Category"] ||
      ""
    ).toString().trim() || null;

    // Detectar opciones de variantes si proviene de CSV de inventario
    const optDesc = [
      row["Option1 Value"] && row["Option1 Value"] !== "Default Title"
        ? `${row["Option1 Name"] || "Opción"}: ${row["Option1 Value"]}`
        : null,
      row["Option2 Value"]
        ? `${row["Option2 Name"] || "Opción"}: ${row["Option2 Value"]}`
        : null,
      row["Option3 Value"]
        ? `${row["Option3 Name"] || "Opción"}: ${row["Option3 Value"]}`
        : null,
    ].filter(Boolean).join(", ");

    const descripcion = (
      row["Descripción"] ||
      row["Descripcion"] ||
      row["descripcion"] ||
      optDesc ||
      ""
    ).toString().trim() || null;

    const rawPrecioVenta = row["Precio Venta *"] ?? row["Precio"] ?? row["precio_venta"] ?? row["precio"] ?? row["Price"] ?? 0;
    const precio_venta = Math.max(0, Number(rawPrecioVenta) || 0);

    const rawPrecioCosto = row["Precio Costo"] ?? row["Costo"] ?? row["precio_costo"] ?? row["costo"] ?? row["Cost price"] ?? 0;
    const precio_costo = Math.max(0, Number(rawPrecioCosto) || 0);

    const rawStock = (
      row["Stock Inicial"] ??
      row["Stock"] ??
      row["stock"] ??
      row["Available (not editable)"] ??
      row["On hand (current)"] ??
      row["On hand (new)"] ??
      row["Available"] ??
      row["Inventory"] ??
      0
    );
    const stock = Math.max(0, Number(rawStock) || 0);

    const rawStockMin = row["Stock Mínimo"] ?? row["Stock Minimo"] ?? row["stock_minimo"] ?? 0;
    const stock_minimo = Math.max(0, Number(rawStockMin) || 0);

    productos.push({
      nombre,
      codigo,
      categoria,
      precio_venta,
      precio_costo,
      stock,
      stock_minimo,
      descripcion,
    });
  }

  return productos;
}

/**
 * Exporta el catálogo completo de productos a Excel
 */
export function exportarProductosAExcel(productos: Producto[], nombreNegocio: string = "Operix") {
  const data = productos.map((p) => ({
    "ID": p.id,
    "Código": p.codigo || p.codigo_interno || "",
    "Nombre": p.nombre,
    "Categoría": p.categoria || "Sin categoría",
    "Precio Venta": Number(p.precio_venta || 0),
    "Precio Costo": Number(p.precio_costo || 0),
    "Margen Estimado (%)":
      p.precio_costo && Number(p.precio_costo) > 0
        ? Math.round(((Number(p.precio_venta || 0) - Number(p.precio_costo)) / Number(p.precio_costo)) * 100)
        : 100,
    "Stock Actual": Number(p.stock || 0),
    "Stock Mínimo": Number((p as any).stock_min ?? p.stock_min ?? 0),
    "Control de Stock": p.sin_control_stock ? "No" : "Sí",
    "Activo": p.activo ? "Sí" : "No",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventario");
  const fecha = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Inventario_${nombreNegocio.replace(/\s+/g, "_")}_${fecha}.xlsx`);
}

/**
 * Exporta el historial de ventas a Excel
 */
export function exportarVentasAExcel(ventas: any[], nombreNegocio: string = "Operix") {
  const data = ventas.map((v) => ({
    "Folio": v.id ? v.id.slice(0, 8).toUpperCase() : "",
    "Fecha": v.created_at ? new Date(v.created_at).toLocaleString("es-CL") : "",
    "Cliente": v.cliente?.nombre || "Consumidor Final",
    "Método de Pago": (v.pago || "Efectivo").toUpperCase(),
    "Subtotal": Number(v.subtotal || 0),
    "Descuento": Number(v.descuento || 0),
    "Total": Number(v.total || 0),
    "Estado": (v.estado || "completada").toUpperCase(),
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ventas");
  const fecha = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Ventas_${nombreNegocio.replace(/\s+/g, "_")}_${fecha}.xlsx`);
}

export interface DteVentaReporte {
  folio: number;
  tipoDte: number; // 39: Boleta Afecta, 41: Boleta Exenta, 33: Factura Electrónica
  fecha: string;
  cliente?: string | null;
  medioPago: string;
  montoExento: number;
  montoNeto: number;
  iva: number;
  montoTotal: number;
  estado: string;
  pdfUrl?: string | null;
}

export interface LibroVentasResumen {
  periodo: string; // ej: "Noviembre 2026"
  rutEmisor: string;
  razonSocial: string;
  // DTE 39 (Boleta Afecta)
  boletasAfectasCount: number;
  boletasAfectasFolioMin: number | null;
  boletasAfectasFolioMax: number | null;
  boletasAfectasNeto: number;
  boletasAfectasIva: number;
  boletasAfectasTotal: number;
  // DTE 41 (Boleta Exenta)
  boletasExentasCount: number;
  boletasExentasFolioMin: number | null;
  boletasExentasFolioMax: number | null;
  boletasExentasTotal: number;
  // DTE 33 (Factura Electrónica)
  facturasCount: number;
  facturasFolioMin: number | null;
  facturasFolioMax: number | null;
  facturasNeto: number;
  facturasIva: number;
  facturasTotal: number;
  // Totales Generales
  totalDocumentos: number;
  totalNeto: number;
  totalIvaDebito: number;
  totalExento: number;
  totalFacturadoBruto: number;
}

/**
 * Exporta el Libro de Ventas mensual con resumen F29 y detalle DTEs a Excel
 */
export function exportarLibroVentasAExcel(
  resumen: LibroVentasResumen,
  dtes: DteVentaReporte[]
) {
  const wb = XLSX.utils.book_new();

  // 1. Hoja Resumen F29
  const resumenData = [
    { "CONCEPTO": "Razón Social", "DETALLE / MONTO": resumen.razonSocial },
    { "CONCEPTO": "RUT Empresa", "DETALLE / MONTO": resumen.rutEmisor },
    { "CONCEPTO": "Periodo Tributario", "DETALLE / MONTO": resumen.periodo },
    { "CONCEPTO": "Fecha Emisión Reporte", "DETALLE / MONTO": new Date().toLocaleString("es-CL") },
    { "CONCEPTO": "Software Generador", "DETALLE / MONTO": "Operix ERP · operixerp.cloud" },
    {},
    { "CONCEPTO": "─── CUADRATURA TRIBUTARIA F29 ───", "DETALLE / MONTO": "" },
    {},
    {
      "CONCEPTO": "Boletas Electrónicas Afectas (DTE 39)",
      "CANTIDAD": resumen.boletasAfectasCount,
      "FOLIO DESDE": resumen.boletasAfectasFolioMin ?? "N/A",
      "FOLIO HASTA": resumen.boletasAfectasFolioMax ?? "N/A",
      "EXENTO ($)": 0,
      "NETO ($)": resumen.boletasAfectasNeto,
      "IVA DÉBITO 19% ($)": resumen.boletasAfectasIva,
      "TOTAL BRUTO ($)": resumen.boletasAfectasTotal,
    },
    {
      "CONCEPTO": "Boletas Electrónicas Exentas (DTE 41)",
      "CANTIDAD": resumen.boletasExentasCount,
      "FOLIO DESDE": resumen.boletasExentasFolioMin ?? "N/A",
      "FOLIO HASTA": resumen.boletasExentasFolioMax ?? "N/A",
      "EXENTO ($)": resumen.boletasExentasTotal,
      "NETO ($)": 0,
      "IVA DÉBITO 19% ($)": 0,
      "TOTAL BRUTO ($)": resumen.boletasExentasTotal,
    },
    {
      "CONCEPTO": "Facturas Electrónicas (DTE 33)",
      "CANTIDAD": resumen.facturasCount,
      "FOLIO DESDE": resumen.facturasFolioMin ?? "N/A",
      "FOLIO HASTA": resumen.facturasFolioMax ?? "N/A",
      "EXENTO ($)": 0,
      "NETO ($)": resumen.facturasNeto,
      "IVA DÉBITO 19% ($)": resumen.facturasIva,
      "TOTAL BRUTO ($)": resumen.facturasTotal,
    },
    {},
    {
      "CONCEPTO": "TOTALES DECLARACIÓN F29",
      "CANTIDAD": resumen.totalDocumentos,
      "FOLIO DESDE": "-",
      "FOLIO HASTA": "-",
      "EXENTO ($)": resumen.totalExento,
      "NETO ($)": resumen.totalNeto,
      "IVA DÉBITO 19% ($)": resumen.totalIvaDebito,
      "TOTAL BRUTO ($)": resumen.totalFacturadoBruto,
    },
  ];

  const wsResumen = XLSX.utils.json_to_sheet(resumenData);
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen F29");

  // 2. Hoja Detalle DTEs
  const detalleData = dtes.map((d) => ({
    "Folio": d.folio,
    "Tipo DTE": d.tipoDte === 39 ? "Boleta Afecta (39)" : d.tipoDte === 41 ? "Boleta Exenta (41)" : "Factura Electrónica (33)",
    "Fecha Emisión": d.fecha,
    "Cliente / Receptor": d.cliente || "Consumidor Final",
    "Medio de Pago": d.medioPago.toUpperCase(),
    "Monto Exento": d.montoExento,
    "Monto Neto": d.montoNeto,
    "IVA (19%)": d.iva,
    "Total Bruto": d.montoTotal,
    "Estado": d.estado.toUpperCase(),
    "Enlace PDF Oficial": d.pdfUrl || "No disponible",
  }));

  const wsDetalle = XLSX.utils.json_to_sheet(detalleData);
  XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle DTEs");

  const cleanPeriodo = resumen.periodo.toLowerCase().replace(/[^a-z0-9]/g, "_");
  const cleanRut = (resumen.rutEmisor || "empresa").replace(/[^a-z0-9]/gi, "");
  XLSX.writeFile(wb, `Libro_Ventas_${cleanRut}_${cleanPeriodo}.xlsx`);
}
