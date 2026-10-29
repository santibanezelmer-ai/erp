/**
 * Cliente y utilidades para integración con API Gateway (app.apigateway.cl)
 * Emisión de Boletas Electrónicas directas ante el SII (Portal eBoleta)
 */

export interface APIGatewayConfig {
  activo: boolean;
  token: string; // Token de API Gateway (Authorization: Token ...)
  rutEmisor: string; // RUT de la empresa (ej: 76.123.456-7)
  rutVendedor?: string; // RUT del usuario persona natural autorizado en el SII
  claveSII: string; // Clave de acceso tributario al portal SII
  cdgSIISucur?: number; // Código de sucursal SII (asignado por SII en eBoleta)
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
  tipoDte?: 39 | 41; // 39: Boleta Afecta, 41: Boleta Exenta
  medioPago?: 1 | 2 | 3; // 1: Efectivo, 2: Tarjeta/Débito/Crédito, 3: Cheque/Transferencia/Otro
  receptor?: ReceptorBoleta;
}

export interface EmitirBoletaResponse {
  ok: boolean;
  folio?: number;
  tipoDte?: number;
  pdfUrl?: string;
  pdfBase64?: string;
  fechaEmision?: string;
  error?: string;
  errorTipo?: "rechazo_explicito" | "resultado_incierto";
  raw?: any;
}

/**
 * Normaliza y formatea un RUT chileno (ej: 76123456-7 sin puntos y con guión)
 */
export function normalizarRut(rut: string): string {
  if (!rut) return "";
  const r = rut.replace(/[^0-9kK]/g, "").toUpperCase();
  if (r.length < 2) return r;
  const cuerpo = r.slice(0, -1);
  const dv = r.slice(-1);
  return `${cuerpo}-${dv}`;
}

const APIGATEWAY_BASE_URL = "https://app.apigateway.cl/api/v2";

/**
 * Prueba la validez del Token de API Gateway consultando un recurso de lectura
 */
export async function probarConexionAPIGateway(token: string): Promise<{ ok: boolean; mensaje: string; data?: any }> {
  if (!token || !token.trim()) {
    return { ok: false, mensaje: "Debes ingresar el Token de API Gateway" };
  }

  const cleanToken = token.trim().replace(/^Token\s+/i, "");
  // Endpoint de verificación contra app.apigateway.cl
  const url = `${APIGATEWAY_BASE_URL}/sii/contribuyentes/situacion_tributaria/tercero/76192083-9`;

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
        mensaje: "Token inválido o no autorizado. Revisa tu Token de conexión en apigateway.cl.",
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
      mensaje: "¡Conexión exitosa con API Gateway! Tu Token está activo y validado.",
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
 * Emite una Boleta Electrónica (DTE 39 o 41) en el SII a través del Portal eBoleta de API Gateway
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

  if (!rutEmisorLimpio) {
    return { ok: false, error: "El RUT emisor de la empresa es obligatorio y no es válido." };
  }
  if (!rutVendedorLimpio) {
    return { ok: false, error: "El RUT del usuario vendedor/autorizado en el SII es obligatorio." };
  }

  // Receptor
  const rutReceptor = req.receptor?.rut ? normalizarRut(req.receptor.rut) : "66666666-6";
  const rznSocReceptor = req.receptor?.razonSocial || "Cliente Genérico";

  // Detalle de ítems
  const detalle = req.items.map((it) => ({
    NmbItem: it.nombre.slice(0, 80),
    QtyItem: Math.max(1, Number(it.cantidad || 1)),
    PrcItem: Math.round(Number(it.precioUnitario || 0)),
  }));

  const tipoDteFinal = req.tipoDte === 41 ? 41 : 39;
  const sucursalCodigo = Number(config.cdgSIISucur ?? 0);

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
          TipoDTE: tipoDteFinal, // 39: Boleta Afecta, 41: Boleta Exenta
          MedioPago: req.medioPago || 1, // 1: Efectivo, 2: Tarjeta, 3: Transferencia/Otro
        },
        Emisor: {
          RUTEmisor: rutEmisorLimpio,
          CdgSIISucur: sucursalCodigo,
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

  const endpoint = `${APIGATEWAY_BASE_URL}/sii/eboleta/emitidas/emitir`;

  // Controlador de timeout estricto de 15 segundos para evitar solicitudes colgadas
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Token ${cleanToken}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (netErr: any) {
    clearTimeout(timeoutId);
    const isTimeout = netErr.name === "AbortError" || netErr.message?.includes("timeout");
    return {
      ok: false,
      error: isTimeout
        ? "Tiempo de espera agotado (timeout) al comunicar con el SII / API Gateway. El documento pudo haber sido emitido en el SII."
        : `Fallo de conexión de red con API Gateway (${netErr.message || "desconexión de socket"}). El resultado de la emisión es incierto.`,
      errorTipo: "resultado_incierto",
    };
  }
  clearTimeout(timeoutId);

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    return {
      ok: false,
      error: `Respuesta inesperada de API Gateway (recibido HTML en vez de JSON, código HTTP ${res.status}). El estado de la emisión es incierto.`,
      errorTipo: "resultado_incierto",
    };
  }

  const data = await res.json().catch(() => null);

  // Errores de Gateway o servidor intermedio (502, 503, 504) -> Resultado Incierto
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    return {
      ok: false,
      error: `Servidor tributario no disponible temporalmente (HTTP ${res.status}). La boleta pudo haber sido procesada en el SII.`,
      errorTipo: "resultado_incierto",
      raw: data,
    };
  }

  if (!res.ok) {
    let errorMsg = `Error del SII / API Gateway (HTTP ${res.status})`;
    if (typeof data?.detail === "string") {
      errorMsg = data.detail;
    } else if (typeof data?.message === "string") {
      errorMsg = data.message;
    } else if (typeof data?.error === "string") {
      errorMsg = data.error;
    } else if (data?.code && data?.detail) {
      errorMsg = `[Código ${data.code}]: ${data.detail}`;
    } else if (data && typeof data === "object") {
      const cleanData = { ...data };
      delete cleanData.clave;
      delete cleanData.token;
      errorMsg = JSON.stringify(cleanData);
    }
    return {
      ok: false,
      error: errorMsg,
      errorTipo: "rechazo_explicito",
      raw: data,
    };
  }

    // Extraer folio y URL de PDF según el contrato de app.apigateway.cl
    const folio = Number(
      data?.data?.folio ??
      data?.folio ??
      data?.Folio ??
      data?.dte?.Encabezado?.IdDoc?.Folio ??
      0
    );

    const pdfUrl =
      data?.data?.pdf ??
      data?.pdf ??
      data?.pdf_url ??
      data?.data?.pdf_url ??
      data?.url_pdf ??
      data?.links?.pdf ??
      undefined;

    const pdfBase64 =
      data?.data?.pdf_base64 ??
      data?.pdf_base64 ??
      undefined;

    const tipoDteResult = Number(data?.data?.dte ?? data?.dte ?? tipoDteFinal);

    // Validación estricta de confirmación del proveedor
    if (!folio || folio <= 0) {
      return {
        ok: false,
        error: "API Gateway respondió sin un número de folio asignado por el SII.",
        raw: data,
      };
    }

    return {
      ok: true,
      folio,
      tipoDte: tipoDteResult,
      pdfUrl,
      pdfBase64,
      fechaEmision: data?.fecha || new Date().toISOString(),
      raw: data,
    };
}
