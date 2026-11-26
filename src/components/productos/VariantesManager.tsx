"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Layers, Loader2, Plus, Save, Trash2, Info } from "lucide-react";

type Producto = Database["public"]["Tables"]["productos"]["Row"];
type Variante = Database["public"]["Tables"]["producto_variantes"]["Row"];

/** Fila editable. Los precios vacíos ("") significan "usar el valor del producto". */
type FilaVariante = {
  key: string;
  id: string | null;
  nombre: string;
  codigo: string;
  precioCosto: string;
  precioVenta: string;
  stock: string;
  activo: boolean;
  dirty: boolean;
};

function aFila(v: Variante): FilaVariante {
  return {
    key: v.id,
    id: v.id,
    nombre: v.nombre ?? "",
    codigo: v.codigo ?? "",
    precioCosto: v.precio_costo == null ? "" : String(v.precio_costo),
    precioVenta: v.precio_venta == null ? "" : String(v.precio_venta),
    stock: String(v.stock ?? 0),
    activo: v.activo ?? true,
    dirty: false,
  };
}

function filaNueva(): FilaVariante {
  return {
    key: `nueva-${Math.random().toString(36).slice(2)}`,
    id: null,
    nombre: "",
    codigo: "",
    precioCosto: "",
    precioVenta: "",
    stock: "0",
    activo: true,
    dirty: true,
  };
}

/** "" -> null (hereda del producto); número válido >= 0 -> número; otro -> NaN */
function precioOpcional(valor: string): number | null {
  const t = valor.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

interface Props {
  producto: Producto | null;
  negocioId: string | undefined;
  variantes: Variante[];
  onClose: () => void;
  /** Recarga los datos desde la BD; se espera antes de limpiar las filas nuevas. */
  onChanged: () => Promise<void> | void;
}

/**
 * Gestión de variantes de un producto: stock propio por variante y precios de
 * compra/venta opcionales. Si un precio queda vacío, la variante usa el precio
 * general del producto.
 */
export function VariantesManager({ producto, negocioId, variantes, onClose, onChanged }: Props) {
  // Ediciones locales sobre variantes ya guardadas (por id) y filas nuevas sin guardar.
  // Las filas visibles se derivan de las variantes de la BD + estas ediciones, así
  // un refresco nunca pisa cambios pendientes. El padre usa key={producto.id}.
  const [ediciones, setEdiciones] = useState<Record<string, FilaVariante>>({});
  const [nuevas, setNuevas] = useState<FilaVariante[]>([]);
  const [guardandoKey, setGuardandoKey] = useState<string | null>(null);

  const filas: FilaVariante[] = [
    ...variantes.map((v) => ediciones[v.id] ?? aFila(v)),
    ...nuevas,
  ];

  const actualizar = (fila: FilaVariante, cambios: Partial<FilaVariante>) => {
    const next = { ...fila, ...cambios, dirty: true };
    if (fila.id) {
      setEdiciones((prev) => ({ ...prev, [fila.id as string]: next }));
    } else {
      setNuevas((prev) => prev.map((f) => (f.key === fila.key ? next : f)));
    }
  };

  const descartarLocal = (fila: FilaVariante) => {
    if (fila.id) {
      setEdiciones((prev) => {
        const copy = { ...prev };
        delete copy[fila.id as string];
        return copy;
      });
    } else {
      setNuevas((prev) => prev.filter((f) => f.key !== fila.key));
    }
  };

  const guardar = async (fila: FilaVariante) => {
    if (!producto || !negocioId) return;

    const nombre = fila.nombre.trim();
    if (!nombre) {
      toast.error("La variante necesita un nombre (ej: Grande, Talla M, Rojo)");
      return;
    }
    const duplicada = filas.some(
      (f) => f.key !== fila.key && f.nombre.trim().toLowerCase() === nombre.toLowerCase()
    );
    if (duplicada) {
      toast.error(`Ya existe una variante llamada "${nombre}"`);
      return;
    }

    const precioCosto = precioOpcional(fila.precioCosto);
    const precioVenta = precioOpcional(fila.precioVenta);
    if (Number.isNaN(precioCosto) || Number.isNaN(precioVenta)) {
      toast.error("Los precios deben ser números mayores o iguales a 0, o quedar vacíos");
      return;
    }
    const stock = Number(fila.stock.trim() === "" ? 0 : fila.stock);
    if (!Number.isInteger(stock) || stock < 0) {
      toast.error("El stock debe ser un número entero mayor o igual a 0");
      return;
    }

    const payload = {
      nombre,
      codigo: fila.codigo.trim() || null,
      precio_costo: precioCosto,
      precio_venta: precioVenta,
      stock,
      activo: fila.activo,
    };

    setGuardandoKey(fila.key);
    const supabase = createClient();
    try {
      if (fila.id) {
        const { error } = await supabase
          .from("producto_variantes")
          .update(payload)
          .eq("id", fila.id)
          .eq("negocio_id", negocioId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("producto_variantes")
          .insert({ ...payload, producto_id: producto.id, negocio_id: negocioId });
        if (error) throw error;
      }
      // Recargar primero y luego soltar la copia local, para que la fila no "parpadee"
      await onChanged();
      descartarLocal(fila);
      toast.success(`Variante "${nombre}" guardada`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message;
      toast.error(msg || "No se pudo guardar la variante");
    } finally {
      setGuardandoKey(null);
    }
  };

  const eliminar = async (fila: FilaVariante) => {
    if (!fila.id) {
      descartarLocal(fila);
      return;
    }
    if (!negocioId) return;
    if (!confirm(`¿Eliminar la variante "${fila.nombre}"? Esta acción no se puede deshacer.`)) return;

    setGuardandoKey(fila.key);
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("producto_variantes")
        .delete()
        .eq("id", fila.id)
        .eq("negocio_id", negocioId);

      if (error) {
        // Referenciada por otros registros (ej. comandas): se desactiva en vez de borrar
        if ((error as { code?: string }).code === "23503") {
          const { error: updErr } = await supabase
            .from("producto_variantes")
            .update({ activo: false })
            .eq("id", fila.id)
            .eq("negocio_id", negocioId);
          if (updErr) throw updErr;
          toast.info(`"${fila.nombre}" tiene movimientos asociados: se desactivó en lugar de eliminarse`);
          await onChanged();
          descartarLocal(fila);
          return;
        }
        throw error;
      }
      await onChanged();
      descartarLocal(fila);
      toast.success(`Variante "${fila.nombre}" eliminada`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message;
      toast.error(msg || "No se pudo eliminar la variante");
    } finally {
      setGuardandoKey(null);
    }
  };

  const cerrar = () => {
    if (filas.some((f) => f.dirty) && !confirm("Hay variantes con cambios sin guardar. ¿Cerrar de todos modos?")) {
      return;
    }
    onClose();
  };

  const stockVariantes = filas
    .filter((f) => f.id && f.activo)
    .reduce((acc, f) => acc + (Number(f.stock) || 0), 0);

  return (
    <Dialog open={!!producto} onOpenChange={(open) => !open && cerrar()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <span>Variantes de {producto?.nombre}</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Cada variante tiene su propio stock. Si dejas un precio vacío, se usa el precio general
            del producto.
          </DialogDescription>
        </DialogHeader>

        {producto && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
            <span>
              Precio venta general: <b className="text-foreground">{formatMoney(producto.precio_venta)}</b>
            </span>
            <span>
              Precio compra general: <b className="text-foreground">{formatMoney(producto.precio_costo)}</b>
            </span>
            <span>
              Stock general: <b className="text-foreground">{producto.sin_control_stock ? "Ilimitado" : `${producto.stock ?? 0} u.`}</b>
            </span>
            {filas.some((f) => f.id) && (
              <span>
                Suma stock variantes activas: <b className="text-foreground">{stockVariantes} u.</b>
              </span>
            )}
          </div>
        )}

        <div className="space-y-2 py-1">
          {filas.length === 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Este producto no tiene variantes. Agrega una para manejar tamaños, tallas, colores u
                otras opciones con stock y precio propios.
              </span>
            </div>
          )}

          {filas.map((f) => {
            const ocupado = guardandoKey === f.key;
            return (
              <div
                key={f.key}
                className={`rounded-xl border p-3 space-y-2 ${f.dirty ? "border-amber-500/50 bg-amber-500/5" : "bg-card"}`}
              >
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                  <div className="col-span-2 sm:col-span-2 space-y-1">
                    <Label className="text-[11px]">Nombre *</Label>
                    <Input
                      value={f.nombre}
                      placeholder="Ej: Grande, Talla M"
                      onChange={(e) => actualizar(f, { nombre: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Stock</Label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={f.stock}
                      onChange={(e) => actualizar(f, { stock: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Precio compra</Label>
                    <Input
                      type="number"
                      min={0}
                      value={f.precioCosto}
                      placeholder={String(producto?.precio_costo ?? 0)}
                      onChange={(e) => actualizar(f, { precioCosto: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Precio venta</Label>
                    <Input
                      type="number"
                      min={0}
                      value={f.precioVenta}
                      placeholder={String(producto?.precio_venta ?? 0)}
                      onChange={(e) => actualizar(f, { precioVenta: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Código</Label>
                    <Input
                      value={f.codigo}
                      placeholder="Opcional"
                      onChange={(e) => actualizar(f, { codigo: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Switch
                      checked={f.activo}
                      onCheckedChange={(v) => actualizar(f, { activo: v })}
                    />
                    {f.activo ? "Activa (se vende)" : "Inactiva (oculta)"}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={ocupado}
                      onClick={() => eliminar(f)}
                      className="h-7 px-2 text-destructive hover:text-destructive"
                      title="Eliminar variante"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={ocupado || !f.dirty}
                      onClick={() => guardar(f)}
                      className="h-7 gap-1 px-2.5 text-xs"
                    >
                      {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      {f.id ? "Guardar" : "Crear"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setNuevas((prev) => [...prev, filaNueva()])}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Agregar variante
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={cerrar}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
