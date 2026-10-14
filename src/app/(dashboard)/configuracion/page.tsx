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
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ConfiguracionPage() {
  const { negocio, sucursales, reloadTenant } = useTenant();
  const [saving, setSaving] = useState(false);

  // Form Negocio
  const [nombreNegocio, setNombreNegocio] = useState("");
  const [rut, setRut] = useState("");
  const [direccion, setDireccion] = useState("");
  const [tipoNegocio, setTipoNegocio] = useState<"tienda" | "restaurant">("tienda");

  // Moneda
  const [monedaActual, setMonedaActual] = useState(getCurrency().code);

  // Modal Nueva Sucursal
  const [openModalSucursal, setOpenModalSucursal] = useState(false);
  const [nuevaSucursalNombre, setNuevaSucursalNombre] = useState("");
  const [nuevaSucursalDir, setNuevaSucursalDir] = useState("");
  const [creandoSucursal, setCreandoSucursal] = useState(false);

  useEffect(() => {
    if (negocio) {
      setNombreNegocio(negocio.nombre || "");
      setRut((negocio as any).rut || "");
      setDireccion((negocio as any).direccion || "");
      setTipoNegocio(negocio.tipo_negocio === "restaurant" ? "restaurant" : "tienda");
    }
  }, [negocio]);

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

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración del Sistema</h1>
        <p className="text-sm text-muted-foreground">
          Parámetros generales de tu empresa, sucursales y moneda
        </p>
      </div>

      {/* Datos del Negocio */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" />
            Datos de la Empresa / Local
          </CardTitle>
          <CardDescription>Información legal y formato comercial</CardDescription>
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
                      : "border-border text-muted-foreground"
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
                      : "border-border text-muted-foreground"
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
