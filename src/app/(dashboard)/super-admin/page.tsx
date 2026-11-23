"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTenant } from "@/contexts/tenant-context";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
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
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

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
  rut?: string | null;
  created_at: string;
}

interface SuscripcionRow {
  id: string;
  negocio_id: string;
  plan: string;
  estado: string;
  ciclo?: string | null;
  vence_at: string | null;
  notas: string | null;
  updated_at: string;
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

export default function SuperAdminPage() {
  const router = useRouter();
  const { isSuperAdmin, loading: tenantLoading } = useTenant();

  const [activeTab, setActiveTab] = useState<"comercios" | "cupones">("comercios");
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<GlobalKpis | null>(null);
  const [negocios, setNegocios] = useState<NegocioRow[]>([]);
  const [suscripcionesMap, setSuscripcionesMap] = useState<Record<string, SuscripcionRow>>({});
  const [cupones, setCupones] = useState<CuponRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");

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

  useEffect(() => {
    if (!tenantLoading && !isSuperAdmin) {
      router.replace("/dashboard");
    }
  }, [tenantLoading, isSuperAdmin, router]);

  useEffect(() => {
    if (isSuperAdmin) {
      loadAllData();
    }
  }, [isSuperAdmin]);

  const loadAllData = async () => {
    setLoading(true);
    const supabase = createClient();
    try {
      const [kpisRes, negRes, suscRes, cupRes] = await Promise.all([
        supabase.rpc("sa_kpis_globales"),
        supabase
          .from("negocios")
          .select("id, nombre, slug, plan, tipo_negocio, rut, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("suscripciones").select("*"),
        supabase
          .from("cupones_internos")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      if (kpisRes.data) {
        setKpis(kpisRes.data as unknown as GlobalKpis);
      }

      if (negRes.data) {
        setNegocios(negRes.data as NegocioRow[]);
      }

      if (suscRes.data) {
        const map: Record<string, SuscripcionRow> = {};
        for (const s of suscRes.data as SuscripcionRow[]) {
          map[s.negocio_id] = s;
        }
        setSuscripcionesMap(map);
      }

      if (cupRes.data) {
        setCupones(cupRes.data as CuponRow[]);
      }
    } catch (err: any) {
      console.error("Error cargando datos de Super Admin:", err);
      toast.error("Error al cargar métricas globales");
    } finally {
      setLoading(false);
    }
  };

  const filteredNegocios = useMemo(() => {
    return negocios.filter((n) => {
      const susc = suscripcionesMap[n.id];
      const effectivePlan = susc?.plan || n.plan || "free";
      const matchesPlan = planFilter === "all" || effectivePlan === planFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        n.nombre.toLowerCase().includes(q) ||
        n.slug.toLowerCase().includes(q) ||
        (n.rut && n.rut.toLowerCase().includes(q));
      return matchesPlan && matchesQuery;
    });
  }, [negocios, suscripcionesMap, searchQuery, planFilter]);

  const openEditSubscription = (neg: NegocioRow) => {
    const susc = suscripcionesMap[neg.id];
    setEditingNegocio(neg);
    setSubPlan(susc?.plan && ["free", "pro", "enterprise"].includes(susc.plan) ? susc.plan : "pro");
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

      toast.success(`Suscripción de "${editingNegocio.nombre}" actualizada a ${subPlan.toUpperCase()}`);
      setEditingNegocio(null);
      await loadAllData();
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
      await loadAllData();
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
      await loadAllData();
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
      await loadAllData();
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar cupón");
    }
  };

  if (tenantLoading || (loading && !kpis)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">
          Cargando Consola Global de Super Admin...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold mb-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            Super Admin · Operix Cloud
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Panel de Control Global</h1>
          <p className="text-sm text-muted-foreground">
            Métricas globales, tiendas creadas, gestión de suscripciones y cupones promocionales.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadAllData} disabled={loading} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* KPIs Globales */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tiendas / Comercios
            </CardTitle>
            <Store className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.total_negocios ?? negocios.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Activas: {kpis?.por_estado_susc?.activa ?? 0} · Trial: {kpis?.por_estado_susc?.trial ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Usuarios Totales
            </CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.total_usuarios ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Cuentas registradas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Productos Activos
            </CardTitle>
            <Package className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.total_productos ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">En todos los catálogos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ventas Procesadas
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.total_ventas ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Tickets totales en la nube</p>
          </CardContent>
        </Card>

        <Card className="col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              GMV / Volumen Ventas
            </CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatMoney(kpis?.ingresos_totales ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Transaccionado en comercios</p>
          </CardContent>
        </Card>
      </div>

      {/* Selector de pestañas */}
      <div className="flex items-center justify-between border-b border-border pb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === "comercios" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("comercios")}
            className="gap-1.5"
          >
            <Store className="h-4 w-4" />
            Tiendas y Suscripciones ({negocios.length})
          </Button>
          <Button
            variant={activeTab === "cupones" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("cupones")}
            className="gap-1.5"
          >
            <Ticket className="h-4 w-4" />
            Cupones Promocionales ({cupones.length})
          </Button>
        </div>

        {activeTab === "cupones" && (
          <Button size="sm" onClick={() => openNewCuponModal()} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Nuevo Cupón
          </Button>
        )}
      </div>

      {/* TAB 1: COMERCIOS Y SUSCRIPCIONES */}
      {activeTab === "comercios" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold">Comercios Registrados</CardTitle>
                <CardDescription>
                  Inspecciona métricas por comercio, ajusta su plan o modifica el vencimiento de su suscripción.
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-64">
                  <Search className="h-4 w-4 text-muted-foreground absolute left-2.5 top-2.5" />
                  <Input
                    placeholder="Buscar por nombre, slug o RUT..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9 text-xs"
                  />
                </div>

                <select
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-xs font-medium"
                >
                  <option value="all">Todos los planes</option>
                  <option value="free">Free</option>
                  <option value="basico">Básico</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                  <option value="paid">Paid</option>
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
                    <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                      <th className="py-3 px-3 font-semibold">Comercio</th>
                      <th className="py-3 px-3 font-semibold">Tipo</th>
                      <th className="py-3 px-3 font-semibold">Plan / Suscripción</th>
                      <th className="py-3 px-3 font-semibold">Estado</th>
                      <th className="py-3 px-3 font-semibold">Vencimiento</th>
                      <th className="py-3 px-3 font-semibold">Creado</th>
                      <th className="py-3 px-3 font-semibold text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredNegocios.map((neg) => {
                      const susc = suscripcionesMap[neg.id];
                      const planLabel = (susc?.plan || neg.plan || "free").toUpperCase();
                      const estadoLabel = susc?.estado || "activa";
                      const isVencida =
                        susc?.vence_at && new Date(susc.vence_at).getTime() < Date.now();

                      return (
                        <tr key={neg.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-3 px-3">
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
                            </div>
                          </td>

                          <td className="py-3 px-3 capitalize text-xs">
                            {neg.tipo_negocio === "restaurant" ? "Restaurante" : "Tienda / Retail"}
                          </td>

                          <td className="py-3 px-3">
                            <Badge
                              variant={
                                planLabel === "PRO" || planLabel === "ENTERPRISE" || planLabel === "PAID"
                                  ? "default"
                                  : "secondary"
                              }
                              className="text-[10px] font-bold"
                            >
                              {planLabel}
                            </Badge>
                          </td>

                          <td className="py-3 px-3">
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

                          <td className="py-3 px-3 text-xs text-muted-foreground">
                            {susc?.vence_at
                              ? new Date(susc.vence_at).toLocaleDateString("es-CL")
                              : "Sin límite"}
                          </td>

                          <td className="py-3 px-3 text-xs text-muted-foreground">
                            {new Date(neg.created_at).toLocaleDateString("es-CL")}
                          </td>

                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-1"
                                onClick={() => openStoreDetails(neg)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Métricas
                              </Button>

                              <Button
                                variant="default"
                                size="sm"
                                className="h-8 text-xs gap-1"
                                onClick={() => openEditSubscription(neg)}
                              >
                                <CreditCard className="h-3.5 w-3.5" />
                                Suscripción
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
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

      {/* TAB 2: CUPONES INTERNOS */}
      {activeTab === "cupones" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold">Cupones Internos de Suscripción</CardTitle>
            <CardDescription>
              Permiten otorgar días gratuitos de planes Básico, Pro o Enterprise a los comercios.
            </CardDescription>
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
                    <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                      <th className="py-3 px-3 font-semibold">Código</th>
                      <th className="py-3 px-3 font-semibold">Plan</th>
                      <th className="py-3 px-3 font-semibold">Días Otorgados</th>
                      <th className="py-3 px-3 font-semibold">Usos</th>
                      <th className="py-3 px-3 font-semibold">Expira</th>
                      <th className="py-3 px-3 font-semibold">Estado</th>
                      <th className="py-3 px-3 font-semibold text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {cupones.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/40">
                        <td className="py-3 px-3 font-mono font-bold text-primary">{c.codigo}</td>
                        <td className="py-3 px-3 uppercase text-xs font-bold">{c.plan}</td>
                        <td className="py-3 px-3 text-xs">{c.dias_otorgados} días</td>
                        <td className="py-3 px-3 text-xs">
                          {c.usos} / {c.max_usos ?? "∞"}
                        </td>
                        <td className="py-3 px-3 text-xs text-muted-foreground">
                          {c.vence_at
                            ? new Date(c.vence_at).toLocaleDateString("es-CL")
                            : "Sin expiración"}
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant={c.activo ? "default" : "secondary"} className="text-[10px]">
                            {c.activo ? "ACTIVO" : "INACTIVO"}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => openNewCuponModal(c)}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
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
      )}

      {/* MODAL 1: AJUSTAR SUSCRIPCIÓN */}
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

      {/* MODAL 2: MÉTRICAS Y DETALLE DE TIENDA (sa_negocio_detalle) */}
      <Dialog open={Boolean(detailNegocio)} onOpenChange={(o) => !o && setDetailNegocio(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Métricas de {detailNegocio?.nombre}</DialogTitle>
            <DialogDescription>
              Slug: /{detailNegocio?.slug} · Administrador:{" "}
              <strong>{detailData?.admin_email || "No registrado"}</strong>
            </DialogDescription>
          </DialogHeader>

          {loadingDetail ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Consultando métricas en tiempo real...</span>
            </div>
          ) : detailData ? (
            <div className="space-y-4">
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

              {/* Últimas ventas */}
              <div>
                <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">
                  Últimas Ventas Registradas
                </h4>
                {Array.isArray(detailData.ultimas_ventas) && detailData.ultimas_ventas.length > 0 ? (
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

      {/* MODAL 3: CREAR / EDITAR CUPÓN */}
      <Dialog open={cuponModalOpen} onOpenChange={setCuponModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCuponId ? "Editar Cupón" : "Nuevo Cupón Promocional"}</DialogTitle>
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

      {/* MODAL 4: ELIMINAR COMERCIO */}
      <Dialog open={Boolean(deletingNegocio)} onOpenChange={(o) => !o && setDeletingNegocio(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Eliminar Comercio
            </DialogTitle>
            <DialogDescription>
              Esta acción desvinculará los usuarios y eliminará el comercio{" "}
              <strong>{deletingNegocio?.nombre}</strong>. Para confirmar, escribe el slug{" "}
              <code className="font-mono font-bold text-foreground">{deletingNegocio?.slug}</code>:
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
                confirmDeleteText.trim().toLowerCase() !== deletingNegocio?.slug.toLowerCase()
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
