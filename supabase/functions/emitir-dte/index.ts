// Supabase Edge Function: emitir-dte
// Emisión segura de DTE (Boletas 39 y 41) mediante SimpleAPI para Operix ERP

import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: "Falta encabezado de autorización" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Validar usuario autenticado
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ ok: false, error: "Usuario no autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Obtener profile y tenant
    const { data: profile } = await supabase
      .from("profiles")
      .select("negocio_id, rol")
      .eq("id", user.id)
      .single();

    if (!profile?.negocio_id) {
      return new Response(JSON.stringify({ ok: false, error: "Usuario sin negocio asignado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const negocioId = profile.negocio_id;
    const body = await req.json();
    const { ventaId, tipoDte = 39, receptor, medioPago = "efectivo" } = body;

    if (!ventaId) {
      return new Response(JSON.stringify({ ok: false, error: "Debe especificar ventaId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Validar venta y aislamiento multiempresa
    const [ventaRes, detallesRes] = await Promise.all([
      supabase.from("ventas").select("*").eq("id", ventaId).eq("negocio_id", negocioId).single(),
      supabase.from("detalle_ventas").select("*").eq("venta_id", ventaId).eq("negocio_id", negocioId),
    ]);

    if (ventaRes.error || !ventaRes.data) {
      return new Response(JSON.stringify({ ok: false, error: "Venta no encontrada en este comercio" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const venta = ventaRes.data;

    // 4. Control de Idempotencia: Verificar si ya existe documento emitido
    const { data: docExistente } = await supabase
      .from("documentos_tributarios")
      .select("*")
      .eq("venta_id", ventaId)
      .eq("tipo_dte", tipoDte)
      .maybeSingle();

    if (docExistente) {
      if (docExistente.estado === "aceptado" || docExistente.estado === "enviado") {
        return new Response(JSON.stringify({
          ok: true,
          yaEmitido: true,
          folio: Number(docExistente.folio),
          tipoDte: docExistente.tipo_dte,
          trackId: docExistente.track_id,
          estado: docExistente.estado,
          pdfUrl: docExistente.pdf_url,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (docExistente.estado === "pendiente_conciliacion") {
        return new Response(JSON.stringify({
          ok: false,
          estado: "pendiente_conciliacion",
          error: "Esta venta se encuentra PENDIENTE DE CONCILIACIÓN con el SII. Reintento bloqueado para evitar duplicar folios. Verifique en Ventas.",
        }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 5. Cargar configuración tributaria del negocio
    const { data: cfgTrib, error: cfgError } = await supabase
      .from("configuracion_tributaria")
      .select("*")
      .eq("negocio_id", negocioId)
      .eq("activo", true)
      .maybeSingle();

    if (cfgError || !cfgTrib || !cfgTrib.simpleapi_key) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Facturación electrónica no configurada o inactiva en este negocio. Configure SimpleAPI en Configuración > Tributación.",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Asignación atómica de Folio mediante RPC con SELECT FOR UPDATE
    const { data: folioRpc, error: folioError } = await supabase.rpc("obtener_siguiente_folio_dte", {
      _negocio_id: negocioId,
      _tipo_dte: tipoDte,
    });

    if (folioError || !folioRpc?.ok) {
      return new Response(JSON.stringify({
        ok: false,
        error: folioRpc?.error || "Error al asignar folio tributario. Verifique disponibilidad de folios CAF.",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const folioAsignado = Number(folioRpc.folio);
    const cafXml = folioRpc.caf_xml;

    // 7. Descargar certificado digital PFX desde Storage privado
    if (!cfgTrib.certificado_storage_path) {
      return new Response(JSON.stringify({ ok: false, error: "Certificado digital PFX no encontrado en el almacenamiento del negocio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: certBlob, error: certError } = await supabase.storage
      .from("certificados-tributarios")
      .download(cfgTrib.certificado_storage_path);

    if (certError || !certBlob) {
      return new Response(JSON.stringify({ ok: false, error: "No se pudo leer el certificado digital del comercio" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pfxBuffer = await certBlob.arrayBuffer();

    // 8. Crear registro en documentos_tributarios (estado: 'borrador')
    const totalVenta = Number(venta.total || 0);
    const netoCalculado = tipoDte === 39 ? Math.round(totalVenta / 1.19) : 0;
    const ivaCalculado = tipoDte === 39 ? totalVenta - netoCalculado : 0;
    const exentoCalculado = tipoDte === 41 ? totalVenta : 0;

    const { data: nuevoDoc, error: insertDocError } = await supabase
      .from("documentos_tributarios")
      .insert({
        negocio_id: negocioId,
        venta_id: ventaId,
        tipo_dte: tipoDte,
        folio: folioAsignado,
        rut_emisor: cfgTrib.rut_emisor,
        rut_receptor: receptor?.rut || "66666666-6",
        razon_social_receptor: receptor?.razonSocial || "Cliente Boleta",
        monto_neto: netoCalculado,
        iva: ivaCalculado,
        monto_exento: exentoCalculado,
        monto_total: totalVenta,
        estado: "borrador",
        proveedor: "simpleapi",
      })
      .select()
      .single();

    if (insertDocError) {
      return new Response(JSON.stringify({ ok: false, error: "Error al registrar documento tributario inicial" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Retorna la orden lista para orquestación con SimpleAPI
    return new Response(JSON.stringify({
      ok: true,
      documentoId: nuevoDoc.id,
      folio: folioAsignado,
      tipoDte,
      total: totalVenta,
      ambiente: cfgTrib.ambiente,
      rutEmisor: cfgTrib.rut_emisor,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message || "Error interno en Edge Function emitir-dte" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
