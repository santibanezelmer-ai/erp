/**
 * ══════════════════════════════════════════════════════════════════════════════
 * CLIENTE OFICIAL DE INTEGRACIÓN TRIBUTARIA SIMPLEAPI (Chilesystems)
 * Operix ERP · Facturación y Emisión Electrónica SII
 * 
 * Basado en las especificaciones oficiales de:
 * - API DTE: https://api.simpleapi.cl/api/v1/
 * - API Scraping & Folios: https://servicios.simpleapi.cl/api/
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { simpleApiQueue } from "./simpleapi-queue";

export const SIMPLEAPI_BASE_URL = "https://api.simpleapi.cl/api/v1";
export const SIMPLEAPI_SERVICES_URL = "https://servicios.simpleapi.cl/api";

export interface SimpleAPIConfig {
  apiKey: string;
  rutEmisor: string;
  razonSocial: string;
  giro: string;
  acteco: number; // Código de actividad económica SII (ej: 471100)
  direccion: string;
  comuna: string;
  ciudad: string;
  cdgSIISucur?: number;
  ambiente: "certificacion" | "produccion";
}

export interface CertificadoDigital {
  rutTitular: string; // RUT de la persona natural autorizada titular del certificado
  password: string;
  pfxBuffer: Uint8Array | Buffer;
  filename?: string;
}

export interface CafInfo {
  tipoDte: number;
  folioDesde: number;
  folioHasta: number;
  xmlContent: string;
}

export interface SimpleApiItemDte {
  nroLinea?: number;
  nombre: string;
  cantidad: number;
  precioUnitario: number; // Bruto (incluye IVA para DTE 39)
  descuento?: number;
  subtotal?: number;
  exento?: boolean;
}

export interface SimpleApiReceptorDte {
  rut: string;
  razonSocial: string;
  giro?: string;
  direccion?: string;
  comuna?: string;
  ciudad?: string;
  correo?: string;
}

export interface GenerarBoletaParams {
  folio: number;
  tipoDte?: 39 | 41; // 39: Boleta Afecta, 41: Boleta Exenta
  fechaEmision?: string; // YYYY-MM-DD (por defecto hoy)
  items: SimpleApiItemDte[];
  total: number;
  medioPago?: "efectivo" | "tarjeta" | "transferencia" | "cheque" | "fiado" | "otro" | string;
  receptor?: SimpleApiReceptorDte;
}

export interface ResultadoEmisionSimpleAPI {
  ok: boolean;
  folio?: number;
  tipoDte?: number;
  trackId?: number;
  estado:
    | "generado"
    | "enviado"
    | "aceptado"
    | "rechazado"
    | "pendiente_conciliacion"
    | "error";
  xmlDte?: string;
  xmlEnvio?: string;
  pdfUrl?: string;
  tedTimbre?: string;
  glosa?: string;
  error?: string;
  errorTipo?: "conexion" | "rechazo_sii" | "caf_insuficiente" | "certificado" | "resultado_incierto";
}

export interface ResumenRCOF {
  tipoDocumento: 39 | 41;
  mntNeto: number;
  mntIva: number;
  tasaIva: number;
  mntExento: number;
  mntTotal: number;
  foliosEmitidos: number;
  foliosAnulados: number;
  foliosUtilizados: number;
  rangoUtilizados: Array<{ desde: number; hasta: number }>;
  rangoAnulados?: Array<{ desde: number; hasta: number }>;
}

export interface ConsumoFoliosParams {
  fechaInicio: string; // YYYY-MM-DD
  fechaFinal: string;  // YYYY-MM-DD
  secuenciaEnvio: number;
  resumenes: ResumenRCOF[];
}

/**
 * Normaliza y limpia RUTs chilenos (sin puntos ni espacios, con guión)
 */
export function limpiarRut(rut: string): string {
  if (!rut) return "";
  const cleaned = rut.replace(/[^0-9kK]/g, "").toUpperCase();
  if (cleaned.length < 2) return cleaned;
  const dv = cleaned.slice(-1);
  const cuerpo = cleaned.slice(0, -1);
  return `${cuerpo}-${dv}`;
}

/**
 * Formatea fecha en estándar SII: YYYY-MM-DD
 */
export function formatearFechaSII(fecha?: Date | string): string {
  const d = fecha ? new Date(fecha) : new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Genera el encabezado de autenticación HTTP para SimpleAPI
 * La documentación oficial vigente de SimpleAPI especifica el envío de la API Key directamente:
 * Authorization: <api-key>
 */
function getAuthHeader(apiKey: string): string {
  return apiKey.trim();
}

/**
 * 1. Probar conexión y validez de la API Key en SimpleAPI
 */
export async function probarConexionSimpleAPI(
  apiKey: string
): Promise<{ ok: boolean; mensaje: string; status?: number }> {
  if (!apiKey || !apiKey.trim()) {
    return { ok: false, mensaje: "Debe ingresar una API Key válida de SimpleAPI." };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    // Endpoint de prueba: consulta simple de salud/folios hacia servicios.simpleapi.cl
    const res = await fetch(`${SIMPLEAPI_BASE_URL}/dte/test`, {
      method: "GET",
      headers: {
        Authorization: getAuthHeader(apiKey),
        Accept: "application/json",
      },
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeout);

    // Si responde 200 o 400 (Bad Request con formato JSON), el API Key es válido
    if (res && (res.status === 200 || res.status === 400 || res.status === 404)) {
      return {
        ok: true,
        mensaje: "Conexión con SimpleAPI establecida exitosamente.",
        status: res.status,
      };
    }

    if (res && res.status === 401) {
      return {
        ok: false,
        mensaje: "API Key inválida o no autorizada. Verifique sus credenciales en simpleapi.cl.",
        status: 401,
      };
    }

    // Validación alternativa: test hacia endpoint de folios
    const resFolios = await fetch(`${SIMPLEAPI_SERVICES_URL}/folios/get/39`, {
      method: "GET",
      headers: {
        Authorization: getAuthHeader(apiKey),
      },
    }).catch(() => null);

    if (resFolios && resFolios.status !== 401) {
      return {
        ok: true,
        mensaje: "Conexión con SimpleAPI verificada exitosamente.",
      };
    }

    return {
      ok: false,
      mensaje: "No fue posible autenticar contra SimpleAPI. Verifique que su API Key esté activa.",
    };
  } catch (err: any) {
    return {
      ok: false,
      mensaje: `Error al conectar con SimpleAPI: ${err.message || "Timeout de conexión"}`,
    };
  }
}

/**
 * 2. Generar XML timbrado y firmado de Boleta Electrónica (DTE 39 o 41)
 * Endpoint: POST /api/v1/dte/generar
 */
export async function generarXmlDteSimpleAPI(
  config: SimpleAPIConfig,
  cert: CertificadoDigital,
  caf: CafInfo,
  params: GenerarBoletaParams
): Promise<{ ok: boolean; xmlDte?: string; error?: string }> {
  try {
    const tipoDte = params.tipoDte || 39;
    const fechaEmis = params.fechaEmision || formatearFechaSII();

    // Cálculo tributario exacto en CLP
    let neto = 0;
    let iva = 0;
    let exento = 0;
    let total = Math.round(params.total);

    if (tipoDte === 39) {
      // Boleta afecta: se desglosa el IVA del total
      neto = Math.round(total / 1.19);
      iva = total - neto;
    } else {
      // Boleta exenta
      exento = total;
    }

    // Construcción del detalle según modelo JSON oficial de SimpleAPI
    const detallesDte = params.items.map((item, idx) => {
      const cant = Number(item.cantidad || 1);
      const prcUnit = Math.round(item.precioUnitario);
      const montoTotalLinea = Math.round(cant * prcUnit);

      return {
        NumeroLinea: idx + 1,
        Nombre: (item.nombre || "Producto").slice(0, 80),
        Cantidad: cant,
        Precio: prcUnit,
        Descuento: 0,
        Recargo: 0,
        MontoItem: montoTotalLinea,
        IndicadorExento: tipoDte === 41 || item.exento ? 1 : 0,
      };
    });

    // Mapeo oficial del MedioPago según Enum en SimpleSDK:
    // EF: Efectivo, TC: Tarjeta, PE: Pago electrónico/Transferencia, CH: Cheque, OT: Otro
    let medioPagoCodigo: "EF" | "TC" | "PE" | "CH" | "OT" = "EF";
    if (params.medioPago === "tarjeta") medioPagoCodigo = "TC";
    else if (params.medioPago === "transferencia" || params.medioPago === "fiado") medioPagoCodigo = "PE";
    else if (params.medioPago === "cheque") medioPagoCodigo = "CH";
    else if (params.medioPago === "otro") medioPagoCodigo = "OT";
    else medioPagoCodigo = "EF";

    // Payload JSON con el contrato de modelos de SimpleAPI (documentacion.simpleapi.cl)
    const dteInputPayload = {
      Certificado: {
        Rut: limpiarRut(cert.rutTitular),
        Password: cert.password,
      },
      Documento: {
        Encabezado: {
          IdentificacionDTE: {
            TipoDTE: tipoDte,
            Folio: params.folio,
            FechaEmision: fechaEmis,
            IndicadorServicio: 3, // BoletaVentasYServicios = 3 (Obligatorio en normativa SII para DTE 39/41)
            TipoImpresion: "T", // Formato Ticket térmico POS
            MedioPago: medioPagoCodigo,
          },
          Emisor: {
            Rut: limpiarRut(config.rutEmisor),
            RazonSocial: config.razonSocial.slice(0, 100),
            Giro: config.giro.slice(0, 80),
            ActividadEconomica: [Number(config.acteco || 471100)], // List<int>
            CodigoSucursalSII: config.cdgSIISucur ?? 0,
            DireccionOrigen: config.direccion.slice(0, 70),
            ComunaOrigen: config.comuna.slice(0, 20),
            CiudadOrigen: config.ciudad.slice(0, 20),
          },
          Receptor: {
            Rut: limpiarRut(params.receptor?.rut || "66666666-6"),
            RazonSocial: (params.receptor?.razonSocial || "Cliente Boleta").slice(0, 100),
            Giro: (params.receptor?.giro || "Particular").slice(0, 80),
            Direccion: (params.receptor?.direccion || config.direccion).slice(0, 70),
            Comuna: (params.receptor?.comuna || config.comuna).slice(0, 20),
            Ciudad: (params.receptor?.ciudad || config.ciudad).slice(0, 20),
          },
          Totales: {
            MontoNeto: neto,
            MontoExento: exento,
            TasaIVA: tipoDte === 39 ? 19 : 0,
            IVA: iva,
            MontoTotal: total,
          },
        },
        Detalles: detallesDte,
      },
    };

    const formData = new FormData();
    formData.append("input", JSON.stringify(dteInputPayload));

    // Archivo PFX
    const pfxBlob = new Blob([cert.pfxBuffer as any], { type: "application/x-pkcs12" });
    formData.append("file", pfxBlob, cert.filename || "certificado.pfx");

    // Archivo CAF XML
    const cafBlob = new Blob([caf.xmlContent], { type: "application/xml" });
    formData.append("file", cafBlob, `caf_${tipoDte}_${caf.folioDesde}_${caf.folioHasta}.xml`);

    const res = await simpleApiQueue.enqueue("dte", async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const r = await fetch(`${SIMPLEAPI_BASE_URL}/dte/generar`, {
          method: "POST",
          headers: {
            Authorization: getAuthHeader(config.apiKey),
          },
          body: formData,
          signal: controller.signal,
        });
        return r;
      } finally {
        clearTimeout(timeout);
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        ok: false,
        error: `Error al generar XML en SimpleAPI (${res.status}): ${errText || res.statusText}`,
      };
    }

    const xmlResultante = await res.text();
    return { ok: true, xmlDte: xmlResultante };
  } catch (err: any) {
    return {
      ok: false,
      error: `Excepción en generarXmlDteSimpleAPI: ${err.message || "Timeout"}`,
    };
  }
}

/**
 * 3. Generar el Sobre de Envío XML para el SII
 * Endpoint: POST /api/v1/envio/generar
 */
export async function generarSobreEnvioSimpleAPI(
  config: SimpleAPIConfig,
  cert: CertificadoDigital,
  xmlDteContent: string
): Promise<{ ok: boolean; xmlEnvio?: string; error?: string }> {
  try {
    const sobreInput = {
      Certificado: {
        Rut: limpiarRut(cert.rutTitular),
        Password: cert.password,
      },
      Caratula: {
        RutEmisor: limpiarRut(config.rutEmisor),
        RutEnvia: limpiarRut(cert.rutTitular),
        RutReceptor: "60803000-K", // RUT oficial del SII
        FchResol: "2014-08-22",
        NroResol: 80,
      },
    };

    const formData = new FormData();
    formData.append("input", JSON.stringify(sobreInput));

    // Certificado
    const pfxBlob = new Blob([cert.pfxBuffer as any], { type: "application/x-pkcs12" });
    formData.append("file", pfxBlob, "certificado.pfx");

    // DTE XML
    const dteBlob = new Blob([xmlDteContent], { type: "application/xml" });
    formData.append("file", dteBlob, "dte_documento.xml");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const res = await fetch(`${SIMPLEAPI_BASE_URL}/envio/generar`, {
      method: "POST",
      headers: {
        Authorization: getAuthHeader(config.apiKey),
      },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      return {
        ok: false,
        error: `Error al generar Sobre de Envío en SimpleAPI (${res.status}): ${errText || res.statusText}`,
      };
    }

    const xmlEnvio = await res.text();
    return { ok: true, xmlEnvio };
  } catch (err: any) {
    return {
      ok: false,
      error: `Excepción en generarSobreEnvioSimpleAPI: ${err.message || "Timeout"}`,
    };
  }
}

/**
 * 3.B Generar Sobre de Boletas Electrónicas (<EnvioBOLETA>)
 * Estándar oficial SII para envío de sets de Boletas (DTE 39 y 41)
 * Endpoint: POST /api/v1/boleta/generar o /api/v1/envio/generar
 */
export async function generarSobreBoletaSimpleAPI(
  config: SimpleAPIConfig,
  cert: CertificadoDigital,
  xmlBoletasContent: string[]
): Promise<{ ok: boolean; xmlEnvio?: string; error?: string }> {
  try {
    const sobreInput = {
      Certificado: {
        Rut: limpiarRut(cert.rutTitular),
        Password: cert.password,
      },
      Caratula: {
        RutEmisor: limpiarRut(config.rutEmisor),
        RutEnvia: limpiarRut(cert.rutTitular),
        RutReceptor: "60803000-K", // RUT del SII
        FchResol: "2014-08-22",
        NroResol: 80,
      },
      TipoEnvio: "boleta", // Indicador de sobre EnvioBOLETA
    };

    const formData = new FormData();
    formData.append("input", JSON.stringify(sobreInput));

    const pfxBlob = new Blob([cert.pfxBuffer as any], { type: "application/x-pkcs12" });
    formData.append("file", pfxBlob, "certificado.pfx");

    xmlBoletasContent.forEach((xml, idx) => {
      const dteBlob = new Blob([xml], { type: "application/xml" });
      formData.append("file", dteBlob, `boleta_${idx + 1}.xml`);
    });

    const res = await simpleApiQueue.enqueue("dte", async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const r = await fetch(`${SIMPLEAPI_BASE_URL}/envio/generar`, {
          method: "POST",
          headers: {
            Authorization: getAuthHeader(config.apiKey),
          },
          body: formData,
          signal: controller.signal,
        });
        return r;
      } finally {
        clearTimeout(timeout);
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        ok: false,
        error: `Error al generar Sobre EnvioBOLETA (${res.status}): ${errText || res.statusText}`,
      };
    }

    const xmlEnvio = await res.text();
    return { ok: true, xmlEnvio };
  } catch (err: any) {
    return {
      ok: false,
      error: `Excepción en generarSobreBoletaSimpleAPI: ${err.message || "Timeout"}`,
    };
  }
}

/**
 * 3.C Generar Registro de Consumo de Folios (RCOF / Libro de Boletas) - Solo Certificación
 * 
 * NOTA LEGAL TRIBUTARIA:
 * Conforme a la Resolución Exenta SII N° 53 del 31 de mayo de 2022, el envío diario de RCOF/RVD 
 * fue ELIMINADO para producción a contar del 1 de agosto de 2022. Esta función se preserva únicamente
 * para fines de acreditación en el set de pruebas de certificación del SII si fuere solicitado.
 * Endpoint: POST /api/v1/rcof/generar
 */
export async function generarRCOFXmlCertificacion(
  config: SimpleAPIConfig,
  cert: CertificadoDigital,
  params: ConsumoFoliosParams
): Promise<{ ok: boolean; xmlRcof?: string; error?: string }> {
  try {
    const rcofInput = {
      Certificado: {
        Rut: limpiarRut(cert.rutTitular),
        Password: cert.password,
      },
      Caratula: {
        RutEmisor: limpiarRut(config.rutEmisor),
        RutEnvia: limpiarRut(cert.rutTitular),
        FchInicio: params.fechaInicio,
        FchFinal: params.fechaFinal,
        SecuenciaEnvio: params.secuenciaEnvio,
      },
      Resumenes: params.resumenes.map((r) => ({
        TipoDocumento: r.tipoDocumento,
        MntNeto: r.mntNeto,
        MntIva: r.mntIva,
        TasaIVA: r.tasaIva,
        MntExento: r.mntExento,
        MntTotal: r.mntTotal,
        FoliosEmitidos: r.foliosEmitidos,
        FoliosAnulados: r.foliosAnulados,
        FoliosUtilizados: r.foliosUtilizados,
        RangoUtilizados: r.rangoUtilizados.map((rng) => ({
          Inicial: rng.desde,
          Final: rng.hasta,
        })),
        RangoAnulados: (r.rangoAnulados || []).map((rng) => ({
          Inicial: rng.desde,
          Final: rng.hasta,
        })),
      })),
    };

    const formData = new FormData();
    formData.append("input", JSON.stringify(rcofInput));

    const pfxBlob = new Blob([cert.pfxBuffer as any], { type: "application/x-pkcs12" });
    formData.append("file", pfxBlob, "certificado.pfx");

    const res = await simpleApiQueue.enqueue("dte", async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const r = await fetch(`${SIMPLEAPI_BASE_URL}/rcof/generar`, {
          method: "POST",
          headers: {
            Authorization: getAuthHeader(config.apiKey),
          },
          body: formData,
          signal: controller.signal,
        });
        return r;
      } finally {
        clearTimeout(timeout);
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        ok: false,
        error: `Error al generar RCOF en SimpleAPI (${res.status}): ${errText || res.statusText}`,
      };
    }

    const xmlRcof = await res.text();
    return { ok: true, xmlRcof };
  } catch (err: any) {
    return {
      ok: false,
      error: `Excepción en generarRCOFSimpleAPI: ${err.message || "Timeout"}`,
    };
  }
}

/**
 * 4. Enviar Sobre de Envío al Servicio de Impuestos Internos (SII)
 * Endpoint: POST /api/v1/envio/enviar
 */
export async function enviarSiiSimpleAPI(
  config: SimpleAPIConfig,
  cert: CertificadoDigital,
  xmlEnvioContent: string,
  tipoEnvio: "boleta" | "dte" = "boleta"
): Promise<{ ok: boolean; trackId?: number; estado?: string; responseXml?: string; error?: string; errorTipo?: "conexion" | "resultado_incierto" | "rechazo_sii" }> {
  try {
    const envioInput = {
      Certificado: {
        Rut: limpiarRut(cert.rutTitular),
        Password: cert.password,
      },
      Ambiente: config.ambiente === "produccion" ? 1 : 0, // 0: Certificación, 1: Producción (Oficial SimpleAPI)
      Tipo: tipoEnvio === "boleta" ? 2 : 1, // 1: EnvioDTE, 2: EnvioBoleta (Oficial SimpleAPI)
    };

    const formData = new FormData();
    formData.append("input", JSON.stringify(envioInput));

    const pfxBlob = new Blob([cert.pfxBuffer as any], { type: "application/x-pkcs12" });
    formData.append("file", pfxBlob, "certificado.pfx");

    const envioBlob = new Blob([xmlEnvioContent], { type: "application/xml" });
    formData.append("file", envioBlob, "envio_sii.xml");

    const res = await simpleApiQueue.enqueue("dte", async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      try {
        const r = await fetch(`${SIMPLEAPI_BASE_URL}/envio/enviar`, {
          method: "POST",
          headers: {
            Authorization: getAuthHeader(config.apiKey),
          },
          body: formData,
          signal: controller.signal,
        });
        return r;
      } finally {
        clearTimeout(timeout);
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        ok: false,
        errorTipo: "rechazo_sii",
        error: `Rechazo en envío al SII (${res.status}): ${errText || res.statusText}`,
      };
    }

    const data = await res.json().catch(async () => {
      const txt = await res.text();
      return { ResponseXml: txt, TrackId: null, Estado: res.statusText };
    });

    const trackId = Number(data.TrackId || data.trackId || data.track_id);

    return {
      ok: true,
      trackId: trackId > 0 ? trackId : undefined,
      estado: data.Estado || data.estado || "Recibido por SII",
      responseXml: data.ResponseXml || undefined,
    };
  } catch (err: any) {
    const isTimeout = err.name === "AbortError" || err.message?.includes("timeout");
    return {
      ok: false,
      errorTipo: isTimeout ? "resultado_incierto" : "conexion",
      error: `Error de conexión al enviar al SII: ${err.message}. ${isTimeout ? "El resultado es incierto; verifique antes de reintentar." : ""}`,
    };
  }
}

/**
 * 5.A Consultar Estado de Envío en el SII mediante TrackID
 * Endpoint oficial: POST /api/v1/consulta/envio
 */
export async function consultarEstadoEnvioTrackIdSimpleAPI(
  config: SimpleAPIConfig,
  cert: CertificadoDigital,
  trackId: number
): Promise<{ ok: boolean; estado?: string; glosa?: string; responseXml?: string; error?: string }> {
  try {
    const consultaInput = {
      Certificado: {
        Rut: limpiarRut(cert.rutTitular),
        Password: cert.password,
      },
      Ambiente: config.ambiente === "produccion" ? 1 : 0,
      TrackId: trackId,
    };

    const formData = new FormData();
    formData.append("input", JSON.stringify(consultaInput));

    const pfxBlob = new Blob([cert.pfxBuffer as any], { type: "application/x-pkcs12" });
    formData.append("file", pfxBlob, "certificado.pfx");

    const res = await simpleApiQueue.enqueue("dte", async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const r = await fetch(`${SIMPLEAPI_BASE_URL}/consulta/envio`, {
          method: "POST",
          headers: {
            Authorization: getAuthHeader(config.apiKey),
          },
          body: formData,
          signal: controller.signal,
        });
        return r;
      } finally {
        clearTimeout(timeout);
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Error al consultar estado de envío (${res.status}): ${errText}` };
    }

    const data = await res.json();
    return {
      ok: true,
      estado: data.Estado || data.Glosa || "Consultado",
      glosa: data.Glosa || data.Detalle || "",
      responseXml: data.ResponseXml || undefined,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: `Excepción en consultarEstadoEnvioTrackIdSimpleAPI: ${err.message}`,
    };
  }
}

/**
 * 5.B Consultar Estado de DTE en el SII
 * Endpoint oficial: POST /api/v1/consulta/dte
 */
export async function consultarEstadoDteSimpleAPI(
  config: SimpleAPIConfig,
  cert: CertificadoDigital,
  params: {
    tipoDte: number;
    folio: number;
    fechaEmision: string; // YYYY-MM-DD
    total: number;
    rutReceptor?: string;
  }
): Promise<{ ok: boolean; estado?: string; glosa?: string; error?: string }> {
  try {
    const consultaInput = {
      Certificado: {
        Rut: limpiarRut(cert.rutTitular),
        Password: cert.password,
      },
      Consulta: {
        RutEmisor: limpiarRut(config.rutEmisor),
        RutReceptor: limpiarRut(params.rutReceptor || "66666666-6"),
        TipoDTE: params.tipoDte,
        Folio: params.folio,
        FechaEmision: params.fechaEmision,
        MontoTotal: Math.round(params.total),
      },
    };

    const formData = new FormData();
    formData.append("input", JSON.stringify(consultaInput));

    const pfxBlob = new Blob([cert.pfxBuffer as any], { type: "application/x-pkcs12" });
    formData.append("file", pfxBlob, "certificado.pfx");

    const res = await simpleApiQueue.enqueue("dte", async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const r = await fetch(`${SIMPLEAPI_BASE_URL}/consulta/dte`, {
          method: "POST",
          headers: {
            Authorization: getAuthHeader(config.apiKey),
          },
          body: formData,
          signal: controller.signal,
        });
        return r;
      } finally {
        clearTimeout(timeout);
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Error al consultar estado (${res.status}): ${errText}` };
    }

    const data = await res.json();
    return {
      ok: true,
      estado: data.Estado || data.Glosa || "Consultado",
      glosa: data.Glosa || data.Detalle || "",
    };
  } catch (err: any) {
    return {
      ok: false,
      error: `Excepción en consultarEstadoDteSimpleAPI: ${err.message}`,
    };
  }
}

/**
 * 6. Consultar Folios Máximos Disponibles en el SII
 * Endpoint: GET /folios/get/{tipo}
 */
export async function consultarFoliosDisponiblesSimpleAPI(
  apiKey: string,
  cert: CertificadoDigital,
  rutEmpresa: string,
  tipoDte: number
): Promise<{ ok: boolean; foliosDisponibles?: number; error?: string }> {
  try {
    const foliosInput = {
      RutEmpresa: limpiarRut(rutEmpresa),
      Tipo: tipoDte,
      Password: cert.password,
      RutCertificado: limpiarRut(cert.rutTitular),
      CertificadoB64: Buffer.from(cert.pfxBuffer).toString("base64"),
    };

    const formData = new FormData();
    formData.append("input", JSON.stringify(foliosInput));
    const pfxBlob = new Blob([cert.pfxBuffer as any], { type: "application/x-pkcs12" });
    formData.append("file", pfxBlob, "certificado.pfx");

    const res = await simpleApiQueue.enqueue("folio", async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const r = await fetch(`${SIMPLEAPI_SERVICES_URL}/folios/get/${tipoDte}`, {
          method: "POST",
          headers: {
            Authorization: getAuthHeader(apiKey),
          },
          body: formData,
          signal: controller.signal,
        });
        return r;
      } finally {
        clearTimeout(timeout);
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Error al consultar folios (${res.status}): ${errText}` };
    }

    const folios = await res.json();
    return { ok: true, foliosDisponibles: Number(folios) };
  } catch (err: any) {
    return { ok: false, error: `Excepción al consultar folios: ${err.message}` };
  }
}

/**
 * 7. Descargar Archivo CAF desde el SII
 * Endpoint: POST /Folios/get/{tipo}/{cantidad}
 */
export async function descargarCafSimpleAPI(
  apiKey: string,
  cert: CertificadoDigital,
  rutEmpresa: string,
  tipoDte: number,
  cantidad: number
): Promise<{ ok: boolean; cafXml?: string; error?: string }> {
  try {
    const foliosInput = {
      RutEmpresa: limpiarRut(rutEmpresa),
      Tipo: tipoDte,
      Password: cert.password,
      RutCertificado: limpiarRut(cert.rutTitular),
      CertificadoB64: Buffer.from(cert.pfxBuffer).toString("base64"),
    };

    const formData = new FormData();
    formData.append("input", JSON.stringify(foliosInput));

    const res = await simpleApiQueue.enqueue("folio", async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      try {
        const r = await fetch(`${SIMPLEAPI_SERVICES_URL}/Folios/get/${tipoDte}/${cantidad}`, {
          method: "POST",
          headers: {
            Authorization: getAuthHeader(apiKey),
          },
          body: formData,
          signal: controller.signal,
        });
        return r;
      } finally {
        clearTimeout(timeout);
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Error al descargar CAF (${res.status}): ${errText}` };
    }

    const xmlCaf = await res.text();
    return { ok: true, cafXml: xmlCaf };
  } catch (err: any) {
    return { ok: false, error: `Excepción al descargar CAF: ${err.message}` };
  }
}

/**
 * 8. Orquestador Maestro: Emisión Completa de Boleta Electrónica
 * Realiza el pipeline completo:
 * 1. Genera y firma el XML con el CAF y Certificado PFX (TED timbrado)
 * 2. Genera el sobre de envío al SII
 * 3. Entrega el sobre al SII vía Web Services y obtiene el Track ID
 */
export async function emitirBoletaCompletaSimpleAPI(
  config: SimpleAPIConfig,
  cert: CertificadoDigital,
  caf: CafInfo,
  params: GenerarBoletaParams
): Promise<ResultadoEmisionSimpleAPI> {
  // Paso 1: Generar DTE XML firmado y timbrado
  const resDte = await generarXmlDteSimpleAPI(config, cert, caf, params);
  if (!resDte.ok || !resDte.xmlDte) {
    return {
      ok: false,
      estado: "error",
      folio: params.folio,
      tipoDte: params.tipoDte || 39,
      error: resDte.error || "No se pudo generar el XML timbrado del DTE.",
      errorTipo: "caf_insuficiente",
    };
  }

  // Paso 2: Generar Sobre de Envío (EnvioBOLETA para 39/41 o EnvioDTE para facturas)
  const isBoleta = !params.tipoDte || params.tipoDte === 39 || params.tipoDte === 41;
  const resSobre = isBoleta
    ? await generarSobreBoletaSimpleAPI(config, cert, [resDte.xmlDte])
    : await generarSobreEnvioSimpleAPI(config, cert, resDte.xmlDte);
  if (!resSobre.ok || !resSobre.xmlEnvio) {
    return {
      ok: false,
      estado: "generado",
      folio: params.folio,
      tipoDte: params.tipoDte || 39,
      xmlDte: resDte.xmlDte,
      error: resSobre.error || "No se pudo generar el Sobre de Envío XML.",
      errorTipo: "conexion",
    };
  }

  // Paso 3: Enviar al SII
  const resEnvio = await enviarSiiSimpleAPI(config, cert, resSobre.xmlEnvio, isBoleta ? "boleta" : "dte");
  if (!resEnvio.ok) {
    return {
      ok: false,
      estado: resEnvio.errorTipo === "resultado_incierto" ? "pendiente_conciliacion" : "error",
      folio: params.folio,
      tipoDte: params.tipoDte || 39,
      xmlDte: resDte.xmlDte,
      xmlEnvio: resSobre.xmlEnvio,
      error: resEnvio.error,
      errorTipo: resEnvio.errorTipo,
    };
  }

  return {
    ok: true,
    folio: params.folio,
    tipoDte: params.tipoDte || 39,
    trackId: resEnvio.trackId,
    estado: "enviado",
    xmlDte: resDte.xmlDte,
    xmlEnvio: resSobre.xmlEnvio,
    glosa: resEnvio.estado || "Aceptado para procesamiento por el SII",
  };
}
