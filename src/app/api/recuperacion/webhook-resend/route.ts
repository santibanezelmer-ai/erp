import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import {
  getServiceSupabase,
  mapCampaignRowToRecord,
  RecuperacionCampaignRecord,
  saveCampaignState,
} from "@/lib/recuperacion.server";

/**
 * Webhook de eventos de Resend (`email.sent`, `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`).
 * Actualiza automáticamente el estado del correo, fecha de entrega, fecha de apertura y fecha de clic.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json().catch(() => null);
    if (!payload || !payload.type) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }

    const eventType: string = payload.type;
    const data = payload.data || {};
    const emailId: string | null = data.email_id || data.id || null;
    const eventTimestamp: string = data.created_at || payload.created_at || new Date().toISOString();

    // Extraer tags personalizados enviados a Resend
    let negocioId: string | null = null;
    let step = 1;
    if (Array.isArray(data.tags)) {
      for (const t of data.tags) {
        if (t?.name === "negocio_id") negocioId = t.value;
        if (t?.name === "step") step = Number(t.value) === 2 ? 2 : 1;
      }
    } else if (data.tags && typeof data.tags === "object") {
      negocioId = data.tags.negocio_id || null;
      step = Number(data.tags.step) === 2 ? 2 : 1;
    }

    const supabase = getServiceSupabase() || (await createServerSupabase());

    // Actualizar email_send_log si existe el message_id
    if (emailId) {
      try {
        await supabase
          .from("email_send_log")
          .update({
            status: eventType.replace("email.", ""),
          })
          .eq("message_id", emailId);
      } catch {}
    }

    // Si es queja de spam o rebote duro, registrar en suppressed_emails para respetar bajas
    if (eventType === "email.complained" || eventType === "email.bounced") {
      const recipient = Array.isArray(data.to) ? data.to[0] : data.to;
      if (recipient && typeof recipient === "string") {
        try {
          await supabase.from("suppressed_emails").upsert(
            {
              email: recipient.toLowerCase(),
              reason: eventType === "email.complained" ? "complaint" : "bounce",
              metadata: { email_id: emailId, negocio_id: negocioId },
            },
            { onConflict: "email" }
          );
        } catch {}
      }
    }

    // Localizar la campaña por negocio_id o por resend_id
    let campaign: RecuperacionCampaignRecord | null = null;

    if (negocioId) {
      const { data: row } = await supabase
        .from("recuperacion_campanas")
        .select("*")
        .eq("negocio_id", negocioId)
        .maybeSingle();
      if (row) {
        campaign = mapCampaignRowToRecord(row);
      }
    } else if (emailId) {
      const { data: row1 } = await supabase
        .from("recuperacion_campanas")
        .select("*")
        .or(`correo_1_resend_id.eq.${emailId},correo_2_resend_id.eq.${emailId}`)
        .maybeSingle();
      if (row1) {
        negocioId = row1.negocio_id;
        step = row1.correo_2_resend_id === emailId ? 2 : 1;
        campaign = mapCampaignRowToRecord(row1);
      }
    }

    // Fallback en configuracion.modulos_override.__recuperacion_campana
    if (!campaign && negocioId) {
      const { data: cfg } = await supabase
        .from("configuracion")
        .select("modulos_override")
        .eq("negocio_id", negocioId)
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
      return NextResponse.json({ ok: true, matched: false });
    }

    const updated = { ...campaign };

    if (eventType === "email.delivered") {
      if (step === 2) {
        updated.correo_2_entregado_at = updated.correo_2_entregado_at || eventTimestamp;
        if (updated.correo_2_estado === "enviado" || !updated.correo_2_estado) {
          updated.correo_2_estado = "entregado";
        }
      } else {
        updated.correo_1_entregado_at = updated.correo_1_entregado_at || eventTimestamp;
        if (updated.correo_1_estado === "enviado" || updated.correo_1_estado === "pendiente") {
          updated.correo_1_estado = "entregado";
        }
      }
    } else if (eventType === "email.opened") {
      updated.primer_abierto_at = updated.primer_abierto_at || eventTimestamp;
      if (step === 2) {
        updated.correo_2_abierto_at = updated.correo_2_abierto_at || eventTimestamp;
        if (updated.correo_2_estado !== "clic") {
          updated.correo_2_estado = "abierto";
        }
      } else {
        updated.correo_1_abierto_at = updated.correo_1_abierto_at || eventTimestamp;
        if (updated.correo_1_estado !== "clic") {
          updated.correo_1_estado = "abierto";
        }
      }
    } else if (eventType === "email.clicked") {
      updated.primer_clic_at = updated.primer_clic_at || eventTimestamp;
      updated.primer_abierto_at = updated.primer_abierto_at || eventTimestamp;
      if (step === 2) {
        updated.correo_2_clic_at = updated.correo_2_clic_at || eventTimestamp;
        updated.correo_2_abierto_at = updated.correo_2_abierto_at || eventTimestamp;
        updated.correo_2_estado = "clic";
      } else {
        updated.correo_1_clic_at = updated.correo_1_clic_at || eventTimestamp;
        updated.correo_1_abierto_at = updated.correo_1_abierto_at || eventTimestamp;
        updated.correo_1_estado = "clic";
      }
    } else if (eventType === "email.bounced") {
      if (step === 2) updated.correo_2_estado = "rebotado";
      else updated.correo_1_estado = "rebotado";
    }

    await saveCampaignState(supabase, updated);

    return NextResponse.json({ ok: true, matched: true, eventType });
  } catch (err: any) {
    console.error("[Resend Webhook Error]:", err);
    return NextResponse.json({ ok: false, error: err?.message }, { status: 200 });
  }
}
