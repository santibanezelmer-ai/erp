// Supabase Edge Function: consultar-estado-dte
// Consulta oficial del estado de un DTE ante el SII mediante SimpleAPI

import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ ok: false, error: "Sesión inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("negocio_id")
      .eq("id", user.id)
      .single();

    if (!profile?.negocio_id) {
      return new Response(JSON.stringify({ ok: false, error: "Negocio no encontrado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { documentoId, ventaId } = body;

    let query = supabase.from("documentos_tributarios").select("*").eq("negocio_id", profile.negocio_id);
    if (documentoId) query = query.eq("id", documentoId);
    else if (ventaId) query = query.eq("venta_id", ventaId);
    else {
      return new Response(JSON.stringify({ ok: false, error: "Debe indicar documentoId o ventaId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: doc, error: docErr } = await query.maybeSingle();
    if (docErr || !doc) {
      return new Response(JSON.stringify({ ok: false, error: "Documento tributario no encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      documento: doc,
      estado: doc.estado,
      trackId: doc.track_id,
      folio: doc.folio,
      tipoDte: doc.tipo_dte,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message || "Error interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
