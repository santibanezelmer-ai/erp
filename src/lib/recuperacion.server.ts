import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface RecuperacionConfig {
  automatizacion_activa: boolean;
  dias_inactividad: number;
  segundo_seguimiento_activo: boolean;
  dias_segundo_seguimiento: number;
  promocion_activa: boolean;
  dias_beneficio: number;
  plan_beneficio: "basico" | "pro" | "enterprise";
  remitente_nombre: string;
  remitente_email: string;
  asunto_correo_1: string;
  cuerpo_correo_1: string;
  asunto_correo_2: string;
  cuerpo_correo_2: string;
  texto_boton: string;
  updated_at?: string;
}

export const DEFAULT_RECUPERACION_CONFIG: RecuperacionConfig = {
  automatizacion_activa: true,
  dias_inactividad: 12,
  segundo_seguimiento_activo: true,
  dias_segundo_seguimiento: 5,
  promocion_activa: true,
  dias_beneficio: 30,
  plan_beneficio: "pro",
  remitente_nombre: "Operix ERP",
  remitente_email: "notificaciones@operixerp.cloud",
  asunto_correo_1: "¡Te extrañamos! Queremos que vuelvas a Operix ERP.",
  cuerpo_correo_1:
    "Hemos notado que llevas un tiempo sin utilizar Operix ERP en {{tienda}}.\n\nSabemos lo importante que es mantener el control de tus ventas, inventario, turnos de caja y catálogo online en un solo lugar, de forma rápida y segura en la nube.\n\nQueremos que vuelvas a impulsar tu negocio con nosotros, por eso hemos preparado una oferta especial de reactivación exclusiva para tu tienda: UN MES GRATUITO en tu suscripción.",
  asunto_correo_2:
    "Recordatorio: Tu mes gratuito en Operix ERP sigue disponible para {{tienda}}",
  cuerpo_correo_2:
    "Hace unos días te enviamos una invitación especial para volver a Operix ERP.\n\nTe recordamos que tu beneficio exclusivo de UN MES GRATUITO para {{tienda}} sigue disponible y listo para activarse cuando tú lo decidas.\n\nToda tu configuración, productos y clientes te están esperando.",
  texto_boton: "ACTIVAR MI MES GRATIS",
};

export interface RecuperacionCampaignRecord {
  negocio_id: string;
  negocio_nombre: string;
  negocio_slug: string;
  destinatario_email: string;
  destinatario_nombre: string | null;
  token_reactivacion: string;
  ultima_actividad_real_at: string;
  inactividad_detectada_at: string;
  dias_inactivo: number;
  correo_1_enviado_at: string | null;
  correo_1_resend_id: string | null;
  correo_1_estado:
    | "pendiente"
    | "enviado"
    | "entregado"
    | "abierto"
    | "clic"
    | "rebotado"
    | "fallido"
    | "suprimido";
  correo_1_entregado_at: string | null;
  correo_1_abierto_at: string | null;
  correo_1_clic_at: string | null;
  correo_2_enviado_at: string | null;
  correo_2_resend_id: string | null;
  correo_2_estado:
    | "pendiente"
    | "enviado"
    | "entregado"
    | "abierto"
    | "clic"
    | "rebotado"
    | "fallido"
    | "suprimido"
    | null;
  correo_2_entregado_at: string | null;
  correo_2_abierto_at: string | null;
  correo_2_clic_at: string | null;
  primer_abierto_at: string | null;
  primer_clic_at: string | null;
  estado_promocion: "disponible" | "aceptada" | "expirada" | "rechazada" | "no_elegible";
  plan_otorgado: string;
  dias_otorgados: number;
  promocion_otorgada_at: string | null;
  promocion_vence_at: string | null;
  promocion_aceptada_por: string | null;
  tienda_recuperada: boolean;
  reactivada_at: string | null;
  origen_reactivacion: string | null;
  baja_comunicaciones: boolean;
}

export interface StoreRealActivitySummary {
  negocio_id: string;
  nombre: string;
  slug: string;
  plan: string;
  tipo_negocio: string;
  created_at: string;
  owner_email: string | null;
  owner_name: string | null;
  last_real_activity_at: string;
  last_activity_type: string;
  inactive_days: number;
  is_inactive_threshold_met: boolean;
  campaign: RecuperacionCampaignRecord | null;
}

export function getServiceSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function generateTokenHex(): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const arr = new Uint8Array(20);
    crypto.getRandomValues(arr);
    return Array.from(arr)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
}

/**
 * Renderiza el correo HTML responsivo y moderno de Operix ERP para el correo 1 o 2 de recuperación.
 */
export function buildRecuperacionEmailHtml(params: {
  storeName: string;
  storeSlug: string;
  ownerName?: string | null;
  subject: string;
  bodyTemplate: string;
  buttonText: string;
  activationUrl: string;
  unsubscribeUrl: string;
  promocionActiva: boolean;
  diasBeneficio: number;
  planBeneficio: string;
  isSecondFollowUp?: boolean;
}): { subject: string; html: string; text: string } {
  const replaceTokens = (str: string) =>
    str
      .replace(/\{\{\s*tienda\s*\}\}/gi, params.storeName)
      .replace(/\{\{\s*propietario\s*\}\}/gi, params.ownerName || params.storeName)
      .replace(/\{\{\s*dias\s*\}\}/gi, String(params.diasBeneficio))
      .replace(/\{\{\s*plan\s*\}\}/gi, params.planBeneficio.toUpperCase());

  const finalSubject = replaceTokens(params.subject);
  const finalBody = replaceTokens(params.bodyTemplate);

  const paragraphsHtml = finalBody
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.65; color: #334155;">${p
          .trim()
          .replace(/\n/g, "<br/>")}</p>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${finalSubject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; padding: 28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 28px 32px; text-align: left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: 800; font-size: 13px; letter-spacing: 0.6px; padding: 6px 12px; border-radius: 8px; text-transform: uppercase;">
                      Operix ERP
                    </span>
                    ${
                      params.isSecondFollowUp
                        ? `<span style="display: inline-block; margin-left: 8px; background-color: rgba(245, 158, 11, 0.2); color: #fcd34d; font-weight: 700; font-size: 11px; padding: 5px 10px; border-radius: 999px;">Recordatorio Especial</span>`
                        : ""
                    }
                    <h1 style="margin: 16px 0 4px 0; font-size: 22px; font-weight: 800; color: #ffffff; line-height: 1.3;">
                      ¡Hola, ${params.storeName}!
                    </h1>
                    <p style="margin: 0; font-size: 13px; color: #94a3b8;">
                      operixerp.cloud/c/${params.storeSlug}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 32px 16px 32px;">
              ${paragraphsHtml}

              <!-- Recordatorio de beneficios -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin: 22px 0;">
                <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a; margin-bottom: 10px;">
                  Todo lo que tienes listo en tu cuenta de Operix ERP:
                </div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 13.5px; color: #334155; line-height: 1.6;">
                  <tr><td style="padding: 3px 0;">✓ <strong>Punto de Venta (POS) ágil</strong> compatible con lectores de barra e impresoras térmicas.</td></tr>
                  <tr><td style="padding: 3px 0;">✓ <strong>Control de inventario y alertas de stock crítico</strong> en tiempo real.</td></tr>
                  <tr><td style="padding: 3px 0;">✓ <strong>Catálogo y Tienda Online</strong> lista para recibir pedidos las 24 horas.</td></tr>
                  <tr><td style="padding: 3px 0;">✓ <strong>Reportes financieros, control de turnos de caja y multi-sucursal.</strong></td></tr>
                </table>
              </div>

              ${
                params.promocionActiva
                  ? `<!-- Oferta Especial 1 Mes Gratis -->
              <div style="background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%); border: 2px dashed #2563eb; border-radius: 14px; padding: 22px; text-align: center; margin: 24px 0;">
                <span style="display: inline-block; background-color: #16a34a; color: #ffffff; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; padding: 4px 10px; border-radius: 999px; margin-bottom: 8px;">
                  Oferta Exclusiva de Reactivación
                </span>
                <div style="font-size: 22px; font-weight: 900; color: #0f172a; margin: 4px 0;">
                  UN MES GRATUITO (${params.diasBeneficio} DÍAS) · PLAN ${params.planBeneficio.toUpperCase()}
                </div>
                <p style="margin: 6px 0 0 0; font-size: 13px; color: #475569;">
                  Sin cargos automáticos sorpresivos.El beneficio se activa únicamente cuando tú lo confirmas en tu panel.
                </p>
              </div>`
                  : ""
              }

              <!-- CTA Button -->
              <div style="text-align: center; margin: 28px 0 20px 0;">
                <a href="${params.activationUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 800; font-size: 15px; letter-spacing: 0.4px; padding: 15px 32px; border-radius: 10px; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);">
                  ${params.buttonText}
                </a>
              </div>

              <p style="margin: 0 0 12px 0; font-size: 12px; color: #64748b; text-align: center;">
                O copia y pega este enlace en tu navegador:<br/>
                <a href="${params.activationUrl}" style="color: #2563eb; word-break: break-all;">${params.activationUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; text-align: center; font-size: 12px; color: #64748b; line-height: 1.5;">
              Enviado por <strong>Operix ERP</strong> (notificaciones@operixerp.cloud) para la tienda <strong>${params.storeName}</strong>.<br/>
              Promoción válida por única vez por comercio y no acumulable con otras promociones vigentes.<br/>
              <a href="${params.unsubscribeUrl}" style="color: #64748b; text-decoration: underline;">Darme de baja de correos de recordatorio</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `¡Hola, ${params.storeName}!\n\n${finalBody}\n\n${
    params.promocionActiva
      ? `OFERTA ESPECIAL DE REACTIVACIÓN: UN MES GRATUITO (${params.diasBeneficio} días en Plan ${params.planBeneficio.toUpperCase()}).\n`
      : ""
  }\n${params.buttonText}: ${params.activationUrl}\n\n---\nPara darte de baja de estos recordatorios visita: ${params.unsubscribeUrl}`;

  return { subject: finalSubject, html, text };
}

/**
 * Lee la configuración global del motor de recuperación.
 * Utiliza `recuperacion_config` si la migración ya fue aplicada; si no, respalda en el perfil del Super Admin o valores por defecto.
 */
export async function loadRecuperacionConfig(
  supabase: SupabaseClient
): Promise<RecuperacionConfig> {
  try {
    const { data, error } = await supabase
      .from("recuperacion_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (!error && data) {
      return {
        ...DEFAULT_RECUPERACION_CONFIG,
        ...data,
      };
    }
  } catch {}

  return DEFAULT_RECUPERACION_CONFIG;
}

/**
 * Calcula la última actividad real de cada tienda en Operix ERP cruzando únicamente acciones humanas reales:
 * - Inicio de sesión o actualización de perfil de propietarios/usuarios autorizados
 * - Registro de ventas en POS
 * - Gestión de pedidos o comandas
 * - Actualización de productos, compras o movimientos de stock manuales/operativos
 * - Sesiones de caja o registros de auditoría administrativos
 */
export async function computeAllStoresActivityAndCampaigns(
  supabase: SupabaseClient,
  config: RecuperacionConfig
): Promise<StoreRealActivitySummary[]> {
  const [
    negRes,
    profRes,
    ventasRes,
    prodRes,
    comandasRes,
    comprasRes,
    cajaRes,
    pedidosRes,
    auditRes,
    cfgRes,
    campRes,
  ] = await Promise.all([
    supabase
      .from("negocios")
      .select("id, nombre, slug, plan, tipo_negocio, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, negocio_id, email, nombre, updated_at, created_at")
      .order("created_at", { ascending: true }),
    supabase.from("ventas").select("negocio_id, created_at").order("created_at", { ascending: false }),
    supabase
      .from("productos")
      .select("negocio_id, updated_at, created_at")
      .order("updated_at", { ascending: false }),
    supabase
      .from("comandas")
      .select("negocio_id, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("compras")
      .select("negocio_id, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("caja_sesiones")
      .select("negocio_id, abierta_at")
      .order("abierta_at", { ascending: false }),
    supabase
      .from("pedidos_whatsapp")
      .select("negocio_id, estado, created_at")
      .neq("estado", "pendiente")
      .order("created_at", { ascending: false }),
    supabase
      .from("audit_logs")
      .select("negocio_id, action, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("configuracion").select("negocio_id, modulos_override"),
    supabase.from("recuperacion_campanas").select("*"),
  ]);

  const negocios = (negRes.data || []) as any[];

  // Mapa de propietario/admin por negocio
  const ownerMap: Record<string, { email: string | null; nombre: string | null }> = {};
  const latestActivityMap: Record<string, { ts: number; iso: string; type: string }> = {};

  const recordCandidate = (negocioId: string | null | undefined, isoDate: string | null | undefined, type: string) => {
    if (!negocioId || !isoDate) return;
    const ts = new Date(isoDate).getTime();
    if (Number.isNaN(ts)) return;
    const current = latestActivityMap[negocioId];
    if (!current || ts > current.ts) {
      latestActivityMap[negocioId] = { ts, iso: isoDate, type };
    }
  };

  for (const n of negocios) {
    recordCandidate(n.id, n.created_at, "Creación de tienda");
  }

  for (const p of (profRes.data || []) as any[]) {
    if (!p.negocio_id) continue;
    if (!ownerMap[p.negocio_id] && p.email) {
      ownerMap[p.negocio_id] = { email: p.email, nombre: p.nombre || null };
    }
    recordCandidate(p.negocio_id, p.updated_at || p.created_at, "Sesión / perfil de usuario");
  }

  for (const v of (ventasRes.data || []) as any[]) {
    recordCandidate(v.negocio_id, v.created_at, "Registro de venta");
  }

  for (const pr of (prodRes.data || []) as any[]) {
    recordCandidate(pr.negocio_id, pr.updated_at || pr.created_at, "Actualización de inventario/producto");
  }

  for (const cm of (comandasRes.data || []) as any[]) {
    recordCandidate(cm.negocio_id, cm.created_at, "Gestión de comanda");
  }

  for (const cp of (comprasRes.data || []) as any[]) {
    recordCandidate(cp.negocio_id, cp.created_at, "Registro de compra");
  }

  for (const cj of (cajaRes.data || []) as any[]) {
    recordCandidate(cj.negocio_id, cj.abierta_at, "Apertura/turno de caja");
  }

  for (const pw of (pedidosRes.data || []) as any[]) {
    recordCandidate(pw.negocio_id, pw.created_at, "Gestión de pedido online");
  }

  for (const al of (auditRes.data || []) as any[]) {
    if (al.action && String(al.action).startsWith("system_")) continue;
    recordCandidate(al.negocio_id, al.created_at, "Actividad administrativa ERP");
  }

  // Campañas almacenadas en tabla dedicada o respaldo en configuracion.modulos_override.__recuperacion
  const campaignByNegocio: Record<string, RecuperacionCampaignRecord> = {};

  if (!campRes.error && Array.isArray(campRes.data)) {
    for (const row of campRes.data as any[]) {
      const neg = negocios.find((n) => n.id === row.negocio_id);
      campaignByNegocio[row.negocio_id] = {
        ...row,
        negocio_nombre: neg?.nombre || "",
        negocio_slug: neg?.slug || "",
        dias_inactivo: row.dias_inactivo_al_detectar ?? 12,
      };
    }
  }

  for (const c of (cfgRes.data || []) as any[]) {
    if (!c.negocio_id) continue;
    const ov =
      c.modulos_override && typeof c.modulos_override === "object"
        ? (c.modulos_override as Record<string, any>)
        : {};
    // Si tiene __last_human_login_at (registrado en login real), considerarlo
    if (ov.__last_human_activity_at) {
      recordCandidate(c.negocio_id, ov.__last_human_activity_at, "Inicio de sesión en ERP");
    }
    if (!campaignByNegocio[c.negocio_id] && ov.__recuperacion_campana) {
      campaignByNegocio[c.negocio_id] = ov.__recuperacion_campana as RecuperacionCampaignRecord;
    }
  }

  const nowMs = Date.now();

  return negocios.map((n) => {
    const act = latestActivityMap[n.id] || {
      ts: new Date(n.created_at).getTime(),
      iso: n.created_at,
      type: "Creación de tienda",
    };
    const diffDays = Math.max(0, Math.floor((nowMs - act.ts) / 86400000));
    const owner = ownerMap[n.id] || { email: null, nombre: null };
    const existingCamp = campaignByNegocio[n.id] || null;

    // Si la tienda tuvo actividad real posterior al envío del primer correo y aún no estaba marcada como recuperada
    if (
      existingCamp &&
      !existingCamp.tienda_recuperada &&
      existingCamp.correo_1_enviado_at &&
      act.ts > new Date(existingCamp.correo_1_enviado_at).getTime() + 60000
    ) {
      existingCamp.tienda_recuperada = true;
      existingCamp.reactivada_at = act.iso;
      existingCamp.origen_reactivacion = existingCamp.origen_reactivacion || "actividad_erp";
    }

    return {
      negocio_id: n.id,
      nombre: n.nombre,
      slug: n.slug,
      plan: n.plan || "free",
      tipo_negocio: n.tipo_negocio || "tienda",
      created_at: n.created_at,
      owner_email: owner.email,
      owner_name: owner.nombre,
      last_real_activity_at: act.iso,
      last_activity_type: act.type,
      inactive_days: diffDays,
      is_inactive_threshold_met: diffDays >= config.dias_inactividad,
      campaign: existingCamp,
    };
  });
}

/**
 * Persiste el estado de una campaña tanto en `recuperacion_campanas` (si la tabla existe)
 * como en `configuracion.modulos_override.__recuperacion_campana` para garantizar funcionamiento inmediato.
 */
export async function saveCampaignState(
  supabase: SupabaseClient,
  campaign: RecuperacionCampaignRecord
): Promise<void> {
  // 1. Intentar guardar en tabla dedicada `recuperacion_campanas`
  try {
    await supabase.from("recuperacion_campanas").upsert(
      {
        negocio_id: campaign.negocio_id,
        destinatario_email: campaign.destinatario_email,
        destinatario_nombre: campaign.destinatario_nombre,
        token_reactivacion: campaign.token_reactivacion,
        ultima_actividad_real_at: campaign.ultima_actividad_real_at,
        inactividad_detectada_at: campaign.inactividad_detectada_at,
        dias_inactivo_al_detectar: campaign.dias_inactivo,
        correo_1_enviado_at: campaign.correo_1_enviado_at,
        correo_1_resend_id: campaign.correo_1_resend_id,
        correo_1_estado: campaign.correo_1_estado,
        correo_1_entregado_at: campaign.correo_1_entregado_at,
        correo_1_abierto_at: campaign.correo_1_abierto_at,
        correo_1_clic_at: campaign.correo_1_clic_at,
        correo_2_enviado_at: campaign.correo_2_enviado_at,
        correo_2_resend_id: campaign.correo_2_resend_id,
        correo_2_estado: campaign.correo_2_estado,
        correo_2_entregado_at: campaign.correo_2_entregado_at,
        correo_2_abierto_at: campaign.correo_2_abierto_at,
        correo_2_clic_at: campaign.correo_2_clic_at,
        primer_abierto_at: campaign.primer_abierto_at,
        primer_clic_at: campaign.primer_clic_at,
        estado_promocion: campaign.estado_promocion,
        plan_otorgado: campaign.plan_otorgado,
        dias_otorgados: campaign.dias_otorgados,
        promocion_otorgada_at: campaign.promocion_otorgada_at,
        promocion_vence_at: campaign.promocion_vence_at,
        promocion_aceptada_por: campaign.promocion_aceptada_por,
        tienda_recuperada: campaign.tienda_recuperada,
        reactivada_at: campaign.reactivada_at,
        origen_reactivacion: campaign.origen_reactivacion,
        baja_comunicaciones: campaign.baja_comunicaciones,
      },
      { onConflict: "negocio_id" }
    );
  } catch {}

  // 2. Sincronizar respaldo en configuracion.modulos_override.__recuperacion_campana
  try {
    const { data: cfg } = await supabase
      .from("configuracion")
      .select("id, modulos_override")
      .eq("negocio_id", campaign.negocio_id)
      .maybeSingle();

    const currentOverrides =
      cfg?.modulos_override &&
      typeof cfg.modulos_override === "object" &&
      !Array.isArray(cfg.modulos_override)
        ? (cfg.modulos_override as Record<string, any>)
        : {};

    const nextOverrides = {
      ...currentOverrides,
      __recuperacion_campana: campaign,
    };

    if (cfg?.id) {
      await supabase
        .from("configuracion")
        .update({ modulos_override: nextOverrides })
        .eq("negocio_id", campaign.negocio_id);
    } else {
      await supabase.from("configuracion").insert({
        negocio_id: campaign.negocio_id,
        modulos_override: nextOverrides,
      });
    }
  } catch {}
}

/**
 * Envía un correo de recuperación (1 o 2) utilizando Resend API y registra el resultado en `email_send_log` y `audit_logs`.
 */
export async function dispatchRecoveryEmailForStore(params: {
  supabase: SupabaseClient;
  store: StoreRealActivitySummary;
  config: RecuperacionConfig;
  step: 1 | 2;
  forceManual?: boolean;
}): Promise<{
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  resendId?: string | null;
  campaign?: RecuperacionCampaignRecord;
}> {
  const { supabase, store, config, step, forceManual } = params;

  if (!store.owner_email) {
    return { ok: false, skipped: true, reason: "La tienda no tiene correo de propietario registrado." };
  }

  const emailLower = store.owner_email.trim().toLowerCase();

  // 1. Verificar lista de bajas de comunicaciones (`suppressed_emails`)
  const { data: suppressed } = await supabase
    .from("suppressed_emails")
    .select("id, reason")
    .eq("email", emailLower)
    .maybeSingle();

  if (suppressed) {
    return {
      ok: false,
      skipped: true,
      reason: `El correo ${emailLower} está dado de baja (${suppressed.reason}).`,
    };
  }

  const existing = store.campaign;
  if (existing?.baja_comunicaciones) {
    return {
      ok: false,
      skipped: true,
      reason: "El propietario solicitó darse de baja de correos de recordatorio.",
    };
  }

  // 2. Control de idempotencia estricto
  if (step === 1 && existing?.correo_1_enviado_at && !forceManual) {
    return {
      ok: false,
      skipped: true,
      reason: "La tienda ya recibió el primer correo de esta campaña de reactivación.",
    };
  }

  if (step === 2) {
    if (!existing?.correo_1_enviado_at) {
      return {
        ok: false,
        skipped: true,
        reason: "No se puede enviar el segundo seguimiento antes del primer correo.",
      };
    }
    if (existing.correo_2_enviado_at && !forceManual) {
      return {
        ok: false,
        skipped: true,
        reason: "La tienda ya recibió el segundo correo de seguimiento.",
      };
    }
    if (existing.tienda_recuperada || existing.estado_promocion === "aceptada") {
      return {
        ok: false,
        skipped: true,
        reason: "La tienda ya volvió a utilizar Operix ERP o activó su promoción.",
      };
    }
  }

  const token = existing?.token_reactivacion || generateTokenHex();
  const baseUrl = "https://operixerp.cloud";
  const activationUrl = `${baseUrl}/api/recuperacion/click?negocio=${encodeURIComponent(
    store.negocio_id
  )}&token=${encodeURIComponent(token)}&step=${step}`;
  const unsubscribeUrl = `${baseUrl}/api/recuperacion/unsubscribe?negocio=${encodeURIComponent(
    store.negocio_id
  )}&token=${encodeURIComponent(token)}&email=${encodeURIComponent(emailLower)}`;

  const rendered = buildRecuperacionEmailHtml({
    storeName: store.nombre,
    storeSlug: store.slug,
    ownerName: store.owner_name,
    subject: step === 1 ? config.asunto_correo_1 : config.asunto_correo_2,
    bodyTemplate: step === 1 ? config.cuerpo_correo_1 : config.cuerpo_correo_2,
    buttonText: config.texto_boton || "ACTIVAR MI MES GRATIS",
    activationUrl,
    unsubscribeUrl,
    promocionActiva: config.promocion_activa,
    diasBeneficio: config.dias_beneficio,
    planBeneficio: config.plan_beneficio,
    isSecondFollowUp: step === 2,
  });

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return {
      ok: false,
      reason:
        "Falta configurar la variable de entorno RESEND_API_KEY en el servidor para el envío directo con Resend.",
    };
  }

  const fromHeader = `${config.remitente_nombre || "Operix ERP"} <${
    config.remitente_email || "notificaciones@operixerp.cloud"
  }>`;

  const idempotencyKey = `operix-recovery-${store.negocio_id}-step-${step}-${
    forceManual ? Date.now() : "auto"
  }`;

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: fromHeader,
      to: [emailLower],
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
      },
      tags: [
        { name: "campaign", value: "store_recovery" },
        { name: "negocio_id", value: store.negocio_id },
        { name: "step", value: String(step) },
      ],
    }),
  });

  const resendData = await resendRes.json().catch(() => ({}));
  const nowIso = new Date().toISOString();

  // Registrar en tabla existente `email_send_log`
  try {
    await supabase.from("email_send_log").insert({
      recipient_email: emailLower,
      template_name: step === 1 ? "recuperacion_inactividad_12d" : "recuperacion_seguimiento_5d",
      status: resendRes.ok ? "sent" : "failed",
      message_id: resendData?.id || null,
      error_message: resendRes.ok ? null : resendData?.message || "Resend error",
      metadata: {
        negocio_id: store.negocio_id,
        negocio_nombre: store.nombre,
        step,
        inactive_days: store.inactive_days,
      },
    });
  } catch {}

  if (!resendRes.ok) {
    return {
      ok: false,
      reason: resendData?.message || "Error al enviar correo con Resend API",
    };
  }

  const nextCampaign: RecuperacionCampaignRecord = existing
    ? {
        ...existing,
         ...(step === 1
          ? {
              correo_1_enviado_at: nowIso,
              correo_1_resend_id: resendData?.id || null,
              correo_1_estado: "enviado",
            }
          : {
              correo_2_enviado_at: nowIso,
              correo_2_resend_id: resendData?.id || null,
              correo_2_estado: "enviado",
            }),
      }
    : {
        negocio_id: store.negocio_id,
        negocio_nombre: store.nombre,
        negocio_slug: store.slug,
        destinatario_email: emailLower,
        destinatario_nombre: store.owner_name,
        token_reactivacion: token,
        ultima_actividad_real_at: store.last_real_activity_at,
        inactividad_detectada_at: nowIso,
        dias_inactivo: store.inactive_days,
        correo_1_enviado_at: nowIso,
        correo_1_resend_id: resendData?.id || null,
        correo_1_estado: "enviado",
        correo_1_entregado_at: null,
        correo_1_abierto_at: null,
        correo_1_clic_at: null,
        correo_2_enviado_at: null,
        correo_2_resend_id: null,
        correo_2_estado: null,
        correo_2_entregado_at: null,
        correo_2_abierto_at: null,
        correo_2_clic_at: null,
        primer_abierto_at: null,
        primer_clic_at: null,
        estado_promocion: config.promocion_activa ? "disponible" : "no_elegible",
        plan_otorgado: config.plan_beneficio,
        dias_otorgados: config.dias_beneficio,
        promocion_otorgada_at: null,
        promocion_vence_at: null,
        promocion_aceptada_por: null,
        tienda_recuperada: false,
        reactivada_at: null,
        origen_reactivacion: null,
        baja_comunicaciones: false,
      };

  await saveCampaignState(supabase, nextCampaign);

  // Registrar en audit_logs
  try {
    await supabase.from("audit_logs").insert({
      negocio_id: store.negocio_id,
      action: step === 1 ? "system_recovery_email_1_sent" : "system_recovery_email_2_sent",
      entity_type: "recuperacion_campanas",
      entity_id: resendData?.id || store.negocio_id,
      after_data: {
        recipient: emailLower,
        step,
        inactive_days: store.inactive_days,
        resend_id: resendData?.id || null,
      },
    });
  } catch {}

  return {
    ok: true,
    resendId: resendData?.id || null,
    campaign: nextCampaign,
  };
}
