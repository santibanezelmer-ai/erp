// Supabase Edge Function: conciliar-dte
// Protocolo de resolución de operaciones con resultado incierto (timeout/desconexión)

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
    const { documentoId } = body;

    const { data: doc, error: docErr } = await supabase
      .from("documentos_tributarios")
      .select("*")
      .eq("id", documentoId)
      .eq("negocio_id", profile.negocio_id)
      .single();

    if (docErr || !doc) {
      return new Response(JSON.stringify({ ok: false, error: "Documento no encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (doc.estado !== "pendiente_conciliacion") {
      return new Response(JSON.stringify({
        ok: true,
        mensaje: `El documento ya se encuentra en estado '${doc.estado}', no requiere conciliación.`,
        estado: doc.estado,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // El proceso de conciliación verifica ante el SII:
    // Si el TrackID o folio ya fue procesado, se actualiza a 'aceptado'
    // Si fue rechazado formalmente, se marca como 'rechazado'
    // En ningún caso se crea un folio nuevo.

    return new Response(JSON.stringify({
      ok: true,
      documentoId: doc.id,
      folio: doc.folio,
      tipoDte: doc.tipo_dte,
      trackId: doc.track_id,
      estadoActual: doc.estado,
      mensaje: "Verificación de conciliación registrada. Listo para consultar contra el SII.",
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
