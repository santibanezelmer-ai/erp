/**
 * ══════════════════════════════════════════════════════════════════════════════
 * SERVICIO CENTRAL DE FACTURACIÓN SIMPLEAPI PARA OPERIX ERP
 * Orquesta la validación, seguridad, idempotencia y comunicación con SimpleAPI
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { createClient } from "@supabase/supabase-js";
import {
  emitirBoletaCompletaSimpleAPI,
  consultarEstadoDteSimpleAPI,
  probarConexionSimpleAPI,
  type SimpleAPIConfig,
  type CertificadoDigital,
  type CafInfo,
  type GenerarBoletaParams,
  type ResultadoEmisionSimpleAPI,
  limpiarRut,
} from "./simpleapi";
import { descifrarDato } from "./tributario-crypto";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rgyqtxoagsmkleebrmza.supabase.co";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Orquestador principal de emisión para una venta desde el POS
 */
export async function emitirDteVentaSimpleAPI(params: {
  ventaId: string;
  negocioId: string;
  tipoDte?: 39 | 41;
  medioPago?: string;
  receptor?: {
    rut: string;
    razonSocial: string;
    direccion?: string;
    comuna?: string;
    giro?: string;
  };
}): Promise<ResultadoEmisionSimpleAPI> {
  const supabase = getSupabaseAdmin();
  const { ventaId, negocioId, tipoDte = 39, medioPago = "efectivo", receptor } = params;

  try {
    // 1. Cargar configuración fiscal del comercio
    const { data: cfgTrib, error: cfgErr } = await supabase
      .from("configuracion_tributaria")
      .select("*")
      .eq("negocio_id", negocioId)
      .eq("activo", true)
      .maybeSingle();

    if (cfgErr || !cfgTrib || !cfgTrib.simpleapi_key) {
      return {
        ok: false,
        estado: "error",
        error: "Comercio sin facturación electrónica SimpleAPI activa. Verifique en Configuración > Tributación.",
        errorTipo: "conexion",
      };
    }

    // 2. Cargar venta y detalles con aislamiento multiempresa
    const [ventaRes, detallesRes] = await Promise.all([
      supabase.from("ventas").select("*").eq("id", ventaId).eq("negocio_id", negocioId).single(),
      supabase.from("detalle_ventas").select("*").eq("venta_id", ventaId).eq("negocio_id", negocioId),
    ]);

    if (ventaRes.error || !ventaRes.data) {
      return {
        ok: false,
        estado: "error",
        error: "No se encontró la venta especificada en este comercio.",
      };
    }

    const venta = ventaRes.data;

    // 3. Control de Idempotencia: Verificar si ya existe documento emitido o pendiente
    const { data: docExistente } = await supabase
      .from("documentos_tributarios")
      .select("*")
      .eq("venta_id", ventaId)
      .eq("tipo_dte", tipoDte)
      .maybeSingle();

    if (docExistente) {
      if (docExistente.estado === "aceptado" || docExistente.estado === "enviado") {
        return {
          ok: true,
          folio: Number(docExistente.folio),
          tipoDte: docExistente.tipo_dte,
          trackId: docExistente.track_id ? Number(docExistente.track_id) : undefined,
          estado: docExistente.estado as any,
          pdfUrl: docExistente.pdf_url || undefined,
          glosa: "Documento ya emitido previamente.",
        };
      }

      if (docExistente.estado === "pendiente_conciliacion") {
        return {
          ok: false,
          folio: Number(docExistente.folio),
          tipoDte: docExistente.tipo_dte,
          estado: "pendiente_conciliacion",
          error: "Venta pendiente de conciliación con el SII debido a un timeout previo. No se permite re-emitir automáticamente para evitar duplicar folios.",
          errorTipo: "resultado_incierto",
        };
      }
    }

    // 4. Asignación atómica del Folio CAF mediante SELECT FOR UPDATE
    const { data: folioRpc, error: folioErr } = await supabase.rpc("obtener_siguiente_folio_dte", {
      _negocio_id: negocioId,
      _tipo_dte: tipoDte,
    });

    if (folioErr || !folioRpc?.ok) {
      return {
        ok: false,
        estado: "error",
        error: folioRpc?.error || "Error al asignar folio tributario. Verifique disponibilidad de CAF.",
        errorTipo: "caf_insuficiente",
      };
    }

    const folioAsignado = Number(folioRpc.folio);
    const cafXml = folioRpc.caf_xml;

    // 5. Descargar Certificado Digital PFX desde storage privado
    if (!cfgTrib.certificado_storage_path) {
      return {
        ok: false,
        estado: "error",
        error: "Falta cargar el Certificado Digital PFX en la configuración del comercio.",
        errorTipo: "certificado",
      };
    }

    const { data: certBlob, error: certErr } = await supabase.storage
      .from("certificados-tributarios")
      .download(cfgTrib.certificado_storage_path);

    if (certErr || !certBlob) {
      return {
        ok: false,
        estado: "error",
        error: "No se pudo leer el certificado digital del comercio desde el almacenamiento seguro.",
        errorTipo: "certificado",
      };
    }

    const pfxBuffer = Buffer.from(await certBlob.arrayBuffer());

    // 6. Preparar configuración y objetos de firma
    const configSimpleAPI: SimpleAPIConfig = {
      apiKey: descifrarDato(cfgTrib.simpleapi_key),
      rutEmisor: cfgTrib.rut_emisor,
      razonSocial: cfgTrib.razon_social,
      giro: cfgTrib.giro,
      acteco: Number(cfgTrib.acteco || 471100),
      direccion: cfgTrib.direccion,
      comuna: cfgTrib.comuna,
      ciudad: cfgTrib.ciudad,
      cdgSIISucur: cfgTrib.cdg_sii_sucur || 0,
      ambiente: cfgTrib.ambiente === "produccion" ? "produccion" : "certificacion",
    };

    const certDigital: CertificadoDigital = {
      rutTitular: cfgTrib.certificado_rut_titular || cfgTrib.rut_emisor,
      password: descifrarDato(cfgTrib.certificado_password_enc) || "",
      pfxBuffer,
    };

    const cafInfo: CafInfo = {
      tipoDte,
      folioDesde: Number(folioRpc.folio_desde || 1),
      folioHasta: Number(folioRpc.folio_hasta || 1000),
      xmlContent: cafXml,
    };

    // 7. Mapear líneas de detalle de la venta
    const detalles = detallesRes.data || [];
    const items = detalles.length > 0
      ? detalles.map((d, idx) => ({
          nroLinea: idx + 1,
          nombre: d.nombre || "Producto",
          cantidad: Number(d.qty || 1),
          precioUnitario: Number(d.precio || 0),
          exento: tipoDte === 41,
        }))
      : [
          {
            nroLinea: 1,
            nombre: "Venta General",
            cantidad: 1,
            precioUnitario: Number(venta.total || 0),
            exento: tipoDte === 41,
          },
        ];

    const boletaParams: GenerarBoletaParams = {
      folio: folioAsignado,
      tipoDte,
      total: Number(venta.total || 0),
      items,
      medioPago: medioPago as any,
      receptor: receptor ? {
        rut: limpiarRut(receptor.rut),
        razonSocial: receptor.razonSocial,
        direccion: receptor.direccion,
        comuna: receptor.comuna,
      } : undefined,
    };

    // 8. Registro inicial en documentos_tributarios ('borrador')
    const totalVenta = Number(venta.total || 0);
    const netoCalc = tipoDte === 39 ? Math.round(totalVenta / 1.19) : 0;
    const ivaCalc = tipoDte === 39 ? totalVenta - netoCalc : 0;
    const exentoCalc = tipoDte === 41 ? totalVenta : 0;

    const { data: docCreado } = await supabase
      .from("documentos_tributarios")
      .upsert({
        negocio_id: negocioId,
        venta_id: ventaId,
        tipo_dte: tipoDte,
        folio: folioAsignado,
        rut_emisor: cfgTrib.rut_emisor,
        rut_receptor: receptor?.rut || "66666666-6",
        razon_social_receptor: receptor?.razonSocial || "Cliente Boleta",
        monto_neto: netoCalc,
        iva: ivaCalc,
        monto_exento: exentoCalc,
        monto_total: totalVenta,
        estado: "borrador",
        proveedor: "simpleapi",
      }, { onConflict: "negocio_id,venta_id,tipo_dte" })
      .select()
      .single();

    // 9. Ejecutar Pipeline completo a través de la cola de emisión
    const resultado = await emitirBoletaCompletaSimpleAPI(
      configSimpleAPI,
      certDigital,
      cafInfo,
      boletaParams
    );

    // 10. Actualizar documentos_tributarios y ventas
    const docId = docCreado?.id;
    if (docId) {
      await supabase
        .from("documentos_tributarios")
        .update({
          estado: resultado.estado,
          track_id: resultado.trackId || null,
          pdf_url: resultado.pdfUrl || null,
          ultimo_error: resultado.error || null,
          respuesta_proveedor: {
            glosa: resultado.glosa,
            trackId: resultado.trackId,
            error: resultado.error,
          },
        })
        .eq("id", docId);
    }

    // Actualizar compatibilidad retroactiva en tabla ventas
    if (resultado.ok && resultado.folio) {
      await supabase
        .from("ventas")
        .update({
          dte_tipo: tipoDte,
          dte_folio: resultado.folio,
          dte_pdf_url: resultado.pdfUrl || null,
          dte_estado: "emitido",
          dte_fecha: new Date().toISOString(),
          dte_error: null,
        })
        .eq("id", ventaId)
        .eq("negocio_id", negocioId);
    } else if (resultado.estado === "pendiente_conciliacion") {
      await supabase
        .from("ventas")
        .update({
          dte_tipo: tipoDte,
          dte_folio: folioAsignado,
          dte_estado: "pendiente_conciliacion",
          dte_error: resultado.error || "Operación con resultado incierto. Requiere conciliación.",
        })
        .eq("id", ventaId)
        .eq("negocio_id", negocioId);
    } else {
      await supabase
        .from("ventas")
        .update({
          dte_tipo: tipoDte,
          dte_estado: "error",
          dte_error: resultado.error || "Error en emisión con SimpleAPI",
        })
        .eq("id", ventaId)
        .eq("negocio_id", negocioId);
    }

    return resultado;
  } catch (err: any) {
    console.error("Excepción en emitirDteVentaSimpleAPI:", err);
    return {
      ok: false,
      estado: "error",
      error: err.message || "Error interno al procesar emisión con SimpleAPI",
      errorTipo: "conexion",
    };
  }
}

/**
 * Conciliación segura ante resultado incierto (timeout/desconexión)
 */
export async function conciliarDteVentaSimpleAPI(
  negocioId: string,
  ventaId: string
): Promise<{ ok: boolean; estado: string; glosa: string }> {
  const supabase = getSupabaseAdmin();

  const { data: doc } = await supabase
    .from("documentos_tributarios")
    .select("*")
    .eq("venta_id", ventaId)
    .eq("negocio_id", negocioId)
    .maybeSingle();

  if (!doc) {
    return { ok: false, estado: "no_encontrado", glosa: "No existe registro tributario para esta venta." };
  }

  if (doc.estado === "aceptado" || doc.estado === "enviado") {
    return { ok: true, estado: doc.estado, glosa: `El documento Folio #${doc.folio} ya se encuentra confirmado.` };
  }

  // Cargar configuración para consultar
  const { data: cfgTrib } = await supabase
    .from("configuracion_tributaria")
    .select("*")
    .eq("negocio_id", negocioId)
    .maybeSingle();

  if (!cfgTrib || !cfgTrib.simpleapi_key) {
    return { ok: false, estado: "sin_configuracion", glosa: "Falta configuración de SimpleAPI." };
  }

  // Descargar certificado
  const { data: certBlob } = await supabase.storage
    .from("certificados-tributarios")
    .download(cfgTrib.certificado_storage_path);

  if (!certBlob) {
    return { ok: false, estado: "error_certificado", glosa: "No se pudo leer el certificado digital." };
  }

  const pfxBuffer = Buffer.from(await certBlob.arrayBuffer());

  const config: SimpleAPIConfig = {
    apiKey: descifrarDato(cfgTrib.simpleapi_key),
    rutEmisor: cfgTrib.rut_emisor,
    razonSocial: cfgTrib.razon_social,
    giro: cfgTrib.giro,
    acteco: Number(cfgTrib.acteco),
    direccion: cfgTrib.direccion,
    comuna: cfgTrib.comuna,
    ciudad: cfgTrib.ciudad,
    ambiente: cfgTrib.ambiente as any,
  };

  const cert: CertificadoDigital = {
    rutTitular: cfgTrib.certificado_rut_titular || cfgTrib.rut_emisor,
    password: descifrarDato(cfgTrib.certificado_password_enc) || "",
    pfxBuffer,
  };

  // Consultar estado ante el SII
  const resEstado = await consultarEstadoDteSimpleAPI(config, cert, {
    tipoDte: doc.tipo_dte,
    folio: Number(doc.folio),
    fechaEmision: new Date(doc.fecha_emision).toISOString().split("T")[0],
    total: Number(doc.monto_total),
    rutReceptor: doc.rut_receptor,
  });

  if (resEstado.ok) {
    const estadoFinal = resEstado.estado?.toLowerCase().includes("acept") ? "aceptado" : "procesando";
    await supabase
      .from("documentos_tributarios")
      .update({ estado: estadoFinal, ultimo_error: null })
      .eq("id", doc.id);

    await supabase
      .from("ventas")
      .update({ dte_estado: "emitido", dte_error: null })
      .eq("id", ventaId);

    return {
      ok: true,
      estado: estadoFinal,
      glosa: `Conciliación exitosa ante el SII: ${resEstado.glosa || resEstado.estado}`,
    };
  }

  return {
    ok: false,
    estado: doc.estado,
    glosa: `No fue posible confirmar con el SII: ${resEstado.error}`,
  };
}
