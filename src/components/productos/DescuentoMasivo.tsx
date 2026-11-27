"use client";

import { useMemo, useState } from "react";
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
import { Loader2, Percent, Tag, XCircle } from "lucide-react";

type Producto = Database["public"]["Tables"]["productos"]["Row"];
type Variante = Database["public"]["Tables"]["producto_variantes"]["Row"];

type Cambio = {
  tabla: "productos" | "producto_variantes";
  id: string;
  precio_promocional: number | null;
  promo_vence_at: string | null;
};

const TODAS = "__todas__";

interface Props {
  open: boolean;
  onClose: () => void;
  negocioId: string | undefined;
  productos: Producto[];
  variantes: Variante[];
  categorias: string[];
  /** Recarga los productos al terminar. */
  onDone: () => Promise<void> | void;
}

/**
 * Aplica o quita un descuento porcentual a todos los productos (y variantes)
 * de la tienda o de una categoría, con fecha de término opcional.
 * Escribe precio_promocional / promo_vence_at, que catálogo, caja, comandas y
 * pedidos del catálogo ya respetan.
 */
export function DescuentoMasivo({ open, onClose, negocioId, productos, variantes, categorias, onDone }: Props) {
  const [accion, setAccion] = useState<"aplicar" | "quitar">("aplicar");
  const [categoria, setCategoria] = useState<string>(TODAS);
  const [porcentaje, setPorcentaje] = useState<string>("20");
  const [soloConStock, setSoloConStock] = useState(true);
  const [incluirVariantes, setIncluirVariantes] = useState(true);
  const [venceFecha, setVenceFecha] = useState<string>("");
  const [ejecutando, setEjecutando] = useState(false);
  const [progreso, setProgreso] = useState(0);

  const pct = Number(porcentaje);
  const pctValido = Number.isFinite(pct) && pct >= 1 && pct <= 90;

  const enCategoria = (p: Producto) =>
    categoria === TODAS || p.categoria === categoria || (p.categorias || []).includes(categoria);

  const { cambios, nProductos, nVariantes, ejemplo } = useMemo(() => {
    const lista: Cambio[] = [];
    let ej: { nombre: string; antes: number; despues: number } | null = null;
    const vence = venceFecha ? new Date(`${venceFecha}T23:59:59`).toISOString() : null;
    const factor = 1 - pct / 100;
    const conPromo = (precio: number) => Math.round(precio * factor);

    const prods = productos.filter((p) => p.activo && enCategoria(p));
    const prodIds = new Set(prods.map((p) => p.id));

    for (const p of prods) {
      if (accion === "quitar") {
        if (p.precio_promocional != null) {
          lista.push({ tabla: "productos", id: p.id, precio_promocional: null, promo_vence_at: null });
        }
        continue;
      }
      const base = Number(p.precio_venta || 0);
      const disponible = p.sin_control_stock || Number(p.stock || 0) > 0;
      if (!pctValido || base <= 0 || (soloConStock && !disponible)) continue;
      const nuevo = conPromo(base);
      if (nuevo <= 0 || nuevo >= base) continue;
      lista.push({ tabla: "productos", id: p.id, precio_promocional: nuevo, promo_vence_at: vence });
      if (!ej) ej = { nombre: p.nombre, antes: base, despues: nuevo };
    }
    const nProd = lista.length;

    if (incluirVariantes) {
      const porId = new Map(prods.map((p) => [p.id, p]));
      for (const v of variantes) {
        if (!v.activo || !prodIds.has(v.producto_id)) continue;
        const p = porId.get(v.producto_id)!;
        if (accion === "quitar") {
          if (v.precio_promocional != null) {
            lista.push({ tabla: "producto_variantes", id: v.id, precio_promocional: null, promo_vence_at: null });
          }
          continue;
        }
        const base = Number(v.precio_venta ?? p.precio_venta ?? 0);
        const disponible = p.sin_control_stock || Number(v.stock || 0) > 0;
        if (!pctValido || base <= 0 || (soloConStock && !disponible)) continue;
        const nuevo = conPromo(base);
        if (nuevo <= 0 || nuevo >= base) continue;
        lista.push({ tabla: "producto_variantes", id: v.id, precio_promocional: nuevo, promo_vence_at: vence });
      }
    }

    return { cambios: lista, nProductos: nProd, nVariantes: lista.length - nProd, ejemplo: ej };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accion, categoria, pct, pctValido, soloConStock, incluirVariantes, venceFecha, productos, variantes]);

  const ejecutar = async () => {
    if (!negocioId || cambios.length === 0) return;
    const alcance = categoria === TODAS ? "toda la tienda" : `la categoría "${categoria}"`;
    const texto =
      accion === "aplicar"
        ? `¿Aplicar ${pct}% de descuento a ${nProductos} productos y ${nVariantes} variantes de ${alcance}? Reemplaza las promociones que ya tengan.`
        : `¿Quitar las promociones de ${nProductos} productos y ${nVariantes} variantes de ${alcance}?`;
    if (!confirm(texto)) return;

    setEjecutando(true);
    setProgreso(0);
    const supabase = createClient();
    let fallidos = 0;
    let hechos = 0;

    // Lotes pequeños en paralelo: cada fila tiene su propio precio
    const LOTE = 8;
    for (let i = 0; i < cambios.length; i += LOTE) {
      const lote = cambios.slice(i, i + LOTE);
      const res = await Promise.all(
        lote.map((c) =>
          supabase
            .from(c.tabla)
            .update({ precio_promocional: c.precio_promocional, promo_vence_at: c.promo_vence_at })
            .eq("id", c.id)
            .eq("negocio_id", negocioId)
        )
      );
      fallidos += res.filter((r) => r.error).length;
      hechos += lote.length;
      setProgreso(Math.round((hechos / cambios.length) * 100));
    }

    await onDone();
    setEjecutando(false);

    if (fallidos > 0) {
      toast.error(`${cambios.length - fallidos} actualizados, ${fallidos} con error. Vuelve a intentarlo para completar.`);
    } else if (accion === "aplicar") {
      toast.success(`Descuento de ${pct}% aplicado a ${nProductos} productos y ${nVariantes} variantes`);
      onClose();
    } else {
      toast.success(`Promociones quitadas de ${nProductos} productos y ${nVariantes} variantes`);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !ejecutando && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-primary" />
            Descuento masivo
          </DialogTitle>
          <DialogDescription className="text-xs">
            Aplica o quita una promoción a toda la tienda o a una categoría. Se refleja en la tienda
            online, la caja y las comandas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              size="sm"
              variant={accion === "aplicar" ? "default" : "outline"}
              onClick={() => setAccion("aplicar")}
              className="gap-1.5 text-xs"
            >
              <Tag className="h-3.5 w-3.5" /> Aplicar descuento
            </Button>
            <Button
              type="button"
              size="sm"
              variant={accion === "quitar" ? "default" : "outline"}
              onClick={() => setAccion("quitar")}
              className="gap-1.5 text-xs"
            >
              <XCircle className="h-3.5 w-3.5" /> Quitar promociones
            </Button>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Productos</Label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full h-9 rounded-md border bg-background px-2 text-xs"
            >
              <option value={TODAS}>Toda la tienda</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  Categoría: {c}
                </option>
              ))}
            </select>
          </div>

          {accion === "aplicar" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Descuento (%)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    value={porcentaje}
                    onChange={(e) => setPorcentaje(e.target.value)}
                    className="h-9 text-xs"
                  />
                  {!pctValido && <p className="text-[10px] text-destructive">Entre 1 y 90</p>}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Termina el (opcional)</Label>
                  <Input
                    type="date"
                    value={venceFecha}
                    min={new Date().toLocaleDateString("sv-SE")}
                    onChange={(e) => setVenceFecha(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <label className="flex items-center justify-between gap-2 text-xs">
                <span>Solo productos con stock</span>
                <Switch checked={soloConStock} onCheckedChange={setSoloConStock} />
              </label>
            </>
          )}

          <label className="flex items-center justify-between gap-2 text-xs">
            <span>Incluir variantes</span>
            <Switch checked={incluirVariantes} onCheckedChange={setIncluirVariantes} />
          </label>

          <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1">
            <div>
              {accion === "aplicar" ? "Se aplicará a " : "Se quitará de "}
              <b>{nProductos}</b> productos y <b>{nVariantes}</b> variantes.
            </div>
            {accion === "aplicar" && ejemplo && (
              <div className="text-muted-foreground">
                Ej.: {ejemplo.nombre}: <span className="line-through">{formatMoney(ejemplo.antes)}</span> →{" "}
                <b className="text-foreground">{formatMoney(ejemplo.despues)}</b>
              </div>
            )}
            {accion === "aplicar" && (
              <div className="text-muted-foreground">
                {venceFecha
                  ? `Vuelve al precio normal automáticamente después del ${venceFecha.split("-").reverse().join("-")}.`
                  : "Sin fecha de término: queda hasta que la quites."}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={ejecutando}>
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={ejecutar}
            disabled={ejecutando || cambios.length === 0}
            variant={accion === "quitar" ? "destructive" : "default"}
            className="gap-1.5"
          >
            {ejecutando && <Loader2 className="h-4 w-4 animate-spin" />}
            {ejecutando
              ? `Aplicando… ${progreso}%`
              : accion === "aplicar"
              ? "Aplicar descuento"
              : "Quitar promociones"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
