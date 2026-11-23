import { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.types";
import { getServiceSupabase } from "@/lib/recuperacion.server";

export type TicketEstado =
  | "nuevo"
  | "abierto"
  | "esperando_tienda"
  | "en_resolucion"
  | "resuelto"
  | "cerrado";

export type TicketPrioridad = "baja" | "normal" | "alta" | "urgente";

export type TicketCategoria =
  | "acceso_usuarios"
  | "punto_de_venta"
  | "ventas"
  | "productos_inventario"
  | "compras_proveedores"
  | "caja_cierres"
  | "facturacion"
  | "suscripciones_pagos"
  | "configuracion"
  | "pedidos_delivery"
  | "aplicacion_movil"
  | "problemas_tecnicos"
  | "solicitudes_mejora"
  | "otros";

export const SOPORTE_CATEGORIAS: { id: TicketCategoria; label: string }[] = [
  { id: "acceso_usuarios", label: "Acceso y usuarios" },
  { id: "punto_de_venta", label: "Punto de venta" },
  { id: "ventas", label: "Ventas" },
  { id: "productos_inventario", label: "Productos e inventario" },
  { id: "compras_proveedores", label: "Compras y proveedores" },
  { id: "caja_cierres", label: "Caja y cierres" },
  { id: "facturacion", label: "Facturación" },
  { id: "suscripciones_pagos", label: "Suscripciones y pagos" },
  { id: "configuracion", label: "Configuración" },
  { id: "pedidos_delivery", label: "Pedidos y delivery" },
  { id: "aplicacion_movil", label: "Aplicación móvil" },
  { id: "problemas_tecnicos", label: "Problemas técnicos" },
  { id: "solicitudes_mejora", label: "Solicitudes de mejora" },
  { id: "otros", label: "Otros" },
];

export const SOPORTE_ESTADOS: { id: TicketEstado; label: string }[] = [
  { id: "nuevo", label: "Nuevo" },
  { id: "abierto", label: "Abierto" },
  { id: "esperando_tienda", label: "Esperando respuesta de la tienda" },
  { id: "en_resolucion", label: "En resolución" },
  { id: "resuelto", label: "Resuelto" },
  { id: "cerrado", label: "Cerrado" },
];

export const SOPORTE_PRIORIDADES: { id: TicketPrioridad; label: string }[] = [
  { id: "baja", label: "Baja" },
  { id: "normal", label: "Normal" },
  { id: "alta", label: "Alta" },
  { id: "urgente", label: "Urgente" },
];

export interface SoporteConfig {
  sla_urgente_horas: number;
  sla_alta_horas: number;
  sla_normal_horas: number;
  sla_baja_horas: number;
  horario_inicio: string; // "09:00"
  horario_fin: string; // "18:00"
  dias_habiles: number[]; // [1,2,3,4,5] (Lunes a Viernes)
  timezone: string;
  dias_reapertura: number;
  notificaciones_activas: boolean;
  email_soporte: string;
}

export const DEFAULT_SOPORTE_CONFIG: SoporteConfig = {
  sla_urgente_horas: 1,
  sla_alta_horas: 4,
  sla_normal_horas: 8,
  sla_baja_horas: 24,
  horario_inicio: "09:00",
  horario_fin: "18:00",
  dias_habiles: [1, 2, 3, 4, 5],
  timezone: "America/Santiago",
  dias_reapertura: 7,
  notificaciones_activas: true,
  email_soporte: "notificaciones@operixerp.cloud",
};

export interface TicketAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  storagePath?: string | null;
  signedUrl?: string | null;
  dataUrl?: string | null;
  uploadedAt: string;
}

export interface SoporteMensajeRecord {
  id: string;
  ticket_id: string;
  negocio_id: string;
  autor_id: string;
  autor_nombre: string;
  autor_rol: "comercio" | "soporte";
  mensaje: string;
  es_nota_interna: boolean;
  adjuntos: TicketAttachment[];
  created_at: string;
}

export interface SoporteTicketRecord {
  id: string;
  numero: number;
  codigo: string;
  negocio_id: string;
  negocio_nombre?: string;
  negocio_slug?: string;
  solicitante_id: string;
  solicitante_nombre: string;
  solicitante_email: string | null;
  categoria: TicketCategoria;
  asunto: string;
  descripcion: string;
  prioridad: TicketPrioridad;
  estado: TicketEstado;
  responsable_id: string | null;
  responsable_nombre: string | null;
  adjuntos: TicketAttachment[];
  primera_respuesta_at: string | null;
  resuelto_at: string | null;
  cerrado_at: string | null;
  reabierto_at: string | null;
  sla_objetivo_minutos: number;
  tiempo_primera_respuesta_min: number | null;
  tiempo_primera_respuesta_habil_min: number | null;
  tiempo_resolucion_min: number | null;
  tiempo_resolucion_habil_min: number | null;
  sla_incumplido: boolean;
  calificacion: number | null;
  comentario_evaluacion: string | null;
  evaluado_at: string | null;
  created_at: string;
  updated_at: string;
}

export function getCategoriaLabel(cat: string): string {
  return SOPORTE_CATEGORIAS.find((c) => c.id === cat)?.label || cat;
}

export function getEstadoLabel(est: string): string {
  return SOPORTE_ESTADOS.find((e) => e.id === est)?.label || est;
}

export function getPrioridadLabel(prio: string): string {
  return SOPORTE_PRIORIDADES.find((p) => p.id === prio)?.label || prio;
}

export function getSlaTargetMinutes(prioridad: TicketPrioridad, config: SoporteConfig): number {
  const hours =
    prioridad === "urgente"
      ? config.sla_urgente_horas
      : prioridad === "alta"
      ? config.sla_alta_horas
      : prioridad === "normal"
      ? config.sla_normal_horas
      : config.sla_baja_horas;
  return Math.max(15, Math.round(Number(hours || 8) * 60));
}

function parseHHMMToMinutes(hhmm: string): number {
  const parts = (hhmm || "09:00").split(":");
  const h = Number(parts[0]) || 0;
  const m = Number(parts[1]) || 0;
  return h * 60 + m;
}

/**
 * Calcula tanto los minutos calendario como los minutos hábiles reales transcurridos entre dos fechas,
 * respetando los días hábiles configurados (ej. Lunes a Viernes) y la ventana horaria (ej. 09:00 a 18:00).
 */
export function calculateElapsedMinutes(
  startIso: string,
  endIso: string,
  config: SoporteConfig
): { calendarMinutes: number; businessMinutes: number } {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return { calendarMinutes: 0, businessMinutes: 0 };
  }

  const calendarMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));
  const workStartMin = parseHHMMToMinutes(config.horario_inicio);
  const workEndMin = parseHHMMToMinutes(config.horario_fin);

  if (workEndMin <= workStartMin) {
    return { calendarMinutes, businessMinutes: calendarMinutes };
  }

  const validDays = new Set(config.dias_habiles || [1, 2, 3, 4, 5]);
  let businessMinutes = 0;

  // Iterar día por día entre start y end
  const cursor = new Date(startMs);
  cursor.setHours(0, 0, 0, 0);
  const endLimit = new Date(endMs);

  let guard = 0;
  while (cursor.getTime() <= endLimit.getTime() && guard < 366) {
    guard++;
    const jsDay = cursor.getDay(); // 0=Dom .. 6=Sab
    const isoDay = jsDay === 0 ? 7 : jsDay; // 1=Lun .. 7=Dom

    if (validDays.has(isoDay)) {
      const dayWorkStart = new Date(cursor.getTime());
      dayWorkStart.setHours(Math.floor(workStartMin / 60), workStartMin % 60, 0, 0);

      const dayWorkEnd = new Date(cursor.getTime());
      dayWorkEnd.setHours(Math.floor(workEndMin / 60), workEndMin % 60, 0, 0);

      const effectiveStart = Math.max(startMs, dayWorkStart.getTime());
      const effectiveEnd = Math.min(endMs, dayWorkEnd.getTime());

      if (effectiveEnd > effectiveStart) {
        businessMinutes += Math.round((effectiveEnd - effectiveStart) / 60000);
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    calendarMinutes,
    businessMinutes: Math.max(0, businessMinutes),
  };
}

/**
 * Evalúa el estado de SLA en vivo para un ticket (incluso si aún no ha recibido primera respuesta).
 */
export function evaluateTicketLiveSla(
  ticket: SoporteTicketRecord,
  config: SoporteConfig
): {
  targetMinutes: number;
  elapsedBusinessMinutes: number;
  elapsedCalendarMinutes: number;
  breached: boolean;
  atRisk: boolean;
} {
  const targetMinutes =
    ticket.sla_objetivo_minutos || getSlaTargetMinutes(ticket.prioridad, config);

  const endRefIso = ticket.primera_respuesta_at || new Date().toISOString();
  const elapsed = calculateElapsedMinutes(ticket.created_at, endRefIso, config);

  const businessMins =
    ticket.tiempo_primera_respuesta_habil_min ?? elapsed.businessMinutes;
  const calendarMins =
    ticket.tiempo_primera_respuesta_min ?? elapsed.calendarMinutes;

  const breached = Boolean(ticket.sla_incumplido || businessMins > targetMinutes);
  const atRisk = !breached && !ticket.primera_respuesta_at && businessMins >= targetMinutes * 0.75;

  return {
    targetMinutes,
    elapsedBusinessMinutes: businessMins,
    elapsedCalendarMinutes: calendarMins,
    breached,
    atRisk,
  };
}

/**
 * Carga la configuración global de SLA y horarios de soporte.
 */
export async function loadSoporteConfig(
  supabase: SupabaseClient<Database>
): Promise<SoporteConfig> {
  try {
    const { data, error } = await supabase
      .from("soporte_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (!error && data) {
      return {
        sla_urgente_horas: Number(data.sla_urgente_horas ?? 1),
        sla_alta_horas: Number(data.sla_alta_horas ?? 4),
        sla_normal_horas: Number(data.sla_normal_horas ?? 8),
        sla_baja_horas: Number(data.sla_baja_horas ?? 24),
        horario_inicio: String(data.horario_inicio || "09:00").slice(0, 5),
        horario_fin: String(data.horario_fin || "18:00").slice(0, 5),
        dias_habiles: Array.isArray(data.dias_habiles) ? data.dias_habiles : [1, 2, 3, 4, 5],
        timezone: data.timezone || "America/Santiago",
        dias_reapertura: Number(data.dias_reapertura ?? 7),
        notificaciones_activas: Boolean(data.notificaciones_activas ?? true),
        email_soporte: data.email_soporte || "notificaciones@operixerp.cloud",
      };
    }
  } catch {}

  return DEFAULT_SOPORTE_CONFIG;
}

/**
 * Sube un archivo adjunto en Base64 al bucket privado `soporte-adjuntos` y retorna su metadata.
 */
export async function uploadPrivateSupportAttachment(params: {
  supabase: SupabaseClient<Database>;
  negocioId: string;
  fileName: string;
  mimeType: string;
  base64Data: string;
}): Promise<TicketAttachment> {
  const { supabase, negocioId, fileName, mimeType, base64Data } = params;
  const cleanBase64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
  const buffer = Buffer.from(cleanBase64, "base64");

  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const storagePath = `${negocioId}/${id}_${safeFileName}`;

  try {
    const { error } = await supabase.storage
      .from("soporte-adjuntos")
      .upload(storagePath, buffer, {
        contentType: mimeType || "application/octet-stream",
        upsert: false,
      });

    if (!error) {
      return {
        id,
        name: fileName,
        mimeType: mimeType || "application/octet-stream",
        size: buffer.byteLength,
        storagePath,
        uploadedAt: new Date().toISOString(),
      };
    }
  } catch {}

  // Si el bucket aún no fue creado en producción, conservar DataURL segura acotada
  return {
    id,
    name: fileName,
    mimeType: mimeType || "application/octet-stream",
    size: buffer.byteLength,
    storagePath: null,
    dataUrl: `data:${mimeType || "application/octet-stream"};base64,${cleanBase64}`,
    uploadedAt: new Date().toISOString(),
  };
}

/**
 * Genera URLs firmadas temporales (1 hora) para los archivos adjuntos almacenados en el bucket privado.
 */
export async function hydrateSignedAttachmentUrls(
  supabase: SupabaseClient<Database>,
  attachments: TicketAttachment[] | null | undefined
): Promise<TicketAttachment[]> {
  if (!Array.isArray(attachments) || attachments.length === 0) return [];
  const admin = getServiceSupabase() || supabase;

  return Promise.all(
    attachments.map(async (att) => {
      if (att.storagePath) {
        try {
          const { data } = await admin.storage
            .from("soporte-adjuntos")
            .createSignedUrl(att.storagePath, 3600);
          if (data?.signedUrl) {
            return { ...att, signedUrl: data.signedUrl };
          }
        } catch {}
      }
      return { ...att, signedUrl: att.dataUrl || null };
    })
  );
}

/**
 * Envía notificaciones transaccionales de soporte vía Resend (creación, asignación, respuesta,
 * solicitud de información, cambio de estado, resolución y cierre) respetando preferencias de baja.
 */
export async function sendSupportTicketNotification(params: {
  supabase: SupabaseClient<Database>;
  config: SoporteConfig;
  ticket: SoporteTicketRecord;
  event:
    | "ticket_creado"
    | "responsable_asignado"
    | "respuesta_soporte"
    | "info_adicional_solicitada"
    | "cambio_estado"
    | "ticket_resuelto"
    | "ticket_cerrado"
    | "respuesta_comercio";
  recipientEmail: string | null;
  messagePreview?: string;
  isToSupportTeam?: boolean;
}): Promise<void> {
  const {
    supabase,
    config,
    ticket,
    event,
    recipientEmail,
    messagePreview,
    isToSupportTeam,
  } = params;

  if (!config.notificaciones_activas || !recipientEmail) return;
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return;

  const emailLower = recipientEmail.trim().toLowerCase();

  // Verificar si el destinatario está en suppressed_emails
  try {
    const { data: sup } = await supabase
      .from("suppressed_emails")
      .select("id")
      .eq("email", emailLower)
      .maybeSingle();
    if (sup) return;
  } catch {}

  const directUrl = isToSupportTeam
    ? `https://operixerp.cloud/super-admin?mod=soporte&ticket=${encodeURIComponent(ticket.id)}`
    : `https://operixerp.cloud/soporte?ticket=${encodeURIComponent(ticket.id)}`;

  const eventTitles: Record<typeof event, { subject: string; heading: string; badge: string }> = {
    ticket_creado: {
      subject: `[${ticket.codigo}] Solicitud de soporte recibida: ${ticket.asunto}`,
      heading: "Hemos recibido tu solicitud de soporte",
      badge: "NUEVO TICKET",
    },
    responsable_asignado: {
      subject: `[${ticket.codigo}] Un especialista ha tomado tu caso: ${ticket.asunto}`,
      heading: `${ticket.responsable_nombre || "Un especialista de Operix"} está atendiendo tu caso`,
      badge: "ASIGNADO",
    },
    respuesta_soporte: {
      subject: `[${ticket.codigo}] Nueva respuesta de Soporte Operix: ${ticket.asunto}`,
      heading: "Tienes una nueva respuesta del equipo de Soporte",
      badge: "NUEVA RESPUESTA",
    },
    info_adicional_solicitada: {
      subject: `[${ticket.codigo}] Necesitamos información adicional sobre tu caso`,
      heading: "Esperando tu respuesta para continuar con la solución",
      badge: "ACCIÓN REQUERIDA",
    },
    cambio_estado: {
      subject: `[${ticket.codigo}] Estado actualizado a "${getEstadoLabel(ticket.estado)}"`,
      heading: `El estado de tu solicitud cambió a: ${getEstadoLabel(ticket.estado)}`,
      badge: getEstadoLabel(ticket.estado).toUpperCase(),
    },
    ticket_resuelto: {
      subject: `[${ticket.codigo}] Tu solicitud ha sido marcada como Resuelta`,
      heading: "¡Hemos resuelto tu solicitud! Cuéntanos cómo fue tu experiencia",
      badge: "RESUELTO",
    },
    ticket_cerrado: {
      subject: `[${ticket.codigo}] Caso de soporte cerrado`,
      heading: "Tu caso de soporte ha sido cerrado",
      badge: "CERRADO",
    },
    respuesta_comercio: {
      subject: `[${ticket.codigo}] Respuesta del comercio ${ticket.negocio_nombre || ""}: ${ticket.asunto}`,
      heading: `Nuevo mensaje del comercio en ${ticket.codigo}`,
      badge: "RESPUESTA TIENDA",
    },
  };

  const info = eventTitles[event];

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${info.subject}</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a;">
  <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden;">
    <div style="background: #0f172a; padding: 22px 28px; color: #ffffff;">
      <span style="display: inline-block; background: #2563eb; color: #ffffff; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 6px; letter-spacing: 0.5px;">
        CENTRO DE SOPORTE · OPERIX ERP
      </span>
      <span style="display: inline-block; margin-left: 8px; background: rgba(255,255,255,0.15); color: #e2e8f0; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 6px;">
        ${ticket.codigo} · ${info.badge}
      </span>
      <h2 style="margin: 14px 0 4px 0; font-size: 19px; font-weight: 800;">${info.heading}</h2>
      <p style="margin: 0; font-size: 13px; color: #94a3b8;">
        Comercio: ${ticket.negocio_nombre || "Operix Cloud"} · Categoría: ${getCategoriaLabel(ticket.categoria)}
      </p>
    </div>

    <div style="padding: 26px 28px;">
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 18px;">
        <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Asunto del caso:</div>
        <div style="font-size: 15px; font-weight: 700; color: #0f172a;">${ticket.asunto}</div>
        <div style="font-size: 12px; color: #475569; margin-top: 8px;">
          Estado: <strong>${getEstadoLabel(ticket.estado)}</strong> · Prioridad: <strong>${getPrioridadLabel(ticket.prioridad)}</strong>
          ${ticket.responsable_nombre ? ` · Atendido por: <strong>${ticket.responsable_nombre}</strong>` : ""}
        </div>
      </div>

      ${
        messagePreview
          ? `<div style="border-left: 3px solid #2563eb; padding-left: 14px; margin: 18px 0; font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-line;">${messagePreview}</div>`
          : ""
      }

      ${
        event === "ticket_resuelto"
          ? `<p style="font-size: 13.5px; color: #334155; line-height: 1.6;">
              Tu opinión es muy importante para nosotros. Ingresa al enlace de abajo para calificar la atención recibida de 1 a 5 estrellas, o reabrir el caso si aún necesitas ayuda.
            </p>`
          : ""
      }

      <div style="text-align: center; margin: 26px 0 12px 0;">
        <a href="${directUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 26px; border-radius: 8px;">
          Ver Ticket ${ticket.codigo} en Operix ERP →
        </a>
      </div>
    </div>

    <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 28px; text-align: center; font-size: 11.5px; color: #64748b;">
      Comercial Hels / Operix ERP · Centro de Soporte y Atención a Tiendas (operixerp.cloud)
    </div>
  </div>
</body>
</html>`;

  const idempotencyKey = `operix-support-${ticket.id}-${event}-${Date.now()}`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from: `Soporte Operix ERP <${config.email_soporte || "notificaciones@operixerp.cloud"}>`,
        to: [emailLower],
        subject: info.subject,
        html,
        text: `${info.heading}\nTicket: ${ticket.codigo} - ${ticket.asunto}\nEstado: ${getEstadoLabel(
          ticket.estado
        )}\n${messagePreview ? `\nMensaje:\n${messagePreview}\n` : ""}\nVer caso en: ${directUrl}`,
      }),
    });

    const data = await res.json().catch(() => ({}));
    await supabase.from("email_send_log").insert({
      recipient_email: emailLower,
      template_name: `soporte_${event}`,
      status: res.ok ? "sent" : "failed",
      message_id: data?.id || null,
      error_message: res.ok ? null : data?.message || "Resend error",
      metadata: {
        ticket_id: ticket.id,
        codigo: ticket.codigo,
        negocio_id: ticket.negocio_id,
        event,
      } as Json,
    });
  } catch {}
}
