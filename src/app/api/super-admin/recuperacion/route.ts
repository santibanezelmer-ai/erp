import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";
import {
  getServiceSupabase,
  loadRecuperacionConfig,
  computeAllStoresActivityAndCampaigns,
  dispatchRecoveryEmailForStore,
  buildRecuperacionEmailHtml,
  DEFAULT_RECUPERACION_CONFIG,
  normalizePlanBeneficio,
  RecuperacionConfig,
} from "@/lib/recuperacion.server";

async function verifySuperAdmin() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, user: null, client: null };

  const [{ data: superRole }, { data: isSaRpc }] = await Promise.all([
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle(),
    supabase.rpc("is_super_admin", { _uid: user.id }),
  ]);

  const isSuper =
    Boolean(superRole) ||
    Boolean(isSaRpc) ||
    user.email?.toLowerCase() === "santibanez.elmer@gmail.com";

  if (!isSuper) return { ok: false as const, user, client: null };

  return {
    ok: true as const,
    user,
    client: getServiceSupabase() || supabase,
  };
}

/**
 * GET: Devuelve la configuración global de recuperación, métricas consolidadas,
 * previsualización HTML de ambos correos y la lista completa de tiendas con su estado de inactividad y seguimiento.
 */
export async function GET() {
  try {
    const auth = await verifySuperAdmin();
    if (!auth.ok || !auth.client) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const config = await loadRecuperacionConfig(auth.client);
    const [stores, emailLogsRes] = await Promise.all([
      computeAllStoresActivityAndCampaigns(auth.client, config),
      auth.client
        .from("email_send_log")
        .select("*")
        .in("template_name", ["recuperacion_inactividad_12d", "recuperacion_seguimiento_5d"])
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

    const emailLogs = emailLogsRes.data || [];

    // Calcular métricas solicitadas para el Centro de Recuperación de Clientes
    const tiendasInactivas = stores.filter((s) => s.is_inactive_threshold_met).length;
    const campañasEnviadas = stores.filter((s) => Boolean(s.campaign?.correo_1_enviado_at));
    const tiendasRecibieronCorreos = campañasEnviadas.length;

    const totalCorreosEnviados =
      campañasEnviadas.length +
      campañasEnviadas.filter((s) => Boolean(s.campaign?.correo_2_enviado_at)).length;

    const correosEntregados = campañasEnviadas.filter(
      (s) =>
        Boolean(s.campaign?.correo_1_entregado_at) ||
        Boolean(s.campaign?.correo_2_entregado_at) ||
        s.campaign?.correo_1_estado === "entregado" ||
        s.campaign?.correo_1_estado === "abierto" ||
        s.campaign?.correo_1_estado === "clic" ||
        s.campaign?.correo_1_estado === "enviado"
    ).length;

    const correosRechazados = campañasEnviadas.filter(
      (s) =>
        s.campaign?.correo_1_estado === "rebotado" ||
        s.campaign?.correo_1_estado === "fallido" ||
        s.campaign?.correo_2_estado === "rebotado" ||
        s.campaign?.correo_2_estado === "fallido"
    ).length;

    const correosAbiertos = campañasEnviadas.filter(
      (s) =>
        Boolean(s.campaign?.primer_abierto_at) ||
        Boolean(s.campaign?.correo_1_abierto_at) ||
        Boolean(s.campaign?.correo_2_abierto_at) ||
        s.campaign?.correo_1_estado === "abierto" ||
        s.campaign?.correo_1_estado === "clic"
    ).length;

    const clicsBoton = campañasEnviadas.filter(
      (s) =>
        Boolean(s.campaign?.primer_clic_at) ||
        Boolean(s.campaign?.correo_1_clic_at) ||
        Boolean(s.campaign?.correo_2_clic_at) ||
        s.campaign?.correo_1_estado === "clic" ||
        s.campaign?.correo_2_estado === "clic"
    ).length;

    const promocionesAceptadas = stores.filter(
      (s) => s.campaign?.estado_promocion === "aceptada"
    ).length;

    const tiendasRecuperadas = campañasEnviadas.filter(
      (s) => Boolean(s.campaign?.tienda_recuperada) || s.campaign?.estado_promocion === "aceptada"
    ).length;

    const tasaRecuperacion =
      tiendasRecibieronCorreos > 0
        ? Math.round((tiendasRecuperadas / tiendasRecibieronCorreos) * 1000) / 10
        : 0;

    const mesesGratuitosOtorgados = promocionesAceptadas;

    const previewStep1 = buildRecuperacionEmailHtml({
      storeName: "Mi Comercio Ejemplo",
      storeSlug: "mi-comercio",
      ownerName: "Juan Pérez",
      subject: config.asunto_correo_1,
      bodyTemplate: config.cuerpo_correo_1,
      buttonText: config.texto_boton,
      activationUrl: "https://operixerp.cloud/planes?activar_mes_gratis=1",
      unsubscribeUrl: "https://operixerp.cloud/api/recuperacion/unsubscribe",
      promocionActiva: config.promocion_activa,
      diasBeneficio: config.dias_beneficio,
      planBeneficio: config.plan_beneficio,
      isSecondFollowUp: false,
    });

    const previewStep2 = buildRecuperacionEmailHtml({
      storeName: "Mi Comercio Ejemplo",
      storeSlug: "mi-comercio",
      ownerName: "Juan Pérez",
      subject: config.asunto_correo_2,
      bodyTemplate: config.cuerpo_correo_2,
      buttonText: config.texto_boton,
      activationUrl: "https://operixerp.cloud/planes?activar_mes_gratis=1",
      unsubscribeUrl: "https://operixerp.cloud/api/recuperacion/unsubscribe",
      promocionActiva: config.promocion_activa,
      diasBeneficio: config.dias_beneficio,
      planBeneficio: config.plan_beneficio,
      isSecondFollowUp: true,
    });

    return NextResponse.json({
      config,
      resendConfigured: Boolean(process.env.RESEND_API_KEY),
      metrics: {
        tiendasInactivas,
        tiendasRecibieronCorreos,
        totalCorreosEnviados,
        correosEntregados,
        correosRechazados,
        correosAbiertos,
        clicsBoton,
        promocionesAceptadas,
        tiendasRecuperadas,
        tasaRecuperacion,
        mesesGratuitosOtorgados,
      },
      previews: {
        step1: previewStep1,
        step2: previewStep2,
      },
      stores,
      emailLogs,
    });
  } catch (err: any) {
    console.error("[SuperAdmin Recuperacion GET]:", err);
    return NextResponse.json(
      { error: err?.message || "Error al cargar sistema de recuperación" },
      { status: 500 }
    );
  }
}

/**
 * PUT: Guarda la configuración del sistema de recuperación (días de inactividad, segundo seguimiento,
 * activación de automatización, duración del beneficio y plantillas de correo).
 */
export async function PUT(req: NextRequest) {
  try {
    const auth = await verifySuperAdmin();
    if (!auth.ok || !auth.client) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const nextConfig: RecuperacionConfig = {
      automatizacion_activa: Boolean(body.automatizacion_activa),
      dias_inactividad: Math.max(1, Math.min(365, Number(body.dias_inactividad) || 12)),
      segundo_seguimiento_activo: Boolean(body.segundo_seguimiento_activo),
      dias_segundo_seguimiento: Math.max(
        1,
        Math.min(90, Number(body.dias_segundo_seguimiento) || 5)
      ),
      promocion_activa: Boolean(body.promocion_activa),
      dias_beneficio: Math.max(1, Math.min(365, Number(body.dias_beneficio) || 30)),
      plan_beneficio: normalizePlanBeneficio(body.plan_beneficio),
      remitente_nombre: String(body.remitente_nombre || "Operix ERP").trim(),
      remitente_email: String(
        body.remitente_email || "notificaciones@operixerp.cloud"
      ).trim(),
      asunto_correo_1: String(
        body.asunto_correo_1 || DEFAULT_RECUPERACION_CONFIG.asunto_correo_1
      ).trim(),
      cuerpo_correo_1: String(
        body.cuerpo_correo_1 || DEFAULT_RECUPERACION_CONFIG.cuerpo_correo_1
      ).trim(),
      asunto_correo_2: String(
        body.asunto_correo_2 || DEFAULT_RECUPERACION_CONFIG.asunto_correo_2
      ).trim(),
      cuerpo_correo_2: String(
        body.cuerpo_correo_2 || DEFAULT_RECUPERACION_CONFIG.cuerpo_correo_2
      ).trim(),
      texto_boton: String(body.texto_boton || "ACTIVAR MI MES GRATIS").trim(),
    };

    const upsertRow: Database["public"]["Tables"]["recuperacion_config"]["Insert"] = {
      id: 1,
      ...nextConfig,
      updated_at: new Date().toISOString(),
      updated_by: auth.user.id,
    };

    const { error } = await auth.client
      .from("recuperacion_config")
      .upsert(upsertRow, { onConflict: "id" });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, config: nextConfig });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error al actualizar configuración" },
      { status: 500 }
    );
  }
}

/**
 * POST: Permite al Super Admin disparar un envío individual (Correo 1 o Correo 2) a una tienda
 * o ejecutar manualmente el barrido completo de detección de tiendas inactivas.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifySuperAdmin();
    if (!auth.ok || !auth.client) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const action = body?.action as "send_single" | "preview";
    const config = await loadRecuperacionConfig(auth.client);

    if (action === "preview") {
      const step = Number(body?.step) === 2 ? 2 : 1;
      const preview = buildRecuperacionEmailHtml({
        storeName: body?.storeName || "Tienda Demo Operix",
        storeSlug: body?.storeSlug || "tienda-demo",
        ownerName: body?.ownerName || "Propietario",
        subject:
          step === 1
            ? body?.asunto_correo_1 || config.asunto_correo_1
            : body?.asunto_correo_2 || config.asunto_correo_2,
        bodyTemplate:
          step === 1
            ? body?.cuerpo_correo_1 || config.cuerpo_correo_1
            : body?.cuerpo_correo_2 || config.cuerpo_correo_2,
        buttonText: body?.texto_boton || config.texto_boton,
        activationUrl: "https://operixerp.cloud/planes?activar_mes_gratis=1",
        unsubscribeUrl: "https://operixerp.cloud/api/recuperacion/unsubscribe",
        promocionActiva:
          typeof body?.promocion_activa === "boolean"
            ? body.promocion_activa
            : config.promocion_activa,
        diasBeneficio: Number(body?.dias_beneficio) || config.dias_beneficio,
        planBeneficio: body?.plan_beneficio || config.plan_beneficio,
        isSecondFollowUp: step === 2,
      });
      return NextResponse.json({ ok: true, preview });
    }

    if (action === "send_single") {
      const negocioId = body?.negocioId as string;
      const step = (Number(body?.step) === 2 ? 2 : 1) as 1 | 2;
      const forceManual = Boolean(body?.forceManual);

      const stores = await computeAllStoresActivityAndCampaigns(auth.client, config);
      const targetStore = stores.find((s) => s.negocio_id === negocioId);

      if (!targetStore) {
        return NextResponse.json({ error: "Comercio no encontrado" }, { status: 404 });
      }

      const result = await dispatchRecoveryEmailForStore({
        supabase: auth.client,
        store: targetStore,
        config,
        step,
        forceManual,
      });

      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: result.reason || "No se pudo enviar el correo" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        ok: true,
        resendId: result.resendId,
        campaign: result.campaign,
      });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error interno" },
      { status: 500 }
    );
  }
}
