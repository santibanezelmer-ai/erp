import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database.types";
import { getServiceSupabase } from "@/lib/recuperacion.server";
import {
  calculateElapsedMinutes,
  evaluateTicketLiveSla,
  getSlaTargetMinutes,
  hydrateSignedAttachmentUrls,
  loadSoporteConfig,
  sendSupportTicketNotification,
  SoporteConfig,
  SoporteMensajeRecord,
  SoporteTicketRecord,
  TicketAttachment,
  TicketCategoria,
  TicketEstado,
  TicketPrioridad,
  uploadPrivateSupportAttachment,
} from "@/lib/soporte.server";

async function verifySuperAdmin() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, user: null, client: null };

  const [{ data: superRole }, { data: isSaRpc }, { data: prof }] = await Promise.all([
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle(),
    supabase.rpc("is_super_admin", { _uid: user.id }),
    supabase.from("profiles").select("nombre, email").eq("id", user.id).maybeSingle(),
  ]);

  const isSuper =
    Boolean(superRole) ||
    Boolean(isSaRpc) ||
    user.email?.toLowerCase() === "santibanez.elmer@gmail.com";

  if (!isSuper) return { ok: false as const, user, client: null };

  return {
    ok: true as const,
    user,
    adminName: prof?.nombre || user.email || "Soporte Operix",
    client: getServiceSupabase() || supabase,
  };
}

function mapTicketRow(
  row: Database["public"]["Tables"]["soporte_tickets"]["Row"],
  negocioNombre?: string,
  negocioSlug?: string
): SoporteTicketRecord {
  return {
    id: row.id,
    numero: Number(row.numero),
    codigo: row.codigo || `TK-${String(row.numero).padStart(5, "0")}`,
    negocio_id: row.negocio_id,
    negocio_nombre: negocioNombre,
    negocio_slug: negocioSlug,
    solicitante_id: row.solicitante_id,
    solicitante_nombre: row.solicitante_nombre,
    solicitante_email: row.solicitante_email,
    categoria: row.categoria as TicketCategoria,
    asunto: row.asunto,
    descripcion: row.descripcion,
    prioridad: row.prioridad as TicketPrioridad,
    estado: row.estado as TicketEstado,
    responsable_id: row.responsable_id,
    responsable_nombre: row.responsable_nombre,
    adjuntos: Array.isArray(row.adjuntos)
      ? (row.adjuntos as unknown as TicketAttachment[])
      : [],
    primera_respuesta_at: row.primera_respuesta_at,
    resuelto_at: row.resuelto_at,
    cerrado_at: row.cerrado_at,
    reabierto_at: row.reabierto_at,
    sla_objetivo_minutos: row.sla_objetivo_minutos,
    tiempo_primera_respuesta_min: row.tiempo_primera_respuesta_min,
    tiempo_primera_respuesta_habil_min: row.tiempo_primera_respuesta_habil_min,
    tiempo_resolucion_min: row.tiempo_resolucion_min,
    tiempo_resolucion_habil_min: row.tiempo_resolucion_habil_min,
    sla_incumplido: row.sla_incumplido,
    calificacion: row.calificacion,
    comentario_evaluacion: row.comentario_evaluacion,
    evaluado_at: row.evaluado_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * GET /api/super-admin/soporte
 * - Si incluye `?ticketId=...`, devuelve el ticket completo con TODOS los mensajes
 *   (tanto mensajes públicos como notas internas `es_nota_interna = true`) y URLs firmadas.
 * - Si no incluye `ticketId`, devuelve la bandeja global de tickets, los 11 indicadores ejecutivos,
 *   alertas de SLA, agentes disponibles y configuración actual de SLA.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await verifySuperAdmin();
    if (!auth.ok || !auth.client) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const db = auth.client;
    const config = await loadSoporteConfig(db);
    const ticketId = req.nextUrl.searchParams.get("ticketId");

    const { data: negociosRows } = await db
      .from("negocios")
      .select("id, nombre, slug");
    const negocioMap: Record<string, { nombre: string; slug: string }> = {};
    for (const n of negociosRows || []) {
      negocioMap[n.id] = { nombre: n.nombre, slug: n.slug };
    }

    if (ticketId) {
      const { data: ticketRow } = await db
        .from("soporte_tickets")
        .select("*")
        .eq("id", ticketId)
        .maybeSingle();

      if (!ticketRow) {
        return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
      }

      const { data: msgRows } = await db
        .from("soporte_mensajes")
        .select("*")
        .eq("ticket_id", ticketRow.id)
        .order("created_at", { ascending: true });

      const neg = negocioMap[ticketRow.negocio_id];
      const mappedTicket = mapTicketRow(ticketRow, neg?.nombre, neg?.slug);
      mappedTicket.adjuntos = await hydrateSignedAttachmentUrls(db, mappedTicket.adjuntos);

      const mensajes: SoporteMensajeRecord[] = await Promise.all(
        (msgRows || []).map(async (m) => {
          const rawAtts = Array.isArray(m.adjuntos)
            ? (m.adjuntos as unknown as TicketAttachment[])
            : [];
          return {
            id: m.id,
            ticket_id: m.ticket_id,
            negocio_id: m.negocio_id,
            autor_id: m.autor_id,
            autor_nombre: m.autor_nombre,
            autor_rol: m.autor_rol === "soporte" ? "soporte" : "comercio",
            mensaje: m.mensaje,
            es_nota_interna: Boolean(m.es_nota_interna),
            adjuntos: await hydrateSignedAttachmentUrls(db, rawAtts),
            created_at: m.created_at,
          };
        })
      );

      return NextResponse.json({
        ticket: mappedTicket,
        mensajes,
        liveSla: evaluateTicketLiveSla(mappedTicket, config),
      });
    }

    // Listado global de todos los tickets y agentes de soporte
    const [{ data: ticketRows }, { data: superRoles }] = await Promise.all([
      db.from("soporte_tickets").select("*").order("updated_at", { ascending: false }),
      db
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["super_admin", "admin"]),
    ]);

    const superUserIds = Array.from(
      new Set([
        auth.user.id,
        ...(superRoles || [])
          .filter((r) => r.role === "super_admin")
          .map((r) => r.user_id),
      ])
    );

    const { data: agentProfiles } = await db
      .from("profiles")
      .select("id, nombre, email")
      .in("id", superUserIds);

    const agents = (agentProfiles || []).map((a) => ({
      id: a.id,
      nombre: a.nombre || a.email || "Soporte Operix",
      email: a.email,
    }));

    const tickets = (ticketRows || []).map((r) => {
      const neg = negocioMap[r.negocio_id];
      const mapped = mapTicketRow(r, neg?.nombre, neg?.slug);
      const sla = evaluateTicketLiveSla(mapped, config);
      return {
        ...mapped,
        sla_incumplido: sla.breached,
        tiempo_primera_respuesta_habil_min:
          mapped.tiempo_primera_respuesta_habil_min ?? sla.elapsedBusinessMinutes,
      };
    });

    // 11 Indicadores ejecutivos del Panel de Soporte Super Admin
    const totalTickets = tickets.length;
    const ticketsNuevos = tickets.filter((t) => t.estado === "nuevo").length;
    const ticketsAbiertos = tickets.filter((t) => t.estado === "abierto").length;
    const ticketsUrgentes = tickets.filter(
      (t) => t.prioridad === "urgente" && t.estado !== "resuelto" && t.estado !== "cerrado"
    ).length;
    const ticketsEsperandoRespuesta = tickets.filter(
      (t) => t.estado === "esperando_tienda"
    ).length;
    const ticketsEnResolucion = tickets.filter((t) => t.estado === "en_resolucion").length;
    const ticketsResueltos = tickets.filter((t) => t.estado === "resuelto").length;
    const ticketsCerrados = tickets.filter((t) => t.estado === "cerrado").length;
    const ticketsSlaIncumplido = tickets.filter((t) => t.sla_incumplido).length;

    const firstResponseSample = tickets.filter(
      (t) =>
        t.primera_respuesta_at !== null &&
        typeof t.tiempo_primera_respuesta_habil_min === "number"
    );
    const avgFirstResponseBusinessMin =
      firstResponseSample.length > 0
        ? Math.round(
            firstResponseSample.reduce(
              (acc, t) => acc + (t.tiempo_primera_respuesta_habil_min || 0),
              0
            ) / firstResponseSample.length
          )
        : 0;

    const resolutionSample = tickets.filter(
      (t) =>
        t.resuelto_at !== null && typeof t.tiempo_resolucion_habil_min === "number"
    );
    const avgResolutionBusinessMin =
      resolutionSample.length > 0
        ? Math.round(
            resolutionSample.reduce(
              (acc, t) => acc + (t.tiempo_resolucion_habil_min || 0),
              0
            ) / resolutionSample.length
          )
        : 0;

    const ratedTickets = tickets.filter(
      (t) => typeof t.calificacion === "number" && t.calificacion >= 1
    );
    const avgSatisfaction =
      ratedTickets.length > 0
        ? Math.round(
            (ratedTickets.reduce((acc, t) => acc + (t.calificacion || 0), 0) /
              ratedTickets.length) *
              10
          ) / 10
        : null;

    return NextResponse.json({
      currentUserId: auth.user.id,
      currentAdminName: auth.adminName,
      config,
      agents,
      metrics: {
        totalTickets,
        ticketsNuevos,
        ticketsAbiertos,
        ticketsUrgentes,
        ticketsEsperandoRespuesta,
        ticketsEnResolucion,
        ticketsResueltos,
        ticketsCerrados,
        ticketsSlaIncumplido,
        avgFirstResponseBusinessMin,
        avgResolutionBusinessMin,
        avgSatisfaction,
        ratedCount: ratedTickets.length,
      },
      tickets,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error al cargar Centro de Soporte" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/super-admin/soporte
 * Acciones de gestión para Super Admin:
 * - reply_ticket: Responder al comercio (público) o agregar una nota interna (`esNotaInterna = true`)
 * - update_ticket_meta: Cambiar estado, prioridad o responsable asignado
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifySuperAdmin();
    if (!auth.ok || !auth.client) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const db = auth.client;
    const config = await loadSoporteConfig(db);
    const body = await req.json();
    const action = body?.action as "reply_ticket" | "update_ticket_meta";

    const ticketId = String(body?.ticketId || "");
    if (!ticketId) {
      return NextResponse.json({ error: "ticketId requerido" }, { status: 400 });
    }

    const { data: ticketRow } = await db
      .from("soporte_tickets")
      .select("*")
      .eq("id", ticketId)
      .maybeSingle();

    if (!ticketRow) {
      return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
    }

    const { data: neg } = await db
      .from("negocios")
      .select("id, nombre, slug")
      .eq("id", ticketRow.negocio_id)
      .maybeSingle();

    const nowIso = new Date().toISOString();

    // 1. RESPONDER TICKET O AGREGAR NOTA INTERNA
    if (action === "reply_ticket") {
      const mensaje = String(body?.mensaje || "").trim();
      const esNotaInterna = Boolean(body?.esNotaInterna);
      const nuevoEstado = body?.nuevoEstado as TicketEstado | undefined;
      const rawFiles = Array.isArray(body?.attachments) ? body.attachments : [];

      if (!mensaje) {
        return NextResponse.json(
          { error: "Escribe un mensaje o nota interna" },
          { status: 400 }
        );
      }

      const uploadedAttachments: TicketAttachment[] = [];
      for (const f of rawFiles.slice(0, 5)) {
        if (f?.name && f?.base64Data) {
          const att = await uploadPrivateSupportAttachment({
            supabase: db,
            negocioId: ticketRow.negocio_id,
            fileName: String(f.name),
            mimeType: String(f.mimeType || "application/octet-stream"),
            base64Data: String(f.base64Data),
          });
          uploadedAttachments.push(att);
        }
      }

      await db.from("soporte_mensajes").insert({
        ticket_id: ticketRow.id,
        negocio_id: ticketRow.negocio_id,
        autor_id: auth.user.id,
        autor_nombre: auth.adminName,
        autor_rol: "soporte",
        mensaje,
        es_nota_interna: esNotaInterna,
        adjuntos: uploadedAttachments as unknown as Json,
      });

      const updateFields: Database["public"]["Tables"]["soporte_tickets"]["Update"] = {
        updated_at: nowIso,
      };

      // Si no tenía responsable asignado, auto-asignar al especialista que responde
      if (!ticketRow.responsable_id) {
        updateFields.responsable_id = auth.user.id;
        updateFields.responsable_nombre = auth.adminName;
      }

      // Si es mensaje PÚBLICO (no nota interna) y aún no tenía primera_respuesta_at, calcular SLA
      if (!esNotaInterna && !ticketRow.primera_respuesta_at) {
        const elapsed = calculateElapsedMinutes(ticketRow.created_at, nowIso, config);
        const targetMins =
          ticketRow.sla_objetivo_minutos ||
          getSlaTargetMinutes(ticketRow.prioridad as TicketPrioridad, config);
        updateFields.primera_respuesta_at = nowIso;
        updateFields.tiempo_primera_respuesta_min = elapsed.calendarMinutes;
        updateFields.tiempo_primera_respuesta_habil_min = elapsed.businessMinutes;
        updateFields.sla_incumplido = elapsed.businessMinutes > targetMins;
      }

      if (nuevoEstado) {
        updateFields.estado = nuevoEstado;
        if (nuevoEstado === "resuelto" && !ticketRow.resuelto_at) {
          const resElapsed = calculateElapsedMinutes(ticketRow.created_at, nowIso, config);
          updateFields.resuelto_at = nowIso;
          updateFields.tiempo_resolucion_min = resElapsed.calendarMinutes;
          updateFields.tiempo_resolucion_habil_min = resElapsed.businessMinutes;
        } else if (nuevoEstado === "cerrado" && !ticketRow.cerrado_at) {
          updateFields.cerrado_at = nowIso;
        }
      } else if (!esNotaInterna && ticketRow.estado === "nuevo") {
        updateFields.estado = "abierto";
      }

      const { data: updatedRow } = await db
        .from("soporte_tickets")
        .update(updateFields)
        .eq("id", ticketRow.id)
        .select("*")
        .single();

      const mapped = mapTicketRow(updatedRow || ticketRow, neg?.nombre, neg?.slug);

      // Si NO es nota interna, notificar por correo al comercio vía Resend
      if (!esNotaInterna) {
        const notifEvent =
          mapped.estado === "resuelto"
            ? "ticket_resuelto"
            : mapped.estado === "cerrado"
            ? "ticket_cerrado"
            : mapped.estado === "esperando_tienda"
            ? "info_adicional_solicitada"
            : "respuesta_soporte";

        await sendSupportTicketNotification({
          supabase: db,
          config,
          ticket: mapped,
          event: notifEvent,
          recipientEmail: mapped.solicitante_email,
          messagePreview: mensaje,
        });
      }

      return NextResponse.json({ ok: true, ticket: mapped });
    }

    // 2. ACTUALIZAR ESTADO, PRIORIDAD O RESPONSABLE ASIGNADO
    if (action === "update_ticket_meta") {
      const nextEstado = (body?.estado || ticketRow.estado) as TicketEstado;
      const nextPrioridad = (body?.prioridad || ticketRow.prioridad) as TicketPrioridad;
      const nextResponsableId =
        typeof body?.responsableId !== "undefined"
          ? body.responsableId || null
          : ticketRow.responsable_id;
      const nextResponsableNombre =
        typeof body?.responsableNombre !== "undefined"
          ? body.responsableNombre || null
          : ticketRow.responsable_nombre;

      const slaTargetMin = getSlaTargetMinutes(nextPrioridad, config);

      const updateFields: Database["public"]["Tables"]["soporte_tickets"]["Update"] = {
        estado: nextEstado,
        prioridad: nextPrioridad,
        responsable_id: nextResponsableId,
        responsable_nombre: nextResponsableNombre,
        sla_objetivo_minutos: slaTargetMin,
        updated_at: nowIso,
      };

      if (nextEstado === "resuelto" && !ticketRow.resuelto_at) {
        const resElapsed = calculateElapsedMinutes(ticketRow.created_at, nowIso, config);
        updateFields.resuelto_at = nowIso;
        updateFields.tiempo_resolucion_min = resElapsed.calendarMinutes;
        updateFields.tiempo_resolucion_habil_min = resElapsed.businessMinutes;
      }

      if (nextEstado === "cerrado" && !ticketRow.cerrado_at) {
        updateFields.cerrado_at = nowIso;
      }

      const { data: updatedRow, error: uErr } = await db
        .from("soporte_tickets")
        .update(updateFields)
        .eq("id", ticketRow.id)
        .select("*")
        .single();

      if (uErr) {
        return NextResponse.json({ error: uErr.message }, { status: 400 });
      }

      const mapped = mapTicketRow(updatedRow || ticketRow, neg?.nombre, neg?.slug);

      // Registrar en audit_logs
      try {
        await db.from("audit_logs").insert({
          negocio_id: ticketRow.negocio_id,
          usuario_id: auth.user.id,
          action: "soporte_ticket_actualizado",
          entity_type: "soporte_tickets",
          entity_id: ticketRow.id,
          after_data: {
            codigo: mapped.codigo,
            estado: nextEstado,
            prioridad: nextPrioridad,
            responsable: nextResponsableNombre,
          } as Json,
        });
      } catch {}

      // Enviar notificaciones según el cambio realizado
      if (nextEstado !== ticketRow.estado) {
        const eventType =
          nextEstado === "resuelto"
            ? "ticket_resuelto"
            : nextEstado === "cerrado"
            ? "ticket_cerrado"
            : nextEstado === "esperando_tienda"
            ? "info_adicional_solicitada"
            : "cambio_estado";

        await sendSupportTicketNotification({
          supabase: db,
          config,
          ticket: mapped,
          event: eventType,
          recipientEmail: mapped.solicitante_email,
        });
      } else if (
        nextResponsableId &&
        nextResponsableId !== ticketRow.responsable_id
      ) {
        await sendSupportTicketNotification({
          supabase: db,
          config,
          ticket: mapped,
          event: "responsable_asignado",
          recipientEmail: mapped.solicitante_email,
        });
      }

      return NextResponse.json({ ok: true, ticket: mapped });
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error al actualizar ticket" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/super-admin/soporte
 * Guarda la configuración de SLA (Urgente 1h, Alta 4h, Normal 8h, Baja 24h), horarios hábiles,
 * días de reapertura y notificaciones de soporte.
 */
export async function PUT(req: NextRequest) {
  try {
    const auth = await verifySuperAdmin();
    if (!auth.ok || !auth.client) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const nextCfg: SoporteConfig = {
      sla_urgente_horas: Math.max(0.25, Number(body.sla_urgente_horas) || 1),
      sla_alta_horas: Math.max(0.5, Number(body.sla_alta_horas) || 4),
      sla_normal_horas: Math.max(1, Number(body.sla_normal_horas) || 8),
      sla_baja_horas: Math.max(1, Number(body.sla_baja_horas) || 24),
      horario_inicio: String(body.horario_inicio || "09:00").slice(0, 5),
      horario_fin: String(body.horario_fin || "18:00").slice(0, 5),
      dias_habiles: Array.isArray(body.dias_habiles) ? body.dias_habiles : [1, 2, 3, 4, 5],
      timezone: String(body.timezone || "America/Santiago"),
      dias_reapertura: Math.max(0, Math.min(90, Number(body.dias_reapertura ?? 7))),
      notificaciones_activas: Boolean(body.notificaciones_activas ?? true),
      email_soporte: String(
        body.email_soporte || "notificaciones@operixerp.cloud"
      ).trim(),
    };

    const upsertRow: Database["public"]["Tables"]["soporte_config"]["Insert"] = {
      id: 1,
      ...nextCfg,
      updated_at: new Date().toISOString(),
      updated_by: auth.user.id,
    };

    const { error } = await auth.client
      .from("soporte_config")
      .upsert(upsertRow, { onConflict: "id" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, config: nextCfg });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error al guardar configuración de SLA" },
      { status: 500 }
    );
  }
}
