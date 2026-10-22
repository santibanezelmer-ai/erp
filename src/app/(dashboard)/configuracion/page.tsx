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
  Globe,
  ExternalLink,
  Check,
  FileText,
  FileCheck,
  AlertCircle,
  KeyRound,
  Landmark,
  HelpCircle,
  Send,
  Receipt,
  Sparkles,
  Save,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { limpiarRut } from "@/lib/libredte";

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

  // Logo del Negocio
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Tienda Online y Subdominio
  const [slug, setSlug] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [savingSlug, setSavingSlug] = useState(false);
  const [productosCount, setProductosCount] = useState<number>(0);
  const [dominioBase, setDominioBase] = useState("operixerp.cl");

  // Estados Facturación LibreDTE (Chile - SII)
  const [dteActivo, setDteActivo] = useState(false);
  const [dteHash, setDteHash] = useState("");
  const [dteRutEmisor, setDteRutEmisor] = useState("");
  const [dteRazonSocial, setDteRazonSocial] = useState("");
  const [dteGiro, setDteGiro] = useState("");
  const [dteActeco, setDteActeco] = useState("477111");
  const [dteDireccion, setDteDireccion] = useState("");
  const [dteComuna, setDteComuna] = useState("Santiago");
  const [dteCiudad, setDteCiudad] = useState("Santiago");
  const [dteAmbiente, setDteAmbiente] = useState<"certificacion" | "produccion">("certificacion");
  const [dteTipoDefault, setDteTipoDefault] = useState<39 | 33>(39);
  const [dteEmisionAuto, setDteEmisionAuto] = useState(true);

  // Estados de prueba y guardado DTE
  const [probandoDte, setProbandoDte] = useState(false);
  const [testDteResultado, setTestDteResultado] = useState<{ ok: boolean; mensaje: string } | null>(null);
  const [savingDte, setSavingDte] = useState(false);

  useEffect(() => {
    if (negocio) {
      setNombreNegocio(negocio.nombre || "");
      setRut((negocio as any).rut || "");
      setTelefono((negocio as any).telefono || "");
      setDireccion((negocio as any).direccion || "");
      setTipoNegocio(negocio.tipo_negocio === "restaurant" ? "restaurant" : "tienda");
      setLogoUrl(
        (negocio as any).logo_url ||
          (negocio.perfil?.startsWith("http") || negocio.perfil?.startsWith("data:")
            ? negocio.perfil
            : "")
      );
      setSlug(negocio.slug || "");
      cargarEquipo();
      cargarConteoProductos();
      cargarConfiguracionFiscal();
    }
    if (typeof window !== "undefined") {
      const h = window.location.host.split(":")[0];
      const parts = h.split(".");
      if (parts.length >= 2 && !h.includes("localhost")) {
        setDominioBase(parts.slice(-2).join("."));
      } else if (h.includes("localhost")) {
        setDominioBase("localhost:3000");
      }
    }
  }, [negocio?.id]);

  const cargarConteoProductos = async () => {
    if (!negocio?.id) return;
    const supabase = createClient();
    const { count } = await supabase
      .from("productos")
      .select("id", { count: "exact", head: true })
      .eq("negocio_id", negocio.id)
      .eq("activo", true);
    setProductosCount(count || 0);
  };

  const guardarSlug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocio?.id) return;
    const cleanSlug = slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!cleanSlug) {
      toast.error("El slug no puede estar vacío");
      return;
    }

    setSavingSlug(true);
    const supabase = createClient();
    try {
      const { data: existente } = await supabase
        .from("negocios")
        .select("id")
        .eq("slug", cleanSlug)
        .neq("id", negocio.id)
        .maybeSingle();

      if (existente) {
        toast.error("Este subdominio/slug ya está en uso por otro negocio");
        setSavingSlug(false);
        return;
      }

      const { error } = await supabase
        .from("negocios")
        .update({ slug: cleanSlug })
        .eq("id", negocio.id);

      if (error) throw error;
      toast.success("¡Subdominio y enlace de tienda actualizados!");
      setSlug(cleanSlug);
      reloadTenant();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar slug");
    } finally {
      setSavingSlug(false);
    }
  };

  const copiarEnlaceTienda = () => {
    const s = negocio?.slug || slug;
    const url = typeof window !== "undefined" ? `${window.location.origin}/c/${s}` : `https://${s}.${dominioBase}`;
    navigator.clipboard.writeText(url);
    setCopiado(true);
    toast.success("Enlace de tu tienda copiado al portapapeles");
    setTimeout(() => setCopiado(false), 2500);
  };

  const compartirWhatsApp = () => {
    const s = negocio?.slug || slug;
    const url = typeof window !== "undefined" ? `${window.location.origin}/c/${s}` : `https://${s}.${dominioBase}`;
    const msg = `¡Hola! Te invitamos a conocer el catálogo online de ${nombreNegocio || "nuestra tienda"}. Puedes revisar nuestros productos y hacer pedidos directamente desde aquí: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!negocio?.id) {
      toast.error("No se encontró el identificador del negocio");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      toast.error("La imagen debe pesar menos de 3MB");
      return;
    }

    setUploadingLogo(true);
    const supabase = createClient();

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const filePath = `${negocio.id}/logos/logo-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("producto-imgs")
        .upload(filePath, file, {
          upsert: true,
          cacheControl: "3600",
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data: pubData } = supabase.storage
        .from("producto-imgs")
        .getPublicUrl(filePath);

      const publicUrl = pubData.publicUrl;
      setLogoUrl(publicUrl);
      toast.success("Logo cargado con éxito. Haz clic en 'Guardar Información' para confirmar.");
    } catch (err: any) {
      console.error("Error al subir logo:", err);
      toast.error(err.message || "Error al subir la imagen");
    } finally {
      setUploadingLogo(false);
    }
  };

  // Cargar configuración de LibreDTE
  const cargarConfiguracionFiscal = async () => {
    if (!negocio?.id) return;
    const supabase = createClient();
    try {
      const { data } = await supabase
        .from("configuracion")
        .select("libredte_config, rut, business_name, direccion")
        .eq("negocio_id", negocio.id)
        .maybeSingle();

      const c = (data?.libredte_config as any) || {};
      setDteActivo(Boolean(c.activo));
      setDteHash(c.hash || "");
      setDteRutEmisor(c.rutEmisor || data?.rut || (negocio as any).rut || "");
      setDteRazonSocial(c.razonSocial || data?.business_name || negocio.nombre || "");
      setDteGiro(c.giro || "");
      setDteActeco(c.acteco ? String(c.acteco) : "477111");
      setDteDireccion(c.direccion || data?.direccion || (negocio as any).direccion || "");
      setDteComuna(c.comuna || "Santiago");
      setDteCiudad(c.ciudad || c.comuna || "Santiago");
      setDteAmbiente(c.ambiente === "produccion" ? "produccion" : "certificacion");
      setDteTipoDefault(Number(c.tipoDteDefault) === 33 ? 33 : 39);
      setDteEmisionAuto(c.emisionAutomatica !== false);
    } catch (err) {
      console.error("Error al cargar configuracion fiscal:", err);
    }
  };

  // Probar conexión con LibreDTE API
  const probarConexionDte = async () => {
    if (!dteHash.trim()) {
      toast.error("Por favor ingresa tu Token / Hash de LibreDTE");
      return;
    }
    setProbandoDte(true);
    setTestDteResultado(null);
    try {
      const res = await fetch("/api/libredte/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash: dteHash.trim() }),
      });
      const data = await res.json();
      setTestDteResultado(data);
      if (data.ok) {
        toast.success(data.mensaje);
      } else {
        toast.error(data.mensaje);
      }
    } catch (err: any) {
      const msg = err.message || "Error al conectar con LibreDTE";
      setTestDteResultado({ ok: false, mensaje: msg });
      toast.error(msg);
    } finally {
      setProbandoDte(false);
    }
  };

  // Guardar configuración fiscal LibreDTE
  const guardarConfiguracionFiscal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocio?.id) return;

    if (dteActivo && !dteHash.trim()) {
      toast.error("Para activar la facturación debes ingresar tu Hash / Token de LibreDTE");
      return;
    }

    if (dteActivo && !dteRutEmisor.trim()) {
      toast.error("Debes ingresar el RUT emisor de la empresa ante el SII");
      return;
    }

    setSavingDte(true);
    const supabase = createClient();
    try {
      const libredtePayload = {
        activo: dteActivo,
        hash: dteHash.trim(),
        rutEmisor: limpiarRut(dteRutEmisor.trim()),
        razonSocial: dteRazonSocial.trim(),
        giro: dteGiro.trim(),
        acteco: Number(dteActeco) || 477111,
        direccion: dteDireccion.trim(),
        comuna: dteComuna.trim(),
        ciudad: dteCiudad.trim(),
        ambiente: dteAmbiente,
        tipoDteDefault: Number(dteTipoDefault),
        emisionAutomatica: dteEmisionAuto,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("configuracion")
        .upsert(
          {
            negocio_id: negocio.id,
            libredte_config: libredtePayload,
            rut: limpiarRut(dteRutEmisor.trim()) || undefined,
            business_name: dteRazonSocial.trim() || undefined,
            direccion: dteDireccion.trim() || undefined,
          },
          { onConflict: "negocio_id" }
        );

      if (error) throw error;
      toast.success("¡Configuración fiscal de LibreDTE guardada exitosamente!");
    } catch (err: any) {
      toast.error(err.message || "Error al guardar configuración fiscal");
    } finally {
      setSavingDte(false);
    }
  };

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
      const cleanLogo = logoUrl ? logoUrl.trim() : null;

      const { error } = await supabase
        .from("negocios")
        .update({
          nombre: nombreNegocio.trim(),
          rut: rut.trim() || null,
          direccion: direccion.trim() || null,
          tipo_negocio: tipoNegocio,
          logo_url: cleanLogo,
          perfil: cleanLogo || (negocio.perfil?.startsWith("http") ? null : negocio.perfil) || "tienda",
        })
        .eq("id", negocio.id);

      if (error) throw error;

      // Mantener en sincronía con tabla configuracion
      try {
        await supabase
          .from("configuracion")
          .upsert(
            {
              negocio_id: negocio.id,
              business_name: nombreNegocio.trim(),
              logo_url: cleanLogo,
              rut: rut.trim() || null,
              direccion: direccion.trim() || null,
            },
            { onConflict: "negocio_id" }
          );
      } catch (errCfg) {
        console.warn("Sync configuracion warn:", errCfg);
      }

      toast.success("Información del negocio actualizada exitosamente");
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
            {/* Logo de la empresa */}
            <div className="flex items-center gap-4 p-3 rounded-xl border border-dashed border-border bg-muted/20">
              <div className="h-16 w-16 rounded-xl border bg-background flex items-center justify-center overflow-hidden shrink-0 shadow-xs relative">
                {uploadingLogo ? (
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                ) : logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-full w-full object-contain p-1" />
                ) : (
                  <Store className="h-7 w-7 text-muted-foreground/40" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <span className="text-xs font-bold text-foreground">Logotipo de la Empresa</span>
                <p className="text-[11px] text-muted-foreground">
                  Aparecerá en el encabezado de tus tickets térmicos y en tu catálogo digital público.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <label
                    className={cn(
                      "cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs",
                      uploadingLogo && "opacity-60 pointer-events-none"
                    )}
                  >
                    {uploadingLogo ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Subiendo logo...</span>
                      </>
                    ) : (
                      <span>{logoUrl ? "Cambiar Logo" : "Subir Logo"}</span>
                    )}
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/svg+xml, image/webp"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                      className="hidden"
                    />
                  </label>
                  {logoUrl && !uploadingLogo && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setLogoUrl("")}
                      className="h-7 text-xs text-destructive hover:bg-destructive/10"
                    >
                      Quitar Logo
                    </Button>
                  )}
                </div>
              </div>
            </div>

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

      {/* Tienda Online, Subdominio y Catálogo Digital */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Tienda Online & Subdominio del Negocio
          </CardTitle>
          <CardDescription>
            Configura el subdominio y el enlace público de tu catálogo online para clientes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={guardarSlug} className="space-y-3">
            <Label htmlFor="cfg-slug" className="text-xs font-semibold">
              Identificador / Subdominio de tu Tienda
            </Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 flex items-center rounded-lg border border-border bg-muted/30 px-3 py-1.5 focus-within:ring-2 focus-within:ring-primary">
                <span className="text-xs text-muted-foreground mr-1">https://</span>
                <input
                  id="cfg-slug"
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="mi-tienda"
                  disabled={savingSlug}
                  className="bg-transparent text-xs font-semibold text-foreground focus:outline-hidden flex-1"
                />
                <span className="text-xs text-primary font-medium ml-1">.{dominioBase}</span>
              </div>
              <Button type="submit" size="sm" disabled={savingSlug || slug === negocio?.slug} className="text-xs shrink-0">
                {savingSlug ? "Guardando..." : "Actualizar Subdominio"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Solo letras minúsculas, números y guiones. Este identificador define tu subdominio (ej: <code className="text-primary font-mono">{slug || "tienda"}.{dominioBase}</code>) y tu enlace directo (<code className="text-primary font-mono">{dominioBase}/c/{slug || "tienda"}</code>).
            </p>
          </form>

          {/* Enlaces y Acciones */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-foreground block">
                  Enlace público de tu catálogo:
                </span>
                <a
                  href={`/c/${negocio?.slug || slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline font-mono break-all inline-flex items-center gap-1 mt-0.5"
                >
                  {typeof window !== "undefined" ? `${window.location.origin}/c/${negocio?.slug || slug}` : `/c/${negocio?.slug || slug}`}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copiarEnlaceTienda}
                  className="gap-1.5 text-xs h-8"
                >
                  {copiado ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiado ? "Copiado" : "Copiar Enlace"}</span>
                </Button>
                <a
                  href={`/c/${negocio?.slug || slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:bg-primary/90 transition-colors h-8"
                >
                  <Store className="h-3.5 w-3.5" />
                  <span>Abrir Tienda</span>
                </a>
              </div>
            </div>

            <div className="border-t border-border pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Tienda activa con {productosCount} productos publicados</span>
              </div>
              <button
                type="button"
                onClick={compartirWhatsApp}
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Compartir catálogo por WhatsApp
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Facturación Electrónica SII - LibreDTE */}
      <Card className="border-primary/20 shadow-xs">
        <CardHeader className="pb-4 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Landmark className="h-5 w-5 text-primary" />
                <span>🇨🇱 Facturación Electrónica SII (LibreDTE)</span>
              </CardTitle>
              <CardDescription>
                Emite Boletas (DTE 39) y Facturas (DTE 33) oficiales ante el SII de Chile conectando tu cuenta de LibreDTE.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-xl border border-border">
              <span className="text-xs font-semibold text-foreground">
                {dteActivo ? "LibreDTE Activo" : "LibreDTE Desactivado"}
              </span>
              <Switch
                checked={dteActivo}
                onCheckedChange={setDteActivo}
                aria-label="Activar LibreDTE"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-5">
          <form onSubmit={guardarConfiguracionFiscal} className="space-y-5">
            {/* 1. Credencial API de LibreDTE */}
            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <Label htmlFor="dte-hash" className="text-xs font-bold flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-primary" />
                    <span>Token / Hash Personal de LibreDTE *</span>
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Se obtiene en <a href="https://libredte.cl" target="_blank" rel="noopener noreferrer" className="text-primary underline font-medium">libredte.cl</a> ingresando a <strong>Mi Cuenta &gt; Datos de Usuario &gt; Hash</strong>.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={probarConexionDte}
                  disabled={probandoDte || !dteHash.trim()}
                  className="h-8 text-xs gap-1.5 shrink-0 border-primary/40 text-primary hover:bg-primary/10 font-semibold"
                >
                  {probandoDte ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  <span>{probandoDte ? "Verificando..." : "Probar Conexión"}</span>
                </Button>
              </div>

              <div className="relative">
                <Input
                  id="dte-hash"
                  type="password"
                  value={dteHash}
                  onChange={(e) => {
                    setDteHash(e.target.value);
                    setTestDteResultado(null);
                  }}
                  placeholder="Pega aquí tu Hash de LibreDTE (ej: a1b2c3d4e5f6...)"
                  className="bg-background font-mono text-xs pr-10"
                />
              </div>

              {testDteResultado && (
                <div
                  className={cn(
                    "text-xs p-3 rounded-lg border flex items-center gap-2",
                    testDteResultado.ok
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                      : "bg-destructive/10 border-destructive/30 text-destructive"
                  )}
                >
                  {testDteResultado.ok ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0" />
                  )}
                  <span>{testDteResultado.mensaje}</span>
                </div>
              )}
            </div>

            {/* 2. Datos de la Empresa Emisora ante el SII */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider block">
                Datos de la Empresa Emisora (SII)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="dte-rut">RUT Emisor *</Label>
                  <Input
                    id="dte-rut"
                    placeholder="76.123.456-7"
                    value={dteRutEmisor}
                    onChange={(e) => setDteRutEmisor(e.target.value)}
                    onBlur={() => setDteRutEmisor(limpiarRut(dteRutEmisor))}
                    className="bg-background text-xs"
                    required={dteActivo}
                  />
                  <p className="text-[10px] text-muted-foreground">RUT de la empresa autorizada en el SII.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dte-rzn">Razón Social *</Label>
                  <Input
                    id="dte-rzn"
                    placeholder="Mi Empresa SpA o Juan Pérez Pérez"
                    value={dteRazonSocial}
                    onChange={(e) => setDteRazonSocial(e.target.value)}
                    className="bg-background text-xs"
                    required={dteActivo}
                  />
                  <p className="text-[10px] text-muted-foreground">Nombre legal según iniciación de actividades.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="dte-giro">Giro Comercial *</Label>
                  <Input
                    id="dte-giro"
                    placeholder="Venta al por menor de prendas de vestir, cafetería..."
                    value={dteGiro}
                    onChange={(e) => setDteGiro(e.target.value)}
                    className="bg-background text-xs"
                    required={dteActivo}
                  />
                  <p className="text-[10px] text-muted-foreground">Giro registrado ante el SII.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dte-acteco">Código Actividad Económica (Acteco SII) *</Label>
                  <Input
                    id="dte-acteco"
                    placeholder="477111"
                    value={dteActeco}
                    onChange={(e) => setDteActeco(e.target.value.replace(/[^0-9]/g, ""))}
                    className="bg-background text-xs font-mono"
                    required={dteActivo}
                  />
                  <p className="text-[10px] text-muted-foreground">Código de 6 dígitos del SII (ej: 477111, 561000).</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor="dte-dir">Dirección Casa Matriz</Label>
                  <Input
                    id="dte-dir"
                    placeholder="Av. Providencia 1234"
                    value={dteDireccion}
                    onChange={(e) => setDteDireccion(e.target.value)}
                    className="bg-background text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dte-com">Comuna *</Label>
                  <Input
                    id="dte-com"
                    placeholder="Providencia, Santiago, Viña del Mar..."
                    value={dteComuna}
                    onChange={(e) => setDteComuna(e.target.value)}
                    className="bg-background text-xs"
                    required={dteActivo}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dte-ciu">Ciudad</Label>
                  <Input
                    id="dte-ciu"
                    placeholder="Santiago"
                    value={dteCiudad}
                    onChange={(e) => setDteCiudad(e.target.value)}
                    className="bg-background text-xs"
                  />
                </div>
              </div>
            </div>

            {/* 3. Modalidad y Opciones de Emisión en POS */}
            <div className="p-4 rounded-xl border border-border bg-card space-y-4">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider block">
                Comportamiento en Punto de Venta (POS)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Ambiente de Operación</Label>
                  <select
                    value={dteAmbiente}
                    onChange={(e) => setDteAmbiente(e.target.value as any)}
                    className="w-full text-xs rounded-lg border border-border bg-background p-2 font-medium"
                  >
                    <option value="certificacion">🧪 Certificación (Pruebas / Sandbox SII)</option>
                    <option value="produccion">🚀 Producción (Documentos Oficiales Reales)</option>
                  </select>
                  <p className="text-[10px] text-muted-foreground">
                    Usa <em>Certificación</em> para ensayar sin declarar impuestos y <em>Producción</em> cuando tu empresa ya esté autorizada por el SII.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Documento por Defecto</Label>
                  <select
                    value={dteTipoDefault}
                    onChange={(e) => setDteTipoDefault(Number(e.target.value) as any)}
                    className="w-full text-xs rounded-lg border border-border bg-background p-2 font-medium"
                  >
                    <option value={39}>🧾 Boleta Electrónica (DTE 39)</option>
                    <option value={33}>📄 Factura Electrónica (DTE 33)</option>
                  </select>
                  <p className="text-[10px] text-muted-foreground">
                    Documento tributario seleccionado automáticamente al abrir la ventana de cobro.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/60">
                <div className="space-y-0.5 pr-4">
                  <span className="text-xs font-bold text-foreground block">
                    Emisión Automática al Cobrar en POS
                  </span>
                  <span className="text-[11px] text-muted-foreground block">
                    Al presionar "Cobrar" en el POS, generar y timbrar la Boleta Electrónica en LibreDTE en el mismo instante y mostrar su enlace PDF con folio del SII.
                  </span>
                </div>
                <Switch
                  checked={dteEmisionAuto}
                  onCheckedChange={setDteEmisionAuto}
                />
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={savingDte} className="gap-2 shadow-sm font-bold">
                {savingDte ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>{savingDte ? "Guardando configuración fiscal..." : "Guardar Configuración Fiscal"}</span>
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
