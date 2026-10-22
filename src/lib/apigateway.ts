/**
 * Cliente y utilidades para integración con API Gateway (apigateway.cl)
 * Emisión de Boletas Electrónicas directas ante el SII (Portal eBoleta)
 */

export interface APIGatewayConfig {
  activo: boolean;
  token: string; // Token de API Gateway (Authorization: Token ...)
  rutEmisor: string; // RUT de la empresa (ej: 76.123.456-7)
  rutVendedor?: string; // RUT del usuario persona natural autorizado en el SII (si es diferente)
  claveSII: string; // Clave de acceso tributario al portal SII
  cdgSIISucur?: number; // Código de sucursal SII (0 para Casa Matriz)
  razonSocial?: string;
  giro?: string;
  direccion?: string;
  comuna?: string;
  emisionAutomatica?: boolean;
}

export interface ItemBoleta {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
}

export interface ReceptorBoleta {
  rut?: string;
  razonSocial?: string;
  direccion?: string;
  comuna?: string;
  correo?: string;
}

export interface EmitirBoletaRequest {
  items: ItemBoleta[];
  total: number;
  medioPago?: 1 | 2 | 3; // 1: Efectivo, 2: Tarjeta/Débito, 3: Cheque/Otro
  receptor?: ReceptorBoleta;
}

export interface EmitirBoletaResponse {
  ok: boolean;
  folio?: number;
  tipoDte?: number;
  pdfUrl?: string;
  fechaEmision?: string;
  error?: string;
  raw?: any;
}

export function normalizarRut(rut: string): string {
  if (!rut) return "";
  const r = rut.replace(/[^0-9kK]/g, "").toUpperCase();
  if (r.length < 2) return r;
  const cuerpo = r.slice(0, -1);
  const dv = r.slice(-1);
  return `${cuerpo}-${dv}`;
}

/**
 * Prueba la validez del Token de API Gateway
 */
export async function probarConexionAPIGateway(token: string): Promise<{ ok: boolean; mensaje: string; data?: any }> {
  if (!token || !token.trim()) {
    return { ok: false, mensaje: "Debes ingresar el Token de API Gateway" };
  }

  const cleanToken = token.trim().replace(/^Token\s+/i, "");
  const url = "https://apigateway.cl/api/v2/sii/indicadores/uf";

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Authorization": `Token ${cleanToken}`,
      },
      cache: "no-store",
    });

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        mensaje: "Token inválido o no autorizado. Revisa el Token de tu conexión en apigateway.cl.",
      };
    }

    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        mensaje: `Error de API Gateway (HTTP ${res.status}): ${text.slice(0, 150)}`,
      };
    }

    const data = await res.json().catch(() => null);
    return {
      ok: true,
      mensaje: "¡Conexión exitosa con API Gateway! Tu Token y proxy están funcionando correctamente.",
      data,
    };
  } catch (err: any) {
    return {
      ok: false,
      mensaje: `Fallo de red al conectar con API Gateway: ${err.message || "Error desconocido"}`,
    };
  }
}

/**
 * Emite una Boleta Electrónica (DTE 39) en el SII a través del Portal eBoleta de API Gateway
 */
export async function emitirBoletaAPIGateway(
  config: APIGatewayConfig,
  req: EmitirBoletaRequest
): Promise<EmitirBoletaResponse> {
  if (!config.activo) {
    return { ok: false, error: "La facturación fiscal está desactivada en la configuración." };
  }
  if (!config.token || !config.token.trim()) {
    return { ok: false, error: "Falta el Token de API Gateway en la configuración." };
  }
  if (!config.claveSII || !config.claveSII.trim()) {
    return { ok: false, error: "Falta la clave del SII en la configuración para timbrar en eBoleta." };
  }

  const cleanToken = config.token.trim().replace(/^Token\s+/i, "");
  const rutEmisorLimpio = normalizarRut(config.rutEmisor);
  const rutVendedorLimpio = normalizarRut(config.rutVendedor || config.rutEmisor);

  // Receptor
  const rutReceptor = req.receptor?.rut ? normalizarRut(req.receptor.rut) : "66666666-6";
  const rznSocReceptor = req.receptor?.razonSocial || "Cliente Genérico";

  // Detalle de ítems
  const detalle = req.items.map((it) => ({
    NmbItem: it.nombre.slice(0, 80),
    QtyItem: Math.max(1, Number(it.cantidad || 1)),
    PrcItem: Math.round(Number(it.precioUnitario || 0)),
  }));

  const payload = {
    auth: {
      pass: {
        rut: rutVendedorLimpio,
        clave: config.claveSII.trim(),
      },
    },
    dte: {
      vendedor: rutVendedorLimpio,
      Encabezado: {
        IdDoc: {
          TipoDTE: 39, // Boleta Electrónica
          MedioPago: req.medioPago || 1, // 1: Efectivo, 2: Tarjeta, etc.
        },
        Emisor: {
          RUTEmisor: rutEmisorLimpio,
          CdgSIISucur: Number(config.cdgSIISucur ?? 0),
        },
        Receptor: {
          RUTRecep: rutReceptor,
          RznSocRecep: rznSocReceptor.slice(0, 100),
          DirRecep: req.receptor?.direccion?.slice(0, 70) || "Sin dirección",
          CorreoRecep: req.receptor?.correo || undefined,
        },
      },
      Detalle: detalle,
    },
  };

  const endpoint = "https://apigateway.cl/api/v2/sii/eboleta/emitidas/emitir";

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Token ${cleanToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg =
        data?.message ||
        data?.error ||
        data?.detail ||
        (typeof data === "object" ? JSON.stringify(data) : `HTTP ${res.status}`);
      return {
        ok: false,
        error: `Error del SII / API Gateway: ${errorMsg}`,
        raw: data,
      };
    }

    // Extraer folio y URL de PDF de la respuesta de API Gateway
    const folio = Number(data?.folio || data?.Folio || data?.data?.folio || data?.dte?.Encabezado?.IdDoc?.Folio || 0);
    const pdfUrl = data?.pdf || data?.pdf_url || data?.url_pdf || data?.links?.pdf || undefined;

    return {
      ok: true,
      folio: folio || undefined,
      tipoDte: 39,
      pdfUrl,
      fechaEmision: data?.fecha || new Date().toISOString(),
      raw: data,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: `Excepción de red al comunicar con API Gateway: ${err.message || "Error desconocido"}`,
    };
  }
}
