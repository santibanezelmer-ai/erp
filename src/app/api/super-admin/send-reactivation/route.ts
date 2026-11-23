import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Verificar que quien invoca sea Super Admin
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

    if (!isSuperAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const {
      toEmail,
      storeName,
      storeSlug,
      subject,
      message,
      cuponCodigo,
      reactivationUrl,
    } = body as {
      toEmail: string;
      storeName: string;
      storeSlug: string;
      subject: string;
      message: string;
      cuponCodigo?: string;
      reactivationUrl?: string;
    };

    if (!toEmail || !subject || !message) {
      return NextResponse.json(
        { error: "Destinatario, asunto y mensaje son obligatorios" },
        { status: 400 }
      );
    }

    const actionUrl = reactivationUrl || "https://operixerp.cloud/planes";
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || "Operix ERP <notificaciones@operixerp.cloud>";

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-w: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc; color: #0f172a;">
        <div style="background-color: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="margin-bottom: 20px;">
            <span style="display: inline-block; background-color: #0f172a; color: #ffffff; font-weight: 800; font-size: 14px; padding: 6px 12px; border-radius: 8px;">
              Operix ERP
            </span>
          </div>
          <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #0f172a;">
            Hola, equipo de ${storeName}
          </h2>
          <div style="font-size: 15px; line-height: 1.6; color: #334155; white-space: pre-line; margin-bottom: 24px;">
${message}
          </div>
          ${
            cuponCodigo
              ? `<div style="background-color: #f0fdf4; border: 1px dashed #16a34a; border-radius: 10px; padding: 16px; text-align: center; margin-bottom: 24px;">
                  <div style="font-size: 12px; text-transform: uppercase; color: #15803d; font-weight: 700; margin-bottom: 4px;">
                    Cupón Especial de Reactivación
                  </div>
                  <div style="font-family: monospace; font-size: 22px; font-weight: 800; color: #166534; letter-spacing: 1px;">
                    ${cuponCodigo}
                  </div>
                </div>`
              : ""
          }
          <div style="text-align: center; margin: 28px 0;">
            <a href="${actionUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 15px; padding: 12px 24px; border-radius: 8px;">
              Reactivar mi Tienda en Operix ERP →
            </a>
          </div>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #64748b; margin: 0;">
            Tienda asociada: <strong>${storeName}</strong> (operixerp.cloud/c/${storeSlug})<br/>
            Si necesitas asistencia personalizada, responde directamente a este correo.
          </p>
        </div>
      </div>
    `;

    if (resendApiKey) {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          subject,
          html: htmlBody,
          text: `${message}\n\nReactiva tu tienda aquí: ${actionUrl}`,
        }),
      });

      const resendData = await resendRes.json();
      if (!resendRes.ok) {
        return NextResponse.json(
          {
            sentViaApi: false,
            error: resendData?.message || "Error al enviar mediante Resend API",
          },
          { status: 502 }
        );
      }

      return NextResponse.json({
        sentViaApi: true,
        provider: "resend",
        id: resendData.id,
      });
    }

    // Si aún no está configurada RESEND_API_KEY en Vercel, devolvemos modo cliente (mailto / copia directa)
    return NextResponse.json({
      sentViaApi: false,
      fallbackMailto: true,
      reason: "RESEND_API_KEY no configurada en variables de entorno; abriendo cliente de correo.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error interno al procesar envío" },
      { status: 500 }
    );
  }
}
