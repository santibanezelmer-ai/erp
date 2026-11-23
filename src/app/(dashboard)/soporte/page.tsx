"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTenant } from "@/contexts/tenant-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LifeBuoy,
  Plus,
  Send,
  Paperclip,
  Loader2,
  CheckCircle2,
  Clock,
  MessageSquare,
  Star,
  RotateCcw,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Search,
  RefreshCw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  SOPORTE_CATEGORIAS,
  getCategoriaLabel,
  getEstadoLabel,
  getPrioridadLabel,
  type SoporteTicketRecord,
  type SoporteMensajeRecord,
  type TicketCategoria,
  type TicketPrioridad,
} from "@/lib/soporte.server";

interface PendingFile {
  name: string;
  mimeType: string;
  size: number;
  base64Data: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function SoporteComercioInner() {
  const { negocio } = useTenant();
  const searchParams = useSearchParams();
  const urlTicketId = searchParams.get("ticket");

  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<SoporteTicketRecord[]>([]);
  const [diasReapertura, setDiasReapertura] = useState(7);
  const [horarioStr, setHorarioStr] = useState("09:00 a 18:00 hrs");

  const [statusFilter, setStatusFilter] = useState<"todos" | "activos" | "resueltos">("todos");
  const [searchQuery, setSearchQuery] = useState("");

  // Ticket seleccionado y conversación
  const [selectedTicket, setSelectedTicket] = useState<SoporteTicketRecord | null>(null);
  const [mensajes, setMensajes] = useState<SoporteMensajeRecord[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);

  // Nuevo mensaje en hilo
  const [replyText, setReplyText] = useState("");
  const [replyFiles, setReplyFiles] = useState<PendingFile[]>([]);
  const [sendingReply, setSendingReply] = useState(false);

  // Modal de creación de nuevo ticket
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newCategoria, setNewCategoria] = useState<TicketCategoria>("punto_de_venta");
  const [newPrioridad, setNewPrioridad] = useState<TicketPrioridad>("normal");
  const [newAsunto, setNewAsunto] = useState("");
  const [newDescripcion, setNewDescripcion] = useState("");
  const [newFiles, setNewFiles] = useState<PendingFile[]>([]);
  const [creatingTicket, setCreatingTicket] = useState(false);

  // Evaluación 1 a 5 estrellas
  const [ratingValue, setRatingValue] = useState<number>(5);
  const [ratingComment, setRatingComment] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [reopening, setReopening] = useState(false);

  const loadTicketsList = async (autoSelectId?: string | null) => {
    setLoading(true);
    try {
      const res = await fetch("/api/soporte");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar tus solicitudes");
      const list: SoporteTicketRecord[] = data.tickets || [];
      setTickets(list);
      if (data.config) {
        setDiasReapertura(Number(data.config.dias_reapertura ?? 7));
        setHorarioStr(
          `${data.config.horario_inicio || "09:00"} a ${data.config.horario_fin || "18:00"} hrs`
        );
      }

      const targetId = autoSelectId || urlTicketId || selectedTicket?.id;
      if (targetId) {
        const found = list.find((t) => t.id === targetId);
        if (found) {
          await openTicketThread(found.id);
        }
      } else if (list.length > 0 && !selectedTicket) {
        await openTicketThread(list[0].id);
      }
    } catch (err: any) {
      toast.error(err.message || "No se pudieron cargar las solicitudes de soporte");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTicketsList(urlTicketId);
  }, [negocio?.id]);

  const openTicketThread = async (ticketId: string) => {
    setLoadingThread(true);
    try {
      const res = await fetch(`/api/soporte?ticketId=${encodeURIComponent(ticketId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo cargar la conversación");
      setSelectedTicket(data.ticket);
      setMensajes(data.mensajes || []);
      setRatingValue(data.ticket?.calificacion || 5);
      setRatingComment(data.ticket?.comentario_evaluacion || "");
    } catch (err: any) {
      toast.error(err.message || "Error al abrir el ticket");
    } finally {
      setLoadingThread(false);
    }
  };

  const handleFileInput = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: "new" | "reply"
  ) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const added: PendingFile[] = [];
    for (let i = 0; i < Math.min(fileList.length, 4); i++) {
      const f = fileList[i];
      if (f.size > 6 * 1024 * 1024) {
        toast.error(`El archivo ${f.name} supera el límite de 6 MB.`);
        continue;
      }
      const base64Data = await fileToBase64(f);
      added.push({
        name: f.name,
        mimeType: f.type || "application/octet-stream",
        size: f.size,
        base64Data,
      });
    }

    if (target === "new") {
      setNewFiles((prev) => [...prev, ...added].slice(0, 5));
    } else {
      setReplyFiles((prev) => [...prev, ...added].slice(0, 5));
    }
    e.target.value = "";
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsunto.trim() || !newDescripcion.trim()) {
      toast.error("Por favor completa el asunto y la descripción de tu problema");
      return;
    }

    setCreatingTicket(true);
    try {
      const res = await fetch("/api/soporte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_ticket",
          categoria: newCategoria,
          prioridad: newPrioridad,
          asunto: newAsunto.trim(),
          descripcion: newDescripcion.trim(),
          attachments: newFiles,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear la solicitud");

      toast.success(`Solicitud ${data.ticket.codigo} enviada al equipo de Soporte Operix`);
      setNewModalOpen(false);
      setNewAsunto("");
      setNewDescripcion("");
      setNewFiles([]);
      await loadTicketsList(data.ticket.id);
    } catch (err: any) {
      toast.error(err.message || "No se pudo crear el ticket");
    } finally {
      setCreatingTicket(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;

    setSendingReply(true);
    try {
      const res = await fetch("/api/soporte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_message",
          ticketId: selectedTicket.id,
          mensaje: replyText.trim(),
          attachments: replyFiles,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al enviar respuesta");

      setReplyText("");
      setReplyFiles([]);
      toast.success("Mensaje enviado a Soporte");
      await openTicketThread(selectedTicket.id);
      await loadTicketsList(selectedTicket.id);
    } catch (err: any) {
      toast.error(err.message || "Error al enviar el mensaje");
    } finally {
      setSendingReply(false);
    }
  };

  const handleReopenTicket = async () => {
    if (!selectedTicket) return;
    setReopening(true);
    try {
      const res = await fetch("/api/soporte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reopen_ticket",
          ticketId: selectedTicket.id,
          motivo: "El comercio solicita continuar con la atención del caso.",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo reabrir el ticket");

      toast.success(`Ticket ${selectedTicket.codigo} reabierto correctamente`);
      await openTicketThread(selectedTicket.id);
      await loadTicketsList(selectedTicket.id);
    } catch (err: any) {
      toast.error(err.message || "Error al reabrir ticket");
    } finally {
      setReopening(false);
    }
  };

  const handleRateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    setSubmittingRating(true);
    try {
      const res = await fetch("/api/soporte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rate_ticket",
          ticketId: selectedTicket.id,
          calificacion: ratingValue,
          comentario: ratingComment.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar calificación");

      toast.success("¡Muchas gracias por calificar nuestra atención!");
      await openTicketThread(selectedTicket.id);
      await loadTicketsList(selectedTicket.id);
    } catch (err: any) {
      toast.error(err.message || "Error al enviar evaluación");
    } finally {
      setSubmittingRating(false);
    }
  };

  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tickets.filter((t) => {
      if (
        statusFilter === "activos" &&
        (t.estado === "resuelto" || t.estado === "cerrado")
      ) {
        return false;
      }
      if (
        statusFilter === "resueltos" &&
        t.estado !== "resuelto" &&
        t.estado !== "cerrado"
      ) {
        return false;
      }
      if (!q) return true;
      return (
        t.codigo.toLowerCase().includes(q) ||
        t.asunto.toLowerCase().includes(q) ||
        getCategoriaLabel(t.categoria).toLowerCase().includes(q)
      );
    });
  }, [tickets, statusFilter, searchQuery]);

  const canReopenSelected = useMemo(() => {
    if (!selectedTicket || selectedTicket.estado !== "resuelto") return false;
    if (!selectedTicket.resuelto_at) return true;
    const days =
      (Date.now() - new Date(selectedTicket.resuelto_at).getTime()) / 86400000;
    return days <= diasReapertura;
  }, [selectedTicket, diasReapertura]);

  const getEstadoBadgeClass = (estado: string) => {
    switch (estado) {
      case "nuevo":
        return "bg-blue-500/10 text-blue-600 border-blue-500/30";
      case "abierto":
      case "en_resolucion":
        return "bg-amber-500/10 text-amber-600 border-amber-500/30";
      case "esperando_tienda":
        return "bg-purple-500/10 text-purple-600 border-purple-500/30";
      case "resuelto":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="space-y-5">
      {/* Encabezado Amigable para Tiendas */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold mb-1">
            <LifeBuoy className="h-3.5 w-3.5" />
            Centro de Ayuda y Soporte Técnico · Operix ERP
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Ayuda y Soporte</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            ¿Tienes alguna duda o inconveniente en {negocio?.nombre || "tu comercio"}? Crea una solicitud y nuestro equipo te atenderá directamente. Horario hábil: {horarioStr}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadTicketsList()}
            disabled={loading}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button
            size="sm"
            onClick={() => setNewModalOpen(true)}
            className="gap-1.5 text-xs font-bold shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Nueva Solicitud de Soporte
          </Button>
        </div>
      </div>

      {/* Layout Principal: Lista de Solicitudes a la izquierda + Conversación a la derecha */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Columna Izquierda: Mis Solicitudes */}
        <Card className="lg:col-span-5 shadow-2xs">
          <CardHeader className="p-4 pb-3 space-y-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold">
                Mis Solicitudes ({filteredTickets.length})
              </CardTitle>
              <div className="flex items-center gap-1">
                {(["todos", "activos", "resueltos"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setStatusFilter(f)}
                    className={`px-2 py-1 rounded text-[11px] font-semibold capitalize transition-colors ${
                      statusFilter === f
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
              <Input
                placeholder="Buscar por código (ej. TK-01001) o asunto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading && tickets.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Cargando solicitudes...</span>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <LifeBuoy className="h-9 w-9 text-muted-foreground mx-auto opacity-60" />
                <div className="text-sm font-semibold">No tienes solicitudes en esta vista</div>
                <p className="text-xs text-muted-foreground">
                  Si necesitas asistencia con tu Punto de Venta, inventario, facturación o suscripción, crea un ticket y te responderemos a la brevedad.
                </p>
                <Button size="sm" onClick={() => setNewModalOpen(true)} className="gap-1.5 text-xs">
                  <Plus className="h-3.5 w-3.5" />
                  Crear mi primer ticket
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                {filteredTickets.map((t) => {
                  const isSelected = selectedTicket?.id === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => openTicketThread(t.id)}
                      className={`w-full text-left p-3.5 transition-colors flex flex-col gap-1.5 ${
                        isSelected ? "bg-primary/8 border-l-4 border-l-primary" : "hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-primary">
                          {t.codigo}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold ${getEstadoBadgeClass(t.estado)}`}
                        >
                          {getEstadoLabel(t.estado)}
                        </Badge>
                      </div>

                      <div className="font-semibold text-sm text-foreground line-clamp-1">
                        {t.asunto}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{getCategoriaLabel(t.categoria)}</span>
                        <span>{new Date(t.updated_at).toLocaleDateString("es-CL")}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Columna Derecha: Hilo de Conversación y Detalle del Caso */}
        <Card className="lg:col-span-7 shadow-2xs">
          {!selectedTicket ? (
            <CardContent className="py-20 text-center space-y-2">
              <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto opacity-40" />
              <div className="text-sm font-semibold">
                Selecciona una solicitud para ver su conversación
              </div>
              <p className="text-xs text-muted-foreground">
                Aquí podrás consultar las respuestas del equipo de Soporte Operix, enviar capturas y evaluar la atención.
              </p>
            </CardContent>
          ) : loadingThread ? (
            <CardContent className="py-20 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">
                Cargando historial del caso {selectedTicket.codigo}...
              </span>
            </CardContent>
          ) : (
            <>
              <CardHeader className="p-4 border-b border-border space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-primary/10 text-primary">
                      {selectedTicket.codigo}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${getEstadoBadgeClass(
                        selectedTicket.estado
                      )}`}
                    >
                      {getEstadoLabel(selectedTicket.estado)}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      Prioridad {getPrioridadLabel(selectedTicket.prioridad)}
                    </Badge>
                  </div>

                  {canReopenSelected && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleReopenTicket}
                      disabled={reopening}
                      className="h-7 text-xs gap-1"
                    >
                      <RotateCcw className="h-3 w-3" />
                      {reopening ? "Reabriendo..." : "Reabrir Caso"}
                    </Button>
                  )}
                </div>

                <CardTitle className="text-base font-bold">{selectedTicket.asunto}</CardTitle>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>Categoría: {getCategoriaLabel(selectedTicket.categoria)}</span>
                  <span>•</span>
                  <span>
                    Creado: {new Date(selectedTicket.created_at).toLocaleString("es-CL")}
                  </span>
                  {selectedTicket.responsable_nombre && (
                    <>
                      <span>•</span>
                      <span>
                        Atendido por: <strong>{selectedTicket.responsable_nombre}</strong>
                      </span>
                    </>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                {/* Banner de Evaluación del Servicio (cuando está Resuelto o Cerrado) */}
                {(selectedTicket.estado === "resuelto" ||
                  selectedTicket.estado === "cerrado") && (
                  <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" />
                        {selectedTicket.calificacion
                          ? `Evaluaste esta atención con ${selectedTicket.calificacion} / 5 estrellas`
                          : "Este caso fue marcado como Resuelto. ¿Cómo calificarías nuestra atención?"}
                      </div>
                    </div>

                    <form onSubmit={handleRateTicket} className="space-y-2.5">
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRatingValue(star)}
                            className="p-1 rounded hover:bg-emerald-500/10 transition-colors"
                          >
                            <Star
                              className={`h-5 w-5 ${
                                star <= ratingValue
                                  ? "text-amber-400 fill-amber-400"
                                  : "text-muted-foreground"
                              }`}
                            />
                          </button>
                        ))}
                        <span className="text-xs font-semibold ml-1">
                          {ratingValue} de 5 estrellas
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                          placeholder="Comentario opcional sobre la atención recibida..."
                          value={ratingComment}
                          onChange={(e) => setRatingComment(e.target.value)}
                          className="h-8 text-xs flex-1 bg-background"
                        />
                        <Button
                          type="submit"
                          size="sm"
                          disabled={submittingRating}
                          className="h-8 text-xs shrink-0"
                        >
                          {submittingRating
                            ? "Guardando..."
                            : selectedTicket.calificacion
                            ? "Actualizar Evaluación"
                            : "Enviar Evaluación"}
                        </Button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Hilo de Mensajes */}
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {mensajes.map((m) => {
                    const isSupport = m.autor_rol === "soporte";
                    return (
                      <div
                        key={m.id}
                        className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                          isSupport
                            ? "bg-primary/5 border-primary/25 ml-0 sm:mr-6"
                            : "bg-muted/30 border-border sm:ml-6 mr-0"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-foreground">{m.autor_nombre}</span>
                            <Badge
                              variant={isSupport ? "default" : "secondary"}
                              className="text-[9px] px-1.5 py-0"
                            >
                              {isSupport ? "Soporte Operix" : "Tu Comercio"}
                            </Badge>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(m.created_at).toLocaleString("es-CL")}
                          </span>
                        </div>

                        <div className="text-foreground leading-relaxed whitespace-pre-line">
                          {m.mensaje}
                        </div>

                        {/* Adjuntos del mensaje */}
                        {Array.isArray(m.adjuntos) && m.adjuntos.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {m.adjuntos.map((att) => (
                              <a
                                key={att.id}
                                href={att.signedUrl || att.dataUrl || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-background hover:bg-muted text-[11px] font-medium text-primary"
                              >
                                {att.mimeType?.startsWith("image/") ? (
                                  <ImageIcon className="h-3.5 w-3.5" />
                                ) : (
                                  <FileText className="h-3.5 w-3.5" />
                                )}
                                <span className="truncate max-w-[160px]">{att.name}</span>
                                <ExternalLink className="h-3 w-3 opacity-60" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Caja para responder */}
                {selectedTicket.estado !== "cerrado" ? (
                  <form onSubmit={handleSendReply} className="space-y-2.5 pt-2 border-t border-border">
                    <Label className="text-xs font-semibold">Responder a Soporte</Label>
                    <textarea
                      rows={3}
                      placeholder="Escribe aquí tu respuesta o información adicional..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background p-2.5 text-xs leading-relaxed"
                      required
                    />

                    {replyFiles.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {replyFiles.map((f, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="text-[11px] gap-1 pr-1"
                          >
                            <span className="truncate max-w-[140px]">{f.name}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setReplyFiles((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium cursor-pointer">
                        <Paperclip className="h-3.5 w-3.5 text-primary" />
                        <span>Adjuntar imagen o documento</span>
                        <input
                          type="file"
                          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                          multiple
                          className="hidden"
                          onChange={(e) => handleFileInput(e, "reply")}
                        />
                      </label>

                      <Button
                        type="submit"
                        size="sm"
                        disabled={sendingReply || !replyText.trim()}
                        className="gap-1.5 text-xs font-bold"
                      >
                        {sendingReply ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Send className="h-3.5 w-3.5" />
                            Enviar Mensaje
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="p-3 rounded-lg bg-muted/50 text-center text-xs text-muted-foreground">
                    Este caso se encuentra cerrado definitivamente. Si necesitas nueva asistencia, haz clic en <strong>Nueva Solicitud de Soporte</strong>.
                  </div>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>

      {/* MODAL: CREAR NUEVO TICKET DE SOPORTE */}
      <Dialog open={newModalOpen} onOpenChange={setNewModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LifeBuoy className="h-5 w-5 text-primary" />
              Nueva Solicitud de Soporte
            </DialogTitle>
            <DialogDescription>
              Selecciona el área donde necesitas ayuda y cuéntanos qué sucede. Puedes adjuntar capturas de pantalla o documentos.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateTicket} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Categoría del Problema</Label>
                <select
                  value={newCategoria}
                  onChange={(e) => setNewCategoria(e.target.value as TicketCategoria)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-medium"
                >
                  {SOPORTE_CATEGORIAS.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Prioridad</Label>
                <select
                  value={newPrioridad}
                  onChange={(e) => setNewPrioridad(e.target.value as TicketPrioridad)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-medium"
                >
                  <option value="baja">Baja — Consulta general</option>
                  <option value="normal">Normal — Duda o ajuste operativo</option>
                  <option value="alta">Alta — Dificultad importante</option>
                  <option value="urgente">Urgente — Impide vender o facturar</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Asunto Breve</Label>
              <Input
                placeholder="Ej: No puedo imprimir boleta en mi impresora Bluetooth"
                value={newAsunto}
                onChange={(e) => setNewAsunto(e.target.value)}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Descripción Detallada</Label>
              <textarea
                rows={5}
                placeholder="Explícanos con tus palabras qué estabas haciendo y qué mensaje o inconveniente apareció..."
                value={newDescripcion}
                onChange={(e) => setNewDescripcion(e.target.value)}
                className="w-full rounded-md border border-input bg-background p-3 text-xs leading-relaxed"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium cursor-pointer">
                <Paperclip className="h-3.5 w-3.5 text-primary" />
                <span>Adjuntar capturas o documentos (opcional)</span>
                <input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileInput(e, "new")}
                />
              </label>

              {newFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {newFiles.map((f, idx) => (
                    <Badge key={idx} variant="secondary" className="text-[11px] gap-1 pr-1">
                      <span className="truncate max-w-[160px]">{f.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setNewFiles((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setNewModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={creatingTicket} className="gap-1.5">
                {creatingTicket ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Enviando Solicitud...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Crear Ticket de Soporte
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SoporteComercioPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      }
    >
      <SoporteComercioInner />
    </Suspense>
  );
}
