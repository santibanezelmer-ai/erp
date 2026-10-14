"use client";

import { useEffect, useState } from "react";
import { useTenant } from "@/contexts/tenant-context";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  UtensilsCrossed,
  Plus,
  Users,
  CheckCircle2,
  Clock,
  Layers,
  Trash2,
  Loader2,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Area = Database["public"]["Tables"]["areas"]["Row"];
type Mesa = Database["public"]["Tables"]["mesas"]["Row"];
type Comanda = Database["public"]["Tables"]["comandas"]["Row"];

export default function MesasPage() {
  const { negocio } = useTenant();
  const [areas, setAreas] = useState<Area[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [comandasActivas, setComandasActivas] = useState<Comanda[]>([]);
  const [loading, setLoading] = useState(true);
  const [areaSeleccionada, setAreaSeleccionada] = useState<string>("todas");

  // Modal Nueva Mesa
  const [modalMesaOpen, setModalMesaOpen] = useState(false);
  const [numeroMesa, setNumeroMesa] = useState("");
  const [capacidadMesa, setCapacidadMesa] = useState("4");
  const [areaIdMesa, setAreaIdMesa] = useState("");
  const [guardandoMesa, setGuardandoMesa] = useState(false);

  // Modal Nueva Área
  const [modalAreaOpen, setModalAreaOpen] = useState(false);
  const [nombreArea, setNombreArea] = useState("");
  const [guardandoArea, setGuardandoArea] = useState(false);

  const fetchData = async () => {
    if (!negocio?.id) return;
    setLoading(true);
    const supabase = createClient();

    try {
      const [areasRes, mesasRes, comandasRes] = await Promise.all([
        supabase
          .from("areas")
          .select("*")
          .eq("negocio_id", negocio.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("mesas")
          .select("*")
          .eq("negocio_id", negocio.id)
          .order("numero", { ascending: true }),
        supabase
          .from("comandas")
          .select("*")
          .eq("negocio_id", negocio.id)
          .eq("estado", "abierta"),
      ]);

      const loadedAreas = areasRes.data || [];
      setAreas(loadedAreas);
      if (loadedAreas.length > 0 && !areaIdMesa) {
        setAreaIdMesa(loadedAreas[0].id);
      }
      setMesas(mesasRes.data || []);
      setComandasActivas(comandasRes.data || []);
    } catch (err: any) {
      toast.error(err.message || "Error al cargar las mesas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [negocio?.id]);

  const crearMesa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocio?.id || !numeroMesa.trim()) return;

    setGuardandoMesa(true);
    const supabase = createClient();

    try {
      const { error } = await supabase.from("mesas").insert({
        negocio_id: negocio.id,
        area_id: areaIdMesa || null,
        numero: numeroMesa.trim(),
        capacidad: Number(capacidadMesa) || 4,
        estado: "libre",
      });

      if (error) throw error;
      toast.success("Mesa creada exitosamente");
      setModalMesaOpen(false);
      setNumeroMesa("");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Error al crear mesa");
    } finally {
      setGuardandoMesa(false);
    }
  };

  const crearArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocio?.id || !nombreArea.trim()) return;

    setGuardandoArea(true);
    const supabase = createClient();

    try {
      const { error } = await supabase.from("areas").insert({
        negocio_id: negocio.id,
        nombre: nombreArea.trim(),
      });

      if (error) throw error;
      toast.success("Área creada");
      setModalAreaOpen(false);
      setNombreArea("");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Error al crear área");
    } finally {
      setGuardandoArea(false);
    }
  };

  const cambiarEstadoMesa = async (mesa: Mesa, nuevoEstado: "libre" | "ocupada" | "reservada") => {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("mesas")
        .update({ estado: nuevoEstado })
        .eq("id", mesa.id);

      if (error) throw error;
      toast.success(`Mesa ${mesa.numero} marcada como ${nuevoEstado}`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar mesa");
    }
  };

  const eliminarMesa = async (id: string) => {
    if (!confirm("¿Deseas eliminar esta mesa?")) return;
    const supabase = createClient();
    try {
      const { error } = await supabase.from("mesas").delete().eq("id", id);
      if (error) throw error;
      toast.success("Mesa eliminada");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar");
    }
  };

  const mesasFiltradas = mesas.filter((m) => {
    if (areaSeleccionada === "todas") return true;
    return m.area_id === areaSeleccionada;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestión de Mesas y Salón</h1>
          <p className="text-sm text-muted-foreground">
            Control visual del estado de mesas, áreas y pedidos en curso
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setModalAreaOpen(true)} className="text-xs">
            + Nueva Área
          </Button>
          <Button size="sm" onClick={() => setModalMesaOpen(true)} className="gap-1.5 text-xs shadow-sm">
            <Plus className="h-4 w-4" />
            Nueva Mesa
          </Button>
        </div>
      </div>

      {/* Selector de Áreas */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setAreaSeleccionada("todas")}
          className={cn(
            "px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all",
            areaSeleccionada === "todas"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background border-border text-muted-foreground hover:bg-muted"
          )}
        >
          Todas las Áreas ({mesas.length})
        </button>
        {areas.map((a) => {
          const count = mesas.filter((m) => m.area_id === a.id).length;
          return (
            <button
              key={a.id}
              onClick={() => setAreaSeleccionada(a.id)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                areaSeleccionada === a.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {a.nombre} ({count})
            </button>
          );
        })}
      </div>

      {/* Grid de Mesas */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs">Cargando distribución de mesas...</span>
        </div>
      ) : mesasFiltradas.length === 0 ? (
        <Card className="text-center py-16 border-dashed">
          <CardContent className="space-y-3">
            <UtensilsCrossed className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <h3 className="font-bold text-base">No hay mesas en esta área</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Haz clic en &apos;Nueva Mesa&apos; para agregar mesas a tu salón, terraza o barra.
            </p>
            <Button size="sm" onClick={() => setModalMesaOpen(true)}>
              Agregar Mesa
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {mesasFiltradas.map((mesa) => {
            const comanda = comandasActivas.find((c) => c.mesa_id === mesa.id);
            const isOcupada = mesa.estado === "ocupada" || !!comanda;
            const isReservada = mesa.estado === "reservada";

            return (
              <div
                key={mesa.id}
                className={cn(
                  "p-4 rounded-xl border flex flex-col justify-between transition-all bg-card shadow-xs hover:shadow-md relative group",
                  isOcupada
                    ? "border-amber-500/50 bg-amber-500/5"
                    : isReservada
                    ? "border-blue-500/50 bg-blue-500/5"
                    : "border-emerald-500/40 bg-emerald-500/5"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg font-black text-foreground">
                    Mesa {mesa.numero}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full",
                      isOcupada
                        ? "bg-amber-500 text-white"
                        : isReservada
                        ? "bg-blue-500 text-white"
                        : "bg-emerald-500 text-white"
                    )}
                  >
                    {isOcupada ? "Ocupada" : isReservada ? "Reservada" : "Libre"}
                  </span>
                </div>

                <div className="my-3 space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    <span>{mesa.capacidad} personas</span>
                  </div>
                  {comanda && (
                    <div className="font-bold text-foreground text-sm pt-1">
                      Cuenta: {formatMoney(comanda.total)}
                    </div>
                  )}
                </div>

                {/* Acciones de cambio de estado */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-border/60">
                  {isOcupada ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => cambiarEstadoMesa(mesa, "libre")}
                      className="w-full h-7 text-[11px] font-semibold text-emerald-600 border-emerald-500/40 hover:bg-emerald-500/10"
                    >
                      Liberar Mesa
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => cambiarEstadoMesa(mesa, "ocupada")}
                      className="w-full h-7 text-[11px] font-semibold bg-amber-500 hover:bg-amber-600 text-white"
                    >
                      Ocupar Mesa
                    </Button>
                  )}
                  <button
                    onClick={() => eliminarMesa(mesa.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity"
                    title="Eliminar mesa"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Nueva Mesa */}
      <Dialog open={modalMesaOpen} onOpenChange={setModalMesaOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva Mesa</DialogTitle>
            <DialogDescription>Asigna el número y capacidad de comensales.</DialogDescription>
          </DialogHeader>

          <form onSubmit={crearMesa} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="m-num">Número o Identificador de Mesa *</Label>
              <Input
                id="m-num"
                placeholder="Ej: 1, 12, Barra-3"
                value={numeroMesa}
                onChange={(e) => setNumeroMesa(e.target.value)}
                required
                disabled={guardandoMesa}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="m-cap">Capacidad (Personas)</Label>
              <Input
                id="m-cap"
                type="number"
                min="1"
                value={capacidadMesa}
                onChange={(e) => setCapacidadMesa(e.target.value)}
                required
                disabled={guardandoMesa}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="m-area">Área / Salón</Label>
              <select
                id="m-area"
                value={areaIdMesa}
                onChange={(e) => setAreaIdMesa(e.target.value)}
                className="w-full text-xs rounded-lg border border-border bg-background p-2 text-foreground"
                disabled={guardandoMesa}
              >
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalMesaOpen(false)} disabled={guardandoMesa}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardandoMesa}>
                {guardandoMesa ? "Creando..." : "Crear Mesa"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Nueva Área */}
      <Dialog open={modalAreaOpen} onOpenChange={setModalAreaOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva Área / Salón</DialogTitle>
            <DialogDescription>Ejemplo: Terraza, Salón VIP, Barra, Patio.</DialogDescription>
          </DialogHeader>

          <form onSubmit={crearArea} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="a-nom">Nombre del Área</Label>
              <Input
                id="a-nom"
                placeholder="Ej: Terraza Exterior"
                value={nombreArea}
                onChange={(e) => setNombreArea(e.target.value)}
                required
                disabled={guardandoArea}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalAreaOpen(false)} disabled={guardandoArea}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardandoArea}>
                {guardandoArea ? "Guardando..." : "Crear Área"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
