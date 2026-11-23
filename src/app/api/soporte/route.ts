import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database.types";
import { getServiceSupabase } from "@/lib/recuperacion.server";
import {
  calculateElapsedMinutes,
  getSlaTargetMinutes,
  hydrateSignedAttachmentUrls,
  loadSoporteConfig,
  sendSupportTicketNotification,
  SOPORTE_CATEGORIAS,
  SoporteMensajeRecord,
  SoporteTicketRecord,
  TicketAttachment,
  TicketCategoria,
  TicketEstado,
  TicketPrioridad,
  uploadPrivateSupportAttachment,
} from "@/lib/soporte.server";

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
 * GET /api/soporte
 * Lista los tickets del comercio actual. Si se pasa `?ticketId=...`, devuelve además
 * el hilo de conversación público (`es_nota_interna = false`) con URLs firmadas para los adjuntos.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: prof } = await supabase
      .from("profiles")
      .select("id, nombre, email, negocio_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!prof?.negocio_id) {
      return NextResponse.json({ error: "Comercio no encontrado" }, { status: 400 });
    }

    const db = getServiceSupabase() || supabase;
    const config = await loadSoporteConfig(db);
    const ticketId = req.nextUrl.searchParams.get("ticketId");

    // Si solicita detalle de un ticket específico con sus mensajes públicos
    if (ticketId) {
      const { data: ticketRow, error: tErr } = await db
        .from("soporte_tickets")
        .select("*")
        .eq("id", ticketId)
        .eq("negocio_id", prof.negocio_id)
        .maybeSingle();

      if (tErr || !ticketRow) {
        return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
      }

      // ESTRICTAMENTE filtrar es_nota_interna = false para usuarios de tiendas
      const { data: msgRows } = await db
        .from("soporte_mensajes")
        .select("*")
        .eq("ticket_id", ticketRow.id)
        .eq("negocio_id", prof.negocio_id)
        .eq("es_nota_interna", false)
        .order("created_at", { ascending: true });

      const mappedTicket = mapTicketRow(ticketRow);
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
            es_nota_interna: false,
            adjuntos: await hydrateSignedAttachmentUrls(db, rawAtts),
            created_at: m.created_at,
          };
        })
      );

      return NextResponse.json({
        ticket: mappedTicket,
        mensajes,
        config: {
          dias_reapertura: config.dias_reapertura,
          horario_inicio: config.horario_inicio,
          horario_fin: config.horario_fin,
        },
      });
    }

    // Listado de todos los tickets del comercio
    const { data: rows } = await db
      .from("soporte_tickets")
      .select("*")
      .eq("negocio_id", prof.negocio_id)
      .order("updated_at", { ascending: false });

    const tickets = (rows || []).map((r) => mapTicketRow(r));

    return NextResponse.json({
      tickets,
      config: {
        dias_reapertura: config.dias_reapertura,
        horario_inicio: config.horario_inicio,
        horario_fin: config.horario_fin,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error al consultar soporte" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/soporte
 * Acciones disponibles para las tiendas:
 * - create_ticket: Crear nuevo ticket con adjuntos opcionales
 * - send_message: Enviar mensaje en un ticket propio (siempre público)
 * - reopen_ticket: Reabrir un ticket resuelto dentro del plazo configurado (`dias_reapertura`)
 * - rate_ticket: Evaluar la atención recibida (1 a 5 estrellas + comentario opcional)
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: prof } = await supabase
      .from("profiles")
      .select("id, nombre, email, negocio_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!prof?.negocio_id) {
      return NextResponse.json({ error: "No tienes un comercio asignado" }, { status: 400 });
    }

    const db = getServiceSupabase() || supabase;
    const config = await loadSoporteConfig(db);

    const { data: neg } = await db
      .from("negocios")
      .select("id, nombre, slug")
      .eq("id", prof.negocio_id)
      .maybeSingle();

    const body = await req.json();
    const action = body?.action as
      | "create_ticket"
      | "send_message"
      | "reopen_ticket"
      | "rate_ticket";

    // 1. CREAR NUEVO TICKET
    if (action === "create_ticket") {
      const categoria = body?.categoria as TicketCategoria;
      const asunto = String(body?.asunto || "").trim();
      const descripcion = String(body?.descripcion || "").trim();
      const prioridad = (body?.prioridad || "normal") as TicketPrioridad;
      const rawFiles = Array.isArray(body?.attachments) ? body.attachments : [];

      if (!SOPORTE_CATEGORIAS.some((c) => c.id === categoria)) {
        return NextResponse.json({ error: "Selecciona una categoría válida" }, { status: 400 });
      }
      if (asunto.length < 3) {
        return NextResponse.json(
          { error: "El asunto debe tener al menos 3 caracteres" },
          { status: 400 }
        );
      }
      if (descripcion.length < 5) {
        return NextResponse.json(
          { error: "Por favor describe tu solicitud con mayor detalle" },
          { status: 400 }
        );
      }

      const uploadedAttachments: TicketAttachment[] = [];
      for (const f of rawFiles.slice(0, 5)) {
        if (f?.name && f?.base64Data) {
          const att = await uploadPrivateSupportAttachment({
            supabase: db,
            negocioId: prof.negocio_id,
            fileName: String(f.name),
            mimeType: String(f.mimeType || "application/octet-stream"),
            base64Data: String(f.base64Data),
          });
          uploadedAttachments.push(att);
        }
      }

      const slaTargetMin = getSlaTargetMinutes(prioridad, config);

      const insertPayload: Database["public"]["Tables"]["soporte_tickets"]["Insert"] = {
        negocio_id: prof.negocio_id,
        solicitante_id: user.id,
        solicitante_nombre: prof.nombre || user.email || "Usuario",
        solicitante_email: prof.email || user.email || null,
        categoria,
        asunto,
        descripcion,
        prioridad,
        estado: "nuevo",
        adjuntos: uploadedAttachments as unknown as Json,
        sla_objetivo_minutos: slaTargetMin,
      };

      const { data: createdRow, error: cErr } = await db
        .from("soporte_tickets")
        .insert(insertPayload)
        .select("*")
        .single();

      if (cErr || !createdRow) {
        return NextResponse.json(
          { error: cErr?.message || "No se pudo crear el ticket" },
          { status: 400 }
        );
      }

      // Crear el primer mensaje en el hilo de conversación con la descripción inicial
      await db.from("soporte_mensajes").insert({
        ticket_id: createdRow.id,
        negocio_id: prof.negocio_id,
        autor_id: user.id,
        autor_nombre: prof.nombre || user.email || "Usuario",
        autor_rol: "comercio",
        mensaje: descripcion,
        es_nota_interna: false,
        adjuntos: uploadedAttachments as unknown as Json,
      });

      const mapped = mapTicketRow(createdRow, neg?.nombre, neg?.slug);

      // Notificar al comercio y al equipo de soporte vía Resend
      await Promise.all([
        sendSupportTicketNotification({
          supabase: db,
          config,
          ticket: mapped,
          event: "ticket_creado",
          recipientEmail: mapped.solicitante_email,
          messagePreview: descripcion,
        }),
        sendSupportTicketNotification({
          supabase: db,
          config,
          ticket: mapped,
          event: "ticket_creado",
          recipientEmail: config.email_soporte,
          messagePreview: descripcion,
          isToSupportTeam: true,
        }),
      ]);

      return NextResponse.json({ ok: true, ticket: mapped });
    }

    // 2. ENVIAR MENSAJE EN EL HILO DE CONVERSACIÓN
    if (action === "send_message") {
      const ticketId = String(body?.ticketId || "");
      const mensaje = String(body?.mensaje || "").trim();
      const rawFiles = Array.isArray(body?.attachments) ? body.attachments : [];

      if (!ticketId || !mensaje) {
        return NextResponse.json(
          { error: "El mensaje no puede estar vacío" },
          { status: 400 }
        );
      }

      const { data: ticketRow } = await db
        .from("soporte_tickets")
        .select("*")
        .eq("id", ticketId)
        .eq("negocio_id", prof.negocio_id)
        .maybeSingle();

      if (!ticketRow) {
        return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
      }

      if (ticketRow.estado === "cerrado") {
        return NextResponse.json(
          { error: "Este caso se encuentra cerrado. Crea un nuevo ticket si necesitas ayuda." },
          { status: 400 }
        );
      }

      const uploadedAttachments: TicketAttachment[] = [];
      for (const f of rawFiles.slice(0, 5)) {
        if (f?.name && f?.base64Data) {
          const att = await uploadPrivateSupportAttachment({
            supabase: db,
            negocioId: prof.negocio_id,
            fileName: String(f.name),
            mimeType: String(f.mimeType || "application/octet-stream"),
            base64Data: String(f.base64Data),
          });
          uploadedAttachments.push(att);
        }
      }

      await db.from("soporte_mensajes").insert({
        ticket_id: ticketRow.id,
        negocio_id: prof.negocio_id,
        autor_id: user.id,
        autor_nombre: prof.nombre || user.email || "Usuario",
        autor_rol: "comercio",
        mensaje,
        es_nota_interna: false,
        adjuntos: uploadedAttachments as unknown as Json,
      });

      // Si estaba "esperando_tienda", pasarlo automáticamente a "abierto"
      const nextEstado: TicketEstado =
        ticketRow.estado === "esperando_tienda"
          ? "abierto"
          : (ticketRow.estado as TicketEstado);

      const { data: updatedRow } = await db
        .from("soporte_tickets")
        .update({
          estado: nextEstado,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticketRow.id)
        .select("*")
        .single();

      const mapped = mapTicketRow(updatedRow || ticketRow, neg?.nombre, neg?.slug);

      await sendSupportTicketNotification({
        supabase: db,
        config,
        ticket: mapped,
        event: "respuesta_comercio",
        recipientEmail: config.email_soporte,
        messagePreview: mensaje,
        isToSupportTeam: true,
      });

      return NextResponse.json({ ok: true, ticket: mapped });
    }

    // 3. REABRIR TICKET RESUELTO DENTRO DEL PERÍODO CONFIGURABLE
    if (action === "reopen_ticket") {
      const ticketId = String(body?.ticketId || "");
      const motivo = String(body?.motivo || "Reabierto por el comercio").trim();

      const { data: ticketRow } = await db
        .from("soporte_tickets")
        .select("*")
        .eq("id", ticketId)
        .eq("negocio_id", prof.negocio_id)
        .maybeSingle();

      if (!ticketRow) {
        return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
      }

      if (ticketRow.estado !== "resuelto") {
        return NextResponse.json(
          { error: "Solo se pueden reabrir tickets en estado Resuelto" },
          { status: 400 }
        );
      }

      if (ticketRow.resuelto_at) {
        const daysSinceResolved =
          (Date.now() - new Date(ticketRow.resuelto_at).getTime()) / 86400000;
        if (daysSinceResolved > config.dias_reapertura) {
          return NextResponse.json(
            {
              error: `El plazo máximo para reabrir un ticket (${config.dias_reapertura} días) ha expirado. Por favor crea una nueva solicitud.`,
            },
            { status: 400 }
          );
        }
      }

      const nowIso = new Date().toISOString();
      const { data: updatedRow } = await db
        .from("soporte_tickets")
        .update({
          estado: "abierto",
          reabierto_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", ticketRow.id)
        .select("*")
        .single();

      await db.from("soporte_mensajes").insert({
        ticket_id: ticketRow.id,
        negocio_id: prof.negocio_id,
        autor_id: user.id,
        autor_nombre: prof.nombre || user.email || "Usuario",
        autor_rol: "comercio",
        mensaje: `[Ticket reabierto por el comercio]: ${motivo}`,
        es_nota_interna: false,
      });

      const mapped = mapTicketRow(updatedRow || ticketRow, neg?.nombre, neg?.slug);

      await sendSupportTicketNotification({
        supabase: db,
        config,
        ticket: mapped,
        event: "respuesta_comercio",
        recipientEmail: config.email_soporte,
        messagePreview: `El comercio reabrió el ticket: ${motivo}`,
        isToSupportTeam: true,
      });

      return NextResponse.json({ ok: true, ticket: mapped });
    }

    // 4. EVALUAR SERVICIO (1 A 5 ESTRELLAS + COMENTARIO OPCIONAL)
    if (action === "rate_ticket") {
      const ticketId = String(body?.ticketId || "");
      const calificacion = Number(body?.calificacion);
      const comentario = body?.comentario ? String(body.comentario).trim() : null;

      if (!ticketId || Number.isNaN(calificacion) || calificacion < 1 || calificacion > 5) {
        return NextResponse.json(
          { error: "Selecciona una calificación entre 1 y 5 estrellas" },
          { status: 400 }
        );
      }

      const { data: ticketRow } = await db
        .from("soporte_tickets")
        .select("*")
        .eq("id", ticketId)
        .eq("negocio_id", prof.negocio_id)
        .maybeSingle();

      if (!ticketRow) {
        return NextResponse.json({ error: "Ticket no encontrado" }, { status: 404 });
      }

      if (ticketRow.estado !== "resuelto" && ticketRow.estado !== "cerrado") {
        return NextResponse.json(
          { error: "Solo puedes evaluar tickets resueltos o cerrados" },
          { status: 400 }
        );
      }

      const nowIso = new Date().toISOString();
      const { data: updatedRow } = await db
        .from("soporte_tickets")
        .update({
          calificacion,
          comentario_evaluacion: comentario,
          evaluado_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", ticketRow.id)
        .select("*")
        .single();

      return NextResponse.json({
        ok: true,
        ticket: mapTicketRow(updatedRow || ticketRow, neg?.nombre, neg?.slug),
      });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error al procesar solicitud de soporte" },
      { status: 500 }
    );
  }
}
