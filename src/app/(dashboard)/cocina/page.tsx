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

  useEffect(() => {
    fetchCocina();

    // Supabase Realtime subscription para nuevos pedidos
    const supabase = createClient();
    const channel = supabase
      .channel("cocina-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comanda_items" },
        () => {
          fetchCocina();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [negocio?.id]);

  const cambiarEstadoItem = async (id: string, nuevoEstado: string) => {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("comanda_items")
        .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      toast.success(`Plato marcado como ${nuevoEstado}`);
      fetchCocina();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar");
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

        <Button variant="outline" size="sm" onClick={fetchCocina} className="gap-1.5 text-xs">
          <RefreshCw className="h-3.5 w-3.5" />
          Actualizar
        </Button>
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
                        onClick={() => cambiarEstadoItem(item.id, "preparando")}
                        className="w-full h-8 text-xs font-semibold gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
                      >
                        <Flame className="h-3.5 w-3.5" />
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
                        onClick={() => cambiarEstadoItem(item.id, "listo")}
                        className="w-full h-8 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
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
                Listos para Servir
              </span>
              <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-full text-xs">
                {listos.length}
              </span>
            </div>

            <div className="space-y-3">
              {listos.map((item) => (
                <Card key={item.id} className="border-l-4 border-l-emerald-500 shadow-sm opacity-90">
                  <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
                    <span className="font-bold text-xs bg-muted px-2 py-0.5 rounded">
                      Mesa: {item.mesa_numero}
                    </span>
                    <span className="text-[11px] text-emerald-600 font-semibold">Listo</span>
                  </CardHeader>
                  <CardContent className="p-3 pt-2">
                    <div className="text-sm font-bold text-foreground">
                      <span className="mr-1">{item.qty}×</span>
                      {item.nombre}
                    </div>

                    <div className="mt-3 pt-2 border-t border-border/60">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => cambiarEstadoItem(item.id, "entregado")}
                        className="w-full h-8 text-xs"
                      >
                        Marcar Entregado
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
