// Supabase Edge Function: configurar-empresa-tributaria
// Configuración fiscal y subida segura de certificado digital PFX

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
      .select("negocio_id, rol")
      .eq("id", user.id)
      .single();

    if (!profile?.negocio_id || profile.rol !== "admin") {
      return new Response(JSON.stringify({ ok: false, error: "Permiso denegado: Se requiere rol de Administrador" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      rutEmisor,
      razonSocial,
      giro,
      acteco = 471100,
      direccion,
      comuna,
      ciudad,
      simpleapiKey,
      ambiente = "certificacion",
      emisionAutomatica = true,
      certificadoRutTitular,
      pfxBase64,
      pfxPassword,
    } = body;

    const negocioId = profile.negocio_id;
    let storagePath: string | null = null;

    // Si se adjunta un archivo PFX en base64, guardarlo en el bucket privado
    if (pfxBase64) {
      const pfxBytes = Uint8Array.from(atob(pfxBase64), (c) => c.charCodeAt(0));
      storagePath = `${negocioId}/cert_${Date.now()}.pfx`;

      const { error: uploadError } = await supabase.storage
        .from("certificados-tributarios")
        .upload(storagePath, pfxBytes, {
          contentType: "application/x-pkcs12",
          upsert: true,
        });

      if (uploadError) {
        return new Response(JSON.stringify({ ok: false, error: `Error al almacenar certificado: ${uploadError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Upsert en public.configuracion_tributaria
    const upsertData: Record<string, any> = {
      negocio_id: negocioId,
      rut_emisor: rutEmisor,
      razon_social: razonSocial,
      giro: giro,
      acteco: Number(acteco),
      direccion: direccion,
      comuna: comuna,
      ciudad: ciudad,
      simpleapi_key: simpleapiKey,
      ambiente: ambiente === "produccion" ? "produccion" : "certificacion",
      emision_automatica: Boolean(emisionAutomatica),
      activo: true,
    };

    if (certificadoRutTitular) upsertData.certificado_rut_titular = certificadoRutTitular;
    if (storagePath) upsertData.certificado_storage_path = storagePath;
    if (pfxPassword) upsertData.certificado_password_enc = pfxPassword;

    const { data: configSaved, error: saveErr } = await supabase
      .from("configuracion_tributaria")
      .upsert(upsertData, { onConflict: "negocio_id" })
      .select()
      .single();

    if (saveErr) {
      return new Response(JSON.stringify({ ok: false, error: `Error al guardar configuración: ${saveErr.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      mensaje: "Configuración tributaria guardada exitosamente.",
      config: {
        rutEmisor: configSaved.rut_emisor,
        razonSocial: configSaved.razon_social,
        ambiente: configSaved.ambiente,
        tieneCertificado: Boolean(configSaved.certificado_storage_path),
      },
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
