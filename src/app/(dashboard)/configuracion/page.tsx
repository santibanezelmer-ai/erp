"use client";

import { useEffect, useState } from "react";
import { useTenant } from "@/contexts/tenant-context";
import { createClient } from "@/lib/supabase/client";
import { CURRENCIES, getCurrency, setCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Settings,
  Building2,
  DollarSign,
  Plus,
  Trash2,
  Store,
  UtensilsCrossed,
  CheckCircle2,
  Loader2,
  Users,
  UserPlus,
  Shield,
  Smartphone,
  Phone,
  MessageSquare,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Colaborador {
  id: string;
  user_id: string;
  role: string;
  email?: string;
  nombre?: string;
}

interface Invitacion {
  id: string;
  codigo: string;
  email: string | null;
  role: string;
  estado: string;
  created_at: string;
}

export default function ConfiguracionPage() {
  const { negocio, sucursales, reloadTenant, profile } = useTenant();
  const [saving, setSaving] = useState(false);

  // Form Negocio
  const [nombreNegocio, setNombreNegocio] = useState("");
  const [rut, setRut] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [tipoNegocio, setTipoNegocio] = useState<"tienda" | "restaurant">("tienda");

  // Moneda
  const [monedaActual, setMonedaActual] = useState(getCurrency().code);

  // Modal Nueva Sucursal
  const [openModalSucursal, setOpenModalSucursal] = useState(false);
  const [nuevaSucursalNombre, setNuevaSucursalNombre] = useState("");
  const [nuevaSucursalDir, setNuevaSucursalDir] = useState("");
  const [creandoSucursal, setCreandoSucursal] = useState(false);

  // Colaboradores y Roles
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [loadingEquipo, setLoadingEquipo] = useState(false);

  // Modal Invitar Colaborador
  const [modalInvitarOpen, setModalInvitarOpen] = useState(false);
  const [invitarEmail, setInvitarEmail] = useState("");
  const [invitarRol, setInvitarRol] = useState<"cajero" | "vendedor" | "bodeguero" | "admin">("cajero");
  const [invitarSucursalId, setInvitarSucursalId] = useState("");
  const [enviandoInvitacion, setEnviandoInvitacion] = useState(false);
  const [invitacionCreada, setInvitacionCreada] = useState<Invitacion | null>(null);

  useEffect(() => {
    if (negocio) {
      setNombreNegocio(negocio.nombre || "");
      setRut((negocio as any).rut || "");
      setTelefono((negocio as any).telefono || "");
      setDireccion((negocio as any).direccion || "");
      setTipoNegocio(negocio.tipo_negocio === "restaurant" ? "restaurant" : "tienda");
      cargarEquipo();
    }
  }, [negocio?.id]);

  const cargarEquipo = async () => {
    if (!negocio?.id) return;
    setLoadingEquipo(true);
    const supabase = createClient();

    try {
      // 1. Roles del negocio
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("*")
        .eq("negocio_id", negocio.id);

      // 2. Perfiles asociados
      const userIds = (rolesData || []).map((r) => r.user_id);
      let profilesMap = new Map<string, any>();

      if (userIds.length > 0) {
        const { data: perfs } = await supabase
          .from("profiles")
          .select("id, nombre, email")
          .in("id", userIds);
        (perfs || []).forEach((p) => profilesMap.set(p.id, p));
      }

      const listaColabs: Colaborador[] = (rolesData || []).map((r) => ({
        id: r.id,
        user_id: r.user_id,
        role: r.role,
        nombre: profilesMap.get(r.user_id)?.nombre || "Usuario Operix",
        email: profilesMap.get(r.user_id)?.email || "",
      }));

      setColaboradores(listaColabs);

      // 3. Invitaciones pendientes
      const { data: invs } = await supabase
        .from("invitaciones")
        .select("*")
        .eq("negocio_id", negocio.id)
        .eq("estado", "pendiente");

      setInvitaciones(invs || []);
    } catch (err: any) {
      console.error("Error al cargar equipo:", err);
    } finally {
      setLoadingEquipo(false);
    }
  };

  const guardarDatosNegocio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocio?.id) return;

    setSaving(true);
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from("negocios")
        .update({
          nombre: nombreNegocio.trim(),
          rut: rut.trim() || null,
          direccion: direccion.trim() || null,
          tipo_negocio: tipoNegocio,
        })
        .eq("id", negocio.id);

      if (error) throw error;
      toast.success("Información del negocio actualizada");
      reloadTenant();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleCambiarMoneda = (code: string) => {
    setMonedaActual(code);
    setCurrency(code);
    toast.success(`Moneda cambiada a ${code}`);
  };

  const crearSucursal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocio?.id || !nuevaSucursalNombre.trim()) return;

    setCreandoSucursal(true);
    const supabase = createClient();

    try {
      const { error } = await supabase.from("sucursales").insert({
        negocio_id: negocio.id,
        nombre: nuevaSucursalNombre.trim(),
        direccion: nuevaSucursalDir.trim() || null,
      });

      if (error) throw error;
      toast.success("Sucursal creada con éxito");
      setOpenModalSucursal(false);
      setNuevaSucursalNombre("");
      setNuevaSucursalDir("");
      reloadTenant();
    } catch (err: any) {
      toast.error(err.message || "Error al crear sucursal");
    } finally {
      setCreandoSucursal(false);
    }
  };

  const eliminarSucursal = async (id: string) => {
    if (sucursales.length <= 1) {
      toast.error("Debes mantener al menos una sucursal activa");
      return;
    }
    if (!confirm("¿Deseas eliminar esta sucursal?")) return;

    const supabase = createClient();
    try {
      const { error } = await supabase.from("sucursales").delete().eq("id", id);
      if (error) throw error;
      toast.success("Sucursal eliminada");
      reloadTenant();
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar");
    }
  };

  // Crear invitación para nuevo colaborador
  const handleCrearInvitacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocio?.id) return;
    setEnviandoInvitacion(true);
    const supabase = createClient();

    try {
      // Código de 8 caracteres alfanumérico
      const codigo = Math.random().toString(36).substring(2, 10).toUpperCase();

      const { data, error } = await supabase
        .from("invitaciones")
        .insert({
          negocio_id: negocio.id,
          codigo,
          email: invitarEmail.trim().toLowerCase() || null,
          role: invitarRol,
          sucursal_id: invitarSucursalId || null,
          estado: "pendiente",
        })
        .select("*")
        .single();

      if (error) throw error;
      setInvitacionCreada(data);
      toast.success("¡Invitación generada exitosamente!");
      cargarEquipo();
    } catch (err: any) {
      toast.error(err.message || "Error al generar invitación");
    } finally {
      setEnviandoInvitacion(false);
    }
  };

  const copiarCodigoInvitacion = (cod: string) => {
    navigator.clipboard.writeText(cod);
    toast.success("Código copiado al portapapeles");
  };

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración del Sistema</h1>
        <p className="text-sm text-muted-foreground">
          Parámetros generales de tu empresa, colaboradores, sucursales y moneda
        </p>
      </div>

      {/* Datos del Negocio */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" />
            Datos de la Empresa / Local
          </CardTitle>
          <CardDescription>Información legal, dirección y contacto para tickets y catálogo digital</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={guardarDatosNegocio} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cfg-nombre">Nombre Comercial *</Label>
                <Input
                  id="cfg-nombre"
                  value={nombreNegocio}
                  onChange={(e) => setNombreNegocio(e.target.value)}
                  required
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cfg-rut">RUT / Identificación Tributaria</Label>
                <Input
                  id="cfg-rut"
                  placeholder="Ej: 76.123.456-7"
                  value={rut}
                  onChange={(e) => setRut(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cfg-dir">Dirección Principal</Label>
              <Input
                id="cfg-dir"
                placeholder="Av. Providencia 1234, Santiago"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label>Modalidad Operativa</Label>
              <div className="grid grid-cols-2 gap-3 max-w-md">
                <button
                  type="button"
                  onClick={() => setTipoNegocio("tienda")}
                  className={cn(
                    "flex items-center gap-2.5 p-3 rounded-lg border text-xs font-semibold transition-all",
                    tipoNegocio === "tienda"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Store className="h-4 w-4" />
                  Tienda / Comercio
                </button>

                <button
                  type="button"
                  onClick={() => setTipoNegocio("restaurant")}
                  className={cn(
                    "flex items-center gap-2.5 p-3 rounded-lg border text-xs font-semibold transition-all",
                    tipoNegocio === "restaurant"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <UtensilsCrossed className="h-4 w-4" />
                  Restaurante / Bar
                </button>
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando cambios..." : "Guardar Información"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Equipo de Trabajo y Colaboradores */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Equipo de Trabajo y Colaboradores
            </CardTitle>
            <CardDescription>Cajeros, mozos, bodegueros y administradores</CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setInvitacionCreada(null);
              setInvitarEmail("");
              setModalInvitarOpen(true);
            }}
            className="gap-1.5 text-xs font-semibold"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Invitar Colaborador
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingEquipo ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : colaboradores.length === 0 ? (
            <div className="text-center py-6 text-xs text-muted-foreground">
              Aún no hay colaboradores adicionales registrados en este negocio.
            </div>
          ) : (
            <div className="divide-y divide-border border rounded-xl">
              {colaboradores.map((colab) => (
                <div key={colab.id} className="p-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-foreground flex items-center gap-2">
                      {colab.nombre}
                      {colab.user_id === profile?.id && (
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                          Tú
                        </span>
                      )}
                    </div>
                    {colab.email && <span className="text-muted-foreground text-[11px]">{colab.email}</span>}
                  </div>
                  <span className="font-bold capitalize px-2 py-0.5 rounded-md bg-muted text-foreground text-[11px]">
                    {colab.role}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Invitaciones pendientes */}
          {invitaciones.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Invitaciones Pendientes ({invitaciones.length})
              </span>
              <div className="divide-y divide-border border rounded-xl bg-muted/10">
                {invitaciones.map((inv) => (
                  <div key={inv.id} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold">{inv.email || "Invitación Abierta"}</span>
                      <div className="text-[10px] text-muted-foreground">
                        Rol asignado: <span className="font-bold capitalize">{inv.role}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-background px-2 py-1 rounded border font-mono font-bold text-primary text-[11px]">
                        {inv.codigo}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copiarCodigoInvitacion(inv.codigo)}
                        className="h-7 px-2"
                        title="Copiar código"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selector de Moneda */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-500" />
            Moneda y Formato
          </CardTitle>
          <CardDescription>Selecciona la moneda en la que operas tus ventas y reportes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {CURRENCIES.map((curr) => (
              <button
                key={curr.code}
                type="button"
                onClick={() => handleCambiarMoneda(curr.code)}
                className={cn(
                  "p-2.5 rounded-lg border text-left text-xs transition-all",
                  monedaActual === curr.code
                    ? "border-primary bg-primary/10 text-primary font-bold ring-1 ring-primary"
                    : "border-border hover:bg-muted text-muted-foreground"
                )}
              >
                <div>{curr.code}</div>
                <div className="text-[11px] opacity-75 truncate">{curr.label}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Gestión de Sucursales */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Sucursales y Puntos de Venta
            </CardTitle>
            <CardDescription>Locales y bodegas asociadas a tu negocio</CardDescription>
          </div>
          <Button size="sm" onClick={() => setOpenModalSucursal(true)} className="gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Nueva Sucursal
          </Button>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border">
            {sucursales.map((suc) => (
              <div key={suc.id} className="py-3 flex items-center justify-between text-sm">
                <div>
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    {suc.nombre}
                    {suc.id === sucursales[0]?.id && (
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                        Casa Matriz
                      </span>
                    )}
                  </div>
                  {suc.direccion && (
                    <div className="text-xs text-muted-foreground mt-0.5">{suc.direccion}</div>
                  )}
                </div>

                {sucursales.length > 1 && (
                  <button
                    onClick={() => eliminarSucursal(suc.id)}
                    className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    title="Eliminar sucursal"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modal Invitar Colaborador */}
      <Dialog open={modalInvitarOpen} onOpenChange={setModalInvitarOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Invitar Miembro al Equipo
            </DialogTitle>
            <DialogDescription className="text-xs">
              Genera una invitación para que un colaborador acceda con su rol asignado.
            </DialogDescription>
          </DialogHeader>

          {invitacionCreada ? (
            <div className="space-y-4 py-3 text-center">
              <div className="h-10 w-10 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm">¡Invitación Creada!</h4>
                <p className="text-xs text-muted-foreground">Comparte este código o enlace con tu colaborador:</p>
              </div>

              <div className="p-3 rounded-xl border bg-muted/30 flex items-center justify-between">
                <code className="text-lg font-black tracking-widest text-primary font-mono">
                  {invitacionCreada.codigo}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copiarCodigoInvitacion(invitacionCreada.codigo)}
                  className="gap-1.5 text-xs"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copiar Código
                </Button>
              </div>

              <DialogFooter>
                <Button onClick={() => setModalInvitarOpen(false)} className="w-full">
                  Cerrar
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleCrearInvitacion} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="inv-email" className="text-xs">Correo Electrónico (Opcional)</Label>
                <Input
                  id="inv-email"
                  type="email"
                  placeholder="colaborador@correo.com"
                  value={invitarEmail}
                  onChange={(e) => setInvitarEmail(e.target.value)}
                  disabled={enviandoInvitacion}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Rol en el Negocio *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "cajero", label: "Cajero", desc: "POS y ventas" },
                    { id: "vendedor", label: "Vendedor / Mozo", desc: "Comandas y catálogo" },
                    { id: "bodeguero", label: "Bodeguero", desc: "Stock y compras" },
                    { id: "admin", label: "Administrador", desc: "Acceso total" },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setInvitarRol(r.id as any)}
                      className={cn(
                        "p-2.5 rounded-lg border text-left text-xs transition-all",
                        invitarRol === r.id
                          ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <div className="font-bold">{r.label}</div>
                      <div className="text-[10px] opacity-75">{r.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Sucursal Asignada</Label>
                <select
                  value={invitarSucursalId}
                  onChange={(e) => setInvitarSucursalId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="">Todas las sucursales</option>
                  {sucursales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalInvitarOpen(false)}
                  disabled={enviandoInvitacion}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={enviandoInvitacion}>
                  {enviandoInvitacion ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    "Generar Invitación"
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Nueva Sucursal */}
      <Dialog open={openModalSucursal} onOpenChange={setOpenModalSucursal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva Sucursal</DialogTitle>
            <DialogDescription>Agrega otro punto de venta o local a tu cuenta.</DialogDescription>
          </DialogHeader>

          <form onSubmit={crearSucursal} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="suc-nom">Nombre de la Sucursal *</Label>
              <Input
                id="suc-nom"
                placeholder="Ej: Sucursal Mall Plaza o Bodega 2"
                value={nuevaSucursalNombre}
                onChange={(e) => setNuevaSucursalNombre(e.target.value)}
                required
                disabled={creandoSucursal}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="suc-dir">Dirección</Label>
              <Input
                id="suc-dir"
                placeholder="Ej: Local 204, Nivel 2"
                value={nuevaSucursalDir}
                onChange={(e) => setNuevaSucursalDir(e.target.value)}
                disabled={creandoSucursal}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenModalSucursal(false)} disabled={creandoSucursal}>
                Cancelar
              </Button>
              <Button type="submit" disabled={creandoSucursal}>
                {creandoSucursal ? "Creando..." : "Crear Sucursal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
