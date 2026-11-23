import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database.types";
import {
  getServiceSupabase,
  loadRecuperacionConfig,
  computeAllStoresActivityAndCampaigns,
  buildRecuperacionEmailHtml,
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
 * GET /api/super-admin/overview
 * Consolida todos los datos reales de las 10 secciones del Super Admin en una sola consulta autenticada:
 * 1. Resumen ejecutivo (con series temporales reales separando GMV de comercios vs Ingresos de Operix por suscripciones)
 * 2. Tiendas y comercios (con última actividad, ubicación de referencia y contacto)
 * 3. Usuarios y roles
 * 4. Suscripciones, pagos reales de Mercado Pago (mp_pagos) y vencimientos próximos
 * 5. Recuperación de clientes (métricas e historial completo)
 * 6. Automatizaciones (procesos, estado, historial de ejecuciones reales y duración)
 * 7. Cupones y canjes (cupones_internos y cupon_canjes)
 * 8. Comunicaciones y Resend (email_send_log, suppressed_emails, entregabilidad, aperturas, clics, rebotes)
 * 9. Auditoría administrativa (audit_logs)
 * 10. Configuración global
 */
export async function GET() {
  try {
    const auth = await verifySuperAdmin();
    if (!auth.ok || !auth.client) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const db = auth.client;
    const recConfig = await loadRecuperacionConfig(db);

    const [
      kpisRes,
      negociosRes,
      suscRes,
      mpPagosRes,
      profilesRes,
      rolesRes,
      cuponesRes,
      canjesRes,
      emailLogsRes,
      suppressedRes,
      auditLogsRes,
      ventasRecentRes,
      cfgRes,
      storesActivity,
    ] = await Promise.all([
      db.rpc("sa_kpis_globales"),
      db
        .from("negocios")
        .select("id, nombre, slug, plan, tipo_negocio, perfil, rut, direccion, created_at")
        .order("created_at", { ascending: false }),
      db
        .from("suscripciones")
        .select("*")
        .order("updated_at", { ascending: false }),
      db
        .from("mp_pagos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      db
        .from("profiles")
        .select("id, nombre, email, negocio_id, sucursal_id, activo, created_at, updated_at")
        .order("created_at", { ascending: false }),
      db
        .from("user_roles")
        .select("id, user_id, negocio_id, role"),
      db
        .from("cupones_internos")
        .select("*")
        .order("created_at", { ascending: false }),
      db
        .from("cupon_canjes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      db
        .from("email_send_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300),
      db
        .from("suppressed_emails")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      db
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(250),
      db
        .from("ventas")
        .select("id, negocio_id, total, created_at, estado")
        .gte("created_at", new Date(Date.now() - 90 * 86400000).toISOString())
        .order("created_at", { ascending: false }),
      db
        .from("configuracion")
        .select("negocio_id, telefono, direccion, modulos_override"),
      computeAllStoresActivityAndCampaigns(db, recConfig),
    ]);

    const negocios = negociosRes.data || [];
    const suscripciones = suscRes.data || [];
    const mpPagos = mpPagosRes.data || [];
    const profiles = profilesRes.data || [];
    const userRoles = rolesRes.data || [];
    const cupones = cuponesRes.data || [];
    const cuponCanjes = canjesRes.data || [];
    const emailLogs = emailLogsRes.data || [];
    const suppressedEmails = suppressedRes.data || [];
    const auditLogs = auditLogsRes.data || [];
    const ventas90d = ventasRecentRes.data || [];
    const configuraciones = cfgRes.data || [];

    // Ingresos reales de Operix por suscripciones cobradas en Mercado Pago (estado === 'aprobada')
    const pagosAprobados = mpPagos.filter(
      (p) => p.estado === "aprobada" || p.estado === "approved"
    );
    const ingresosSuscripcionesTotal = pagosAprobados.reduce(
      (acc, p) => acc + Number(p.monto || 0),
      0
    );

    const nowMs = Date.now();
    const thirtyDaysAgoMs = nowMs - 30 * 86400000;
    const ingresosSuscripciones30d = pagosAprobados
      .filter((p) => new Date(p.created_at).getTime() >= thirtyDaysAgoMs)
      .reduce((acc, p) => acc + Number(p.monto || 0), 0);

    // Suscripciones próximas a vencer (en los próximos 7 días) o vencidas
    const sevenDaysAheadMs = nowMs + 7 * 86400000;
    const suscripcionesPorVencer = suscripciones.filter((s) => {
      if (!s.vence_at || s.estado !== "activa") return false;
      const vMs = new Date(s.vence_at).getTime();
      return vMs >= nowMs && vMs <= sevenDaysAheadMs;
    });

    // Estado de actividad de tiendas
    const tiendasInactivasCount = storesActivity.filter(
      (s) => s.is_inactive_threshold_met
    ).length;
    const tiendasActivasCount = Math.max(0, negocios.length - tiendasInactivasCount);
    const tiendasEnTrialCount = suscripciones.filter((s) => s.estado === "trial").length;

    // Serie temporal real (últimos 90 días agrupados por día YYYY-MM-DD)
    const dailySeriesMap: Record<
      string,
      {
        date: string;
        nuevasTiendas: number;
        nuevosUsuarios: number;
        ventasCount: number;
        gmvComercios: number;
        ingresosOperix: number;
      }
    > = {};

    for (let i = 89; i >= 0; i--) {
      const d = new Date(nowMs - i * 86400000).toISOString().slice(0, 10);
      dailySeriesMap[d] = {
        date: d,
        nuevasTiendas: 0,
        nuevosUsuarios: 0,
        ventasCount: 0,
        gmvComercios: 0,
        ingresosOperix: 0,
      };
    }

    for (const n of negocios) {
      const d = n.created_at?.slice(0, 10);
      if (d && dailySeriesMap[d]) {
        dailySeriesMap[d].nuevasTiendas += 1;
      }
    }

    for (const u of profiles) {
      const d = u.created_at?.slice(0, 10);
      if (d && dailySeriesMap[d]) {
        dailySeriesMap[d].nuevosUsuarios += 1;
      }
    }

    for (const v of ventas90d) {
      if (v.estado === "anulada" || v.estado === "cancelada") continue;
      const d = v.created_at?.slice(0, 10);
      if (d && dailySeriesMap[d]) {
        dailySeriesMap[d].ventasCount += 1;
        dailySeriesMap[d].gmvComercios += Number(v.total || 0);
      }
    }

    for (const p of pagosAprobados) {
      const d = p.created_at?.slice(0, 10);
      if (d && dailySeriesMap[d]) {
        dailySeriesMap[d].ingresosOperix += Number(p.monto || 0);
      }
    }

    const timeSeries = Object.values(dailySeriesMap);

    // Historial real de ejecuciones de automatizaciones extraído de audit_logs
    const automationRuns = auditLogs.filter(
      (a) =>
        a.action?.startsWith("system_cron_") ||
        a.action?.startsWith("system_recovery_") ||
        a.action === "promocion_recuperacion_activada"
    );

    // Métricas reales de comunicaciones Resend
    const totalEmailsLogged = emailLogs.length;
    const deliveredEmailsCount = emailLogs.filter((e) =>
      ["sent", "delivered", "opened", "clicked"].includes(e.status)
    ).length;
    const openedEmailsCount =
      emailLogs.filter((e) => ["opened", "clicked"].includes(e.status)).length ||
      storesActivity.filter((s) => Boolean(s.campaign?.primer_abierto_at)).length;
    const clickedEmailsCount =
      emailLogs.filter((e) => e.status === "clicked").length ||
      storesActivity.filter((s) => Boolean(s.campaign?.primer_clic_at)).length;
    const bouncedEmailsCount =
      emailLogs.filter((e) => ["bounced", "failed"].includes(e.status)).length +
      suppressedEmails.filter((s) => s.reason === "bounce").length;
    const complainedEmailsCount =
      emailLogs.filter((e) => e.status === "complained").length +
      suppressedEmails.filter((s) => s.reason === "complaint").length;
    const unsubscribedCount = suppressedEmails.filter((s) =>
      s.reason?.includes("unsubscribed")
    ).length;

    const previewStep1 = buildRecuperacionEmailHtml({
      storeName: "Comercio Ejemplo",
      storeSlug: "comercio-ejemplo",
      ownerName: "Administrador",
      subject: recConfig.asunto_correo_1,
      bodyTemplate: recConfig.cuerpo_correo_1,
      buttonText: recConfig.texto_boton,
      activationUrl: "https://operixerp.cloud/planes?activar_mes_gratis=1",
      unsubscribeUrl: "https://operixerp.cloud/api/recuperacion/unsubscribe",
      promocionActiva: recConfig.promocion_activa,
      diasBeneficio: recConfig.dias_beneficio,
      planBeneficio: recConfig.plan_beneficio,
      isSecondFollowUp: false,
    });

    const previewStep2 = buildRecuperacionEmailHtml({
      storeName: "Comercio Ejemplo",
      storeSlug: "comercio-ejemplo",
      ownerName: "Administrador",
      subject: recConfig.asunto_correo_2,
      bodyTemplate: recConfig.cuerpo_correo_2,
      buttonText: recConfig.texto_boton,
      activationUrl: "https://operixerp.cloud/planes?activar_mes_gratis=1",
      unsubscribeUrl: "https://operixerp.cloud/api/recuperacion/unsubscribe",
      promocionActiva: recConfig.promocion_activa,
      diasBeneficio: recConfig.dias_beneficio,
      planBeneficio: recConfig.plan_beneficio,
      isSecondFollowUp: true,
    });

    return NextResponse.json({
      kpis: kpisRes.data || null,
      executive: {
        totalTiendas: negocios.length,
        tiendasActivas: tiendasActivasCount,
        tiendasInactivas: tiendasInactivasCount,
        tiendasEnTrial: tiendasEnTrialCount,
        totalUsuarios: profiles.length,
        ingresosSuscripcionesTotal,
        ingresosSuscripciones30d,
        pagosAprobadosCount: pagosAprobados.length,
        suscripcionesPorVencerCount: suscripcionesPorVencer.length,
        suscripcionesPorVencer,
      },
      timeSeries,
      negocios,
      suscripciones,
      mpPagos,
      profiles,
      userRoles,
      cupones,
      cuponCanjes,
      configuraciones,
      storesActivity,
      recuperacionConfig: recConfig,
      emailPreviews: {
        step1: previewStep1,
        step2: previewStep2,
      },
      communications: {
        resendConfigured: Boolean(process.env.RESEND_API_KEY),
        senderDomain: "operixerp.cloud",
        senderEmail: recConfig.remitente_email || "notificaciones@operixerp.cloud",
        senderName: recConfig.remitente_nombre || "Operix ERP",
        webhookEndpoint: "https://operixerp.cloud/api/recuperacion/webhook-resend",
        stats: {
          totalSent: totalEmailsLogged,
          delivered: deliveredEmailsCount,
          opened: openedEmailsCount,
          clicked: clickedEmailsCount,
          bounced: bouncedEmailsCount,
          complained: complainedEmailsCount,
          unsubscribed: unsubscribedCount,
          deliverabilityRate:
            totalEmailsLogged > 0
              ? Math.round((deliveredEmailsCount / totalEmailsLogged) * 1000) / 10
              : 100,
        },
        emailLogs,
        suppressedEmails,
      },
      automations: {
        runs: automationRuns,
      },
      auditLogs,
    });
  } catch (err: any) {
    console.error("[SuperAdmin Overview GET Error]:", err);
    return NextResponse.json(
      { error: err?.message || "Error al cargar consola de Super Admin" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/super-admin/overview
 * Ejecuta acciones administrativas auditadas:
 * - toggle_user_status: activar / desactivar usuario en profiles
 * - change_user_role: cambiar rol de usuario en un comercio
 * - run_expired_subscriptions_job: ejecutar RPC suspender_suscripciones_vencidas()
 * - remove_suppressed_email: reactivar un correo previamente dado de baja / rebotado
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifySuperAdmin();
    if (!auth.ok || !auth.client) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const db = auth.client;
    const body = await req.json();
    const action = body?.action as string;

    if (action === "toggle_user_status") {
      const userId = body?.userId as string;
      const activo = Boolean(body?.activo);
      if (!userId) {
        return NextResponse.json({ error: "userId requerido" }, { status: 400 });
      }

      const { error } = await db
        .from("profiles")
        .update({ activo, updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ ok: true, userId, activo });
    }

    if (action === "change_user_role") {
      const userId = body?.userId as string;
      const negocioId = body?.negocioId as string;
      const newRole = body?.role as Database["public"]["Enums"]["app_role"];

      if (!userId || !negocioId || !newRole) {
        return NextResponse.json(
          { error: "userId, negocioId y role son requeridos" },
          { status: 400 }
        );
      }

      await db
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("negocio_id", negocioId);

      const { error } = await db.from("user_roles").insert({
        user_id: userId,
        negocio_id: negocioId,
        role: newRole,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      try {
        await db.from("audit_logs").insert({
          negocio_id: negocioId,
          usuario_id: auth.user.id,
          action: "super_admin_role_updated",
          entity_type: "user_roles",
          entity_id: userId,
          after_data: { role: newRole } as Json,
        });
      } catch {}

      return NextResponse.json({ ok: true });
    }

    if (action === "run_expired_subscriptions_job") {
      const startedAt = Date.now();
      const { data, error } = await db.rpc("suspender_suscripciones_vencidas");
      const durationMs = Date.now() - startedAt;

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({
        ok: true,
        suspendedCount: Number(data || 0),
        durationMs,
        executedAt: new Date().toISOString(),
      });
    }

    if (action === "remove_suppressed_email") {
      const email = String(body?.email || "").trim().toLowerCase();
      if (!email) {
        return NextResponse.json({ error: "Email requerido" }, { status: 400 });
      }

      const { error } = await db.from("suppressed_emails").delete().eq("email", email);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ ok: true, email });
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error al ejecutar acción" },
      { status: 500 }
    );
  }
}
