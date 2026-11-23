import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import {
  getServiceSupabase,
  RecuperacionCampaignRecord,
  saveCampaignState,
} from "@/lib/recuperacion.server";

/**
 * Permite que un propietario se dé de baja de los correos de recordatorio de inactividad.
 * Registra el correo en `suppressed_emails` y marca `baja_comunicaciones = true` en su campaña.
 */
export async function GET(req: NextRequest) {
  const negocioId = req.nextUrl.searchParams.get("negocio");
  const email = (req.nextUrl.searchParams.get("email") || "").trim().toLowerCase();

  try {
    const supabase = getServiceSupabase() || (await createServerSupabase());

    if (email) {
      await supabase.from("suppressed_emails").upsert(
        {
          email,
          reason: "user_unsubscribed_recovery",
          metadata: { negocio_id: negocioId, unsubscribed_at: new Date().toISOString() },
        },
        { onConflict: "email" }
      );
    }

    if (negocioId) {
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
        const camp = ov.__recuperacion_campana as RecuperacionCampaignRecord;
        await saveCampaignState(supabase, {
          ...camp,
          baja_comunicaciones: true,
        });
      }
    }
  } catch (err) {
    console.warn("[Unsubscribe Error]:", err);
  }

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preferencias de correo actualizadas · Operix ERP</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #0f172a; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 16px;">
  <div style="max-width: 460px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; text-align: center; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);">
    <div style="display: inline-block; background: #0f172a; color: #ffffff; font-weight: 800; font-size: 13px; padding: 6px 12px; border-radius: 8px; margin-bottom: 16px;">
      OPERIX ERP
    </div>
    <h1 style="font-size: 20px; margin: 0 0 12px 0;">Te has dado de baja correctamente</h1>
    <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 24px 0;">
      No volveremos a enviarte correos automáticos de recordatorio por inactividad${
        email ? ` a <strong>${email}</strong>` : ""
      }. Tu cuenta y tu tienda siguen disponibles cuando quieras ingresar.
    </p>
    <a href="https://operixerp.cloud/login" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 10px 20px; border-radius: 8px;">
      Ir a Operix ERP
    </a>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
