/**
 * Cliente y utilidades para integración con LibreDTE (Facturación Electrónica Chile - SII)
 * Soporta Boleta Electrónica (39), Boleta Exenta (41), Factura Electrónica (33), Factura Exenta (34).
 */

export interface LibreDTEConfig {
  activo: boolean;
  hash: string; // Token / API Key de usuario en LibreDTE
  rutEmisor: string; // Ej: 76.123.456-7
  razonSocial: string;
  giro: string;
  acteco: number | string; // Código de actividad económica SII (ej: 477111)
  direccion: string;
  comuna: string;
  ciudad?: string;
  ambiente: "certificacion" | "produccion";
  tipoDteDefault: 39 | 33 | 41 | 34; // 39: Boleta, 33: Factura
  emisionAutomatica: boolean;
}

export interface ItemDTE {
  nombre: string;
  cantidad: number;
  precioUnitario: number; // Con IVA para boletas, neto para facturas si aplica
  descuento?: number;
}

export interface ReceptorDTE {
  rut: string; // 66666666-6 para cliente ocasional en boleta
  razonSocial: string;
  giro?: string;
  direccion?: string;
  comuna?: string;
  ciudad?: string;
}

export interface EmitirDTERequest {
  tipoDte: 39 | 33 | 41 | 34;
  items: ItemDTE[];
  subtotal: number;
  descuento?: number;
  total: number;
  receptor?: ReceptorDTE;
  observaciones?: string;
}

export interface EmitirDTEResponse {
  ok: boolean;
  folio?: number;
  tipoDte?: number;
  pdfUrl?: string;
  xmlUrl?: string;
  codigo?: string;
  error?: string;
  ted?: string; // Timbre Electrónico DTE
  raw?: any;
}

/**
 * Limpia y formatea un RUT chileno (ej: 76123456-7)
 */
export function limpiarRut(rut: string): string {
  if (!rut) return "";
  const r = rut.replace(/[^0-9kK]/g, "").toUpperCase();
  if (r.length < 2) return r;
  const cuerpo = r.slice(0, -1);
  const dv = r.slice(-1);
  return `${cuerpo}-${dv}`;
}

/**
 * Obtiene la URL base de la API de LibreDTE según el ambiente
 */
export function getLibreDTEBaseUrl(ambiente: "certificacion" | "produccion" = "produccion"): string {
  // LibreDTE opera principalmente sobre https://libredte.cl/api
  // El ambiente (certificación/producción) se maneja a nivel de cuenta/empresa en LibreDTE
  return "https://libredte.cl/api";
}

/**
 * Prueba la conexión con LibreDTE usando el Hash de usuario
 */
export async function probarConexionLibreDTE(hash: string): Promise<{ ok: boolean; mensaje: string; data?: any }> {
  if (!hash || !hash.trim()) {
    return { ok: false, mensaje: "Debes ingresar el Token / Hash de LibreDTE" };
  }

  const cleanHash = hash.trim();
  const url = `${getLibreDTEBaseUrl()}/dte/dte_tmps/listar`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${cleanHash}`,
        "X-LibreDTE-Hash": cleanHash,
      },
      cache: "no-store",
    });

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        mensaje: "Credenciales inválidas. Verifica tu Hash de usuario en LibreDTE (Mi Cuenta > Datos de Usuario).",
      };
    }

    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        mensaje: `Error al conectar con LibreDTE (HTTP ${res.status}): ${text.slice(0, 150)}`,
      };
    }

    const data = await res.json().catch(() => null);
    return {
      ok: true,
      mensaje: "¡Conexión exitosa con LibreDTE! Credenciales válidas ante el servicio.",
      data,
    };
  } catch (err: any) {
    return {
      ok: false,
      mensaje: `Fallo de red al conectar con LibreDTE: ${err.message || "Error desconocido"}`,
    };
  }
}

/**
 * Construye el payload JSON estándar de LibreDTE para emitir DTE
 */
export function construirPayloadDTE(config: LibreDTEConfig, req: EmitirDTERequest) {
  const fechaHoy = new Date().toISOString().split("T")[0];
  const rutEmisorLimpio = limpiarRut(config.rutEmisor);

  // Receptor por defecto para Boletas anónimas
  const rutReceptor = req.receptor?.rut ? limpiarRut(req.receptor.rut) : "66666666-6";
  const rznSocReceptor = req.receptor?.razonSocial || (req.tipoDte === 39 ? "CLIENTE GENERAL" : "CLIENTE SIN RAZON SOCIAL");

  // Detalle de ítems
  const detalle = req.items.map((it) => {
    const cantidad = Math.max(1, Number(it.cantidad || 1));
    const precio = Math.round(Number(it.precioUnitario || 0));
    const monto = Math.round(cantidad * precio);

    return {
      NmbItem: it.nombre.slice(0, 80),
      QtyItem: cantidad,
      PrcItem: precio,
      MontoItem: monto,
    };
  });

  const totalCalculado = detalle.reduce((acc, it) => acc + it.MontoItem, 0);
  const totalFinal = Math.round(req.total || totalCalculado);

  const encabezado: any = {
    IdDoc: {
      TipoDTE: req.tipoDte,
      Folio: 0, // 0 indica que LibreDTE asigna el folio correlativo autorizado por SII
      FchEmis: fechaHoy,
    },
    Emisor: {
      RUTEmisor: rutEmisorLimpio,
      RznSoc: config.razonSocial.slice(0, 100),
      GiroEmis: config.giro.slice(0, 80),
      Acteco: Number(config.acteco) || 477111,
      DirOrigen: config.direccion.slice(0, 70),
      CmnaOrigen: config.comuna.slice(0, 20),
      CiudadOrigen: (config.ciudad || config.comuna).slice(0, 20),
    },
    Receptor: {
      RUTRecep: rutReceptor,
      RznSocRecep: rznSocReceptor.slice(0, 100),
    },
    Totales: {
      MntTotal: totalFinal,
    },
  };

  // Si es Boleta (39 ó 41)
  if (req.tipoDte === 39 || req.tipoDte === 41) {
    encabezado.IdDoc.IndServicio = 3; // 3: Boleta de ventas y servicios
    // Para boletas afectas con IVA incluido (39), LibreDTE acepta MntTotal directo
  }

  // Si es Factura (33)
  if (req.tipoDte === 33) {
    // Para factura electrónica, desglosamos Neto e IVA (19%)
    const neto = Math.round(totalFinal / 1.19);
    const iva = totalFinal - neto;
    encabezado.Totales.MntNeto = neto;
    encabezado.Totales.TasaIVA = 19;
    encabezado.Totales.IVA = iva;
    encabezado.Totales.MntTotal = totalFinal;

    if (req.receptor?.giro) {
      encabezado.Receptor.GiroRecep = req.receptor.giro.slice(0, 40);
    }
    if (req.receptor?.direccion) {
      encabezado.Receptor.DirRecep = req.receptor.direccion.slice(0, 70);
    }
    if (req.receptor?.comuna) {
      encabezado.Receptor.CmnaRecep = req.receptor.comuna.slice(0, 20);
    }
    if (req.receptor?.ciudad) {
      encabezado.Receptor.CiudadRecep = req.receptor.ciudad.slice(0, 20);
    }
  }

  return {
    Encabezado: encabezado,
    Detalle: detalle,
  };
}

/**
 * Emite un DTE real a través de LibreDTE
 */
export async function emitirDTELibreDTE(
  config: LibreDTEConfig,
  req: EmitirDTERequest
): Promise<EmitirDTEResponse> {
  if (!config.activo) {
    return { ok: false, error: "La facturación con LibreDTE está desactivada en la configuración." };
  }
  if (!config.hash || !config.hash.trim()) {
    return { ok: false, error: "Falta el Hash / Token de LibreDTE en la configuración." };
  }
  if (!config.rutEmisor || !config.rutEmisor.trim()) {
    return { ok: false, error: "Falta el RUT del emisor en la configuración fiscal." };
  }

  const payload = construirPayloadDTE(config, req);
  const cleanHash = config.hash.trim();
  const baseUrl = getLibreDTEBaseUrl(config.ambiente);
  const rutEmisorLimpio = limpiarRut(config.rutEmisor);

  try {
    // Paso 1: Crear DTE temporal en LibreDTE
    const resCrear = await fetch(`${baseUrl}/dte/dte_tmps/crear`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${cleanHash}`,
        "X-LibreDTE-Hash": cleanHash,
      },
      body: JSON.stringify(payload),
    });

    const dataCrear = await resCrear.json().catch(() => null);

    if (!resCrear.ok) {
      const errorMsg = dataCrear?.message || dataCrear?.error || JSON.stringify(dataCrear) || `HTTP ${resCrear.status}`;
      return {
        ok: false,
        error: `Error al crear DTE en LibreDTE: ${errorMsg}`,
        raw: dataCrear,
      };
    }

    const codigoTemporal = dataCrear?.codigo || dataCrear?.d || dataCrear?.id;
    if (!codigoTemporal) {
      return {
        ok: false,
        error: "LibreDTE no devolvió un código de documento temporal.",
        raw: dataCrear,
      };
    }

    // Paso 2: Generar y Timbrar el DTE ante el SII
    const resGenerar = await fetch(`${baseUrl}/dte/dte_tmps/generar/${codigoTemporal}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${cleanHash}`,
        "X-LibreDTE-Hash": cleanHash,
      },
      body: JSON.stringify({
        cedula: rutEmisorLimpio,
      }),
    });

    const dataGenerar = await resGenerar.json().catch(() => null);

    if (!resGenerar.ok) {
      const genMsg = dataGenerar?.message || dataGenerar?.error || JSON.stringify(dataGenerar) || `HTTP ${resGenerar.status}`;
      return {
        ok: false,
        error: `Error al generar DTE en LibreDTE/SII: ${genMsg}`,
        raw: dataGenerar,
      };
    }

    const folio = Number(dataGenerar?.folio || dataGenerar?.Folio || 0);
    const tipoDte = Number(req.tipoDte);

    // URL oficial de PDF de LibreDTE
    // Formato papel continuo (térmico 80mm): ?papelContinuo=80
    const pdfUrl = `${baseUrl}/dte/dte_emitir/pdf/${codigoTemporal}/${rutEmisorLimpio}/${tipoDte}/${folio}?papelContinuo=80`;
    const xmlUrl = `${baseUrl}/dte/dte_emitir/xml/${codigoTemporal}/${rutEmisorLimpio}/${tipoDte}/${folio}`;

    return {
      ok: true,
      folio: folio || undefined,
      tipoDte,
      codigo: codigoTemporal,
      pdfUrl,
      xmlUrl,
      ted: dataGenerar?.ted || undefined,
      raw: dataGenerar,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: `Excepción al comunicar con LibreDTE: ${err.message || "Error de conexión"}`,
    };
  }
}
