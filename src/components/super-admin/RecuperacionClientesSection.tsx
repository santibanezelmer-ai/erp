"use client";

import { useEffect, useState, useMemo } from "react";
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
  Store,
  Mail,
  CheckCircle2,
  MousePointerClick,
  Gift,
  TrendingUp,
  RefreshCw,
  Send,
  Eye,
  Settings2,
  Play,
  Loader2,
  Clock,
  Sparkles,
  MailOpen,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { RecuperacionConfig, StoreRealActivitySummary } from "@/lib/recuperacion.server";

interface RecuperacionMetrics {
  tiendasInactivas: number;
  tiendasRecibieronCorreos: number;
  correosEntregados: number;
  correosAbiertos: number;
  clicsBoton: number;
  promocionesAceptadas: number;
  tiendasRecuperadas: number;
  tasaRecuperacion: number;
  mesesGratuitosOtorgados: number;
}

export function RecuperacionClientesSection() {
  const [loading, setLoading] = useState(true);
  const [runningCron, setRunningCron] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [sendingStoreId, setSendingStoreId] = useState<string | null>(null);

  const [config, setConfig] = useState<RecuperacionConfig | null>(null);
  const [resendConfigured, setResendConfigured] = useState(false);
  const [metrics, setMetrics] = useState<RecuperacionMetrics | null>(null);
  const [stores, setStores] = useState<StoreRealActivitySummary[]>([]);
  const [filterView, setFilterView] = useState<"inactivas" | "enviadas" | "recuperadas" | "todas">(
    "inactivas"
  );

  // Modal de configuración y editor/previsualizador de correos
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewStep, setPreviewStep] = useState<1 | 2>(1);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewSubject, setPreviewSubject] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  const loadRecuperacionData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/recuperacion");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar módulo de recuperación");

      setConfig(data.config);
      setResendConfigured(Boolean(data.resendConfigured));
      setMetrics(data.metrics);
      setStores(data.stores || []);
      if (data.previews?.step1) {
        setPreviewHtml(data.previews.step1.html);
        setPreviewSubject(data.previews.step1.subject);
      }
    } catch (err: any) {
      toast.error(err.message || "Error cargando Recuperación de clientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecuperacionData();
  }, []);

  const filteredStores = useMemo(() => {
    return stores.filter((s) => {
      if (filterView === "inactivas") return s.is_inactive_threshold_met;
      if (filterView === "enviadas") return Boolean(s.campaign?.correo_1_enviado_at);
      if (filterView === "recuperadas")
        return Boolean(s.campaign?.tienda_recuperada) || s.campaign?.estado_promocion === "aceptada";
      return true;
    });
  }, [stores, filterView]);

  const handleSaveConfig = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!config) return;
    setSavingConfig(true);
    try {
      const res = await fetch("/api/super-admin/recuperacion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar la configuración");
      setConfig(data.config);
      toast.success("Configuración de recuperación y plantillas actualizada");
      setConfigModalOpen(false);
      await loadRecuperacionData();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar configuración");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleQuickToggle = async (field: keyof RecuperacionConfig, value: boolean) => {
    if (!config) return;
    const updated = { ...config, [field]: value };
    setConfig(updated);
    try {
      const res = await fetch("/api/super-admin/recuperacion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (!res.ok) throw new Error("Error al guardar cambio");
      toast.success("Ajuste actualizado");
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar ajuste");
    }
  };

  const handleOpenPreview = async (step: 1 | 2) => {
    if (!config) return;
    setPreviewStep(step);
    setPreviewModalOpen(true);
    setLoadingPreview(true);
    try {
      const res = await fetch("/api/super-admin/recuperacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview",
          step,
          ...config,
        }),
      });
      const data = await res.json();
      if (res.ok && data.preview) {
        setPreviewHtml(data.preview.html);
        setPreviewSubject(data.preview.subject);
      }
    } catch {} finally {
      setLoadingPreview(false);
    }
  };

  const handleRunAutomatedCycleNow = async () => {
    setRunningCron(true);
    try {
      const res = await fetch("/api/cron/recuperacion-tiendas?force=1", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al ejecutar barrido de inactividad");

      if (data.errors?.length > 0) {
        toast.warning(
          `Ciclo ejecutado: ${data.sentStep1} Correo 1, ${data.sentStep2} Correo 2. (${data.errors[0].error})`
        );
      } else {
        toast.success(
          `Detección completada: ${data.sentStep1} correos de reactivación y ${data.sentStep2} de 2° seguimiento enviados.`
        );
      }
      await loadRecuperacionData();
    } catch (err: any) {
      toast.error(err.message || "Error al ejecutar automatización");
    } finally {
      setRunningCron(false);
    }
  };

  const handleSendSingleStoreEmail = async (
    store: StoreRealActivitySummary,
    step: 1 | 2,
    forceManual = false
  ) => {
    setSendingStoreId(`${store.negocio_id}-${step}`);
    try {
      const res = await fetch("/api/super-admin/recuperacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_single",
          negocioId: store.negocio_id,
          step,
          forceManual,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo enviar el correo");

      toast.success(
        `Correo ${step === 1 ? "de reactivación" : "de 2° seguimiento"} enviado a ${
          store.owner_email
        } vía Resend`
      );
      await loadRecuperacionData();
    } catch (err: any) {
      toast.error(err.message || "Error al enviar correo con Resend");
    } finally {
      setSendingStoreId(null);
    }
  };

  if (loading && !config) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-2">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">
          Analizando última actividad real de todas las tiendas...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Barra de Estado y Controles Rápidos de Automatización */}
      <Card className="border-primary/20 bg-card">
        <CardContent className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" />
                Motor Automático de Recuperación de Clientes
              </h3>
              <Badge
                variant={config?.automatizacion_activa ? "default" : "secondary"}
                className="text-[10px] font-bold"
              >
                {config?.automatizacion_activa ? "AUTOMATIZACIÓN ACTIVA" : "PAUSADO"}
              </Badge>
              <Badge
                variant="outline"
                className={
                  resendConfigured
                    ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10 text-[10px]"
                    : "border-amber-500/40 text-amber-600 bg-amber-500/10 text-[10px]"
                }
              >
                {resendConfigured
                  ? `Resend Conectado (${config?.remitente_email})`
                  : "Resend API pendiente en servidor"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Detecta tiendas con <strong>{config?.dias_inactividad ?? 12} días</strong> sin actividad real, ofrece{" "}
              <strong>
                {config?.dias_beneficio ?? 30} días gratis (Plan{" "}
                {(config?.plan_beneficio || "pro").toUpperCase()})
              </strong>{" "}
              y envía un 2° seguimiento a los{" "}
              <strong>{config?.dias_segundo_seguimiento ?? 5} días</strong> si continúa inactiva.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/30 text-xs">
              <Switch
                checked={Boolean(config?.automatizacion_activa)}
                onCheckedChange={(v) => handleQuickToggle("automatizacion_activa", v)}
              />
              <span className="font-medium">Envío Automático</span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/30 text-xs">
              <Switch
                checked={Boolean(config?.promocion_activa)}
                onCheckedChange={(v) => handleQuickToggle("promocion_activa", v)}
              />
              <span className="font-medium">Promo 1 Mes Gratis</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => handleOpenPreview(1)}
            >
              <Eye className="h-3.5 w-3.5" />
              Previsualizar y Editar Correos
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setConfigModalOpen(true)}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Reglas ({config?.dias_inactividad}d / +{config?.dias_segundo_seguimiento}d)
            </Button>

            <Button
              size="sm"
              onClick={handleRunAutomatedCycleNow}
              disabled={runningCron}
              className="gap-1.5 text-xs font-bold"
            >
              {runningCron ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Ejecutar Detección Ahora
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 9 Indicadores solicitados para Recuperación de clientes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-3">
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] font-semibold uppercase text-muted-foreground flex items-center justify-between">
              <span>Tiendas Inactivas</span>
              <Clock className="h-3.5 w-3.5 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <div className="text-2xl font-bold">{metrics?.tiendasInactivas ?? 0}</div>
            <p className="text-[10px] text-muted-foreground">
              ≥ {config?.dias_inactividad ?? 12} días sin uso
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] font-semibold uppercase text-muted-foreground flex items-center justify-between">
              <span>Recibieron Correo</span>
              <Mail className="h-3.5 w-3.5 text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <div className="text-2xl font-bold">{metrics?.tiendasRecibieronCorreos ?? 0}</div>
            <p className="text-[10px] text-muted-foreground">Campañas iniciadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] font-semibold uppercase text-muted-foreground flex items-center justify-between">
              <span>Entregados</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <div className="text-2xl font-bold">{metrics?.correosEntregados ?? 0}</div>
            <p className="text-[10px] text-muted-foreground">Vía Resend</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] font-semibold uppercase text-muted-foreground flex items-center justify-between">
              <span>Abiertos</span>
              <MailOpen className="h-3.5 w-3.5 text-indigo-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <div className="text-2xl font-bold">{metrics?.correosAbiertos ?? 0}</div>
            <p className="text-[10px] text-muted-foreground">Lecturas confirmadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] font-semibold uppercase text-muted-foreground flex items-center justify-between">
              <span>Clics Botón</span>
              <MousePointerClick className="h-3.5 w-3.5 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <div className="text-2xl font-bold">{metrics?.clicsBoton ?? 0}</div>
            <p className="text-[10px] text-muted-foreground">En Activar Mes Gratis</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] font-semibold uppercase text-muted-foreground flex items-center justify-between">
              <span>Promos Aceptadas</span>
              <Gift className="h-3.5 w-3.5 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <div className="text-2xl font-bold text-emerald-600">
              {metrics?.promocionesAceptadas ?? 0}
            </div>
            <p className="text-[10px] text-muted-foreground">Confirmadas en panel</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] font-semibold uppercase text-muted-foreground flex items-center justify-between">
              <span>Recuperadas</span>
              <Store className="h-3.5 w-3.5 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <div className="text-2xl font-bold">{metrics?.tiendasRecuperadas ?? 0}</div>
            <p className="text-[10px] text-muted-foreground">Volvieron al ERP</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] font-semibold uppercase text-muted-foreground flex items-center justify-between">
              <span>Tasa Recuperación</span>
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <div className="text-2xl font-bold">{metrics?.tasaRecuperacion ?? 0}%</div>
            <p className="text-[10px] text-muted-foreground">Sobre contactadas</p>
          </CardContent>
        </Card>

        <Card className="col-span-2 sm:col-span-1">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-[11px] font-semibold uppercase text-muted-foreground flex items-center justify-between">
              <span>Meses Gratis</span>
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <div className="text-2xl font-bold">{metrics?.mesesGratuitosOtorgados ?? 0}</div>
            <p className="text-[10px] text-muted-foreground">Beneficios otorgados</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Tiendas Inactivas y Seguimiento de Correos */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold">
                Seguimiento de Inactividad, Correos y Promociones
              </CardTitle>
              <CardDescription className="text-xs">
                Actividad calculada según última sesión, venta, pedido, inventario o acción real en el ERP (excluyendo procesos automáticos).
              </CardDescription>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <Button
                variant={filterView === "inactivas" ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setFilterView("inactivas")}
              >
                Inactivas ≥ {config?.dias_inactividad ?? 12}d ({metrics?.tiendasInactivas ?? 0})
              </Button>
              <Button
                variant={filterView === "enviadas" ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setFilterView("enviadas")}
              >
                Con Correo Enviado ({metrics?.tiendasRecibieronCorreos ?? 0})
              </Button>
              <Button
                variant={filterView === "recuperadas" ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setFilterView("recuperadas")}
              >
                Recuperadas ({metrics?.tiendasRecuperadas ?? 0})
              </Button>
              <Button
                variant={filterView === "todas" ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setFilterView("todas")}
              >
                Todas ({stores.length})
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={loadRecuperacionData}
                title="Refrescar"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filteredStores.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No hay tiendas en esta vista actualmente.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                    <th className="py-3 px-3 font-semibold">Tienda / Destinatario</th>
                    <th className="py-3 px-3 font-semibold">Última Actividad Real</th>
                    <th className="py-3 px-3 font-semibold">Inactividad</th>
                    <th className="py-3 px-3 font-semibold">1° Correo (Reactivación)</th>
                    <th className="py-3 px-3 font-semibold">2° Seguimiento (+{config?.dias_segundo_seguimiento ?? 5}d)</th>
                    <th className="py-3 px-3 font-semibold">Apertura / Clic</th>
                    <th className="py-3 px-3 font-semibold">Estado Promoción</th>
                    <th className="py-3 px-3 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredStores.map((st) => {
                    const camp = st.campaign;
                    const sending1 = sendingStoreId === `${st.negocio_id}-1`;
                    const sending2 = sendingStoreId === `${st.negocio_id}-2`;

                    return (
                      <tr key={st.negocio_id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-foreground">{st.nombre}</div>
                          <div className="text-xs text-muted-foreground">/{st.slug}</div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                            {st.owner_email || (
                              <span className="text-amber-600 italic">Sin correo registrado</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-xs">
                          <div className="font-medium text-foreground">
                            {new Date(st.last_real_activity_at).toLocaleDateString("es-CL", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {st.last_activity_type}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <Badge
                            variant="outline"
                            className={
                              st.is_inactive_threshold_met
                                ? "border-amber-500/40 text-amber-600 bg-amber-500/10 text-[10px] font-bold"
                                : "border-emerald-500/40 text-emerald-600 bg-emerald-500/10 text-[10px]"
                            }
                          >
                            {st.inactive_days} {st.inactive_days === 1 ? "día" : "días"}
                          </Badge>
                          {camp?.inactividad_detectada_at && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              Detectada:{" "}
                              {new Date(camp.inactividad_detectada_at).toLocaleDateString("es-CL")}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-3 text-xs">
                          {camp?.correo_1_enviado_at ? (
                            <div>
                              <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                                {camp.correo_1_estado}
                              </Badge>
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {new Date(camp.correo_1_enviado_at).toLocaleDateString("es-CL")}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">No enviado</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-xs">
                          {camp?.correo_2_enviado_at ? (
                            <div>
                              <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                                {camp.correo_2_estado || "enviado"}
                              </Badge>
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {new Date(camp.correo_2_enviado_at).toLocaleDateString("es-CL")}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Pendiente</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-xs">
                          <div className="space-y-0.5">
                            {camp?.primer_abierto_at ? (
                              <div className="text-[11px] text-indigo-600 font-medium">
                                Abierto: {new Date(camp.primer_abierto_at).toLocaleDateString("es-CL")}
                              </div>
                            ) : (
                              <div className="text-[11px] text-muted-foreground">Sin apertura</div>
                            )}
                            {camp?.primer_clic_at && (
                              <div className="text-[11px] text-primary font-bold">
                                Clic: {new Date(camp.primer_clic_at).toLocaleDateString("es-CL")}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-xs">
                          {camp ? (
                            <div>
                              <Badge
                                variant={
                                  camp.estado_promocion === "aceptada" ? "default" : "outline"
                                }
                                className={
                                  camp.estado_promocion === "aceptada"
                                    ? "bg-emerald-600 hover:bg-emerald-600 text-[10px]"
                                    : "text-[10px]"
                                }
                              >
                                {camp.estado_promocion === "aceptada"
                                  ? `ACEPTADA (${camp.dias_otorgados}D)`
                                  : camp.estado_promocion.toUpperCase()}
                              </Badge>
                              {camp.promocion_vence_at && (
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  Vence:{" "}
                                  {new Date(camp.promocion_vence_at).toLocaleDateString("es-CL")}
                                </div>
                              )}
                              {camp.tienda_recuperada && camp.reactivada_at && (
                                <div className="text-[10px] text-emerald-600 font-semibold">
                                  Recuperada:{" "}
                                  {new Date(camp.reactivada_at).toLocaleDateString("es-CL")}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Sin campaña</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {!camp?.correo_1_enviado_at ? (
                              <Button
                                variant="default"
                                size="sm"
                                className="h-8 text-xs gap-1"
                                disabled={!st.owner_email || Boolean(sendingStoreId)}
                                onClick={() => handleSendSingleStoreEmail(st, 1, false)}
                              >
                                {sending1 ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Send className="h-3.5 w-3.5" />
                                )}
                                Enviar 1° Correo
                              </Button>
                            ) : !camp.correo_2_enviado_at && !camp.tienda_recuperada ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-1 border-primary/30 text-primary"
                                disabled={!st.owner_email || Boolean(sendingStoreId)}
                                onClick={() => handleSendSingleStoreEmail(st, 2, false)}
                              >
                                {sending2 ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Mail className="h-3.5 w-3.5" />
                                )}
                                Enviar 2° Seguimiento
                              </Button>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">
                                {camp.tienda_recuperada ? "Tienda Recuperada ✓" : "Seguimiento Completo"}
                              </Badge>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL 1: CONFIGURACIÓN DE REGLAS Y PROMOCIÓN */}
      <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Configuración de Recuperación Automática</DialogTitle>
            <DialogDescription>
              Ajusta los días de inactividad, el segundo seguimiento y las condiciones del beneficio gratuito.
            </DialogDescription>
          </DialogHeader>

          {config && (
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cfg-dias-inac">Días de Inactividad (1° Correo)</Label>
                  <Input
                    id="cfg-dias-inac"
                    type="number"
                    min={1}
                    max={365}
                    value={config.dias_inactividad}
                    onChange={(e) =>
                      setConfig({ ...config, dias_inactividad: Number(e.target.value) })
                    }
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cfg-dias-seg">Días para 2° Seguimiento</Label>
                  <Input
                    id="cfg-dias-seg"
                    type="number"
                    min={1}
                    max={90}
                    value={config.dias_segundo_seguimiento}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        dias_segundo_seguimiento: Number(e.target.value),
                      })
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cfg-dias-ben">Duración del Beneficio (Días)</Label>
                  <Input
                    id="cfg-dias-ben"
                    type="number"
                    min={1}
                    max={365}
                    value={config.dias_beneficio}
                    onChange={(e) =>
                      setConfig({ ...config, dias_beneficio: Number(e.target.value) })
                    }
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cfg-plan-ben">Plan Otorgado</Label>
                  <select
                    id="cfg-plan-ben"
                    value={config.plan_beneficio}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        plan_beneficio: e.target.value as "basico" | "pro" | "enterprise",
                      })
                    }
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="basico">Plan Básico</option>
                    <option value="pro">Plan Pro</option>
                    <option value="enterprise">Plan Enterprise</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cfg-rem-nom">Nombre del Remitente</Label>
                  <Input
                    id="cfg-rem-nom"
                    value={config.remitente_nombre}
                    onChange={(e) =>
                      setConfig({ ...config, remitente_nombre: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cfg-rem-em">Correo Remitente (Resend)</Label>
                  <Input
                    id="cfg-rem-em"
                    type="email"
                    value={config.remitente_email}
                    onChange={(e) =>
                      setConfig({ ...config, remitente_email: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-border">
                  <div className="text-xs">
                    <div className="font-semibold">Segundo Correo de Seguimiento</div>
                    <div className="text-muted-foreground">
                      Enviar recordatorio si sigue sin actividad tras el primer correo
                    </div>
                  </div>
                  <Switch
                    checked={config.segundo_seguimiento_activo}
                    onCheckedChange={(v) =>
                      setConfig({ ...config, segundo_seguimiento_activo: v })
                    }
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfigModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={savingConfig}>
                  {savingConfig ? "Guardando..." : "Guardar Configuración"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL 2: EDITOR Y PREVISUALIZADOR DE CORREOS HTML */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editor y Previsualización de Correos de Recuperación</DialogTitle>
            <DialogDescription>
              Personaliza el asunto, mensaje y botón de llamada a la acción. Puedes usar{" "}
              <code className="text-xs font-mono bg-muted px-1 rounded">{"{{tienda}}"}</code>,{" "}
              <code className="text-xs font-mono bg-muted px-1 rounded">{"{{dias}}"}</code> y{" "}
              <code className="text-xs font-mono bg-muted px-1 rounded">{"{{plan}}"}</code>.
            </DialogDescription>
          </DialogHeader>

          {config && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={previewStep === 1 ? "default" : "outline"}
                  onClick={() => handleOpenPreview(1)}
                >
                  1° Correo ({config.dias_inactividad} días de inactividad)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={previewStep === 2 ? "default" : "outline"}
                  onClick={() => handleOpenPreview(2)}
                >
                  2° Correo de Seguimiento (+{config.dias_segundo_seguimiento} días)
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Editor */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Asunto del Correo</Label>
                    <Input
                      value={
                        previewStep === 1 ? config.asunto_correo_1 : config.asunto_correo_2
                      }
                      onChange={(e) =>
                        setConfig(
                          previewStep === 1
                            ? { ...config, asunto_correo_1: e.target.value }
                            : { ...config, asunto_correo_2: e.target.value }
                        )
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Cuerpo del Mensaje</Label>
                    <textarea
                      rows={9}
                      value={
                        previewStep === 1 ? config.cuerpo_correo_1 : config.cuerpo_correo_2
                      }
                      onChange={(e) =>
                        setConfig(
                          previewStep === 1
                            ? { ...config, cuerpo_correo_1: e.target.value }
                            : { ...config, cuerpo_correo_2: e.target.value }
                        )
                      }
                      className="w-full rounded-md border border-input bg-background p-3 text-xs leading-relaxed"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Texto del Botón Destacado</Label>
                    <Input
                      value={config.texto_boton}
                      onChange={(e) =>
                        setConfig({ ...config, texto_boton: e.target.value })
                      }
                    />
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => handleOpenPreview(previewStep)}
                    disabled={loadingPreview}
                  >
                    {loadingPreview ? "Actualizando vista previa..." : "Actualizar Vista Previa →"}
                  </Button>
                </div>

                {/* Vista Previa HTML Real */}
                <div className="rounded-xl border border-border overflow-hidden bg-slate-100 flex flex-col">
                  <div className="bg-slate-800 text-white px-3 py-2 text-xs">
                    <div className="opacity-75">
                      De: {config.remitente_nombre} &lt;{config.remitente_email}&gt;
                    </div>
                    <div className="font-bold truncate">Asunto: {previewSubject}</div>
                  </div>
                  <div className="flex-1 min-h-[380px] bg-white">
                    <iframe
                      title="Email Preview"
                      srcDoc={previewHtml}
                      className="w-full h-[420px] border-0"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setPreviewModalOpen(false)}>
                  Cerrar
                </Button>
                <Button onClick={() => handleSaveConfig()} disabled={savingConfig}>
                  {savingConfig ? "Guardando..." : "Guardar Plantillas"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
