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
  Package,
  Plus,
  Search,
  Pencil,
  Trash2,
  AlertTriangle,
  Loader2,
  Barcode,
  Layers,
  CheckCircle2,
  XCircle,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Producto = Database["public"]["Tables"]["productos"]["Row"];

export default function ProductosPage() {
  const { negocio, sucursalActiva } = useTenant();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroStock, setFiltroStock] = useState<"todos" | "bajo" | "agotado">("todos");

  // Modal Crear / Editar
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [productoEdit, setProductoEdit] = useState<Producto | null>(null);

  // Form states
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [precioVenta, setPrecioVenta] = useState<string>("0");
  const [precioCosto, setPrecioCosto] = useState<string>("0");
  const [stock, setStock] = useState<string>("0");
  const [stockMin, setStockMin] = useState<string>("5");
  const [sinControlStock, setSinControlStock] = useState(false);
  const [activo, setActivo] = useState(true);

  // Modal Ajuste Rápido
  const [ajusteModalOpen, setAjusteModalOpen] = useState(false);
  const [productoAjuste, setProductoAjuste] = useState<Producto | null>(null);
  const [cantidadAjuste, setCantidadAjuste] = useState<string>("0");
  const [tipoAjuste, setTipoAjuste] = useState<"agregar" | "reducir">("agregar");
  const [savingAjuste, setSavingAjuste] = useState(false);

  const fetchProductos = async () => {
    if (!negocio?.id) return;
    setLoading(true);
    const supabase = createClient();

    try {
      let query = supabase
        .from("productos")
        .select("*")
        .eq("negocio_id", negocio.id)
        .order("nombre", { ascending: true });

      const { data, error } = await query;
      if (error) throw error;
      setProductos(data || []);
    } catch (err: any) {
      toast.error(err.message || "Error al cargar productos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductos();
  }, [negocio?.id]);

  const abrirCrear = () => {
    setProductoEdit(null);
    setNombre("");
    setCodigo("");
    setCategoria("");
    setPrecioVenta("0");
    setPrecioCosto("0");
    setStock("0");
    setStockMin("5");
    setSinControlStock(false);
    setActivo(true);
    setModalOpen(true);
  };

  const abrirEditar = (prod: Producto) => {
    setProductoEdit(prod);
    setNombre(prod.nombre || "");
    setCodigo(prod.codigo || "");
    setCategoria(prod.categoria || "");
    setPrecioVenta(String(prod.precio_venta || 0));
    setPrecioCosto(String(prod.precio_costo || 0));
    setStock(String(prod.stock || 0));
    setStockMin(String(prod.stock_min || 5));
    setSinControlStock(prod.sin_control_stock || false);
    setActivo(prod.activo);
    setModalOpen(true);
  };

  const guardarProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocio?.id) return;

    if (!nombre.trim()) {
      toast.error("El nombre del producto es obligatorio");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    try {
      const payload = {
        negocio_id: negocio.id,
        sucursal_id: sucursalActiva?.id || null,
        nombre: nombre.trim(),
        codigo: codigo.trim() || null,
        categoria: categoria.trim() || null,
        precio_venta: Number(precioVenta) || 0,
        precio_costo: Number(precioCosto) || 0,
        stock: sinControlStock ? 0 : Number(stock) || 0,
        stock_min: Number(stockMin) || 0,
        sin_control_stock: sinControlStock,
        activo: activo,
      };

      if (productoEdit?.id) {
        // Actualizar
        const { error } = await supabase
          .from("productos")
          .update(payload)
          .eq("id", productoEdit.id);

        if (error) throw error;
        toast.success("Producto actualizado correctamente");
      } else {
        // Crear
        const { error } = await supabase.from("productos").insert(payload);
        if (error) throw error;
        toast.success("Producto creado con éxito");
      }

      setModalOpen(false);
      fetchProductos();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar el producto");
    } finally {
      setSaving(false);
    }
  };

  const eliminarProducto = async (id: string) => {
    if (!confirm("¿Seguro que deseas eliminar este producto?")) return;
    const supabase = createClient();
    try {
      const { error } = await supabase.from("productos").delete().eq("id", id);
      if (error) throw error;
      toast.success("Producto eliminado");
      fetchProductos();
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar");
    }
  };

  const abrirAjusteStock = (prod: Producto) => {
    setProductoAjuste(prod);
    setCantidadAjuste("1");
    setTipoAjuste("agregar");
    setAjusteModalOpen(true);
  };

  const guardarAjusteStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productoAjuste) return;

    const cant = Number(cantidadAjuste);
    if (isNaN(cant) || cant <= 0) {
      toast.error("Ingresa una cantidad válida");
      return;
    }

    setSavingAjuste(true);
    const supabase = createClient();

    try {
      const actual = Number(productoAjuste.stock || 0);
      const nuevoStock = tipoAjuste === "agregar" ? actual + cant : Math.max(0, actual - cant);

      const { error } = await supabase
        .from("productos")
        .update({ stock: nuevoStock })
        .eq("id", productoAjuste.id);

      if (error) throw error;
      toast.success(`Stock actualizado: ${nuevoStock} unidades`);
      setAjusteModalOpen(false);
      fetchProductos();
    } catch (err: any) {
      toast.error(err.message || "Error al ajustar stock");
    } finally {
      setSavingAjuste(false);
    }
  };

  // Filtrado
  const productosFiltrados = productos.filter((p) => {
    const q = busqueda.toLowerCase().trim();
    const matchBusqueda =
      !q ||
      p.nombre.toLowerCase().includes(q) ||
      (p.codigo && p.codigo.toLowerCase().includes(q)) ||
      (p.categoria && p.categoria.toLowerCase().includes(q));

    if (!matchBusqueda) return false;

    if (filtroStock === "bajo") {
      return !p.sin_control_stock && (p.stock || 0) <= (p.stock_min || 5) && (p.stock || 0) > 0;
    }
    if (filtroStock === "agotado") {
      return !p.sin_control_stock && (p.stock || 0) <= 0;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catálogo de Productos</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona precios, inventario y códigos de barra ({productos.length} productos registrados)
          </p>
        </div>

        <Button onClick={abrirCrear} className="gap-2 shadow-sm">
          <Plus className="h-4 w-4" />
          Nuevo Producto
        </Button>
      </div>

      {/* Filters and search */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, código o categoría..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setFiltroStock("todos")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              filtroStock === "todos"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border hover:bg-muted text-muted-foreground"
            )}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setFiltroStock("bajo")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              filtroStock === "bajo"
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-background border-border hover:bg-muted text-muted-foreground"
            )}
          >
            Stock Bajo
          </button>
          <button
            type="button"
            onClick={() => setFiltroStock("agotado")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              filtroStock === "agotado"
                ? "bg-destructive text-destructive-foreground border-destructive"
                : "bg-background border-border hover:bg-muted text-muted-foreground"
            )}
          >
            Agotados
          </button>
        </div>
      </div>

      {/* Table view */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs">Cargando inventario...</span>
            </div>
          ) : productosFiltrados.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {busqueda
                ? "No se encontraron productos con ese criterio de búsqueda."
                : "Aún no tienes productos registrados. Haz clic en 'Nuevo Producto' para comenzar."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 border-b border-border text-xs text-muted-foreground uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Producto</th>
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4 text-right">Precio Venta</th>
                    <th className="py-3 px-4 text-right">Costo</th>
                    <th className="py-3 px-4 text-center">Stock</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {productosFiltrados.map((prod) => {
                    const st = Number(prod.stock || 0);
                    const stMin = Number(prod.stock_min || 5);
                    const isBajo = !prod.sin_control_stock && st <= stMin && st > 0;
                    const isAgotado = !prod.sin_control_stock && st <= 0;

                    return (
                      <tr key={prod.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-foreground">{prod.nombre}</div>
                        </td>
                        <td className="py-3 px-4">
                          {prod.codigo ? (
                            <span className="font-mono text-xs text-muted-foreground flex items-center gap-1">
                              <Barcode className="h-3 w-3" />
                              {prod.codigo}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {prod.categoria ? (
                            <span className="inline-block px-2 py-0.5 rounded text-xs bg-muted font-medium">
                              {prod.categoria}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-foreground">
                          {formatMoney(prod.precio_venta)}
                        </td>
                        <td className="py-3 px-4 text-right text-xs text-muted-foreground">
                          {formatMoney(prod.precio_costo)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {prod.sin_control_stock ? (
                            <span className="text-xs text-muted-foreground italic">Ilimitado</span>
                          ) : (
                            <div className="inline-flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "font-bold text-xs px-2 py-0.5 rounded-full",
                                  isAgotado
                                    ? "bg-destructive/10 text-destructive"
                                    : isBajo
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-500"
                                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500"
                                )}
                              >
                                {st} u.
                              </span>
                              <button
                                onClick={() => abrirAjusteStock(prod)}
                                title="Ajustar stock"
                                className="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                              >
                                <ArrowUpDown className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {prod.activo ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-500 font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Activo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                              <XCircle className="h-3.5 w-3.5" />
                              Inactivo
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => abrirEditar(prod)}
                              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => eliminarProducto(prod.id)}
                              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
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

      {/* Modal Crear / Editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {productoEdit ? "Editar Producto" : "Nuevo Producto"}
            </DialogTitle>
            <DialogDescription>
              Completa los datos del producto para el punto de venta e inventario.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={guardarProducto} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="prod-nombre">Nombre del Producto *</Label>
              <Input
                id="prod-nombre"
                placeholder="Ej: Coca Cola 1.5L o Hamburguesa Especial"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                disabled={saving}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="prod-codigo">Código de Barras</Label>
                <Input
                  id="prod-codigo"
                  placeholder="Escanea o escribe..."
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prod-cat">Categoría</Label>
                <Input
                  id="prod-cat"
                  placeholder="Bebidas, Snacks..."
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="prod-precio">Precio de Venta *</Label>
                <Input
                  id="prod-precio"
                  type="number"
                  step="any"
                  value={precioVenta}
                  onChange={(e) => setPrecioVenta(e.target.value)}
                  required
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prod-costo">Costo (Compra)</Label>
                <Input
                  id="prod-costo"
                  type="number"
                  step="any"
                  value={precioCosto}
                  onChange={(e) => setPrecioCosto(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            {/* Switch sin control de stock */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold">Sin control de stock</div>
                <div className="text-[11px] text-muted-foreground">
                  Para servicios o platos de cocina sin inventario rígido
                </div>
              </div>
              <input
                type="checkbox"
                checked={sinControlStock}
                onChange={(e) => setSinControlStock(e.target.checked)}
                className="h-4 w-4 rounded border-border"
                disabled={saving}
              />
            </div>

            {!sinControlStock && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="prod-stock">Stock Actual</Label>
                  <Input
                    id="prod-stock"
                    type="number"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prod-stock-min">Stock Mínimo</Label>
                  <Input
                    id="prod-stock-min"
                    type="number"
                    value={stockMin}
                    onChange={(e) => setStockMin(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar Producto"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Ajuste Rápido de Stock */}
      <Dialog open={ajusteModalOpen} onOpenChange={setAjusteModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajustar Stock</DialogTitle>
            <DialogDescription>
              {productoAjuste?.nombre} (Actual: {productoAjuste?.stock || 0} u.)
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={guardarAjusteStock} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipoAjuste("agregar")}
                className={cn(
                  "py-2 rounded-lg text-xs font-semibold border transition-all",
                  tipoAjuste === "agregar"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-muted-foreground"
                )}
              >
                + Entrada (Sumar)
              </button>
              <button
                type="button"
                onClick={() => setTipoAjuste("reducir")}
                className={cn(
                  "py-2 rounded-lg text-xs font-semibold border transition-all",
                  tipoAjuste === "reducir"
                    ? "bg-destructive text-destructive-foreground border-destructive"
                    : "bg-background border-border text-muted-foreground"
                )}
              >
                - Salida (Restar)
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cant-ajuste">Cantidad de unidades</Label>
              <Input
                id="cant-ajuste"
                type="number"
                min="1"
                value={cantidadAjuste}
                onChange={(e) => setCantidadAjuste(e.target.value)}
                required
                disabled={savingAjuste}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAjusteModalOpen(false)}
                disabled={savingAjuste}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={savingAjuste}>
                {savingAjuste ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Aplicar Ajuste"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
