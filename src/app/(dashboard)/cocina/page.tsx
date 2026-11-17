"use client";

import { useEffect, useState } from "react";
import { useTenant } from "@/contexts/tenant-context";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ChefHat,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Flame,
  Bell,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ComandaItem = Database["public"]["Tables"]["comanda_items"]["Row"];
type Mesa = Database["public"]["Tables"]["mesas"]["Row"];

interface ItemConMesa extends ComandaItem {
  mesa_numero?: string;
}

export default function CocinaPage() {
  const { negocio } = useTenant();
  const [items, setItems] = useState<ItemConMesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [actualizandoItemId, setActualizandoItemId] = useState<string | null>(null);

  const fetchCocina = async () => {
    if (!negocio?.id) return;
    setLoading(true);
    const supabase = createClient();

    try {
      // 1. Obtener comandas abiertas
      const { data: coms } = await supabase
        .from("comandas")
        .select("id, mesa_id")
        .eq("negocio_id", negocio.id)
        .eq("estado", "abierta");

      const comIds = (coms || []).map((c) => c.id);

      if (comIds.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      // 2. Obtener items pendientes o en preparación
      const { data: its, error } = await supabase
        .from("comanda_items")
        .select("*")
        .in("comanda_id", comIds)
        .eq("requiere_preparacion", true)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // 3. Mesas map
      const { data: mesasData } = await supabase
        .from("mesas")
        .select("id, numero")
        .eq("negocio_id", negocio.id);

      const mesaMap = new Map((mesasData || []).map((m) => [m.id, m.numero]));
      const comandaMesaMap = new Map((coms || []).map((c) => [c.id, c.mesa_id ? mesaMap.get(c.mesa_id) : "Para Llevar"]));

      const itemsDecorados: ItemConMesa[] = (its || []).map((item) => ({
        ...item,
        mesa_numero: comandaMesaMap.get(item.comanda_id) || "Mesa",
      }));

      setItems(itemsDecorados);
    } catch (err: any) {
      toast.error(err.message || "Error al cargar pedidos de cocina");
    } finally {
      setLoading(false);
    }
  };

  // Reproduce un timbre de campana de cocina auténtico mediante síntesis Web Audio
  const reproducirCampanaCocina = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Primer armónico de campana (1046 Hz - C6)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(1046.5, now);
      gain1.gain.setValueAtTime(0.4, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.8);

      // Segundo armónico brillante (1318 Hz - E6)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1318.5, now + 0.12);
      gain2.gain.setValueAtTime(0.35, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 1.0);
    } catch (e) {
      console.warn("Audio Context bloqueado o no disponible:", e);
    }
  };

  useEffect(() => {
    if (!negocio?.id) return;
    fetchCocina();

    // Supabase Realtime subscription para pedidos de cocina con filtro estricto por negocio
    const supabase = createClient();
    const channel = supabase
      .channel(`cocina-kds-live-${negocio.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comanda_items",
          filter: `negocio_id=eq.${negocio.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            reproducirCampanaCocina();
            toast.info("🛎️ ¡Nuevo pedido marchado a cocina!");
          }
          fetchCocina();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comandas",
          filter: `negocio_id=eq.${negocio.id}`,
        },
        () => {
          fetchCocina();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [negocio?.id]);

  const cambiarEstadoItem = async (
    id: string,
    nuevoEstado: string,
    estadoAnteriorEsperado?: string
  ) => {
    if (!negocio?.id) return;
    setActualizandoItemId(id);
    const supabase = createClient();
    try {
      // Consulta con condición atómica de estado anterior para prevenir concurrencia
      let query = supabase
        .from("comanda_items")
        .update({
          estado: nuevoEstado,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("negocio_id", negocio.id);

      if (estadoAnteriorEsperado) {
        query = query.eq("estado", estadoAnteriorEsperado);
      }

      const { data, error } = await query.select("id, estado");

      if (error) throw error;

      // Si 0 filas fueron modificadas, otro usuario ya cambió el estado del plato
      if (!data || data.length === 0) {
        toast.warning(
          "El plato ya fue actualizado o cancelado por otro usuario en sala o cocina."
        );
        await fetchCocina();
        return;
      }

      // Actualizar localmente solo con confirmación de base de datos
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, estado: nuevoEstado } : i))
      );

      toast.success(
        nuevoEstado === "listo"
          ? "¡Plato listo! Se notificó al personal de sala."
          : `Plato marcado como ${nuevoEstado}`
      );
      fetchCocina();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar");
      fetchCocina();
    } finally {
      setActualizandoItemId(null);
    }
  };

  const pendientes = items.filter((i) => i.estado === "pendiente" || !i.estado);
  const enPreparacion = items.filter((i) => i.estado === "preparando");
  const listos = items.filter((i) => i.estado === "listo");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ChefHat className="h-6 w-6 text-primary" />
            Pantalla de Cocina / KDS
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitor de comandas y preparación en tiempo real
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              reproducirCampanaCocina();
              toast.success("🔔 Campana de cocina activada");
            }}
            className="gap-1.5 text-xs text-amber-600 border-amber-200 hover:bg-amber-50 dark:border-amber-900/50 dark:hover:bg-amber-950/30"
          >
            <Bell className="h-3.5 w-3.5" />
            Probar Campana
          </Button>
          <Button variant="outline" size="sm" onClick={fetchCocina} className="gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs">Conectando con la comanda de cocina...</span>
        </div>
      ) : items.length === 0 ? (
        <Card className="text-center py-20 border-dashed">
          <CardContent className="space-y-2">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <h3 className="font-bold text-base">Cocina al día</h3>
            <p className="text-xs text-muted-foreground">
              No hay pedidos pendientes de preparación en este momento.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Columna Pendientes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-destructive/10 border border-destructive/20 font-bold text-sm text-destructive">
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Pendientes
              </span>
              <span className="bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full text-xs">
                {pendientes.length}
              </span>
            </div>

            <div className="space-y-3">
              {pendientes.map((item) => (
                <Card key={item.id} className="border-l-4 border-l-destructive shadow-sm">
                  <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
                    <span className="font-bold text-xs bg-muted px-2 py-0.5 rounded">
                      Mesa: {item.mesa_numero}
                    </span>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(item.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </CardHeader>
                  <CardContent className="p-3 pt-2">
                    <div className="text-sm font-bold text-foreground">
                      <span className="text-primary font-black mr-1">{item.qty}×</span>
                      {item.nombre}
                    </div>
                    {item.notas && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 italic">
                        ⚠️ &quot;{item.notas}&quot;
                      </p>
                    )}

                    <div className="mt-3 pt-2 border-t border-border/60">
                      <Button
                        size="sm"
                        disabled={actualizandoItemId === item.id}
                        onClick={() => cambiarEstadoItem(item.id, "preparando", item.estado || "pendiente")}
                        className="w-full h-8 text-xs font-semibold gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
                      >
                        {actualizandoItemId === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Flame className="h-3.5 w-3.5" />
                        )}
                        Empezar a Cocinar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Columna En Preparación */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 font-bold text-sm text-amber-700 dark:text-amber-400">
              <span className="flex items-center gap-2">
                <Flame className="h-4 w-4" />
                En Preparación
              </span>
              <span className="bg-amber-500 text-white px-2 py-0.5 rounded-full text-xs">
                {enPreparacion.length}
              </span>
            </div>

            <div className="space-y-3">
              {enPreparacion.map((item) => (
                <Card key={item.id} className="border-l-4 border-l-amber-500 shadow-sm">
                  <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
                    <span className="font-bold text-xs bg-muted px-2 py-0.5 rounded">
                      Mesa: {item.mesa_numero}
                    </span>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(item.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </CardHeader>
                  <CardContent className="p-3 pt-2">
                    <div className="text-sm font-bold text-foreground">
                      <span className="text-amber-600 font-black mr-1">{item.qty}×</span>
                      {item.nombre}
                    </div>
                    {item.notas && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 italic">
                        ⚠️ &quot;{item.notas}&quot;
                      </p>
                    )}

                    <div className="mt-3 pt-2 border-t border-border/60">
                      <Button
                        size="sm"
                        disabled={actualizandoItemId === item.id}
                        onClick={() => cambiarEstadoItem(item.id, "listo", "preparando")}
                        className="w-full h-8 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {actualizandoItemId === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        ¡Plato Listo!
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Columna Listos para Servir */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 font-bold text-sm text-emerald-700 dark:text-emerald-400">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Listos en Barra / Pase
              </span>
              <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-full text-xs">
                {listos.length}
              </span>
            </div>

            <div className="space-y-3">
              {listos.map((item) => (
                <Card key={item.id} className="border-l-4 border-l-emerald-500 shadow-sm bg-card">
                  <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
                    <span className="font-bold text-xs bg-muted px-2 py-0.5 rounded">
                      Mesa: {item.mesa_numero}
                    </span>
                    <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 animate-pulse">
                      <Bell className="h-3 w-3" />
                      Esperando retiro
                    </span>
                  </CardHeader>
                  <CardContent className="p-3 pt-2">
                    <div className="text-sm font-bold text-foreground">
                      <span className="text-emerald-600 font-black mr-1">{item.qty}×</span>
                      {item.nombre}
                    </div>
                    {item.notas && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 italic">
                        ⚠️ &quot;{item.notas}&quot;
                      </p>
                    )}

                    <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground italic">
                        El garzón confirmará en salón
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={actualizandoItemId === item.id}
                        onClick={() => cambiarEstadoItem(item.id, "entregado", "listo")}
                        className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground hover:bg-muted"
                        title="Despachar manualmente si se entrega directamente"
                      >
                        {actualizandoItemId === item.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Despachar"
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
