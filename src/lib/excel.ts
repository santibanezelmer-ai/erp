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
    // Detectar campos buscando variaciones comunes de encabezados
    const nombre = (row["Nombre Producto *"] || row["Nombre"] || row["nombre"] || row["Producto"] || "").toString().trim();
    if (!nombre) continue; // Si no tiene nombre se salta

    const codigo = (row["Código de Barras"] || row["Codigo"] || row["codigo"] || row["Barcode"] || "").toString().trim() || null;
    const categoria = (row["Categoría"] || row["Categoria"] || row["categoria"] || "").toString().trim() || null;
    const descripcion = (row["Descripción"] || row["Descripcion"] || row["descripcion"] || "").toString().trim() || null;

    const rawPrecioVenta = row["Precio Venta *"] ?? row["Precio"] ?? row["precio_venta"] ?? row["precio"] ?? 0;
    const precio_venta = Math.max(0, Number(rawPrecioVenta) || 0);

    const rawPrecioCosto = row["Precio Costo"] ?? row["Costo"] ?? row["precio_costo"] ?? row["costo"] ?? 0;
    const precio_costo = Math.max(0, Number(rawPrecioCosto) || 0);

    const rawStock = row["Stock Inicial"] ?? row["Stock"] ?? row["stock"] ?? 0;
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
