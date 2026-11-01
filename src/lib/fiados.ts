/**
 * Utilidades para conciliación y desglose de fiados y cuentas corrientes
 * Permite obtener los nombres reales de los productos que componen el saldo adeudado
 * de cada cliente con referencia a su número de venta.
 */

export interface ProductoFiadoItem {
  id: string;
  ventaId?: string;
  folio?: string; // Folio / ID de la venta de referencia (ej: #17594A64)
  fecha: string;
  nombre: string; // Nombre real del producto
  qty: number;
  precio: number;
  subtotal: number;
  esParcial?: boolean; // Si la venta fue parcialmente abonada
  montoPendiente?: number; // Saldo remanente de esta línea
}

/**
 * Extrae y desglosa los nombres limpios y cantidades de productos desde las notas de deudas/ventas
 */
export function parsearItemsDesdeNotas(
  notas: string | null | undefined,
  montoTotal: number,
  fecha: string,
  ventaId?: string | null,
  cargoId?: string
): ProductoFiadoItem[] {
  const folio = ventaId ? ventaId.slice(0, 8).toUpperCase() : undefined;

  if (!notas) {
    return [
      {
        id: cargoId || `cargo-${Date.now()}`,
        ventaId: ventaId || undefined,
        folio,
        fecha,
        nombre: "Artículo / Consumo a crédito",
        qty: 1,
        precio: montoTotal,
        subtotal: montoTotal,
      },
    ];
  }

  // Quitar prefijos comunes como "Venta fiada:", "Venta fiada #09023186:", "Venta:", etc.
  let limpio = notas
    .replace(/^venta(\s+fiada)?\s*(#[a-f0-9]+)?\s*[:\-–—]?\s*/i, "")
    .trim();

  // Si quedó vacío o solo era un hash/identificador
  if (!limpio || /^#[a-f0-9]+$/i.test(limpio) || /^venta(\s+fiada)?$/i.test(limpio)) {
    return [
      {
        id: cargoId || `cargo-${Date.now()}`,
        ventaId: ventaId || undefined,
        folio,
        fecha,
        nombre: "Consumo fiado en cuenta",
        qty: 1,
        precio: montoTotal,
        subtotal: montoTotal,
      },
    ];
  }

  // Si contiene múltiples productos separados por coma antes de "Nx " (ej: "1x Crema, 2x Labial")
  let partes = limpio.split(/,\s*(?=\d+\s*x\s+)/i);

  // Si no se dividió pero tiene comas, probar dividir por coma simple
  if (partes.length === 1 && limpio.includes(",")) {
    const subPartes = limpio.split(/,\s*/).map((s) => s.trim()).filter(Boolean);
    if (subPartes.length > 1) {
      partes = subPartes;
    }
  }

  if (partes.length > 1) {
    const subPorItem = montoTotal / partes.length;
    return partes.map((p, idx) => {
      const match = p.match(/^(\d+)\s*x\s+(.+)$/i);
      const qty = match ? Number(match[1]) : 1;
      const nombreProd = match ? match[2].trim() : p.trim();
      return {
        id: `${cargoId || "c"}-${idx}`,
        ventaId: ventaId || undefined,
        folio,
        fecha,
        nombre: nombreProd,
        qty: qty,
        precio: Math.round(subPorItem / qty),
        subtotal: Math.round(subPorItem),
      };
    });
  }

  // Un solo producto
  const match = limpio.match(/^(\d+)\s*x\s+(.+)$/i);
  const qty = match ? Number(match[1]) : 1;
  const nombreProd = match ? match[2].trim() : limpio;

  return [
    {
      id: cargoId || `cargo-${Date.now()}`,
      ventaId: ventaId || undefined,
      folio,
      fecha,
      nombre: nombreProd,
      qty: qty,
      precio: Math.round(montoTotal / qty),
      subtotal: montoTotal,
    },
  ];
}

/**
 * Reconcilia deudas y ventas de un cliente aplicando FIFO para determinar
 * exactamente qué productos están pendientes de pago según su saldo deudor activo.
 */
export function conciliarFiadosClienteFIFO(
  deudaActual: number,
  deudasCliente: any[],
  ventasCliente: any[],
  detallesPorVenta: Map<string, any[]>
): {
  productos: ProductoFiadoItem[];
  ultimaFecha: string | null;
} {
  type Cargo = {
    id: string;
    venta_id: string | null;
    monto: number;
    fecha: string;
    notas: string | null;
  };

  const cargosMap = new Map<string, Cargo>();

  // Mapa de notas de deudas asociadas a ventas
  const deudasPorVenta = new Map<string, any>();
  deudasCliente.forEach((d) => {
    if (d.venta_id && d.tipo !== "pago") {
      deudasPorVenta.set(d.venta_id, d);
    }
  });

  // 1. Agregar ventas fiadas
  ventasCliente.forEach((v) => {
    const dAsociada = deudasPorVenta.get(v.id);
    cargosMap.set(`v-${v.id}`, {
      id: `v-${v.id}`,
      venta_id: v.id,
      monto: Number(v.total || 0),
      fecha: v.created_at,
      notas: dAsociada?.notas || null,
    });
  });

  // 2. Agregar cargos manuales de deudas y acumular abonos
  let totalAbonos = 0;
  deudasCliente.forEach((d) => {
    const m = Number(d.monto || 0);
    if (d.tipo === "pago") {
      totalAbonos += m;
    } else {
      const key = d.venta_id ? `v-${d.venta_id}` : `d-${d.id}`;
      const existing = cargosMap.get(key);
      if (existing) {
        if (d.notas && !existing.notas) {
          existing.notas = d.notas;
        }
      } else {
        cargosMap.set(key, {
          id: d.id,
          venta_id: d.venta_id,
          monto: m,
          fecha: d.created_at,
          notas: d.notas,
        });
      }
    }
  });

  // Ordenar cronológicamente (FIFO)
  const listaCargos = Array.from(cargosMap.values()).sort(
    (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
  );

  const totalCargosHistoricos = listaCargos.reduce((acc, crg) => acc + crg.monto, 0);
  let saldoPagado = Math.max(0, totalCargosHistoricos - deudaActual);
  if (totalAbonos > saldoPagado) {
    saldoPagado = totalAbonos;
  }

  const cargosPendientes: {
    cargo: Cargo;
    montoPendiente: number;
    esParcial: boolean;
  }[] = [];

  for (const crg of listaCargos) {
    if (saldoPagado >= crg.monto) {
      saldoPagado -= crg.monto;
    } else if (saldoPagado > 0) {
      const rem = crg.monto - saldoPagado;
      saldoPagado = 0;
      cargosPendientes.push({
        cargo: crg,
        montoPendiente: rem,
        esParcial: true,
      });
    } else {
      cargosPendientes.push({
        cargo: crg,
        montoPendiente: crg.monto,
        esParcial: false,
      });
    }
  }

  const itemsFinales: ProductoFiadoItem[] = [];
  let ultimaFecha: string | null = null;

  for (const cp of cargosPendientes) {
    const crg = cp.cargo;
    ultimaFecha = crg.fecha;

    // Comprobar si hay detalle_ventas desglosado y válido (no solo genérico "Venta")
    const tieneDetalles =
      Boolean(crg.venta_id) &&
      detallesPorVenta.has(crg.venta_id!) &&
      (detallesPorVenta.get(crg.venta_id!) || []).length > 0;

    const prods = tieneDetalles ? detallesPorVenta.get(crg.venta_id!)! : [];
    const esGenerico = prods.length === 1 && /^venta(\s+fiada)?$/i.test(prods[0].nombre || "");

    if (tieneDetalles && !esGenerico) {
      prods.forEach((p, idx) => {
        itemsFinales.push({
          id: `${p.id || idx}-${crg.id}`,
          ventaId: crg.venta_id || undefined,
          folio: crg.venta_id?.slice(0, 8).toUpperCase(),
          fecha: crg.fecha,
          nombre: p.nombre || "Artículo sin nombre",
          qty: Number(p.qty || 1),
          precio: Number(p.precio || 0),
          subtotal: Number(p.subtotal || Number(p.qty || 1) * Number(p.precio || 0)),
          esParcial: cp.esParcial,
          montoPendiente: cp.esParcial ? cp.montoPendiente : undefined,
        });
      });
    } else {
      // Extraer nombres reales de los productos desde las notas de la deuda o venta
      const itemsParseados = parsearItemsDesdeNotas(
        crg.notas,
        cp.montoPendiente,
        crg.fecha,
        crg.venta_id,
        crg.id
      );
      itemsParseados.forEach((it) => {
        itemsFinales.push({
          ...it,
          esParcial: cp.esParcial,
          montoPendiente: cp.esParcial ? cp.montoPendiente : undefined,
        });
      });
    }
  }

  // Fallback si no hay detalles pero sí saldo activo
  if (itemsFinales.length === 0 && deudaActual > 0) {
    itemsFinales.push({
      id: `saldo-${Date.now()}`,
      fecha: new Date().toISOString(),
      nombre: "Saldo adeudado pendiente en cuenta",
      qty: 1,
      precio: deudaActual,
      subtotal: deudaActual,
      esParcial: false,
      montoPendiente: deudaActual,
    });
  }

  return {
    productos: itemsFinales,
    ultimaFecha,
  };
}
