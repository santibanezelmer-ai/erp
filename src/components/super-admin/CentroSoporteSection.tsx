"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  Search,
  RefreshCw,
  Send,
  Paperclip,
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Star,
  Lock,
  MessageSquare,
  Settings2,
  UserCheck,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  X,
  Inbox,
  Flame,
} from "lucide-react";
import { toast } from "sonner";
import {
  SOPORTE_CATEGORIAS,
  SOPORTE_ESTADOS,
  SOPORTE_PRIORIDADES,
  getCategoriaLabel,
  getEstadoLabel,
  getPrioridadLabel,
  type SoporteConfig,
  type SoporteMensajeRecord,
  type SoporteTicketRecord,
  type TicketEstado,
  type TicketPrioridad,
} from "@/lib/soporte.server";

type BandejaFilter =
  | "todos"
  | "sin_asignar"
  | "mis_tickets"
  | "urgentes"
  | "pendientes"
  | "esperando_tienda"
  | "resueltos";

interface SupportAgent {
  id: string;
  nombre: string;
  email: string | null;
}

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

function formatDurationMinutes(mins: number | null | undefined): string {
  if (mins === null || typeof mins === "undefined") return "—";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function CentroSoporteSection() {
  const searchParams = useSearchParams();
  const urlTicketId = searchParams.get("ticket");

  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentAdminName, setCurrentAdminName] = useState<string>("Soporte Operix");
  const [config, setConfig] = useState<SoporteConfig | null>(null);
  const [agents, setAgents] = useState<SupportAgent[]>([]);
  const [metrics, setMetrics] = useState<any | null>(null);
  const [tickets, setTickets] = useState<SoporteTicketRecord[]>([]);

  // Bandeja de trabajo y filtros
  const [bandeja, setBandeja] = useState<BandejaFilter>("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("all");

  // Ticket seleccionado y conversación completa (pública + notas internas)
  const [selectedTicket, setSelectedTicket] = useState<SoporteTicketRecord | null>(null);
  const [mensajes, setMensajes] = useState<SoporteMensajeRecord[]>([]);
  const [liveSla, setLiveSla] = useState<any | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [updatingMeta, setUpdatingMeta] = useState(false);

  // Respuesta / Nota interna
  const [replyText, setReplyText] = useState("");
  const [esNotaInterna, setEsNotaInterna] = useState(false);
  const [replyNextEstado, setReplyNextEstado] = useState<string>("");
  const [replyFiles, setReplyFiles] = useState<PendingFile[]>([]);
  const [sendingReply, setSendingReply] = useState(false);

  // Modal de Configuración de SLA y Horarios Hábiles
  const [slaModalOpen, setSlaModalOpen] = useState(false);
  const [savingSla, setSavingSla] = useState(false);

  const loadSupportCenterData = async (autoSelectId?: string | null) => {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/soporte");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar Centro de Soporte");

      setCurrentUserId(data.currentUserId || "");
      setCurrentAdminName(data.currentAdminName || "Soporte Operix");
      setConfig(data.config);
      setAgents(data.agents || []);
      setMetrics(data.metrics);
      const list: SoporteTicketRecord[] = data.tickets || [];
      setTickets(list);

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
      toast.error(err.message || "Error al cargar Centro de Soporte");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSupportCenterData(urlTicketId);
  }, []);

  const openTicketThread = async (ticketId: string) => {
    setLoadingThread(true);
    try {
      const res = await fetch(
        `/api/super-admin/soporte?ticketId=${encodeURIComponent(ticketId)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo cargar el ticket");
      setSelectedTicket(data.ticket);
      setMensajes(data.mensajes || []);
      setLiveSla(data.liveSla || null);
      setReplyNextEstado("");
    } catch (err: any) {
      toast.error(err.message || "Error al abrir conversación");
    } finally {
      setLoadingThread(false);
    }
  };

  // Filtrado por Bandeja de Trabajo + Buscador por comercio, número, usuario o asunto
  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tickets.filter((t) => {
      if (bandeja === "sin_asignar" && t.responsable_id) return false;
      if (bandeja === "mis_tickets" && t.responsable_id !== currentUserId) return false;
      if (
        bandeja === "urgentes" &&
        (t.prioridad !== "urgente" || t.estado === "resuelto" || t.estado === "cerrado")
      ) {
        return false;
      }
      if (
        bandeja === "pendientes" &&
        t.estado !== "nuevo" &&
        t.estado !== "abierto" &&
        t.estado !== "en_resolucion"
      ) {
        return false;
      }
      if (bandeja === "esperando_tienda" && t.estado !== "esperando_tienda") return false;
      if (
        bandeja === "resueltos" &&
        t.estado !== "resuelto" &&
        t.estado !== "cerrado"
      ) {
        return false;
      }

      if (categoriaFilter !== "all" && t.categoria !== categoriaFilter) return false;

      if (!q) return true;
      return (
        t.codigo.toLowerCase().includes(q) ||
        String(t.numero).includes(q) ||
        t.asunto.toLowerCase().includes(q) ||
        (t.negocio_nombre && t.negocio_nombre.toLowerCase().includes(q)) ||
        t.solicitante_nombre.toLowerCase().includes(q) ||
        (t.solicitante_email && t.solicitante_email.toLowerCase().includes(q))
      );
    });
  }, [tickets, bandeja, categoriaFilter, searchQuery, currentUserId]);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    setReplyFiles((prev) => [...prev, ...added].slice(0, 5));
    e.target.value = "";
  };

  const handleSendReplyOrInternalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;

    setSendingReply(true);
    try {
      const res = await fetch("/api/super-admin/soporte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reply_ticket",
          ticketId: selectedTicket.id,
          mensaje: replyText.trim(),
          esNotaInterna,
          nuevoEstado: replyNextEstado || undefined,
          attachments: replyFiles,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al registrar mensaje");

      toast.success(
        esNotaInterna
          ? "Nota interna privada registrada en el ticket"
          : "Respuesta enviada al comercio y notificada por correo"
      );
      setReplyText("");
      setReplyFiles([]);
      setEsNotaInterna(false);
      await openTicketThread(selectedTicket.id);
      await loadSupportCenterData(selectedTicket.id);
    } catch (err: any) {
      toast.error(err.message || "Error al enviar respuesta");
    } finally {
      setSendingReply(false);
    }
  };

  const handleUpdateTicketMeta = async (updates: {
    estado?: TicketEstado;
    prioridad?: TicketPrioridad;
    responsableId?: string | null;
    responsableNombre?: string | null;
  }) => {
    if (!selectedTicket) return;
    setUpdatingMeta(true);
    try {
      const res = await fetch("/api/super-admin/soporte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_ticket_meta",
          ticketId: selectedTicket.id,
          ...updates,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar ticket");

      setSelectedTicket(data.ticket);
      toast.success(`Ticket ${data.ticket.codigo} actualizado`);
      await loadSupportCenterData(selectedTicket.id);
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar ticket");
    } finally {
      setUpdatingMeta(false);
    }
  };

  const handleSaveSlaConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSavingSla(true);
    try {
      const res = await fetch("/api/super-admin/soporte", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar SLA");
      setConfig(data.config);
      toast.success("Configuración de SLA y horarios hábiles actualizada");
      setSlaModalOpen(false);
      await loadSupportCenterData();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar configuración");
    } finally {
      setSavingSla(false);
    }
  };

  const getPrioridadBadgeClass = (prio: string) => {
    switch (prio) {
      case "urgente":
        return "bg-destructive text-destructive-foreground font-extrabold";
      case "alta":
        return "bg-amber-500/15 text-amber-600 border-amber-500/30 font-bold";
      case "normal":
        return "bg-blue-500/10 text-blue-600 border-blue-500/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

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

  if (loading && !config) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-2">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">
          Cargando Centro de Soporte y Atención a Tiendas...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Cabecera Operativa y Configuración de SLA */}
      <Card className="border-border bg-card shadow-2xs">
        <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-foreground flex items-center gap-1.5">
                <LifeBuoy className="h-4 w-4 text-primary" />
                Centro de Soporte Técnico · Comercial Hels / Operix ERP
              </h3>
              <Badge variant="outline" className="text-[10px] font-semibold">
                Horario hábil: {config?.horario_inicio} – {config?.horario_fin} (Lun-Vie)
              </Badge>
              {(metrics?.ticketsSlaIncumplido ?? 0) > 0 && (
                <Badge variant="destructive" className="text-[10px] gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {metrics.ticketsSlaIncumplido} SLA Excedidos
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Objetivos SLA (1° respuesta hábil): Urgente{" "}
              <strong>{config?.sla_urgente_horas}h</strong> · Alta{" "}
              <strong>{config?.sla_alta_horas}h</strong> · Normal{" "}
              <strong>{config?.sla_normal_horas}h</strong> · Baja{" "}
              <strong>{config?.sla_baja_horas}h</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => setSlaModalOpen(true)}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Configurar SLA y Horarios
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => loadSupportCenterData()}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 11 Indicadores Ejecutivos del Panel de Soporte Super Admin */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-11 gap-2">
        <div className="p-2.5 rounded-xl border border-border bg-card">
          <div className="text-[10px] font-semibold uppercase text-muted-foreground">
            Total Tickets
          </div>
          <div className="text-lg font-bold mt-0.5">{metrics?.totalTickets ?? 0}</div>
        </div>

        <div className="p-2.5 rounded-xl border border-border bg-card">
          <div className="text-[10px] font-semibold uppercase text-blue-600">Nuevos</div>
          <div className="text-lg font-bold mt-0.5">{metrics?.ticketsNuevos ?? 0}</div>
        </div>

        <div className="p-2.5 rounded-xl border border-border bg-card">
          <div className="text-[10px] font-semibold uppercase text-amber-600">Abiertos</div>
          <div className="text-lg font-bold mt-0.5">{metrics?.ticketsAbiertos ?? 0}</div>
        </div>

        <div className="p-2.5 rounded-xl border border-border bg-card">
          <div className="text-[10px] font-semibold uppercase text-destructive flex items-center gap-1">
            <span>Urgentes</span>
            <Flame className="h-3 w-3" />
          </div>
          <div className="text-lg font-bold text-destructive mt-0.5">
            {metrics?.ticketsUrgentes ?? 0}
          </div>
        </div>

        <div className="p-2.5 rounded-xl border border-border bg-card">
          <div className="text-[10px] font-semibold uppercase text-purple-600">
            Esp. Tienda
          </div>
          <div className="text-lg font-bold mt-0.5">
            {metrics?.ticketsEsperandoRespuesta ?? 0}
          </div>
        </div>

        <div className="p-2.5 rounded-xl border border-border bg-card">
          <div className="text-[10px] font-semibold uppercase text-sky-600">
            En Resolución
          </div>
          <div className="text-lg font-bold mt-0.5">
            {metrics?.ticketsEnResolucion ?? 0}
          </div>
        </div>

        <div className="p-2.5 rounded-xl border border-border bg-card">
          <div className="text-[10px] font-semibold uppercase text-emerald-600">
            Resueltos
          </div>
          <div className="text-lg font-bold text-emerald-600 mt-0.5">
            {metrics?.ticketsResueltos ?? 0}
          </div>
        </div>

        <div className="p-2.5 rounded-xl border border-border bg-card">
          <div className="text-[10px] font-semibold uppercase text-muted-foreground">
            Cerrados
          </div>
          <div className="text-lg font-bold mt-0.5">{metrics?.ticketsCerrados ?? 0}</div>
        </div>

        <div className="p-2.5 rounded-xl border border-border bg-card">
          <div className="text-[10px] font-semibold uppercase text-muted-foreground">
            T. 1° Respuesta
          </div>
          <div className="text-lg font-bold mt-0.5">
            {formatDurationMinutes(metrics?.avgFirstResponseBusinessMin)}
          </div>
          <div className="text-[9px] text-muted-foreground">Tiempo hábil</div>
        </div>

        <div className="p-2.5 rounded-xl border border-border bg-card">
          <div className="text-[10px] font-semibold uppercase text-muted-foreground">
            T. Resolución
          </div>
          <div className="text-lg font-bold mt-0.5">
            {formatDurationMinutes(metrics?.avgResolutionBusinessMin)}
          </div>
          <div className="text-[9px] text-muted-foreground">Tiempo hábil</div>
        </div>

        <div className="p-2.5 rounded-xl border border-border bg-card col-span-2 sm:col-span-1">
          <div className="text-[10px] font-semibold uppercase text-amber-600 flex items-center gap-1">
            <span>Satisfacción</span>
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          </div>
          <div className="text-lg font-bold mt-0.5">
            {metrics?.avgSatisfaction ? `${metrics.avgSatisfaction} / 5` : "—"}
          </div>
          <div className="text-[9px] text-muted-foreground">
            {metrics?.ratedCount ?? 0} evaluaciones
          </div>
        </div>
      </div>

      {/* Bandejas de Trabajo Rápidas */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(
            [
              { id: "todos", label: `Todos (${tickets.length})` },
              {
                id: "sin_asignar",
                label: `Sin asignar (${tickets.filter((t) => !t.responsable_id).length})`,
              },
              {
                id: "mis_tickets",
                label: `Mis tickets (${
                  tickets.filter((t) => t.responsable_id === currentUserId).length
                })`,
              },
              {
                id: "urgentes",
                label: `Urgentes (${metrics?.ticketsUrgentes ?? 0})`,
              },
              {
                id: "pendientes",
                label: `Pendientes (${
                  (metrics?.ticketsNuevos ?? 0) +
                  (metrics?.ticketsAbiertos ?? 0) +
                  (metrics?.ticketsEnResolucion ?? 0)
                })`,
              },
              {
                id: "esperando_tienda",
                label: `Esperando tienda (${metrics?.ticketsEsperandoRespuesta ?? 0})`,
              },
              {
                id: "resueltos",
                label: `Resueltos (${
                  (metrics?.ticketsResueltos ?? 0) + (metrics?.ticketsCerrados ?? 0)
                })`,
              },
            ] as { id: BandejaFilter; label: string }[]
          ).map((b) => (
            <Button
              key={b.id}
              size="sm"
              variant={bandeja === b.id ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => setBandeja(b.id)}
            >
              {b.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
            <Input
              placeholder="Buscar comercio, TK-01001, usuario, asunto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          <select
            value={categoriaFilter}
            onChange={(e) => setCategoriaFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium"
          >
            <option value="all">Todas las categorías</option>
            {SOPORTE_CATEGORIAS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Área de Trabajo Dividida: Bandeja de Tickets (5 cols) + Consola de Conversación y Acciones (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Bandeja de Tickets */}
        <Card className="lg:col-span-5 shadow-2xs">
          <CardHeader className="p-3.5 border-b border-border flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1.5">
              <Inbox className="h-3.5 w-3.5 text-primary" />
              Bandeja de Solicitudes ({filteredTickets.length})
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            {filteredTickets.length === 0 ? (
              <div className="py-16 text-center text-xs text-muted-foreground">
                No hay tickets en esta bandeja con los filtros actuales.
              </div>
            ) : (
              <div className="divide-y divide-border max-h-[680px] overflow-y-auto">
                {filteredTickets.map((t) => {
                  const isSelected = selectedTicket?.id === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => openTicketThread(t.id)}
                      className={`w-full text-left p-3.5 transition-colors flex flex-col gap-1.5 ${
                        isSelected
                          ? "bg-primary/8 border-l-4 border-l-primary"
                          : "hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-extrabold text-primary">
                            {t.codigo}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[9px] uppercase ${getPrioridadBadgeClass(
                              t.prioridad
                            )}`}
                          >
                            {getPrioridadLabel(t.prioridad)}
                          </Badge>
                          {t.sla_incumplido && (
                            <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
                              SLA Excedido
                            </Badge>
                          )}
                        </div>

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
                        <span className="font-medium text-foreground/80 truncate max-w-[180px]">
                          {t.negocio_nombre || "Comercio"} · {t.solicitante_nombre}
                        </span>
                        <span>{new Date(t.updated_at).toLocaleDateString("es-CL")}</span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                        <span>{getCategoriaLabel(t.categoria)}</span>
                        <span>
                          {t.responsable_nombre ? (
                            <span className="text-primary font-semibold">
                              Asignado: {t.responsable_nombre}
                            </span>
                          ) : (
                            <span className="text-amber-600 font-semibold">Sin asignar</span>
                          )}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detalle del Ticket, Controles Rápidos y Conversación (Pública + Notas Internas) */}
        <Card className="lg:col-span-7 shadow-2xs">
          {!selectedTicket ? (
            <CardContent className="py-24 text-center space-y-2">
              <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto opacity-40" />
              <div className="text-sm font-semibold">
                Selecciona un ticket de la bandeja para atenderlo
              </div>
              <p className="text-xs text-muted-foreground">
                Podrás asignar un responsable, cambiar prioridad/estado, responder al comercio o dejar notas internas privadas.
              </p>
            </CardContent>
          ) : loadingThread ? (
            <CardContent className="py-24 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">
                Cargando conversación de {selectedTicket.codigo}...
              </span>
            </CardContent>
          ) : (
            <>
              <CardHeader className="p-4 border-b border-border space-y-3">
                {/* Fila 1: Código, Comercio, SLA y Calificación */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-primary/10 text-primary">
                      {selectedTicket.codigo}
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      {selectedTicket.negocio_nombre || "Comercio"}
                    </span>
                    {selectedTicket.negocio_slug && (
                      <span className="text-xs text-muted-foreground">
                        (/{selectedTicket.negocio_slug})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {liveSla && (
                      <Badge
                        variant="outline"
                        className={
                          liveSla.breached
                            ? "border-destructive/40 text-destructive bg-destructive/10 text-[10px]"
                            : liveSla.atRisk
                            ? "border-amber-500/40 text-amber-600 bg-amber-500/10 text-[10px]"
                            : "border-emerald-500/40 text-emerald-600 bg-emerald-500/10 text-[10px]"
                        }
                      >
                        <Clock className="h-3 w-3 mr-1" />
                        SLA 1° Resp:{" "}
                        {formatDurationMinutes(liveSla.elapsedBusinessMinutes)} /{" "}
                        {formatDurationMinutes(liveSla.targetMinutes)} hábiles
                      </Badge>
                    )}

                    {selectedTicket.calificacion && (
                      <Badge className="bg-amber-500 text-white text-[10px] gap-1">
                        <Star className="h-3 w-3 fill-white" />
                        {selectedTicket.calificacion} / 5
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Asunto y metadatos del solicitante */}
                <div>
                  <CardTitle className="text-base font-bold">
                    {selectedTicket.asunto}
                  </CardTitle>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
                    <span>
                      Solicitante: <strong>{selectedTicket.solicitante_nombre}</strong> (
                      {selectedTicket.solicitante_email || "sin email"})
                    </span>
                    <span>•</span>
                    <span>Categoría: {getCategoriaLabel(selectedTicket.categoria)}</span>
                    <span>•</span>
                    <span>
                      Creado: {new Date(selectedTicket.created_at).toLocaleString("es-CL")}
                    </span>
                  </div>
                </div>

                {/* Controles Rápidos: Estado, Prioridad y Responsable Asignado */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div>
                    <Label className="text-[10px] uppercase text-muted-foreground">
                      Estado del Caso
                    </Label>
                    <select
                      disabled={updatingMeta}
                      value={selectedTicket.estado}
                      onChange={(e) =>
                        handleUpdateTicketMeta({
                          estado: e.target.value as TicketEstado,
                        })
                      }
                      className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs font-semibold mt-0.5"
                    >
                      {SOPORTE_ESTADOS.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label className="text-[10px] uppercase text-muted-foreground">
                      Prioridad
                    </Label>
                    <select
                      disabled={updatingMeta}
                      value={selectedTicket.prioridad}
                      onChange={(e) =>
                        handleUpdateTicketMeta({
                          prioridad: e.target.value as TicketPrioridad,
                        })
                      }
                      className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs font-semibold mt-0.5"
                    >
                      {SOPORTE_PRIORIDADES.map((pr) => (
                        <option key={pr.id} value={pr.id}>
                          {pr.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label className="text-[10px] uppercase text-muted-foreground">
                      Responsable Asignado
                    </Label>
                    <div className="flex items-center gap-1 mt-0.5">
                      <select
                        disabled={updatingMeta}
                        value={selectedTicket.responsable_id || ""}
                        onChange={(e) => {
                          const agId = e.target.value || null;
                          const ag = agents.find((a) => a.id === agId);
                          handleUpdateTicketMeta({
                            responsableId: agId,
                            responsableNombre: ag ? ag.nombre : null,
                          });
                        }}
                        className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs font-medium"
                      >
                        <option value="">Sin asignar</option>
                        {agents.map((ag) => (
                          <option key={ag.id} value={ag.id}>
                            {ag.nombre}
                          </option>
                        ))}
                      </select>

                      {selectedTicket.responsable_id !== currentUserId && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          title="Asignarme este ticket"
                          disabled={updatingMeta}
                          onClick={() =>
                            handleUpdateTicketMeta({
                              responsableId: currentUserId,
                              responsableNombre: currentAdminName,
                            })
                          }
                          className="h-8 px-2 text-xs shrink-0"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                {/* Comentario de evaluación del cliente si existe */}
                {selectedTicket.calificacion && (
                  <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-bold text-amber-700 dark:text-amber-400">
                        Evaluación del comercio ({selectedTicket.calificacion}/5 ★):
                      </span>{" "}
                      <span>
                        {selectedTicket.comentario_evaluacion ||
                          "Sin comentario adicional."}
                      </span>
                    </div>
                    {selectedTicket.evaluado_at && (
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(selectedTicket.evaluado_at).toLocaleDateString("es-CL")}
                      </span>
                    )}
                  </div>
                )}

                {/* Hilo de Conversación (Diferenciando Mensajes Públicos vs Notas Internas) */}
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {mensajes.map((m) => {
                    const isInternal = Boolean(m.es_nota_interna);
                    const isSupport = m.autor_rol === "soporte";

                    return (
                      <div
                        key={m.id}
                        className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                          isInternal
                            ? "bg-amber-500/10 border-amber-500/40 border-dashed"
                            : isSupport
                            ? "bg-primary/5 border-primary/25 ml-6"
                            : "bg-muted/30 border-border mr-6"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-foreground">
                              {m.autor_nombre}
                            </span>
                            {isInternal ? (
                              <Badge className="bg-amber-600 hover:bg-amber-600 text-white text-[9px] gap-1 px-1.5 py-0">
                                <Lock className="h-2.5 w-2.5" />
                                NOTA INTERNA (OCULTA AL COMERCIO)
                              </Badge>
                            ) : (
                              <Badge
                                variant={isSupport ? "default" : "secondary"}
                                className="text-[9px] px-1.5 py-0"
                              >
                                {isSupport ? "Soporte Operix" : "Comercio"}
                              </Badge>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(m.created_at).toLocaleString("es-CL")}
                          </span>
                        </div>

                        <div className="text-foreground leading-relaxed whitespace-pre-line">
                          {m.mensaje}
                        </div>

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

                {/* Formulario de Respuesta / Nota Interna */}
                <form
                  onSubmit={handleSendReplyOrInternalNote}
                  className={`p-3.5 rounded-xl border space-y-3 transition-colors ${
                    esNotaInterna
                      ? "bg-amber-500/5 border-amber-500/40"
                      : "bg-card border-border"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEsNotaInterna(false)}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                          !esNotaInterna
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        Respuesta Pública al Comercio
                      </button>
                      <button
                        type="button"
                        onClick={() => setEsNotaInterna(true)}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold inline-flex items-center gap-1 transition-colors ${
                          esNotaInterna
                            ? "bg-amber-600 text-white"
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        <Lock className="h-3 w-3" />
                        Nota Interna Privada
                      </button>
                    </div>

                    {!esNotaInterna && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-muted-foreground">Al enviar cambiar a:</span>
                        <select
                          value={replyNextEstado}
                          onChange={(e) => setReplyNextEstado(e.target.value)}
                          className="h-7 rounded border border-input bg-background px-2 text-xs font-medium"
                        >
                          <option value="">Mantener ({getEstadoLabel(selectedTicket.estado)})</option>
                          <option value="abierto">Abierto</option>
                          <option value="esperando_tienda">Esperando respuesta tienda</option>
                          <option value="en_resolucion">En resolución</option>
                          <option value="resuelto">Resuelto (solicitar evaluación)</option>
                          <option value="cerrado">Cerrado</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <textarea
                    rows={3}
                    placeholder={
                      esNotaInterna
                        ? "Escribe una nota interna confidencial (solo visible para Super Admin)..."
                        : "Escribe la respuesta para el comercio (se notificará por correo vía Resend)..."
                    }
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background p-2.5 text-xs leading-relaxed"
                    required
                  />

                  {replyFiles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {replyFiles.map((f, idx) => (
                        <Badge key={idx} variant="secondary" className="text-[11px] gap-1 pr-1">
                          <span className="truncate max-w-[150px]">{f.name}</span>
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
                      <span>Adjuntar archivo</span>
                      <input
                        type="file"
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                        multiple
                        className="hidden"
                        onChange={handleFileInput}
                      />
                    </label>

                    <Button
                      type="submit"
                      size="sm"
                      disabled={sendingReply || !replyText.trim()}
                      className={`gap-1.5 text-xs font-bold ${
                        esNotaInterna ? "bg-amber-600 hover:bg-amber-700 text-white" : ""
                      }`}
                    >
                      {sendingReply ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Guardando...
                        </>
                      ) : esNotaInterna ? (
                        <>
                          <Lock className="h-3.5 w-3.5" />
                          Guardar Nota Interna
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          Enviar Respuesta al Comercio
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>

      {/* MODAL: CONFIGURACIÓN DE SLA, HORARIOS HÁBILES Y REAPERTURA */}
      <Dialog open={slaModalOpen} onOpenChange={setSlaModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Configuración de SLA y Horarios de Atención</DialogTitle>
            <DialogDescription>
              Define los tiempos objetivo de primera respuesta (en horas hábiles) por prioridad y la ventana de horario hábil de Comercial Hels / Operix.
            </DialogDescription>
          </DialogHeader>

          {config && (
            <form onSubmit={handleSaveSlaConfig} className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-destructive font-bold">Urgente (Horas)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0.25"
                    value={config.sla_urgente_horas}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        sla_urgente_horas: Number(e.target.value),
                      })
                    }
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-amber-600 font-bold">Alta (Horas)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={config.sla_alta_horas}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        sla_alta_horas: Number(e.target.value),
                      })
                    }
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-blue-600 font-bold">Normal (Horas)</Label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    value={config.sla_normal_horas}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        sla_normal_horas: Number(e.target.value),
                      })
                    }
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground font-bold">
                    Baja (Horas)
                  </Label>
                  <Input
                    type="number"
                    step="1"
                    min="1"
                    value={config.sla_baja_horas}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        sla_baja_horas: Number(e.target.value),
                      })
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Inicio Jornada Hábil</Label>
                  <Input
                    type="time"
                    value={config.horario_inicio}
                    onChange={(e) =>
                      setConfig({ ...config, horario_inicio: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Fin Jornada Hábil</Label>
                  <Input
                    type="time"
                    value={config.horario_fin}
                    onChange={(e) =>
                      setConfig({ ...config, horario_fin: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <Label className="text-xs">Plazo Reapertura (Días)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="90"
                    value={config.dias_reapertura}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        dias_reapertura: Number(e.target.value),
                      })
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Correo Oficial de Soporte (Remitente / Alertas)</Label>
                <Input
                  type="email"
                  value={config.email_soporte}
                  onChange={(e) =>
                    setConfig({ ...config, email_soporte: e.target.value })
                  }
                  required
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border">
                <div className="text-xs">
                  <div className="font-semibold">Notificaciones por Correo (Resend)</div>
                  <div className="text-muted-foreground">
                    Notificar automáticamente al comercio al crear, responder o resolver un ticket
                  </div>
                </div>
                <Switch
                  checked={config.notificaciones_activas}
                  onCheckedChange={(v) =>
                    setConfig({ ...config, notificaciones_activas: v })
                  }
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSlaModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={savingSla}>
                  {savingSla ? "Guardando..." : "Guardar SLA y Horarios"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
