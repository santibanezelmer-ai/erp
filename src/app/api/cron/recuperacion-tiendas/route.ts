import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import {
  getServiceSupabase,
  loadRecuperacionConfig,
  computeAllStoresActivityAndCampaigns,
  dispatchRecoveryEmailForStore,
} from "@/lib/recuperacion.server";

async function isAuthorizedCronOrSuperAdmin(req: NextRequest) {
  // 1. Verificar cabecera de Vercel Cron (`Authorization: Bearer <CRON_SECRET>`)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { authorized: true, isCron: true, client: getServiceSupabase() };
  }

  // 2. Verificar sesión de Super Admin desde el panel
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { authorized: false, isCron: false, client: null };

  const [{ data: superRole }, { data: isSaRpc }] = await Promise.all([
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle(),
    supabase.rpc("is_super_admin", { _uid: user.id }),
  ]);

  const isSuperAdmin =
    Boolean(superRole) ||
    Boolean(isSaRpc) ||
    user.email?.toLowerCase() === "santibanez.elmer@gmail.com";

  return {
    authorized: isSuperAdmin,
    isCron: false,
    client: getServiceSupabase() || supabase,
  };
}

/**
 * Proceso programado e idempotente que detecta tiendas con >= N días consecutivos sin actividad real
 * y envía automáticamente el Correo 1 (a los 12 días) o el Correo 2 de seguimiento (+5 días).
 */
export async function GET(req: NextRequest) {
  return runAutomatedRecoveryJob(req);
}

export async function POST(req: NextRequest) {
  return runAutomatedRecoveryJob(req);
}

async function runAutomatedRecoveryJob(req: NextRequest) {
  const startedAtMs = Date.now();
  try {
    const auth = await isAuthorizedCronOrSuperAdmin(req);
    if (!auth.authorized || !auth.client) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const supabase = auth.client;
    const config = await loadRecuperacionConfig(supabase);

    // Si es invocación automática por cron y la automatización está desactivada, salir limpiamente
    const forceRun = req.nextUrl.searchParams.get("force") === "1";
    if (!config.automatizacion_activa && !forceRun) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "La automatización de recuperación se encuentra desactivada en la configuración.",
      });
    }

    const stores = await computeAllStoresActivityAndCampaigns(supabase, config);

    let sentStep1 = 0;
    let sentStep2 = 0;
    let skippedCount = 0;
    const errors: { negocio: string; error: string }[] = [];

    const nowMs = Date.now();

    for (const store of stores) {
      if (!store.owner_email) continue;

      const camp = store.campaign;

      // CASO 1: Cumple umbral de inactividad (ej. >= 12 días) y NUNCA ha recibido el primer correo
      if (store.inactive_days >= config.dias_inactividad && !camp?.correo_1_enviado_at) {
        const res = await dispatchRecoveryEmailForStore({
          supabase,
          store,
          config,
          step: 1,
        });
        if (res.ok) {
          sentStep1++;
        } else if (res.skipped) {
          skippedCount++;
        } else if (res.reason) {
          errors.push({ negocio: store.nombre, error: res.reason });
        }
        continue;
      }

      // CASO 2: Segundo seguimiento (+5 días después del primer correo, si sigue inactiva y no se ha recuperado)
      if (
        config.segundo_seguimiento_activo &&
        camp?.correo_1_enviado_at &&
        !camp.correo_2_enviado_at &&
        !camp.tienda_recuperada &&
        camp.estado_promocion !== "aceptada" &&
        !camp.baja_comunicaciones
      ) {
        const firstSentMs = new Date(camp.correo_1_enviado_at).getTime();
        const daysSinceFirstEmail = Math.floor((nowMs - firstSentMs) / 86400000);
        const lastActMs = new Date(store.last_real_activity_at).getTime();

        // Solo enviar si sigue sin actividad después del primer correo y han pasado >= dias_segundo_seguimiento
        if (
          daysSinceFirstEmail >= config.dias_segundo_seguimiento &&
          lastActMs <= firstSentMs
        ) {
          const res = await dispatchRecoveryEmailForStore({
            supabase,
            store,
            config,
            step: 2,
          });
          if (res.ok) {
            sentStep2++;
          } else if (res.skipped) {
            skippedCount++;
          } else if (res.reason) {
            errors.push({ negocio: store.nombre, error: res.reason });
          }
        }
      }
    }

    const durationMs = Date.now() - startedAtMs;
    const inactiveStoresCount = stores.filter((s) => s.is_inactive_threshold_met).length;

    // Registrar ejecución del proceso en audit_logs si existe al menos un negocio
    if (stores.length > 0) {
      try {
        await supabase.from("audit_logs").insert({
          negocio_id: stores[0].negocio_id,
          action: "system_cron_recovery_run",
          entity_type: "recuperacion_config",
          entity_id: "1",
          after_data: {
            processedStores: stores.length,
            inactiveStoresCount,
            sentStep1,
            sentStep2,
            skippedCount,
            errorsCount: errors.length,
            errors: errors.slice(0, 5),
            durationMs,
            trigger: auth.isCron ? "vercel_cron" : "manual_super_admin",
          },
        });
      } catch {}
    }

    return NextResponse.json({
      ok: true,
      processedStores: stores.length,
      inactiveStoresCount,
      sentStep1,
      sentStep2,
      skippedCount,
      errors,
      durationMs,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Recuperacion Cron Error]:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al ejecutar proceso de recuperación" },
      { status: 500 }
    );
  }
}
