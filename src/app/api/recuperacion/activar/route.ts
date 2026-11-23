import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import {
  getServiceSupabase,
  loadRecuperacionConfig,
  mapCampaignRowToRecord,
  RecuperacionCampaignRecord,
  saveCampaignState,
} from "@/lib/recuperacion.server";

/**
 * GET: Consulta si la tienda del usuario actual tiene una promoción de recuperación elegible ("1 Mes Gratis").
 */
export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ eligible: false, error: "No autenticado" }, { status: 401 });
    }

    const { data: prof } = await supabase
      .from("profiles")
      .select("negocio_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!prof?.negocio_id) {
      return NextResponse.json({ eligible: false });
    }

    const admin = getServiceSupabase() || supabase;
    const config = await loadRecuperacionConfig(admin);

    // Buscar campaña en recuperacion_campanas o en configuracion.modulos_override.__recuperacion_campana
    let campaign: RecuperacionCampaignRecord | null = null;
    try {
      const { data: row } = await admin
        .from("recuperacion_campanas")
        .select("*")
        .eq("negocio_id", prof.negocio_id)
        .maybeSingle();
      if (row) {
        campaign = mapCampaignRowToRecord(row);
      }
    } catch {}

    if (!campaign) {
      const { data: cfg } = await admin
        .from("configuracion")
        .select("modulos_override")
        .eq("negocio_id", prof.negocio_id)
        .maybeSingle();

      const ov =
        cfg?.modulos_override && typeof cfg.modulos_override === "object"
          ? (cfg.modulos_override as Record<string, any>)
          : {};
      if (ov.__recuperacion_campana) {
        campaign = ov.__recuperacion_campana as RecuperacionCampaignRecord;
      }
    }

    if (!campaign) {
      return NextResponse.json({ eligible: false, hasCampaign: false });
    }

    const alreadyAccepted =
      campaign.estado_promocion === "aceptada" || Boolean(campaign.promocion_otorgada_at);

    return NextResponse.json({
      hasCampaign: true,
      eligible: config.promocion_activa && campaign.estado_promocion === "disponible" && !alreadyAccepted,
      alreadyAccepted,
      estadoPromocion: campaign.estado_promocion,
      planBeneficio: campaign.plan_otorgado || config.plan_beneficio,
      diasBeneficio: campaign.dias_otorgados || config.dias_beneficio,
      promocionOtorgadaAt: campaign.promocion_otorgada_at,
      promocionVenceAt: campaign.promocion_vence_at,
    });
  } catch (err: any) {
    return NextResponse.json({ eligible: false, error: err?.message }, { status: 500 });
  }
}

/**
 * POST: El propietario acepta expresamente la promoción de recuperación ("ACTIVAR MI MES GRATIS").
 * Valida elegibilidad, uso único por tienda, no acumulación con otras promociones y actualiza la suscripción.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token: string | undefined = body?.token || undefined;

    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Debes iniciar sesión para activar tu promoción." },
        { status: 401 }
      );
    }

    // 1. Intentar primero mediante la función RPC transaccional en PostgreSQL (si la migración ya está aplicada)
    const { data: rpcData, error: rpcError } = await (supabase.rpc as any)(
      "activar_promocion_recuperacion",
      {
        _token: token || null,
      }
    );

    if (!rpcError && rpcData) {
      return NextResponse.json({
        ok: true,
        ...rpcData,
      });
    }

    // Si el error viene de una validación de negocio de la RPC, retornarlo directamente
    if (
      rpcError &&
      !rpcError.message?.includes("Could not find the function") &&
      !rpcError.message?.includes("recuperacion_campanas")
    ) {
      return NextResponse.json({ error: rpcError.message }, { status: 400 });
    }

    // 2. Fallback transaccional en servidor si la tabla SQL aún no ha sido migrada en producción
    const { data: prof } = await supabase
      .from("profiles")
      .select("negocio_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!prof?.negocio_id) {
      return NextResponse.json(
        { error: "Tu cuenta no tiene un comercio asociado." },
        { status: 400 }
      );
    }

    const negocioId = prof.negocio_id;

    // Verificar que sea propietario/admin de la tienda
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("negocio_id", negocioId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return NextResponse.json(
        {
          error:
            "Solo el propietario o administrador de la tienda puede aceptar y activar esta promoción.",
        },
        { status: 403 }
      );
    }

    const admin = getServiceSupabase() || supabase;
    const config = await loadRecuperacionConfig(admin);

    if (!config.promocion_activa) {
      return NextResponse.json(
        { error: "La promoción de reactivación no está activa en este momento." },
        { status: 400 }
      );
    }

    const { data: cfg } = await admin
      .from("configuracion")
      .select("modulos_override")
      .eq("negocio_id", negocioId)
      .maybeSingle();

    const ov =
      cfg?.modulos_override && typeof cfg.modulos_override === "object"
        ? (cfg.modulos_override as Record<string, any>)
        : {};

    const camp = (ov.__recuperacion_campana || null) as RecuperacionCampaignRecord | null;
    if (!camp) {
      return NextResponse.json(
        { error: "Tu comercio no registra una invitación de recuperación elegible." },
        { status: 400 }
      );
    }

    if (token && camp.token_reactivacion && camp.token_reactivacion !== token.trim()) {
      return NextResponse.json(
        { error: "El código de verificación de la promoción no coincide con tu tienda." },
        { status: 400 }
      );
    }

    if (camp.estado_promocion === "aceptada" || camp.promocion_otorgada_at) {
      return NextResponse.json(
        { error: "Esta tienda ya utilizó su promoción única de mes gratuito anteriormente." },
        { status: 400 }
      );
    }

    // No acumulable con cupones activos vigentes
    const { data: activeCoupon } = await admin
      .from("cupon_canjes")
      .select("id, vence_at_nuevo")
      .eq("negocio_id", negocioId)
      .gt("vence_at_nuevo", new Date().toISOString())
      .maybeSingle();

    if (activeCoupon) {
      return NextResponse.json(
        {
          error:
            "Esta promoción no es acumulable con otros cupones promocionales activos en tu cuenta.",
        },
        { status: 400 }
      );
    }

    const planOtorgar = camp.plan_otorgado || config.plan_beneficio || "pro";
    const diasOtorgar = camp.dias_otorgados || config.dias_beneficio || 30;
    const now = new Date();
    const venceAt = new Date(now.getTime() + diasOtorgar * 86400000);
    const nowIso = now.toISOString();
    const venceIso = venceAt.toISOString();

    const updatedCampaign: RecuperacionCampaignRecord = {
      ...camp,
      estado_promocion: "aceptada",
      plan_otorgado: planOtorgar,
      dias_otorgados: diasOtorgar,
      promocion_otorgada_at: nowIso,
      promocion_vence_at: venceIso,
      promocion_aceptada_por: user.id,
      tienda_recuperada: true,
      reactivada_at: camp.reactivada_at || nowIso,
      origen_reactivacion: "promocion_aceptada",
      primer_clic_at: camp.primer_clic_at || nowIso,
    };

    await saveCampaignState(admin, updatedCampaign);

    // Actualizar suscripción y plan del negocio
    await admin.from("suscripciones").upsert(
      {
        negocio_id: negocioId,
        plan: planOtorgar,
        estado: "activa",
        proveedor: "manual",
        inicio_at: nowIso,
        vence_at: venceIso,
        notas: `Promoción de Reactivación (${diasOtorgar} días gratis aceptados por propietario)`,
      },
      { onConflict: "negocio_id" }
    );

    await admin.from("negocios").update({ plan: planOtorgar }).eq("id", negocioId);

    // Registrar en audit_logs
    try {
      await admin.from("audit_logs").insert({
        negocio_id: negocioId,
        usuario_id: user.id,
        action: "promocion_recuperacion_activada",
        entity_type: "suscripciones",
        entity_id: negocioId,
        after_data: {
          plan: planOtorgar,
          dias_otorgados: diasOtorgar,
          otorgada_at: nowIso,
          vence_at: venceIso,
        },
      });
    } catch {}

    return NextResponse.json({
      ok: true,
      plan: planOtorgar,
      dias_otorgados: diasOtorgar,
      otorgada_at: nowIso,
      vence_at: venceIso,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error al activar la promoción" },
      { status: 500 }
    );
  }
}
