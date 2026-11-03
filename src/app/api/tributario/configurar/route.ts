import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { limpiarRut } from "@/lib/libredte";
import { cifrarDato } from "@/lib/tributario-crypto";

function parseCAFXml(xmlText: string): {
  tipoDte: number;
  folioDesde: number;
  folioHasta: number;
  fechaAutorizacion: string;
} | null {
  try {
    const tdMatch = xmlText.match(/<TD>(\d+)<\/TD>/i);
    const dMatch = xmlText.match(/<D>(\d+)<\/D>/i);
    const hMatch = xmlText.match(/<H>(\d+)<\/H>/i);
    const faMatch = xmlText.match(/<FA>([^<]+)<\/FA>/i);

    if (!tdMatch || !dMatch || !hMatch) {
      return null;
    }

    return {
      tipoDte: parseInt(tdMatch[1], 10),
      folioDesde: parseInt(dMatch[1], 10),
      folioHasta: parseInt(hMatch[1], 10),
      fechaAutorizacion: faMatch ? faMatch[1].trim() : new Date().toISOString().split("T")[0],
    };
  } catch {
    return null;
  }
}

function getServiceSupabase(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rgyqtxoagsmkleebrmza.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createAdminClient(url, key);
}

// GET: Obtiene la configuración tributaria protegida y folios CAF del comercio
export async function GET() {
  try {
    const userSupabase = await createServerClient();
    const { data: { user }, error: authErr } = await userSupabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const { data: profile } = await userSupabase
      .from("profiles")
      .select("negocio_id")
      .eq("id", user.id)
      .single();

    if (!profile?.negocio_id) {
      return NextResponse.json({ ok: false, error: "Usuario sin negocio asignado" }, { status: 403 });
    }

    const { data: userRole } = await userSupabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("negocio_id", profile.negocio_id)
      .eq("role", "admin")
      .maybeSingle();

    if (!userRole) {
      return NextResponse.json({ ok: false, error: "Permiso denegado: Requiere rol de Administrador" }, { status: 403 });
    }

    const serviceDb = getServiceSupabase();

    // 1. Obtener datos tributarios sanitizados (sin filtrar simpleapi_key ni contraseñas)
    const { data: configData } = await serviceDb
      .from("configuracion_tributaria")
      .select(`
        id, negocio_id, rut_emisor, razon_social, giro, acteco,
        direccion, comuna, ciudad, cdg_sii_sucur, ambiente,
        emision_automatica, certificado_rut_titular, certificado_vence, activo,
        simpleapi_key, certificado_storage_path, created_at, updated_at
      `)
      .eq("negocio_id", profile.negocio_id)
      .maybeSingle();

    // 2. Obtener resumen de folios autorizados
    const { data: foliosData } = await serviceDb
      .from("folios_caf")
      .select("id, tipo_dte, folio_desde, folio_hasta, ultimo_folio_usado, fecha_autorizacion, activo, created_at")
      .eq("negocio_id", profile.negocio_id)
      .order("tipo_dte", { ascending: true })
      .order("folio_desde", { ascending: true });

    const folios = (foliosData || []).map((f: any) => ({
      ...f,
      folios_restantes: Math.max(0, Number(f.folio_hasta) - Number(f.ultimo_folio_usado)),
    }));

    const sanitizedConfig = configData
      ? {
          id: configData.id,
          negocio_id: configData.negocio_id,
          rut_emisor: configData.rut_emisor,
          razon_social: configData.razon_social,
          giro: configData.giro,
          acteco: configData.acteco,
          direccion: configData.direccion,
          comuna: configData.comuna,
          ciudad: configData.ciudad,
          cdg_sii_sucur: configData.cdg_sii_sucur,
          ambiente: configData.ambiente,
          emision_automatica: configData.emision_automatica,
          certificado_rut_titular: configData.certificado_rut_titular,
          certificado_vence: configData.certificado_vence,
          activo: configData.activo,
          tiene_apikey: Boolean(configData.simpleapi_key && configData.simpleapi_key.trim().length > 0),
          tiene_certificado: Boolean(configData.certificado_storage_path && configData.certificado_storage_path.trim().length > 0),
        }
      : null;

    return NextResponse.json({
      ok: true,
      configurado: Boolean(sanitizedConfig),
      config: sanitizedConfig,
      folios,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Error al consultar configuración" }, { status: 500 });
  }
}

// POST: Guarda la configuración tributaria, certificado PFX y/o archivo CAF
export async function POST(req: Request) {
  try {
    const userSupabase = await createServerClient();
    const { data: { user }, error: authErr } = await userSupabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const { data: profile } = await userSupabase
      .from("profiles")
      .select("negocio_id")
      .eq("id", user.id)
      .single();

    if (!profile?.negocio_id) {
      return NextResponse.json({ ok: false, error: "Usuario sin negocio asignado" }, { status: 403 });
    }

    const { data: userRole } = await userSupabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("negocio_id", profile.negocio_id)
      .eq("role", "admin")
      .maybeSingle();

    if (!userRole) {
      return NextResponse.json({ ok: false, error: "Permiso denegado: Requiere rol de Administrador" }, { status: 403 });
    }

    const negocioId = profile.negocio_id;
    const serviceDb = getServiceSupabase();

    // Procesar FormData (soporta archivos y texto)
    const formData = await req.formData();

    const rutEmisor = limpiarRut(String(formData.get("rutEmisor") || "").trim());
    const razonSocial = String(formData.get("razonSocial") || "").trim();
    const giro = String(formData.get("giro") || "").trim();
    const acteco = Number(formData.get("acteco")) || 471100;
    const direccion = String(formData.get("direccion") || "").trim();
    const comuna = String(formData.get("comuna") || "").trim();
    const ciudad = String(formData.get("ciudad") || "").trim();
    const cdgSIISucur = Number(formData.get("cdgSIISucur")) || 0;
    const ambiente = String(formData.get("ambiente") || "certificacion") === "produccion" ? "produccion" : "certificacion";
    const emisionAutomatica = formData.get("emisionAutomatica") !== "false";
    // REQUISITO ESTRICTO: No activar SimpleAPI automáticamente al guardar la configuración
    const activo = formData.get("activo") === "true";

    const simpleapiKey = String(formData.get("simpleapiKey") || "").trim();
    const pfxPassword = String(formData.get("pfxPassword") || "").trim();
    const pfxFile = formData.get("pfxFile") as File | null;
    const cafFile = formData.get("cafFile") as File | null;

    if (!rutEmisor) {
      return NextResponse.json({ ok: false, error: "Debe ingresar el RUT emisor de la empresa" }, { status: 400 });
    }
    if (!razonSocial) {
      return NextResponse.json({ ok: false, error: "Debe ingresar la razón social de la empresa" }, { status: 400 });
    }

    // 1. Manejo del Certificado Digital PFX si viene adjunto
    let storagePath: string | null = null;
    if (pfxFile && pfxFile.size > 0) {
      const buffer = Buffer.from(await pfxFile.arrayBuffer());
      storagePath = `${negocioId}/cert_${Date.now()}.pfx`;

      const { error: uploadError } = await serviceDb.storage
        .from("certificados-tributarios")
        .upload(storagePath, buffer, {
          contentType: "application/x-pkcs12",
          upsert: true,
        });

      if (uploadError) {
        return NextResponse.json({ ok: false, error: `Error al almacenar certificado PFX: ${uploadError.message}` }, { status: 500 });
      }
    }

    // 2. Manejo del Archivo CAF si viene adjunto
    let cafInfoMsg = "";
    if (cafFile && cafFile.size > 0) {
      const cafXml = await cafFile.text();
      const parsedCAF = parseCAFXml(cafXml);

      if (!parsedCAF) {
        return NextResponse.json({
          ok: false,
          error: "El archivo CAF no es un XML válido del SII o no contiene los rangos requeridos (<TD>, <D>, <H>).",
        }, { status: 400 });
      }

      const { tipoDte, folioDesde, folioHasta, fechaAutorizacion } = parsedCAF;

      // Upsert en folios_caf
      const { error: cafErr } = await serviceDb
        .from("folios_caf")
        .upsert(
          {
            negocio_id: negocioId,
            tipo_dte: tipoDte,
            folio_desde: folioDesde,
            folio_hasta: folioHasta,
            ultimo_folio_usado: folioDesde - 1, // Folio inicial disponible es folioDesde
            fecha_autorizacion: fechaAutorizacion,
            caf_xml: cafXml,
            activo: true,
          },
          { onConflict: "negocio_id,tipo_dte,folio_desde,folio_hasta" }
        );

      if (cafErr) {
        return NextResponse.json({ ok: false, error: `Error al guardar CAF en base de datos: ${cafErr.message}` }, { status: 500 });
      }

      cafInfoMsg = ` CAF (DTE ${tipoDte}, folios ${folioDesde} al ${folioHasta}) cargado exitosamente.`;
    }

    // 3. Upsert en configuracion_tributaria
    // Consultar estado previo para no pisar apiKey o certificado si no se enviaron nuevos
    const { data: prevCfg } = await serviceDb
      .from("configuracion_tributaria")
      .select("simpleapi_key, certificado_storage_path, certificado_password_enc")
      .eq("negocio_id", negocioId)
      .maybeSingle();

    const upsertData: Record<string, any> = {
      negocio_id: negocioId,
      rut_emisor: rutEmisor,
      razon_social: razonSocial,
      giro: giro || "Venta de productos y servicios",
      acteco,
      direccion: direccion || "Santiago",
      comuna: comuna || "Santiago",
      ciudad: ciudad || "Santiago",
      cdg_sii_sucur: cdgSIISucur,
      ambiente,
      emision_automatica: emisionAutomatica,
      activo, // Respeta estrictamente si el usuario activó o dejó inactivo SimpleAPI
    };

    // Actualizar simpleapi_key de forma cifrada solo si se envió una nueva
    if (simpleapiKey && simpleapiKey.length > 0) {
      upsertData.simpleapi_key = cifrarDato(simpleapiKey);
    } else if (prevCfg?.simpleapi_key) {
      upsertData.simpleapi_key = prevCfg.simpleapi_key;
    }

    // Actualizar certificado storage path solo si se subió uno nuevo
    if (storagePath) {
      upsertData.certificado_storage_path = storagePath;
    } else if (prevCfg?.certificado_storage_path) {
      upsertData.certificado_storage_path = prevCfg.certificado_storage_path;
    }

    // Actualizar contraseña de certificado de forma cifrada solo si se ingresó
    if (pfxPassword && pfxPassword.length > 0) {
      upsertData.certificado_password_enc = cifrarDato(pfxPassword);
    } else if (prevCfg?.certificado_password_enc) {
      upsertData.certificado_password_enc = prevCfg.certificado_password_enc;
    }

    const { error: cfgErr } = await serviceDb
      .from("configuracion_tributaria")
      .upsert(upsertData, { onConflict: "negocio_id" });

    if (cfgErr) {
      return NextResponse.json({ ok: false, error: `Error al guardar configuración tributaria: ${cfgErr.message}` }, { status: 500 });
    }

    // 4. Sincronizar configuracion general del negocio preservando credenciales anteriores de LibreDTE/APIGateway
    const { data: confActual } = await serviceDb
      .from("configuracion")
      .select("libredte_config")
      .eq("negocio_id", negocioId)
      .maybeSingle();

    const rawPrev = (confActual?.libredte_config as Record<string, any>) || {};

    const syncLibreDtePayload = {
      ...rawPrev,
      proveedor: "simpleapi",
      activo, // NO activar automáticamente si no fue seleccionado expresamente
      ambiente,
      rutEmisor,
      razonSocial,
      giro,
      acteco,
      direccion,
      comuna,
      ciudad,
      cdgSIISucur,
      emisionAutomatica,
      updated_at: new Date().toISOString(),
    };

    await serviceDb
      .from("configuracion")
      .upsert(
        {
          negocio_id: negocioId,
          libredte_config: syncLibreDtePayload,
          rut: rutEmisor,
          business_name: razonSocial,
          direccion: direccion || undefined,
        },
        { onConflict: "negocio_id" }
      );

    return NextResponse.json({
      ok: true,
      mensaje: `Configuración tributaria guardada exitosamente.${cafInfoMsg}`,
      activo,
      ambiente,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Error al procesar la configuración" }, { status: 500 });
  }
}
