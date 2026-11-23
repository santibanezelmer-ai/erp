"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTenant } from "@/contexts/tenant-context";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
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
  ShieldCheck,
  Store,
  Users,
  Package,
  DollarSign,
  TrendingUp,
  Search,
  RefreshCw,
  Eye,
  CreditCard,
  Trash2,
  Ticket,
  Plus,
  ExternalLink,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Mail,
  MapPin,
  Globe,
  Copy,
  Send,
  Sparkles,
  LayoutDashboard,
  Bot,
  FileSearch,
  Sliders,
  Play,
  Clock,
  Activity,
  Check,
  XCircle,
  Calendar,
  LifeBuoy,
} from "lucide-react";
import { toast } from "sonner";
import { RecuperacionClientesSection } from "@/components/super-admin/RecuperacionClientesSection";
import { CentroSoporteSection } from "@/components/super-admin/CentroSoporteSection";
import type { RecuperacionConfig } from "@/lib/recuperacion.server";

export type SuperAdminModuleId =
  | "resumen"
  | "comercios"
  | "usuarios"
  | "suscripciones"
  | "recuperacion"
  | "automatizaciones"
  | "cupones"
  | "comunicaciones"
  | "auditoria"
  | "configuracion"
  | "soporte";

interface GlobalKpis {
  total_negocios: number;
  total_usuarios: number;
  total_productos: number;
  total_ventas: number;
  ingresos_totales: number;
  por_plan: Record<string, number> | null;
  por_estado_susc: Record<string, number> | null;
}

interface NegocioRow {
  id: string;
  nombre: string;
  slug: string;
  plan: string | null;
  tipo_negocio: string;
  perfil?: string | null;
  rut?: string | null;
  direccion?: string | null;
  created_at: string;
}

interface SuscripcionRow {
  id: string;
  negocio_id: string;
  plan: string;
  estado: string;
  proveedor?: string;
  ciclo?: string | null;
  inicio_at?: string;
  vence_at: string | null;
  proximo_cobro_at?: string | null;
  mp_payer_email?: string | null;
  mp_preapproval_id?: string | null;
  notas: string | null;
  updated_at: string;
}

interface MpPagoRow {
  id: string;
  negocio_id: string | null;
  payment_id: string | null;
  plan: string | null;
  ciclo: string | null;
  monto: number | null;
  moneda: string | null;
  estado: string;
  detalle: string | null;
  created_at: string;
}

interface ProfileRow {
  id: string;
  nombre: string;
  email: string | null;
  negocio_id: string | null;
  sucursal_id: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

interface UserRoleRow {
  id: string;
  user_id: string;
  negocio_id: string | null;
  role: string;
}

interface CuponRow {
  id: string;
  codigo: string;
  plan: string;
  dias_otorgados: number;
  max_usos: number | null;
  usos: number;
  vence_at: string | null;
  activo: boolean;
  notas: string | null;
  created_at: string;
}

interface CuponCanjeRow {
  id: string;
  cupon_id: string;
  negocio_id: string;
  user_id: string;
  plan_aplicado: string;
  dias_aplicados: number;
  vence_at_nuevo: string;
  created_at: string;
}

interface AuditLogRow {
  id: string;
  negocio_id: string;
  usuario_id: string | null;
  action: string | null;
  entity_type: string | null;
  entity_id: string | null;
  before_data: any;
  after_data: any;
  created_at: string;
}

interface TimeSeriesPoint {
  date: string;
  nuevasTiendas: number;
  nuevosUsuarios: number;
  ventasCount: number;
  gmvComercios: number;
  ingresosOperix: number;
}

interface GeoMetadata {
  countryCode?: string | null;
  countryName?: string | null;
  region?: string | null;
  city?: string | null;
  timezone?: string | null;
}

interface StoreContactInfo {
  email: string | null;
  nombre: string | null;
  telefono: string | null;
  direccion: string | null;
  geo: GeoMetadata | null;
}

const COUNTRY_FLAGS: Record<string, string> = {
  CL: "🇨🇱",
  AR: "🇦🇷",
  PE: "🇵🇪",
  CO: "🇨🇴",
  MX: "🇲🇽",
  UY: "🇺🇾",
  PY: "🇵🇾",
  BO: "🇧🇴",
  EC: "🇪🇨",
  VE: "🇻🇪",
  BR: "🇧🇷",
  ES: "🇪🇸",
  US: "🇺🇸",
};

function inferFallbackLocation(
  neg: NegocioRow,
  contact?: StoreContactInfo
): { country: string; city: string | null; flag: string; isInferred: boolean } | null {
  const geo = contact?.geo;
  if (geo?.countryName) {
    const code = (geo.countryCode || "").toUpperCase();
    return {
      country: geo.countryName,
      city: geo.city || geo.region || null,
      flag: COUNTRY_FLAGS[code] || "🌎",
      isInferred: false,
    };
  }

  const dir = (contact?.direccion || neg.direccion || "").trim();
  const tel = (contact?.telefono || "").trim();
  const rut = (neg.rut || "").trim();

  if (tel.startsWith("+56") || /^\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]$/.test(rut)) {
    return {
      country: "Chile",
      city: dir ? dir.split(",").pop()?.trim() || dir : null,
      flag: "🇨🇱",
      isInferred: true,
    };
  }
  if (tel.startsWith("+54"))
    return { country: "Argentina", city: dir || null, flag: "🇦🇷", isInferred: true };
  if (tel.startsWith("+51"))
    return { country: "Perú", city: dir || null, flag: "🇵🇪", isInferred: true };
  if (tel.startsWith("+57"))
    return { country: "Colombia", city: dir || null, flag: "🇨🇴", isInferred: true };
  if (tel.startsWith("+52"))
    return { country: "México", city: dir || null, flag: "🇲🇽", isInferred: true };
  if (dir) return { country: "Dirección local", city: dir, flag: "📍", isInferred: true };

  return null;
}

const MODULES_MENU: {
  id: SuperAdminModuleId;
  label: string;
  shortLabel: string;
  icon: any;
}[] = [
  { id: "resumen", label: "1. Resumen Ejecutivo", shortLabel: "Resumen", icon: LayoutDashboard },
  { id: "comercios", label: "2. Tiendas y Comercios", shortLabel: "Tiendas", icon: Store },
  { id: "usuarios", label: "3. Usuarios", shortLabel: "Usuarios", icon: Users },
  { id: "suscripciones", label: "4. Suscripciones y Planes", shortLabel: "Suscripciones", icon: CreditCard },
  { id: "recuperacion", label: "5. Recuperación de Clientes", shortLabel: "Recuperación", icon: Sparkles },
  { id: "automatizaciones", label: "6. Automatizaciones", shortLabel: "Automatizaciones", icon: Bot },
  { id: "cupones", label: "7. Cupones y Promociones", shortLabel: "Cupones", icon: Ticket },
  { id: "comunicaciones", label: "8. Comunicaciones y Correos", shortLabel: "Comunicaciones", icon: Mail },
  { id: "auditoria", label: "9. Auditoría Administrativa", shortLabel: "Auditoría", icon: FileSearch },
  { id: "configuracion", label: "10. Configuración Global", shortLabel: "Configuración", icon: Sliders },
  { id: "soporte", label: "11. Centro de Soporte", shortLabel: "Soporte", icon: LifeBuoy },
];

function SuperAdminConsoleInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSuperAdmin, loading: tenantLoading } = useTenant();

  const urlMod = (searchParams.get("mod") as SuperAdminModuleId) || "resumen";
  const activeModule: SuperAdminModuleId = MODULES_MENU.some((m) => m.id === urlMod)
    ? urlMod
    : "resumen";

  const setActiveModule = (mod: SuperAdminModuleId) => {
    router.push(`/super-admin?mod=${mod}`);
  };

  const [loading, setLoading] = useState(true);
  const [periodDays, setPeriodDays] = useState<7 | 30 | 90>(30);

  // Datos consolidados del servidor
  const [kpis, setKpis] = useState<GlobalKpis | null>(null);
  const [executive, setExecutive] = useState<any | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([]);
  const [negocios, setNegocios] = useState<NegocioRow[]>([]);
  const [suscripciones, setSuscripciones] = useState<SuscripcionRow[]>([]);
  const [suscripcionesMap, setSuscripcionesMap] = useState<Record<string, SuscripcionRow>>({});
  const [mpPagos, setMpPagos] = useState<MpPagoRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [userRoles, setUserRoles] = useState<UserRoleRow[]>([]);
  const [cupones, setCupones] = useState<CuponRow[]>([]);
  const [cuponCanjes, setCuponCanjes] = useState<CuponCanjeRow[]>([]);
  const [contactsMap, setContactsMap] = useState<Record<string, StoreContactInfo>>({});
  const [storesActivityMap, setStoresActivityMap] = useState<Record<string, any>>({});
  const [communications, setCommunications] = useState<any | null>(null);
  const [automations, setAutomations] = useState<any | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [recConfig, setRecConfig] = useState<RecuperacionConfig | null>(null);
  const [emailPreviews, setEmailPreviews] = useState<any | null>(null);

  // Filtros en Tiendas
  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [estadoFilter, setEstadoFilter] = useState<string>("all");

  // Filtros en Usuarios
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<string>("all");
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  // Filtros en Auditoría
  const [auditSearch, setAuditSearch] = useState("");

  // Automatizaciones en ejecución manual
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [lastJobResult, setLastJobResult] = useState<Record<string, any>>({});

  // Modal de ajuste de suscripción
  const [editingNegocio, setEditingNegocio] = useState<NegocioRow | null>(null);
  const [subPlan, setSubPlan] = useState<string>("pro");
  const [subEstado, setSubEstado] = useState<string>("activa");
  const [subVenceAt, setSubVenceAt] = useState<string>("");
  const [subNotas, setSubNotas] = useState<string>("");
  const [savingSub, setSavingSub] = useState(false);

  // Modal de métricas detalladas de una tienda
  const [detailNegocio, setDetailNegocio] = useState<NegocioRow | null>(null);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modal de envío de correo directo
  const [emailNegocio, setEmailNegocio] = useState<NegocioRow | null>(null);
  const [emailTo, setEmailTo] = useState("");
  const [emailTemplate, setEmailTemplate] = useState<
    "reactivacion" | "trial_por_vencer" | "cupon_regalo"
  >("reactivacion");
  const [emailCupon, setEmailCupon] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  // Modal de eliminación de comercio
  const [deletingNegocio, setDeletingNegocio] = useState<NegocioRow | null>(null);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");
  const [deletingLoading, setDeletingLoading] = useState(false);

  // Modal de creación/edición de cupón
  const [cuponModalOpen, setCuponModalOpen] = useState(false);
  const [editingCuponId, setEditingCuponId] = useState<string | null>(null);
  const [cuponCodigo, setCuponCodigo] = useState("");
  const [cuponPlan, setCuponPlan] = useState("pro");
  const [cuponDias, setCuponDias] = useState(30);
  const [cuponMaxUsos, setCuponMaxUsos] = useState<string>("");
  const [cuponVenceAt, setCuponVenceAt] = useState<string>("");
  const [cuponActivo, setCuponActivo] = useState(true);
  const [cuponNotas, setCuponNotas] = useState("");
  const [savingCupon, setSavingCupon] = useState(false);

  // Guardado de configuración global
  const [savingGlobalCfg, setSavingGlobalCfg] = useState(false);

  useEffect(() => {
    if (!tenantLoading && !isSuperAdmin) {
      router.replace("/dashboard");
    }
  }, [tenantLoading, isSuperAdmin, router]);

  useEffect(() => {
    if (isSuperAdmin) {
      loadOverviewData();
    }
  }, [isSuperAdmin]);

  const loadOverviewData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/super-admin/overview");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar consola Super Admin");

      setKpis(data.kpis);
      setExecutive(data.executive);
      setTimeSeries(data.timeSeries || []);
      setNegocios(data.negocios || []);
      setSuscripciones(data.suscripciones || []);
      setMpPagos(data.mpPagos || []);
      setProfiles(data.profiles || []);
      setUserRoles(data.userRoles || []);
      setCupones(data.cupones || []);
      setCuponCanjes(data.cuponCanjes || []);
      setCommunications(data.communications || null);
      setAutomations(data.automations || null);
      setAuditLogs(data.auditLogs || []);
      setRecConfig(data.recuperacionConfig || null);
      setEmailPreviews(data.emailPreviews || null);

      const sMap: Record<string, SuscripcionRow> = {};
      for (const s of (data.suscripciones || []) as SuscripcionRow[]) {
        sMap[s.negocio_id] = s;
      }
      setSuscripcionesMap(sMap);

      const actMap: Record<string, any> = {};
      for (const st of data.storesActivity || []) {
        actMap[st.negocio_id] = st;
      }
      setStoresActivityMap(actMap);

      const cMap: Record<string, StoreContactInfo> = {};
      for (const p of (data.profiles || []) as ProfileRow[]) {
        if (p.negocio_id && !cMap[p.negocio_id]) {
          cMap[p.negocio_id] = {
            email: p.email || null,
            nombre: p.nombre || null,
            telefono: null,
            direccion: null,
            geo: null,
          };
        }
      }
      for (const c of data.configuraciones || []) {
        if (!c.negocio_id) continue;
        const existing = cMap[c.negocio_id] || {
          email: null,
          nombre: null,
          telefono: null,
          direccion: null,
          geo: null,
        };
        const ov =
          c.modulos_override && typeof c.modulos_override === "object"
            ? (c.modulos_override as Record<string, any>)
            : {};
        cMap[c.negocio_id] = {
          ...existing,
          telefono: c.telefono || existing.telefono,
          direccion: c.direccion || existing.direccion,
          geo: (ov.__geo || ov.__last_geo || null) as GeoMetadata | null,
        };
      }
      for (const negId of Object.keys(sMap)) {
        if (!cMap[negId]?.email && sMap[negId]?.mp_payer_email) {
          cMap[negId] = {
            ...(cMap[negId] || { nombre: null, telefono: null, direccion: null, geo: null }),
            email: sMap[negId].mp_payer_email || null,
          };
        }
      }
      setContactsMap(cMap);
    } catch (err: any) {
      console.error("Error cargando Super Admin:", err);
      toast.error(err.message || "Error al cargar métricas globales");
    } finally {
      setLoading(false);
    }
  };

  const negocioNameById = useMemo(() => {
    const map: Record<string, NegocioRow> = {};
    for (const n of negocios) map[n.id] = n;
    return map;
  }, [negocios]);

  const geoSummary = useMemo(() => {
    const counts: Record<string, { label: string; flag: string; count: number }> = {};
    for (const n of negocios) {
      const loc = inferFallbackLocation(n, contactsMap[n.id]);
      if (loc) {
        const key = loc.city ? `${loc.country} · ${loc.city}` : loc.country;
        if (!counts[key]) counts[key] = { label: key, flag: loc.flag, count: 0 };
        counts[key].count += 1;
      }
    }
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [negocios, contactsMap]);

  // Serie temporal filtrada por el período seleccionado (7, 30 o 90 días)
  const filteredSeries = useMemo(() => {
    return timeSeries.slice(-periodDays);
  }, [timeSeries, periodDays]);

  const periodTotals = useMemo(() => {
    return filteredSeries.reduce(
      (acc, pt) => {
        acc.nuevasTiendas += pt.nuevasTiendas;
        acc.nuevosUsuarios += pt.nuevosUsuarios;
        acc.ventasCount += pt.ventasCount;
        acc.gmvComercios += pt.gmvComercios;
        acc.ingresosOperix += pt.ingresosOperix;
        return acc;
      },
      {
        nuevasTiendas: 0,
        nuevosUsuarios: 0,
        ventasCount: 0,
        gmvComercios: 0,
        ingresosOperix: 0,
      }
    );
  }, [filteredSeries]);

  const filteredNegocios = useMemo(() => {
    return negocios.filter((n) => {
      const susc = suscripcionesMap[n.id];
      const contact = contactsMap[n.id];
      const effectivePlan = susc?.plan || n.plan || "free";
      const isVencida = Boolean(susc?.vence_at && new Date(susc.vence_at).getTime() < Date.now());
      const effectiveEstado = isVencida ? "vencida" : susc?.estado || "activa";

      const matchesPlan = planFilter === "all" || effectivePlan === planFilter;
      const matchesEstado =
        estadoFilter === "all" ||
        effectiveEstado === estadoFilter ||
        (estadoFilter === "inactivas" &&
          (effectiveEstado === "vencida" ||
            effectiveEstado === "suspendida" ||
            effectiveEstado === "cancelada" ||
            effectivePlan === "free"));

      const q = searchQuery.trim().toLowerCase();
      const loc = inferFallbackLocation(n, contact);
      const locString = loc ? `${loc.country} ${loc.city || ""}`.toLowerCase() : "";

      const matchesQuery =
        !q ||
        n.nombre.toLowerCase().includes(q) ||
        n.slug.toLowerCase().includes(q) ||
        (n.rut && n.rut.toLowerCase().includes(q)) ||
        (contact?.email && contact.email.toLowerCase().includes(q)) ||
        locString.includes(q);

      return matchesPlan && matchesEstado && matchesQuery;
    });
  }, [negocios, suscripcionesMap, contactsMap, searchQuery, planFilter, estadoFilter]);

  const rolesByUserMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const r of userRoles) {
      if (!map[r.user_id]) map[r.user_id] = [];
      if (!map[r.user_id].includes(r.role)) map[r.user_id].push(r.role);
    }
    return map;
  }, [userRoles]);

  const filteredProfiles = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return profiles.filter((p) => {
      const roles = rolesByUserMap[p.id] || ["admin"];
      if (userRoleFilter !== "all" && !roles.includes(userRoleFilter)) return false;
      if (!q) return true;
      const storeName = p.negocio_id ? negocioNameById[p.negocio_id]?.nombre || "" : "";
      return (
        p.nombre?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        storeName.toLowerCase().includes(q)
      );
    });
  }, [profiles, rolesByUserMap, userRoleFilter, userSearch, negocioNameById]);

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return auditLogs;
    return auditLogs.filter((a) => {
      const storeName = negocioNameById[a.negocio_id]?.nombre || "";
      return (
        a.action?.toLowerCase().includes(q) ||
        a.entity_type?.toLowerCase().includes(q) ||
        storeName.toLowerCase().includes(q)
      );
    });
  }, [auditLogs, auditSearch, negocioNameById]);

  // Acciones de Usuarios
  const handleToggleUserStatus = async (prof: ProfileRow) => {
    setTogglingUserId(prof.id);
    try {
      const res = await fetch("/api/super-admin/overview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_user_status",
          userId: prof.id,
          activo: !prof.activo,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cambiar estado del usuario");
      toast.success(
        `Usuario ${prof.email || prof.nombre} ${!prof.activo ? "activado" : "desactivado"}`
      );
      await loadOverviewData();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar usuario");
    } finally {
      setTogglingUserId(null);
    }
  };

  // Acciones de Automatizaciones
  const handleRunRecoveryAutomation = async () => {
    setRunningJob("recovery");
    try {
      const res = await fetch("/api/cron/recuperacion-tiendas?force=1", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al ejecutar proceso");
      setLastJobResult((prev) => ({ ...prev, recovery: data }));
      toast.success(
        `Proceso finalizado en ${data.durationMs ?? 0}ms: ${data.sentStep1} Correo 1, ${data.sentStep2} Correo 2 enviados.`
      );
      await loadOverviewData();
    } catch (err: any) {
      toast.error(err.message || "Error en proceso de recuperación");
    } finally {
      setRunningJob(null);
    }
  };

  const handleRunExpiredSubscriptionsJob = async () => {
    setRunningJob("expired_subs");
    try {
      const res = await fetch("/api/super-admin/overview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_expired_subscriptions_job" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al ejecutar suspensión de vencidas");
      setLastJobResult((prev) => ({ ...prev, expired_subs: data }));
      toast.success(
        `Proceso completado en ${data.durationMs}ms: ${data.suspendedCount} suscripciones vencidas actualizadas.`
      );
      await loadOverviewData();
    } catch (err: any) {
      toast.error(err.message || "Error al ejecutar tarea");
    } finally {
      setRunningJob(null);
    }
  };

  const handleRemoveSuppressedEmail = async (email: string) => {
    try {
      const res = await fetch("/api/super-admin/overview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove_suppressed_email", email }),
      });
      if (!res.ok) throw new Error("No se pudo rehabilitar el correo");
      toast.success(`Correo ${email} rehabilitado para recibir comunicaciones`);
      await loadOverviewData();
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar de lista de bajas");
    }
  };

  const handleSaveGlobalRecConfig = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!recConfig) return;
    setSavingGlobalCfg(true);
    try {
      const res = await fetch("/api/super-admin/recuperacion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recConfig),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar configuración");
      setRecConfig(data.config);
      toast.success("Configuración global actualizada correctamente");
      await loadOverviewData();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar configuración global");
    } finally {
      setSavingGlobalCfg(false);
    }
  };

  // Plantillas de correo manual
  const buildEmailContent = (
    neg: NegocioRow,
    template: "reactivacion" | "trial_por_vencer" | "cupon_regalo",
    selectedCouponCode: string
  ) => {
    const contact = contactsMap[neg.id];
    const ownerName = contact?.nombre || neg.nombre;
    const cuponObj = cupones.find((c) => c.codigo === selectedCouponCode);

    if (template === "reactivacion") {
      setEmailSubject(`Reactiva tu tienda ${neg.nombre} en Operix ERP`);
      setEmailBody(
        `Hola ${ownerName},\n\nNotamos que la suscripción de tu comercio "${neg.nombre}" en Operix ERP se encuentra inactiva o vencida.\n\nToda tu información de productos, inventario, clientes y configuración sigue guardada de forma segura en la nube para que puedas retomar tus ventas y tu catálogo online (/c/${neg.slug}) en cualquier momento.${
          selectedCouponCode
            ? `\n\nPara ayudarte a regresar, hemos activado el cupón promocional ${selectedCouponCode}${
                cuponObj
                  ? ` (${cuponObj.dias_otorgados} días gratis en Plan ${cuponObj.plan.toUpperCase()})`
                  : ""
              } que puedes canjear directamente en tu panel.`
            : ""
        }\n\nHaz clic en el botón de abajo para reactivar tu cuenta hoy mismo.`
      );
    } else if (template === "trial_por_vencer") {
      setEmailSubject(`Tu período de prueba en Operix ERP para ${neg.nombre}`);
      setEmailBody(
        `Hola ${ownerName},\n\nEsperamos que estés teniendo una excelente experiencia gestionando "${neg.nombre}" con Operix ERP.\n\nTe escribimos para recordarte que tu período de prueba está próximo a finalizar. Para mantener activo tu Punto de Venta (POS), control de stock y tienda online sin interrupciones, puedes elegir tu plan Mensual o Anual (con 2 meses gratis) desde la sección Planes y Suscripción.`
      );
    } else {
      setEmailSubject(
        `🎁 Tienes un beneficio especial para activar ${neg.nombre} en Operix ERP`
      );
      setEmailBody(
        `Hola ${ownerName},\n\nQueremos impulsar el crecimiento de "${neg.nombre}". Te enviamos un código promocional exclusivo para activar todas las herramientas Pro de Operix ERP (Punto de Venta, Catálogo Web, Reportes y Multi-sucursal) sin costo durante el período promocional.\n\nIngresa a tu cuenta, ve a Planes y Suscripción e introduce el cupón adjunto.`
      );
    }
  };

  const openReactivationEmailModal = (neg: NegocioRow) => {
    const contact = contactsMap[neg.id];
    const defaultCoupon = cupones.find((c) => c.activo)?.codigo || "";
    setEmailNegocio(neg);
    setEmailTo(contact?.email || "");
    setEmailTemplate("reactivacion");
    setEmailCupon(defaultCoupon);
    buildEmailContent(neg, "reactivacion", defaultCoupon);
  };

  const handleTemplateChange = (
    newTemplate: "reactivacion" | "trial_por_vencer" | "cupon_regalo",
    newCoupon: string
  ) => {
    setEmailTemplate(newTemplate);
    setEmailCupon(newCoupon);
    if (emailNegocio) buildEmailContent(emailNegocio, newTemplate, newCoupon);
  };

  const handleSendReactivationEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailNegocio) return;
    if (!emailTo.trim()) {
      toast.error("Ingresa el correo del destinatario");
      return;
    }

    setSendingEmail(true);
    try {
      const res = await fetch("/api/super-admin/send-reactivation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toEmail: emailTo.trim(),
          storeName: emailNegocio.nombre,
          storeSlug: emailNegocio.slug,
          subject: emailSubject,
          message: emailBody,
          cuponCodigo: emailCupon || undefined,
          reactivationUrl: "https://operixerp.cloud/planes",
        }),
      });

      const data = await res.json();
      if (res.ok && data.sentViaApi) {
        toast.success(`Correo enviado directamente a ${emailTo} vía Resend`);
        setEmailNegocio(null);
        await loadOverviewData();
        return;
      }

      const fullText = `${emailBody}${
        emailCupon ? `\n\nCupón promocional: ${emailCupon}` : ""
      }\n\nReactiva tu tienda aquí: https://operixerp.cloud/planes`;

      const mailtoUrl = `mailto:${encodeURIComponent(
        emailTo.trim()
      )}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(fullText)}`;

      window.open(mailtoUrl, "_blank");
      toast.info("Se abrió tu cliente de correo con el mensaje prellenado.");
      setEmailNegocio(null);
    } catch (err: any) {
      toast.error(err.message || "Error al enviar el correo");
    } finally {
      setSendingEmail(false);
    }
  };

  const openEditSubscription = (neg: NegocioRow) => {
    const susc = suscripcionesMap[neg.id];
    setEditingNegocio(neg);
    setSubPlan(
      susc?.plan && ["free", "pro", "enterprise"].includes(susc.plan) ? susc.plan : "pro"
    );
    setSubEstado(susc?.estado || "activa");
    if (susc?.vence_at) {
      setSubVenceAt(susc.vence_at.slice(0, 10));
    } else {
      const nextMonth = new Date();
      nextMonth.setDate(nextMonth.getDate() + 30);
      setSubVenceAt(nextMonth.toISOString().slice(0, 10));
    }
    setSubNotas(susc?.notas || "");
  };

  const handleSaveSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNegocio) return;

    setSavingSub(true);
    const supabase = createClient();
    try {
      const venceIso = subVenceAt
        ? new Date(`${subVenceAt}T23:59:59.000Z`).toISOString()
        : new Date(Date.now() + 30 * 86400000).toISOString();

      const { error } = await supabase.rpc("sa_set_suscripcion", {
        _negocio_id: editingNegocio.id,
        _plan: subPlan,
        _estado: subEstado,
        _vence_at: venceIso,
        _notas: subNotas || undefined,
      });

      if (error) throw error;

      toast.success(
        `Suscripción de "${editingNegocio.nombre}" actualizada a ${subPlan.toUpperCase()}`
      );
      setEditingNegocio(null);
      await loadOverviewData();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar la suscripción");
    } finally {
      setSavingSub(false);
    }
  };

  const openStoreDetails = async (neg: NegocioRow) => {
    setDetailNegocio(neg);
    setDetailData(null);
    setLoadingDetail(true);
    const supabase = createClient();
    try {
      const { data, error } = await supabase.rpc("sa_negocio_detalle", {
        _negocio_id: neg.id,
      });
      if (error) throw error;
      setDetailData(data);
    } catch (err: any) {
      toast.error(err.message || "No se pudo cargar el detalle del comercio");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDeleteNegocio = async () => {
    if (!deletingNegocio) return;
    if (confirmDeleteText.trim().toLowerCase() !== deletingNegocio.slug.toLowerCase()) {
      toast.error(`Escribe el slug "${deletingNegocio.slug}" para confirmar.`);
      return;
    }

    setDeletingLoading(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.rpc("sa_eliminar_negocio", {
        _negocio_id: deletingNegocio.id,
      });
      if (error) throw error;
      toast.success(`Comercio "${deletingNegocio.nombre}" eliminado.`);
      setDeletingNegocio(null);
      setConfirmDeleteText("");
      await loadOverviewData();
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar comercio");
    } finally {
      setDeletingLoading(false);
    }
  };

  const openNewCuponModal = (cupon?: CuponRow) => {
    if (cupon) {
      setEditingCuponId(cupon.id);
      setCuponCodigo(cupon.codigo);
      setCuponPlan(cupon.plan);
      setCuponDias(cupon.dias_otorgados);
      setCuponMaxUsos(cupon.max_usos ? String(cupon.max_usos) : "");
      setCuponVenceAt(cupon.vence_at ? cupon.vence_at.slice(0, 10) : "");
      setCuponActivo(cupon.activo);
      setCuponNotas(cupon.notas || "");
    } else {
      setEditingCuponId(null);
      setCuponCodigo("");
      setCuponPlan("pro");
      setCuponDias(30);
      setCuponMaxUsos("");
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      setCuponVenceAt(nextYear.toISOString().slice(0, 10));
      setCuponActivo(true);
      setCuponNotas("");
    }
    setCuponModalOpen(true);
  };

  const handleSaveCupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cuponCodigo.trim()) {
      toast.error("Ingresa un código de cupón");
      return;
    }

    setSavingCupon(true);
    const supabase = createClient();
    try {
      const venceIso = cuponVenceAt
        ? new Date(`${cuponVenceAt}T23:59:59.000Z`).toISOString()
        : new Date(Date.now() + 365 * 86400000).toISOString();

      const { error } = await (supabase.rpc as any)("sa_cupon_upsert", {
        _id: editingCuponId,
        _codigo: cuponCodigo.trim().toUpperCase(),
        _plan: cuponPlan,
        _dias_otorgados: Number(cuponDias) || 30,
        _max_usos: cuponMaxUsos ? Number(cuponMaxUsos) : null,
        _vence_at: venceIso,
        _activo: cuponActivo,
        _notas: cuponNotas || null,
      });

      if (error) throw error;
      toast.success(editingCuponId ? "Cupón actualizado" : "Cupón creado");
      setCuponModalOpen(false);
      await loadOverviewData();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar cupón");
    } finally {
      setSavingCupon(false);
    }
  };

  const handleDeleteCupon = async (cupon: CuponRow) => {
    const supabase = createClient();
    try {
      const { error } = await supabase.rpc("sa_cupon_eliminar", { _id: cupon.id });
      if (error) throw error;
      toast.success(`Cupón ${cupon.codigo} eliminado`);
      await loadOverviewData();
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar cupón");
    }
  };

  if (tenantLoading || (loading && !kpis)) {
    return (
      <div className="min-h-[65vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">
          Cargando Consola Central de Super Admin...
        </p>
      </div>
    );
  }

  const currentModuleInfo =
    MODULES_MENU.find((m) => m.id === activeModule) || MODULES_MENU[0];

  return (
    <div className="space-y-5">
      {/* Cabecera Ejecutiva Compacta */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold mb-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            Consola Central Super Admin · operixerp.cloud
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {currentModuleInfo.label}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadOverviewData}
            disabled={loading}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Sincronizar Datos
          </Button>
        </div>
      </div>

      {/* Barra de Navegación Horizontal de los 10 Módulos (sincronizada con la barra lateral) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {MODULES_MENU.map((m) => {
          const Icon = m.icon;
          const isCurrent = activeModule === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setActiveModule(m.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border ${
                isCurrent
                  ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                  : "bg-card text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{m.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* =====================================================================
          MÓDULO 1: RESUMEN EJECUTIVO
         ===================================================================== */}
      {activeModule === "resumen" && (
        <div className="space-y-5">
          {/* 10 Indicadores Ejecutivos con separación estricta entre GMV Comercios e Ingresos Operix */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Card className="shadow-2xs">
              <CardHeader className="p-3.5 pb-1 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Total Tiendas
                </CardTitle>
                <Store className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent className="p-3.5 pt-1">
                <div className="text-2xl font-bold">
                  {executive?.totalTiendas ?? negocios.length}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  +{periodTotals.nuevasTiendas} en últimos {periodDays}d
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-2xs">
              <CardHeader className="p-3.5 pb-1 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Tiendas Activas
                </CardTitle>
                <Activity className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent className="p-3.5 pt-1">
                <div className="text-2xl font-bold text-emerald-600">
                  {executive?.tiendasActivas ?? 0}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Con actividad &lt; {recConfig?.dias_inactividad ?? 12} días
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-2xs">
              <CardHeader className="p-3.5 pb-1 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Tiendas Inactivas
                </CardTitle>
                <Clock className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent className="p-3.5 pt-1">
                <div className="text-2xl font-bold text-amber-600">
                  {executive?.tiendasInactivas ?? 0}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  <button
                    type="button"
                    onClick={() => setActiveModule("recuperacion")}
                    className="text-primary hover:underline font-medium"
                  >
                    Gestionar recuperación →
                  </button>
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-2xs">
              <CardHeader className="p-3.5 pb-1 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-[11px] font-semibold uppercase text-muted-foreground">
                  En Período Trial
                </CardTitle>
                <Sparkles className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent className="p-3.5 pt-1">
                <div className="text-2xl font-bold">{executive?.tiendasEnTrial ?? 0}</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Por vencer (7d):{" "}
                  <strong className="text-foreground">
                    {executive?.suscripcionesPorVencerCount ?? 0}
                  </strong>
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-2xs">
              <CardHeader className="p-3.5 pb-1 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Usuarios Registrados
                </CardTitle>
                <Users className="h-4 w-4 text-indigo-500" />
              </CardHeader>
              <CardContent className="p-3.5 pt-1">
                <div className="text-2xl font-bold">
                  {executive?.totalUsuarios ?? profiles.length}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  +{periodTotals.nuevosUsuarios} en últimos {periodDays}d
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-2xs">
              <CardHeader className="p-3.5 pb-1 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Productos Activos
                </CardTitle>
                <Package className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent className="p-3.5 pt-1">
                <div className="text-2xl font-bold">{kpis?.total_productos ?? 0}</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  En catálogos de comercios
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-2xs">
              <CardHeader className="p-3.5 pb-1 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Ventas Procesadas
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent className="p-3.5 pt-1">
                <div className="text-2xl font-bold">{kpis?.total_ventas ?? 0}</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {periodTotals.ventasCount} tickets en últimos {periodDays}d
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-2xs">
              <CardHeader className="p-3.5 pb-1 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Volumen Ventas Comercios (GMV)
                </CardTitle>
                <DollarSign className="h-4 w-4 text-sky-600" />
              </CardHeader>
              <CardContent className="p-3.5 pt-1">
                <div className="text-2xl font-bold">
                  {formatMoney(kpis?.ingresos_totales ?? 0)}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Transaccionado por las tiendas
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-2xs border-primary/30 bg-primary/5">
              <CardHeader className="p-3.5 pb-1 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-[11px] font-bold uppercase text-primary">
                  Ingresos Suscripciones Operix
                </CardTitle>
                <CreditCard className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent className="p-3.5 pt-1">
                <div className="text-2xl font-bold text-primary">
                  {formatMoney(executive?.ingresosSuscripcionesTotal ?? 0)}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {executive?.pagosAprobadosCount ?? 0} cobros Mercado Pago (30d:{" "}
                  {formatMoney(executive?.ingresosSuscripciones30d ?? 0)})
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-2xs">
              <CardHeader className="p-3.5 pb-1 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Próximas a Vencer (7d)
                </CardTitle>
                <Calendar className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent className="p-3.5 pt-1">
                <div className="text-2xl font-bold">
                  {executive?.suscripcionesPorVencerCount ?? 0}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  <button
                    type="button"
                    onClick={() => setActiveModule("suscripciones")}
                    className="text-primary hover:underline font-medium"
                  >
                    Ver vencimientos →
                  </button>
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos de Evolución Temporal con Filtro por Período (7d / 30d / 90d) */}
          <Card className="shadow-2xs">
            <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold">
                  Evolución Temporal de la Plataforma ({periodDays} días)
                </CardTitle>
                <CardDescription className="text-xs">
                  Actividad diaria real de transacciones procesadas en comercios, nuevas tiendas y usuarios registrados.
                </CardDescription>
              </div>

              <div className="inline-flex items-center p-1 rounded-lg bg-muted border border-border">
                {([7, 30, 90] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setPeriodDays(d)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                      periodDays === d
                        ? "bg-background text-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {d} días
                  </button>
                ))}
              </div>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gráfico 1: Volumen de Ventas (GMV) de Comercios por día */}
                <div className="p-4 rounded-xl border border-border bg-muted/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase text-muted-foreground">
                        Volumen Diario de Ventas en Comercios (GMV)
                      </div>
                      <div className="text-lg font-bold text-foreground">
                        {formatMoney(periodTotals.gmvComercios)}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          ({periodTotals.ventasCount} tickets en {periodDays}d)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="h-36 flex items-end gap-1 pt-4 border-b border-border">
                    {(() => {
                      const maxGmv = Math.max(
                        1,
                        ...filteredSeries.map((pt) => pt.gmvComercios)
                      );
                      return filteredSeries.map((pt) => {
                        const heightPct = Math.max(
                          4,
                          Math.round((pt.gmvComercios / maxGmv) * 100)
                        );
                        return (
                          <div
                            key={pt.date}
                            className="flex-1 flex flex-col items-center justify-end h-full group relative"
                            title={`${pt.date}: ${formatMoney(pt.gmvComercios)} (${pt.ventasCount} ventas)`}
                          >
                            <div
                              style={{ height: `${heightPct}%` }}
                              className={`w-full rounded-t transition-all ${
                                pt.gmvComercios > 0
                                  ? "bg-primary hover:bg-primary/80"
                                  : "bg-muted-foreground/15"
                              }`}
                            />
                          </div>
                        );
                      });
                    })()}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{filteredSeries[0]?.date}</span>
                    <span>{filteredSeries[filteredSeries.length - 1]?.date}</span>
                  </div>
                </div>

                {/* Gráfico 2: Nuevas Tiendas y Usuarios por día */}
                <div className="p-4 rounded-xl border border-border bg-muted/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase text-muted-foreground">
                        Crecimiento de Tiendas y Usuarios
                      </div>
                      <div className="text-lg font-bold text-foreground">
                        +{periodTotals.nuevasTiendas} tiendas · +{periodTotals.nuevosUsuarios}{" "}
                        usuarios
                      </div>
                    </div>
                  </div>

                  <div className="h-36 flex items-end gap-1 pt-4 border-b border-border">
                    {(() => {
                      const maxCount = Math.max(
                        1,
                        ...filteredSeries.map(
                          (pt) => pt.nuevasTiendas + pt.nuevosUsuarios
                        )
                      );
                      return filteredSeries.map((pt) => {
                        const totalDay = pt.nuevasTiendas + pt.nuevosUsuarios;
                        const heightPct = Math.max(
                          4,
                          Math.round((totalDay / maxCount) * 100)
                        );
                        return (
                          <div
                            key={pt.date}
                            className="flex-1 flex flex-col items-center justify-end h-full"
                            title={`${pt.date}: ${pt.nuevasTiendas} tiendas, ${pt.nuevosUsuarios} usuarios`}
                          >
                            <div
                              style={{ height: `${heightPct}%` }}
                              className={`w-full rounded-t transition-all ${
                                totalDay > 0
                                  ? "bg-emerald-500 hover:bg-emerald-400"
                                  : "bg-muted-foreground/15"
                              }`}
                            />
                          </div>
                        );
                      });
                    })()}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{filteredSeries[0]?.date}</span>
                    <span>{filteredSeries[filteredSeries.length - 1]?.date}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Distribución geográfica y accesos rápidos */}
          {geoSummary.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap px-3.5 py-2.5 rounded-xl border border-border bg-card text-xs">
              <span className="font-semibold text-muted-foreground flex items-center gap-1.5 mr-1">
                <Globe className="h-3.5 w-3.5 text-primary" />
                Distribución Geográfica de Comercios:
              </span>
              {geoSummary.map((g) => (
                <Badge
                  key={g.label}
                  variant="secondary"
                  className="text-[11px] font-medium gap-1 px-2 py-0.5 cursor-pointer hover:bg-primary/10"
                  onClick={() => {
                    setSearchQuery(g.label.split("·").pop()?.trim() || "");
                    setActiveModule("comercios");
                  }}
                >
                  <span>{g.flag}</span>
                  <span>{g.label}</span>
                  <span className="font-bold text-primary ml-0.5">({g.count})</span>
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          MÓDULO 2: TIENDAS Y COMERCIOS
         ===================================================================== */}
      {activeModule === "comercios" && (
        <Card className="shadow-2xs">
          <CardHeader className="pb-3">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold">
                  Directorio de Tiendas y Comercios ({filteredNegocios.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Supervisa cada comercio, su última actividad real, país/ciudad de origen, métricas y estado de suscripción.
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-64">
                  <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                  <Input
                    placeholder="Buscar tienda, email, ciudad, RUT..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>

                <select
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium"
                >
                  <option value="all">Todos los planes</option>
                  <option value="free">Free</option>
                  <option value="basico">Básico</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                  <option value="paid">Paid</option>
                </select>

                <select
                  value={estadoFilter}
                  onChange={(e) => setEstadoFilter(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium"
                >
                  <option value="all">Todos los estados</option>
                  <option value="inactivas">Para Reactivar (Free / Vencidas / Susp.)</option>
                  <option value="activa">Activas</option>
                  <option value="trial">En Trial</option>
                  <option value="vencida">Vencidas</option>
                  <option value="suspendida">Suspendidas</option>
                </select>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {filteredNegocios.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No se encontraron comercios con los filtros seleccionados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase text-muted-foreground">
                      <th className="py-2.5 px-3 font-semibold">Comercio / Propietario</th>
                      <th className="py-2.5 px-3 font-semibold">País / Ciudad Ref.</th>
                      <th className="py-2.5 px-3 font-semibold">Última Actividad</th>
                      <th className="py-2.5 px-3 font-semibold">Plan</th>
                      <th className="py-2.5 px-3 font-semibold">Estado</th>
                      <th className="py-2.5 px-3 font-semibold">Vencimiento</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredNegocios.map((neg) => {
                      const susc = suscripcionesMap[neg.id];
                      const contact = contactsMap[neg.id];
                      const act = storesActivityMap[neg.id];
                      const loc = inferFallbackLocation(neg, contact);
                      const planLabel = (susc?.plan || neg.plan || "free").toUpperCase();
                      const estadoLabel = susc?.estado || "activa";
                      const isVencida = Boolean(
                        susc?.vence_at && new Date(susc.vence_at).getTime() < Date.now()
                      );

                      return (
                        <tr key={neg.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-foreground">{neg.nombre}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <span>/{neg.slug}</span>
                              <a
                                href={`/c/${neg.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline inline-flex items-center gap-0.5"
                                title="Ver catálogo público"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                              <span className="text-[10px] opacity-75">
                                · {neg.tipo_negocio === "restaurant" ? "Restaurante" : "Retail"}
                              </span>
                            </div>
                            {contact?.email && (
                              <div className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[210px]">
                                {contact.email}
                              </div>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-xs">
                            {loc ? (
                              <div className="flex items-start gap-1.5">
                                <span className="text-sm leading-none mt-0.5">{loc.flag}</span>
                                <div>
                                  <div className="font-medium text-foreground">{loc.country}</div>
                                  {loc.city && (
                                    <div className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                                      <MapPin className="h-2.5 w-2.5 shrink-0" />
                                      <span className="truncate max-w-[130px]">{loc.city}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground italic">—</span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-xs">
                            {act ? (
                              <div>
                                <div className="font-medium">
                                  {new Date(act.last_real_activity_at).toLocaleDateString("es-CL")}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  Hace {act.inactive_days}d · {act.last_activity_type}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {new Date(neg.created_at).toLocaleDateString("es-CL")}
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-3">
                            <Badge
                              variant={
                                planLabel === "PRO" ||
                                planLabel === "ENTERPRISE" ||
                                planLabel === "PAID"
                                  ? "default"
                                  : "secondary"
                              }
                              className="text-[10px] font-bold"
                            >
                              {planLabel}
                            </Badge>
                          </td>

                          <td className="py-2.5 px-3">
                            <Badge
                              variant="outline"
                              className={
                                estadoLabel === "activa" && !isVencida
                                  ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10 text-[10px]"
                                  : estadoLabel === "trial"
                                  ? "border-blue-500/40 text-blue-600 bg-blue-500/10 text-[10px]"
                                  : "border-destructive/40 text-destructive bg-destructive/10 text-[10px]"
                              }
                            >
                              {isVencida ? "VENCIDA" : estadoLabel.toUpperCase()}
                            </Badge>
                          </td>

                          <td className="py-2.5 px-3 text-xs text-muted-foreground">
                            <div>
                              {susc?.vence_at
                                ? new Date(susc.vence_at).toLocaleDateString("es-CL")
                                : "Sin límite"}
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                                onClick={() => openReactivationEmailModal(neg)}
                              >
                                <Mail className="h-3 w-3" />
                                Correo
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => openStoreDetails(neg)}
                              >
                                <Eye className="h-3 w-3" />
                                Métricas
                              </Button>

                              <Button
                                variant="default"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => openEditSubscription(neg)}
                              >
                                <CreditCard className="h-3 w-3" />
                                Plan
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                title="Eliminar comercio"
                                onClick={() => {
                                  setDeletingNegocio(neg);
                                  setConfirmDeleteText("");
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
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
      )}

      {/* =====================================================================
          MÓDULO 3: USUARIOS
         ===================================================================== */}
      {activeModule === "usuarios" && (
        <Card className="shadow-2xs">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold">
                  Usuarios Registrados en Operix ERP ({filteredProfiles.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Supervisión global de cuentas de propietarios, administradores, cajeros, vendedores y bodegueros.
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-64">
                  <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                  <Input
                    placeholder="Buscar por nombre, correo o tienda..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>

                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium"
                >
                  <option value="all">Todos los roles</option>
                  <option value="super_admin">Super Admin</option>
                  <option value="admin">Admin Comercio</option>
                  <option value="cajero">Cajero</option>
                  <option value="vendedor">Vendedor</option>
                  <option value="bodeguero">Bodeguero</option>
                </select>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase text-muted-foreground">
                    <th className="py-2.5 px-3 font-semibold">Nombre / Correo</th>
                    <th className="py-2.5 px-3 font-semibold">Comercio Asociado</th>
                    <th className="py-2.5 px-3 font-semibold">Roles Asignados</th>
                    <th className="py-2.5 px-3 font-semibold">Estado</th>
                    <th className="py-2.5 px-3 font-semibold">Registro</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredProfiles.map((prof) => {
                    const neg = prof.negocio_id ? negocioNameById[prof.negocio_id] : null;
                    const roles = rolesByUserMap[prof.id] || ["admin"];
                    const isSuper =
                      roles.includes("super_admin") ||
                      prof.email?.toLowerCase() === "santibanez.elmer@gmail.com";

                    return (
                      <tr key={prof.id} className="hover:bg-muted/40">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-foreground">{prof.nombre}</div>
                          <div className="text-xs text-muted-foreground">{prof.email || "—"}</div>
                        </td>

                        <td className="py-2.5 px-3 text-xs">
                          {neg ? (
                            <div>
                              <span className="font-medium text-foreground">{neg.nombre}</span>
                              <span className="text-muted-foreground ml-1">(/{neg.slug})</span>
                            </div>
                          ) : isSuper ? (
                            <Badge variant="default" className="text-[10px]">
                              Plataforma Global
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground italic">
                              Sin comercio (Onboarding)
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            {roles.map((r) => (
                              <Badge
                                key={r}
                                variant={r === "super_admin" ? "default" : "secondary"}
                                className="text-[10px] uppercase"
                              >
                                {r}
                              </Badge>
                            ))}
                          </div>
                        </td>

                        <td className="py-2.5 px-3">
                          <Badge
                            variant="outline"
                            className={
                              prof.activo
                                ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10 text-[10px]"
                                : "border-destructive/40 text-destructive bg-destructive/10 text-[10px]"
                            }
                          >
                            {prof.activo ? "ACTIVO" : "SUSPENDIDO"}
                          </Badge>
                        </td>

                        <td className="py-2.5 px-3 text-xs text-muted-foreground">
                          {new Date(prof.created_at).toLocaleDateString("es-CL")}
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          {!isSuper && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={togglingUserId === prof.id}
                              onClick={() => handleToggleUserStatus(prof)}
                            >
                              {togglingUserId === prof.id
                                ? "..."
                                : prof.activo
                                ? "Suspender"
                                : "Reactivar"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* =====================================================================
          MÓDULO 4: SUSCRIPCIONES Y PLANES
         ===================================================================== */}
      {activeModule === "suscripciones" && (
        <div className="space-y-5">
          {/* Resumen financiero de suscripciones */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="shadow-2xs">
              <CardHeader className="p-3.5 pb-1">
                <CardTitle className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Ingresos Cobrados (Mercado Pago)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-1">
                <div className="text-2xl font-bold text-emerald-600">
                  {formatMoney(executive?.ingresosSuscripcionesTotal ?? 0)}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {executive?.pagosAprobadosCount ?? 0} pagos aprobados históricos
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-2xs">
              <CardHeader className="p-3.5 pb-1">
                <CardTitle className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Ingresos Últimos 30 Días
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-1">
                <div className="text-2xl font-bold">
                  {formatMoney(executive?.ingresosSuscripciones30d ?? 0)}
                </div>
                <p className="text-[11px] text-muted-foreground">Facturación de membresías</p>
              </CardContent>
            </Card>

            <Card className="shadow-2xs">
              <CardHeader className="p-3.5 pb-1">
                <CardTitle className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Suscripciones Activas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-1">
                <div className="text-2xl font-bold">
                  {kpis?.por_estado_susc?.activa ?? 0}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Pro: {kpis?.por_plan?.pro ?? 0} · Enterprise: {kpis?.por_plan?.enterprise ?? 0}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-2xs">
              <CardHeader className="p-3.5 pb-1">
                <CardTitle className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Próximas a Vencer (7 días)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-1">
                <div className="text-2xl font-bold text-amber-600">
                  {executive?.suscripcionesPorVencerCount ?? 0}
                </div>
                <p className="text-[11px] text-muted-foreground">Requieren renovación</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabla de Suscripciones por Tienda */}
          <Card className="shadow-2xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                Estado de Suscripciones por Comercio ({suscripciones.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Administra planes, fechas de vencimiento, proveedor de cobro y notas administrativas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase text-muted-foreground">
                      <th className="py-2.5 px-3 font-semibold">Comercio</th>
                      <th className="py-2.5 px-3 font-semibold">Plan</th>
                      <th className="py-2.5 px-3 font-semibold">Estado</th>
                      <th className="py-2.5 px-3 font-semibold">Proveedor / Ciclo</th>
                      <th className="py-2.5 px-3 font-semibold">Vencimiento</th>
                      <th className="py-2.5 px-3 font-semibold">Notas</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {suscripciones.map((s) => {
                      const neg = negocioNameById[s.negocio_id];
                      const isVencida = Boolean(
                        s.vence_at && new Date(s.vence_at).getTime() < Date.now()
                      );
                      return (
                        <tr key={s.id} className="hover:bg-muted/40">
                          <td className="py-2.5 px-3">
                            <div className="font-semibold">
                              {neg?.nombre || s.negocio_id.slice(0, 8)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              /{neg?.slug || "—"}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge variant="default" className="text-[10px] uppercase">
                              {s.plan}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge
                              variant="outline"
                              className={
                                s.estado === "activa" && !isVencida
                                  ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/10 text-[10px]"
                                  : "border-amber-500/40 text-amber-600 bg-amber-500/10 text-[10px]"
                              }
                            >
                              {isVencida ? "VENCIDA" : s.estado.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-xs capitalize">
                            {s.proveedor || "manual"} {s.ciclo ? `(${s.ciclo})` : ""}
                          </td>
                          <td className="py-2.5 px-3 text-xs">
                            {s.vence_at
                              ? new Date(s.vence_at).toLocaleDateString("es-CL")
                              : "Sin vencimiento"}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-muted-foreground max-w-[240px] truncate">
                            {s.notas || "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {neg && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => openEditSubscription(neg)}
                              >
                                Ajustar Plan
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Historial de Pagos de Mercado Pago */}
          <Card className="shadow-2xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                Historial de Transacciones Mercado Pago ({mpPagos.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Pagos reales registrados desde el webhook de suscripciones de Mercado Pago.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mpPagos.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No se registran pagos en la tabla mp_pagos todavía.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border text-[11px] uppercase text-muted-foreground">
                        <th className="py-2.5 px-3 font-semibold">Fecha</th>
                        <th className="py-2.5 px-3 font-semibold">Comercio</th>
                        <th className="py-2.5 px-3 font-semibold">Payment ID</th>
                        <th className="py-2.5 px-3 font-semibold">Plan / Ciclo</th>
                        <th className="py-2.5 px-3 font-semibold">Monto</th>
                        <th className="py-2.5 px-3 font-semibold">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {mpPagos.map((p) => {
                        const neg = p.negocio_id ? negocioNameById[p.negocio_id] : null;
                        return (
                          <tr key={p.id} className="hover:bg-muted/40 text-xs">
                            <td className="py-2.5 px-3">
                              {new Date(p.created_at).toLocaleString("es-CL")}
                            </td>
                            <td className="py-2.5 px-3 font-medium">
                              {neg?.nombre || p.negocio_id || "—"}
                            </td>
                            <td className="py-2.5 px-3 font-mono">{p.payment_id || "—"}</td>
                            <td className="py-2.5 px-3 uppercase">
                              {p.plan || "—"} ({p.ciclo || "—"})
                            </td>
                            <td className="py-2.5 px-3 font-bold">
                              {formatMoney(p.monto || 0)}
                            </td>
                            <td className="py-2.5 px-3">
                              <Badge
                                variant={
                                  p.estado === "aprobada" || p.estado === "approved"
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-[10px] uppercase"
                              >
                                {p.estado}
                              </Badge>
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
        </div>
      )}

      {/* =====================================================================
          MÓDULO 5: CENTRO DE RECUPERACIÓN DE CLIENTES
         ===================================================================== */}
      {activeModule === "recuperacion" && <RecuperacionClientesSection />}

      {/* =====================================================================
          MÓDULO 6: CENTRO DE AUTOMATIZACIONES
         ===================================================================== */}
      {activeModule === "automatizaciones" && (
        <div className="space-y-5">
          <Card className="shadow-2xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                Procesos Automáticos Programados (Cron & Background Workers)
              </CardTitle>
              <CardDescription className="text-xs">
                Monitorea el estado, última y próxima ejecución, registros procesados, duración y errores. Ningún proceso se dispara al cargar la página.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase text-muted-foreground">
                      <th className="py-2.5 px-3 font-semibold">Nombre del Proceso</th>
                      <th className="py-2.5 px-3 font-semibold">Estado</th>
                      <th className="py-2.5 px-3 font-semibold">Cadencia / Próxima Ejecución</th>
                      <th className="py-2.5 px-3 font-semibold">Última Ejecución</th>
                      <th className="py-2.5 px-3 font-semibold">Procesados / Errores / Duración</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Controles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {/* Proceso 1: Detección de Inactividad y Recuperación con Resend */}
                    {(() => {
                      const lastRunLog = (automations?.runs || []).find(
                        (r: any) => r.action === "system_cron_recovery_run"
                      );
                      const liveRes = lastJobResult.recovery || lastRunLog?.after_data || null;
                      const nextRunDate = new Date();
                      if (nextRunDate.getUTCHours() >= 13) {
                        nextRunDate.setUTCDate(nextRunDate.getUTCDate() + 1);
                      }
                      nextRunDate.setUTCHours(13, 0, 0, 0);

                      return (
                        <tr className="hover:bg-muted/40">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-foreground">
                              Detección de Tiendas Inactivas y Campaña de Recuperación
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                              /api/cron/recuperacion-tiendas (Vercel Cron)
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <Badge
                              variant={
                                recConfig?.automatizacion_activa ? "default" : "secondary"
                              }
                              className="text-[10px]"
                            >
                              {recConfig?.automatizacion_activa ? "ACTIVO" : "PAUSADO"}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-xs">
                            <div className="font-medium">Diario · 13:00 UTC</div>
                            <div className="text-[11px] text-muted-foreground">
                              Próxima: {nextRunDate.toLocaleString("es-CL")}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-xs">
                            {lastRunLog ? (
                              new Date(lastRunLog.created_at).toLocaleString("es-CL")
                            ) : liveRes?.timestamp ? (
                              new Date(liveRes.timestamp).toLocaleString("es-CL")
                            ) : (
                              <span className="text-muted-foreground">Sin ejecuciones registradas</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-xs">
                            {liveRes ? (
                              <div>
                                <span className="font-semibold">
                                  {liveRes.processedStores ?? 0} tiendas
                                </span>{" "}
                                ({liveRes.sentStep1 ?? 0} C1, {liveRes.sentStep2 ?? 0} C2) ·{" "}
                                <span
                                  className={
                                    (liveRes.errorsCount || liveRes.errors?.length || 0) > 0
                                      ? "text-destructive font-bold"
                                      : "text-emerald-600"
                                  }
                                >
                                  {liveRes.errorsCount ?? liveRes.errors?.length ?? 0} errores
                                </span>{" "}
                                · {liveRes.durationMs ?? 0}ms
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setActiveModule("recuperacion")}
                              >
                                Configurar
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-xs gap-1"
                                disabled={runningJob === "recovery"}
                                onClick={handleRunRecoveryAutomation}
                              >
                                {runningJob === "recovery" ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Play className="h-3 w-3" />
                                )}
                                Ejecutar
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })()}

                    {/* Proceso 2: Suspensión Automática de Suscripciones Vencidas */}
                    {(() => {
                      const liveSub = lastJobResult.expired_subs;
                      const nextHour = new Date();
                      nextHour.setMinutes(7, 0, 0);
                      if (nextHour.getTime() <= Date.now()) {
                        nextHour.setHours(nextHour.getHours() + 1);
                      }

                      return (
                        <tr className="hover:bg-muted/40">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-foreground">
                              Suspensión Automática de Suscripciones Vencidas
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                              RPC: public.suspender_suscripciones_vencidas() (pg_cron)
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <Badge variant="default" className="text-[10px]">
                              ACTIVO
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-xs">
                            <div className="font-medium">Cada hora (minuto 07)</div>
                            <div className="text-[11px] text-muted-foreground">
                              Próxima: {nextHour.toLocaleTimeString("es-CL")}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-xs">
                            {liveSub?.executedAt ? (
                              new Date(liveSub.executedAt).toLocaleString("es-CL")
                            ) : (
                              <span className="text-muted-foreground">Automático en PostgreSQL</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-xs">
                            {liveSub ? (
                              <div>
                                <span className="font-semibold">
                                  {liveSub.suspendedCount} suspendidas
                                </span>{" "}
                                · <span className="text-emerald-600">0 errores</span> ·{" "}
                                {liveSub.durationMs}ms
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              disabled={runningJob === "expired_subs"}
                              onClick={handleRunExpiredSubscriptionsJob}
                            >
                              {runningJob === "expired_subs" ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Play className="h-3 w-3" />
                              )}
                              Ejecutar Ahora
                            </Button>
                          </td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Historial de Ejecuciones Automáticas */}
          <Card className="shadow-2xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                Historial de Ejecuciones y Eventos Automáticos ({automations?.runs?.length ?? 0})
              </CardTitle>
              <CardDescription className="text-xs">
                Registro cronológico de procesos de recuperación, envíos automáticos y activaciones de promociones.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!automations?.runs || automations.runs.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Aún no hay ejecuciones registradas en la bitácora de auditoría.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border text-[11px] uppercase text-muted-foreground">
                        <th className="py-2 px-3 font-semibold">Fecha y Hora</th>
                        <th className="py-2 px-3 font-semibold">Proceso / Acción</th>
                        <th className="py-2 px-3 font-semibold">Comercio</th>
                        <th className="py-2 px-3 font-semibold">Resultado / Detalle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {automations.runs.map((r: AuditLogRow) => (
                        <tr key={r.id} className="hover:bg-muted/40">
                          <td className="py-2 px-3 whitespace-nowrap">
                            {new Date(r.created_at).toLocaleString("es-CL")}
                          </td>
                          <td className="py-2 px-3 font-mono font-semibold text-primary">
                            {r.action}
                          </td>
                          <td className="py-2 px-3">
                            {negocioNameById[r.negocio_id]?.nombre || r.negocio_id.slice(0, 8)}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-muted-foreground">
                            {r.after_data ? JSON.stringify(r.after_data) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* =====================================================================
          MÓDULO 7: CUPONES Y PROMOCIONES
         ===================================================================== */}
      {activeModule === "cupones" && (
        <div className="space-y-5">
          <Card className="shadow-2xs">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">
                  Cupones Promocionales ({cupones.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Códigos internos para otorgar días gratuitos de planes Básico, Pro o Enterprise.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => openNewCuponModal()} className="h-8 text-xs gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Nuevo Cupón
              </Button>
            </CardHeader>
            <CardContent>
              {cupones.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No hay cupones creados todavía.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border text-[11px] uppercase text-muted-foreground">
                        <th className="py-2.5 px-3 font-semibold">Código</th>
                        <th className="py-2.5 px-3 font-semibold">Plan</th>
                        <th className="py-2.5 px-3 font-semibold">Días Otorgados</th>
                        <th className="py-2.5 px-3 font-semibold">Usos</th>
                        <th className="py-2.5 px-3 font-semibold">Expira</th>
                        <th className="py-2.5 px-3 font-semibold">Estado</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {cupones.map((c) => (
                        <tr key={c.id} className="hover:bg-muted/40">
                          <td className="py-2.5 px-3 font-mono font-bold text-primary">
                            {c.codigo}
                          </td>
                          <td className="py-2.5 px-3 uppercase text-xs font-bold">{c.plan}</td>
                          <td className="py-2.5 px-3 text-xs">{c.dias_otorgados} días</td>
                          <td className="py-2.5 px-3 text-xs">
                            {c.usos} / {c.max_usos ?? "∞"}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-muted-foreground">
                            {c.vence_at
                              ? new Date(c.vence_at).toLocaleDateString("es-CL")
                              : "Sin expiración"}
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge
                              variant={c.activo ? "default" : "secondary"}
                              className="text-[10px]"
                            >
                              {c.activo ? "ACTIVO" : "INACTIVO"}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => openNewCuponModal(c)}
                              >
                                Editar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteCupon(c)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Historial de Canjes de Cupones */}
          <Card className="shadow-2xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                Historial de Canjes de Cupones ({cuponCanjes.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Trazabilidad de promociones canjeadas por cada comercio.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cuponCanjes.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Ningún comercio ha canjeado cupones todavía.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border text-[11px] uppercase text-muted-foreground">
                        <th className="py-2 px-3 font-semibold">Fecha Canje</th>
                        <th className="py-2 px-3 font-semibold">Comercio</th>
                        <th className="py-2 px-3 font-semibold">Plan Aplicado</th>
                        <th className="py-2 px-3 font-semibold">Días Otorgados</th>
                        <th className="py-2 px-3 font-semibold">Nuevo Vencimiento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {cuponCanjes.map((cj) => (
                        <tr key={cj.id} className="hover:bg-muted/40">
                          <td className="py-2 px-3">
                            {new Date(cj.created_at).toLocaleString("es-CL")}
                          </td>
                          <td className="py-2 px-3 font-semibold">
                            {negocioNameById[cj.negocio_id]?.nombre || cj.negocio_id}
                          </td>
                          <td className="py-2 px-3 uppercase font-bold">{cj.plan_aplicado}</td>
                          <td className="py-2 px-3">{cj.dias_aplicados} días</td>
                          <td className="py-2 px-3">
                            {new Date(cj.vence_at_nuevo).toLocaleDateString("es-CL")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* =====================================================================
          MÓDULO 8: COMUNICACIONES Y CORREOS (RESEND)
         ===================================================================== */}
      {activeModule === "comunicaciones" && (
        <div className="space-y-5">
          {/* Estado de Conexión con Resend y Métricas de Entregabilidad */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            <div className="p-3 rounded-xl border border-border bg-card col-span-2">
              <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                Estado Resend & Dominio
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant={communications?.resendConfigured ? "default" : "secondary"}
                  className={
                    communications?.resendConfigured
                      ? "bg-emerald-600 text-[10px]"
                      : "text-[10px]"
                  }
                >
                  {communications?.resendConfigured ? "CONECTADO" : "PENDIENTE API KEY"}
                </Badge>
                <span className="text-xs font-bold truncate">
                  {communications?.senderDomain || "operixerp.cloud"}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1 truncate">
                Remitente: {communications?.senderEmail}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-border bg-card">
              <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                Enviados
              </div>
              <div className="text-xl font-bold mt-1">
                {communications?.stats?.totalSent ?? 0}
              </div>
              <div className="text-[10px] text-muted-foreground">En bitácora</div>
            </div>

            <div className="p-3 rounded-xl border border-border bg-card">
              <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                Entregabilidad
              </div>
              <div className="text-xl font-bold text-emerald-600 mt-1">
                {communications?.stats?.deliverabilityRate ?? 100}%
              </div>
              <div className="text-[10px] text-muted-foreground">
                {communications?.stats?.delivered ?? 0} entregados
              </div>
            </div>

            <div className="p-3 rounded-xl border border-border bg-card">
              <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                Aperturas
              </div>
              <div className="text-xl font-bold text-indigo-600 mt-1">
                {communications?.stats?.opened ?? 0}
              </div>
              <div className="text-[10px] text-muted-foreground">Confirmadas</div>
            </div>

            <div className="p-3 rounded-xl border border-border bg-card">
              <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                Clics
              </div>
              <div className="text-xl font-bold text-primary mt-1">
                {communications?.stats?.clicked ?? 0}
              </div>
              <div className="text-[10px] text-muted-foreground">En enlaces CTA</div>
            </div>

            <div className="p-3 rounded-xl border border-border bg-card">
              <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                Rebotes
              </div>
              <div className="text-xl font-bold text-destructive mt-1">
                {communications?.stats?.bounced ?? 0}
              </div>
              <div className="text-[10px] text-muted-foreground">Bounces</div>
            </div>

            <div className="p-3 rounded-xl border border-border bg-card">
              <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                Quejas / Bajas
              </div>
              <div className="text-xl font-bold mt-1">
                {(communications?.stats?.complained ?? 0) +
                  (communications?.stats?.unsubscribed ?? 0)}
              </div>
              <div className="text-[10px] text-muted-foreground">Suprimidos</div>
            </div>
          </div>

          {/* Endpoint de Webhook Resend y Plantillas */}
          <Card className="shadow-2xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                Configuración de Webhooks y Plantillas Transaccionales (Resend)
              </CardTitle>
              <CardDescription className="text-xs">
                Las claves API permanecen exclusivamente en el servidor. Aquí puedes editar las plantillas de recuperación y verificar el webhook de eventos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg border border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                <div>
                  <span className="font-bold text-foreground">Webhook Receptor de Eventos Resend:</span>{" "}
                  <code className="font-mono bg-background px-2 py-0.5 rounded border border-border">
                    https://operixerp.cloud/api/recuperacion/webhook-resend
                  </code>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      "https://operixerp.cloud/api/recuperacion/webhook-resend"
                    );
                    toast.success("URL de Webhook copiada al portapapeles");
                  }}
                >
                  <Copy className="h-3 w-3" />
                  Copiar URL
                </Button>
              </div>

              {recConfig && (
                <form onSubmit={handleSaveGlobalRecConfig} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-3 p-3.5 rounded-xl border border-border">
                    <div className="font-bold text-xs uppercase text-primary">
                      Plantilla 1: Reactivación por Inactividad ({recConfig.dias_inactividad}d)
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Asunto</Label>
                      <Input
                        value={recConfig.asunto_correo_1}
                        onChange={(e) =>
                          setRecConfig({ ...recConfig, asunto_correo_1: e.target.value })
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Contenido</Label>
                      <textarea
                        rows={5}
                        value={recConfig.cuerpo_correo_1}
                        onChange={(e) =>
                          setRecConfig({ ...recConfig, cuerpo_correo_1: e.target.value })
                        }
                        className="w-full rounded-md border border-input bg-background p-2.5 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 p-3.5 rounded-xl border border-border">
                    <div className="font-bold text-xs uppercase text-primary">
                      Plantilla 2: Segundo Seguimiento (+{recConfig.dias_segundo_seguimiento}d)
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Asunto</Label>
                      <Input
                        value={recConfig.asunto_correo_2}
                        onChange={(e) =>
                          setRecConfig({ ...recConfig, asunto_correo_2: e.target.value })
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Contenido</Label>
                      <textarea
                        rows={5}
                        value={recConfig.cuerpo_correo_2}
                        onChange={(e) =>
                          setRecConfig({ ...recConfig, cuerpo_correo_2: e.target.value })
                        }
                        className="w-full rounded-md border border-input bg-background p-2.5 text-xs"
                      />
                    </div>
                  </div>

                  <div className="lg:col-span-2 flex justify-end">
                    <Button type="submit" size="sm" disabled={savingGlobalCfg}>
                      {savingGlobalCfg ? "Guardando..." : "Guardar Plantillas de Comunicación"}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Bitácora de Correos Enviados y Lista de Suprimidos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="lg:col-span-2 shadow-2xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">
                  Bitácora de Correos Enviados ({communications?.emailLogs?.length ?? 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!communications?.emailLogs || communications.emailLogs.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Sin registros en email_send_log.
                  </p>
                ) : (
                  <div className="overflow-x-auto max-h-80">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border text-[10px] uppercase text-muted-foreground">
                          <th className="py-2 px-2">Fecha</th>
                          <th className="py-2 px-2">Destinatario</th>
                          <th className="py-2 px-2">Plantilla</th>
                          <th className="py-2 px-2">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {communications.emailLogs.map((log: any) => (
                          <tr key={log.id}>
                            <td className="py-2 px-2 whitespace-nowrap">
                              {new Date(log.created_at).toLocaleString("es-CL")}
                            </td>
                            <td className="py-2 px-2 font-medium">{log.recipient_email}</td>
                            <td className="py-2 px-2 font-mono text-[11px]">
                              {log.template_name}
                            </td>
                            <td className="py-2 px-2">
                              <Badge variant="outline" className="text-[10px] uppercase">
                                {log.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-2xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">
                  Bajas y Correos Suprimidos ({communications?.suppressedEmails?.length ?? 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!communications?.suppressedEmails ||
                communications.suppressedEmails.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    No hay correos dados de baja o rebotados.
                  </p>
                ) : (
                  <div className="divide-y divide-border max-h-80 overflow-y-auto text-xs">
                    {communications.suppressedEmails.map((s: any) => (
                      <div key={s.id} className="py-2 flex items-center justify-between gap-2">
                        <div className="truncate">
                          <div className="font-medium truncate">{s.email}</div>
                          <div className="text-[10px] text-muted-foreground uppercase">
                            Motivo: {s.reason}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px]"
                          onClick={() => handleRemoveSuppressedEmail(s.email)}
                        >
                          Rehabilitar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* =====================================================================
          MÓDULO 9: AUDITORÍA Y ACTIVIDAD ADMINISTRATIVA
         ===================================================================== */}
      {activeModule === "auditoria" && (
        <Card className="shadow-2xs">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold">
                  Bitácora Inmutable de Auditoría ({filteredAuditLogs.length})
                </CardTitle>
                <CardDescription className="text-xs">
                  Trazabilidad de acciones administrativas, activaciones de promociones y eventos relevantes.
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                <Input
                  placeholder="Filtrar por acción, entidad o tienda..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredAuditLogs.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground">
                No se encontraron eventos de auditoría.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase text-muted-foreground">
                      <th className="py-2.5 px-3 font-semibold">Fecha y Hora</th>
                      <th className="py-2.5 px-3 font-semibold">Comercio</th>
                      <th className="py-2.5 px-3 font-semibold">Acción</th>
                      <th className="py-2.5 px-3 font-semibold">Entidad / ID</th>
                      <th className="py-2.5 px-3 font-semibold">Metadatos (after_data)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/40">
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString("es-CL")}
                        </td>
                        <td className="py-2.5 px-3 font-medium">
                          {negocioNameById[log.negocio_id]?.nombre ||
                            log.negocio_id?.slice(0, 8)}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-primary">
                          {log.action || "—"}
                        </td>
                        <td className="py-2.5 px-3">
                          {log.entity_type || "—"}{" "}
                          <span className="text-muted-foreground font-mono">
                            ({log.entity_id?.slice(0, 10) || "—"})
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground max-w-md truncate">
                          {log.after_data ? JSON.stringify(log.after_data) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* =====================================================================
          MÓDULO 10: CONFIGURACIÓN GLOBAL
         ===================================================================== */}
      {activeModule === "configuracion" && recConfig && (
        <Card className="shadow-2xs">
          <CardHeader>
            <CardTitle className="text-base font-bold">
              Parámetros Globales de Operix ERP Cloud
            </CardTitle>
            <CardDescription className="text-xs">
              Configura las reglas globales de automatización, remitente oficial de comunicaciones y beneficios de recuperación.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveGlobalRecConfig} className="space-y-5 max-w-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nombre del Remitente Oficial</Label>
                  <Input
                    value={recConfig.remitente_nombre}
                    onChange={(e) =>
                      setRecConfig({ ...recConfig, remitente_nombre: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Correo Remitente (Dominio Verificado)</Label>
                  <Input
                    type="email"
                    value={recConfig.remitente_email}
                    onChange={(e) =>
                      setRecConfig({ ...recConfig, remitente_email: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Umbral Inactividad (Días)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={recConfig.dias_inactividad}
                    onChange={(e) =>
                      setRecConfig({
                        ...recConfig,
                        dias_inactividad: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">2° Seguimiento (+Días)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    value={recConfig.dias_segundo_seguimiento}
                    onChange={(e) =>
                      setRecConfig({
                        ...recConfig,
                        dias_segundo_seguimiento: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Días de Beneficio Gratis</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={recConfig.dias_beneficio}
                    onChange={(e) =>
                      setRecConfig({
                        ...recConfig,
                        dias_beneficio: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="text-xs">
                    <div className="font-semibold">Automatización Diaria de Recuperación</div>
                    <div className="text-muted-foreground">
                      Ejecuta diariamente a las 13:00 UTC la detección de tiendas con ≥{" "}
                      {recConfig.dias_inactividad} días sin actividad real
                    </div>
                  </div>
                  <Switch
                    checked={recConfig.automatizacion_activa}
                    onCheckedChange={(v) =>
                      setRecConfig({ ...recConfig, automatizacion_activa: v })
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="text-xs">
                    <div className="font-semibold">Promoción de 1 Mes Gratuito por Tienda</div>
                    <div className="text-muted-foreground">
                      Habilita el botón de aceptación expresa del beneficio de uso único en el panel de cada tienda elegible
                    </div>
                  </div>
                  <Switch
                    checked={recConfig.promocion_activa}
                    onCheckedChange={(v) =>
                      setRecConfig({ ...recConfig, promocion_activa: v })
                    }
                  />
                </div>
              </div>

              <Button type="submit" disabled={savingGlobalCfg}>
                {savingGlobalCfg ? "Guardando..." : "Guardar Configuración Global"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* =====================================================================
          MÓDULO 11: CENTRO DE SOPORTE Y ATENCIÓN A TIENDAS
         ===================================================================== */}
      {activeModule === "soporte" && <CentroSoporteSection />}

      {/* =====================================================================
          MODALES COMPARTIDOS (Correo, Suscripción, Métricas, Cupón, Eliminar)
         ===================================================================== */}
      {/* MODAL 1: ENVIAR CORREO DIRECTO */}
      <Dialog open={Boolean(emailNegocio)} onOpenChange={(o) => !o && setEmailNegocio(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Enviar Comunicación a Comercio
            </DialogTitle>
            <DialogDescription>
              Comercio: <strong>{emailNegocio?.nombre}</strong> (/{emailNegocio?.slug})
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSendReactivationEmail} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="react-email">Correo del Destinatario</Label>
              <Input
                id="react-email"
                type="email"
                placeholder="cliente@comercio.cl"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="react-tpl">Plantilla</Label>
                <select
                  id="react-tpl"
                  value={emailTemplate}
                  onChange={(e) =>
                    handleTemplateChange(
                      e.target.value as
                        | "reactivacion"
                        | "trial_por_vencer"
                        | "cupon_regalo",
                      emailCupon
                    )
                  }
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-xs font-medium"
                >
                  <option value="reactivacion">Reactivación de Tienda Inactiva</option>
                  <option value="trial_por_vencer">Recordatorio Fin de Trial</option>
                  <option value="cupon_regalo">Regalo de Cupón Promocional</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="react-cupon">Adjuntar Cupón (Opcional)</Label>
                <select
                  id="react-cupon"
                  value={emailCupon}
                  onChange={(e) => handleTemplateChange(emailTemplate, e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-xs font-medium"
                >
                  <option value="">Sin cupón</option>
                  {cupones
                    .filter((c) => c.activo)
                    .map((c) => (
                      <option key={c.id} value={c.codigo}>
                        {c.codigo} ({c.dias_otorgados}d Plan {c.plan.toUpperCase()})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="react-subject">Asunto</Label>
              <Input
                id="react-subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="react-body">Mensaje</Label>
              <textarea
                id="react-body"
                rows={6}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="w-full rounded-md border border-input bg-background p-3 text-xs leading-relaxed"
                required
              />
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => {
                  const fullText = `${emailSubject}\n\n${emailBody}${
                    emailCupon ? `\n\nCupón: ${emailCupon}` : ""
                  }\n\nReactiva tu tienda en: https://operixerp.cloud/planes`;
                  navigator.clipboard.writeText(fullText);
                  toast.success("Mensaje copiado al portapapeles");
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar Texto
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEmailNegocio(null)}
                >
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={sendingEmail} className="gap-1.5">
                  {sendingEmail ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      Enviar Correo
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: AJUSTAR SUSCRIPCIÓN */}
      <Dialog open={Boolean(editingNegocio)} onOpenChange={(o) => !o && setEditingNegocio(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajustar Suscripción</DialogTitle>
            <DialogDescription>
              Comercio: <strong>{editingNegocio?.nombre}</strong> (/{editingNegocio?.slug})
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSubscription} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sub-plan">Plan</Label>
                <select
                  id="sub-plan"
                  value={subPlan}
                  onChange={(e) => setSubPlan(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sub-estado">Estado</Label>
                <select
                  id="sub-estado"
                  value={subEstado}
                  onChange={(e) => setSubEstado(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="activa">Activa</option>
                  <option value="trial">Trial</option>
                  <option value="suspendida">Suspendida</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sub-vence">Fecha de Vencimiento</Label>
              <Input
                id="sub-vence"
                type="date"
                value={subVenceAt}
                onChange={(e) => setSubVenceAt(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sub-notas">Notas Administrativas</Label>
              <Input
                id="sub-notas"
                placeholder="Ej: Activado manualmente por transferencia anual"
                value={subNotas}
                onChange={(e) => setSubNotas(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingNegocio(null)}
                disabled={savingSub}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={savingSub} className="gap-1.5">
                {savingSub ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Guardar Cambios
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: MÉTRICAS Y DETALLE DE TIENDA */}
      <Dialog open={Boolean(detailNegocio)} onOpenChange={(o) => !o && setDetailNegocio(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Métricas de {detailNegocio?.nombre}</DialogTitle>
            <DialogDescription>
              Slug: /{detailNegocio?.slug} · Administrador:{" "}
              <strong>
                {detailData?.admin_email ||
                  (detailNegocio && contactsMap[detailNegocio.id]?.email) ||
                  "No registrado"}
              </strong>
            </DialogDescription>
          </DialogHeader>

          {loadingDetail ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">
                Consultando métricas en tiempo real...
              </span>
            </div>
          ) : detailData ? (
            <div className="space-y-4">
              {detailNegocio && (
                <div className="p-3 rounded-lg border border-border bg-muted/30 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="font-semibold">Ubicación de referencia:</span>
                    {(() => {
                      const loc = inferFallbackLocation(
                        detailNegocio,
                        contactsMap[detailNegocio.id]
                      );
                      return loc ? (
                        <span>
                          {loc.flag} {loc.country}
                          {loc.city ? ` · ${loc.city}` : ""}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Sin registro aún</span>
                      );
                    })()}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      const n = detailNegocio;
                      setDetailNegocio(null);
                      openReactivationEmailModal(n);
                    }}
                  >
                    <Mail className="h-3 w-3" />
                    Enviar Correo
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <div className="text-[11px] text-muted-foreground uppercase font-semibold">
                    Ventas Hoy
                  </div>
                  <div className="text-lg font-bold">
                    {formatMoney(detailData.metricas?.ventas_total_dia ?? 0)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {detailData.metricas?.cant_ventas_dia ?? 0} tickets
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <div className="text-[11px] text-muted-foreground uppercase font-semibold">
                    Ventas del Mes
                  </div>
                  <div className="text-lg font-bold">
                    {formatMoney(detailData.metricas?.ventas_total_mes ?? 0)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {detailData.metricas?.cant_ventas_mes ?? 0} tickets
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <div className="text-[11px] text-muted-foreground uppercase font-semibold">
                    Productos Activos
                  </div>
                  <div className="text-lg font-bold">
                    {detailData.metricas?.productos_activos ?? 0}
                  </div>
                  <div className="text-[11px] text-amber-600">
                    {detailData.metricas?.stock_critico ?? 0} stock crítico
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-border bg-muted/20">
                  <div className="text-[11px] text-muted-foreground uppercase font-semibold">
                    Equipo y Clientes
                  </div>
                  <div className="text-lg font-bold">
                    {detailData.metricas?.usuarios ?? 0} usuarios
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {detailData.metricas?.clientes ?? 0} clientes
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">
                  Últimas Ventas Registradas
                </h4>
                {Array.isArray(detailData.ultimas_ventas) &&
                detailData.ultimas_ventas.length > 0 ? (
                  <div className="divide-y divide-border rounded-lg border border-border px-3">
                    {detailData.ultimas_ventas.map((v: any) => (
                      <div key={v.id} className="py-2 flex items-center justify-between text-xs">
                        <span>
                          Ticket #{String(v.id).slice(0, 8).toUpperCase()} ({v.pago || "Efectivo"})
                        </span>
                        <span className="font-bold">{formatMoney(v.total)}</span>
                        <span className="text-muted-foreground">
                          {new Date(v.created_at).toLocaleString("es-CL")}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin ventas registradas aún.</p>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* MODAL 4: CREAR / EDITAR CUPÓN */}
      <Dialog open={cuponModalOpen} onOpenChange={setCuponModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCuponId ? "Editar Cupón" : "Nuevo Cupón Promocional"}
            </DialogTitle>
            <DialogDescription>
              El comercio podrá canjear este código para activar días gratis del plan elegido.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCupon} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cup-codigo">Código</Label>
                <Input
                  id="cup-codigo"
                  placeholder="EJ: OPERIXPRO30"
                  value={cuponCodigo}
                  onChange={(e) => setCuponCodigo(e.target.value.toUpperCase())}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cup-plan">Plan Otorgado</Label>
                <select
                  id="cup-plan"
                  value={cuponPlan}
                  onChange={(e) => setCuponPlan(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="basico">Básico</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cup-dias">Días Gratis</Label>
                <Input
                  id="cup-dias"
                  type="number"
                  min={1}
                  max={3650}
                  value={cuponDias}
                  onChange={(e) => setCuponDias(Number(e.target.value))}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cup-usos">Máximo de Usos (opcional)</Label>
                <Input
                  id="cup-usos"
                  type="number"
                  min={1}
                  placeholder="Ilimitado"
                  value={cuponMaxUsos}
                  onChange={(e) => setCuponMaxUsos(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cup-vence">Fecha límite para canjear</Label>
              <Input
                id="cup-vence"
                type="date"
                value={cuponVenceAt}
                onChange={(e) => setCuponVenceAt(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cup-notas">Notas</Label>
              <Input
                id="cup-notas"
                placeholder="Campaña lanzamiento / cliente VIP"
                value={cuponNotas}
                onChange={(e) => setCuponNotas(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCuponModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingCupon}>
                {savingCupon ? "Guardando..." : "Guardar Cupón"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 5: ELIMINAR COMERCIO */}
      <Dialog
        open={Boolean(deletingNegocio)}
        onOpenChange={(o) => !o && setDeletingNegocio(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Eliminar Comercio
            </DialogTitle>
            <DialogDescription>
              Esta acción desvinculará los usuarios y eliminará el comercio{" "}
              <strong>{deletingNegocio?.nombre}</strong>. Para confirmar, escribe el slug{" "}
              <code className="font-mono font-bold text-foreground">
                {deletingNegocio?.slug}
              </code>
              :
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              placeholder={deletingNegocio?.slug || ""}
              value={confirmDeleteText}
              onChange={(e) => setConfirmDeleteText(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingNegocio(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteNegocio}
              disabled={
                deletingLoading ||
                confirmDeleteText.trim().toLowerCase() !==
                  deletingNegocio?.slug.toLowerCase()
              }
            >
              {deletingLoading ? "Eliminando..." : "Confirmar Eliminación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SuperAdminPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium">
            Cargando Consola Super Admin...
          </p>
        </div>
      }
    >
      <SuperAdminConsoleInner />
    </Suspense>
  );
}
