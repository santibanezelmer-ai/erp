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
  Truck,
  Plus,
  Search,
  PackagePlus,
  CheckCircle2,
  Clock,
  Loader2,
  Trash2,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Compra = Database["public"]["Tables"]["compras"]["Row"];
type CompraDetalle = Database["public"]["Tables"]["compra_detalle"]["Row"];
type Proveedor = Database["public"]["Tables"]["proveedores"]["Row"];
type Producto = Database["public"]["Tables"]["productos"]["Row"];

interface ItemCompraForm {
  producto_id: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
}

export default function ComprasPage() {
  const { negocio, user } = useTenant();
  const [compras, setCompras] = useState<Compra[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  // Modal Nueva Compra
  const [openModalCompra, setOpenModalCompra] = useState(false);
  const [proveedorId, setProveedorId] = useState("");
  const [numeroDoc, setNumeroDoc] = useState("");
  const [itemsCompra, setItemsCompra] = useState<ItemCompraForm[]>([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState("");
  const [cantItem, setCantItem] = useState("1");
  const [costoItem, setCostoItem] = useState("0");
  const [guardandoCompra, setGuardandoCompra] = useState(false);

  // Modal Nuevo Proveedor
  const [openModalProv, setOpenModalProv] = useState(false);
  const [provNombre, setProvNombre] = useState("");
  const [provRut, setProvRut] = useState("");
  const [provTel, setProvTel] = useState("");
  const [guardandoProv, setGuardandoProv] = useState(false);

  const fetchComprasData = async () => {
    if (!negocio?.id) return;
    setLoading(true);
    const supabase = createClient();

    try {
      const [comprasRes, provsRes, prodsRes] = await Promise.all([
        supabase
          .from("compras")
          .select("*")
          .eq("negocio_id", negocio.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("proveedores")
          .select("*")
          .eq("negocio_id", negocio.id)
          .order("nombre", { ascending: true }),
        supabase
          .from("productos")
          .select("*")
          .eq("negocio_id", negocio.id)
          .order("nombre", { ascending: true }),
      ]);

      setCompras(comprasRes.data || []);
      setProveedores(provsRes.data || []);
      setProductos(prodsRes.data || []);
    } catch (err: any) {
      toast.error(err.message || "Error al cargar compras");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComprasData();
  }, [negocio?.id]);

  const agregarItemACompra = () => {
    const prod = productos.find((p) => p.id === productoSeleccionado);
    if (!prod) {
      toast.error("Selecciona un producto");
      return;
    }
    const cant = Number(cantItem);
    const costo = Number(costoItem);
    if (cant <= 0 || costo < 0) {
      toast.error("Cantidad y costo deben ser mayores a 0");
      return;
    }

    setItemsCompra((prev) => [
      ...prev,
      {
        producto_id: prod.id,
        nombre: prod.nombre,
        cantidad: cant,
        precio_unitario: costo,
      },
    ]);

    setProductoSeleccionado("");
    setCantItem("1");
    setCostoItem("0");
  };

  const eliminarItemCompra = (index: number) => {
    setItemsCompra((prev) => prev.filter((_, i) => i !== index));
  };

  const totalCompra = itemsCompra.reduce((acc, i) => acc + i.cantidad * i.precio_unitario, 0);

  const guardarCompra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocio?.id) return;
    if (itemsCompra.length === 0) {
      toast.error("Agrega al menos un producto a la orden de compra");
      return;
    }

    setGuardandoCompra(true);
    const supabase = createClient();

    try {
      const prov = proveedores.find((p) => p.id === proveedorId);

      // 1. Insertar orden de compra
      const { data: compra, error: cErr } = await supabase
        .from("compras")
        .insert({
          negocio_id: negocio.id,
          usuario_id: user?.id || null,
          proveedor_id: proveedorId || null,
          proveedor_nombre: prov?.nombre || "Proveedor General",
          numero_doc: numeroDoc.trim() || null,
          fecha: new Date().toISOString().slice(0, 10),
          subtotal: totalCompra,
          total: totalCompra,
          estado: "recibida", // Al registrar la compra, se marca recibida para ingresar stock inmediato
          recibida_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (cErr) throw cErr;

      // 2. Insertar detalles
      const detalles = itemsCompra.map((i) => ({
        compra_id: compra.id,
        negocio_id: negocio.id,
        producto_id: i.producto_id,
        nombre_producto: i.nombre,
        cantidad: i.cantidad,
        cantidad_recibida: i.cantidad,
        precio_unitario: i.precio_unitario,
        total_linea: i.cantidad * i.precio_unitario,
      }));

      await supabase.from("compra_detalle").insert(detalles);

      // 3. Sumar stock y actualizar precio de costo
      for (const item of itemsCompra) {
        const prod = productos.find((p) => p.id === item.producto_id);
        if (prod && !prod.sin_control_stock) {
          const nuevoStock = Number(prod.stock || 0) + item.cantidad;
          await supabase
            .from("productos")
            .update({
              stock: nuevoStock,
              precio_costo: item.precio_unitario,
            })
            .eq("id", prod.id);
        }
      }

      toast.success("¡Compra registrada y stock actualizado!");
      setOpenModalCompra(false);
      setItemsCompra([]);
      setNumeroDoc("");
      setProveedorId("");
      fetchComprasData();
    } catch (err: any) {
      toast.error(err.message || "Error al registrar la compra");
    } finally {
      setGuardandoCompra(false);
    }
  };

  const guardarProveedor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocio?.id || !provNombre.trim()) return;

    setGuardandoProv(true);
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from("proveedores")
        .insert({
          negocio_id: negocio.id,
          nombre: provNombre.trim(),
          rut: provRut.trim() || null,
          telefono: provTel.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;
      toast.success("Proveedor agregado");
      setOpenModalProv(false);
      setProvNombre("");
      setProvRut("");
      setProvTel("");
      if (data) {
        setProveedorId(data.id);
      }
      fetchComprasData();
    } catch (err: any) {
      toast.error(err.message || "Error al agregar proveedor");
    } finally {
      setGuardandoProv(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compras a Proveedores</h1>
          <p className="text-sm text-muted-foreground">
            Ingreso de mercadería, facturas de compra y reposición automática de stock
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpenModalProv(true)} className="text-xs">
            + Nuevo Proveedor
          </Button>
          <Button size="sm" onClick={() => setOpenModalCompra(true)} className="gap-1.5 text-xs shadow-sm">
            <PackagePlus className="h-4 w-4" />
            Registrar Compra / Factura
          </Button>
        </div>
      </div>

      {/* Tabla de Compras */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs">Cargando compras...</span>
            </div>
          ) : compras.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No se han registrado órdenes de compra aún.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 border-b border-border text-xs text-muted-foreground uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4">N° Documento</th>
                    <th className="py-3 px-4">Proveedor</th>
                    <th className="py-3 px-4 text-right">Total Factura</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {compras.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString([], {
                          dateStyle: "medium",
                        })}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-xs text-foreground">
                        {c.numero_doc || `OC-${c.id.slice(0, 6).toUpperCase()}`}
                      </td>
                      <td className="py-3 px-4 font-semibold text-foreground">
                        {c.proveedor_nombre || "Proveedor General"}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-sm text-foreground">
                        {formatMoney(c.total)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="h-3 w-3" />
                          Stock Ingresado
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Registrar Compra */}
      <Dialog open={openModalCompra} onOpenChange={setOpenModalCompra}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar Compra de Mercadería</DialogTitle>
            <DialogDescription>
              Los productos agregados ingresarán automáticamente a tu stock.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={guardarCompra} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-prov">Proveedor</Label>
                <select
                  id="c-prov"
                  value={proveedorId}
                  onChange={(e) => setProveedorId(e.target.value)}
                  className="w-full text-xs rounded-lg border border-border bg-background p-2 text-foreground"
                >
                  <option value="">Selecciona proveedor...</option>
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} {p.rut ? `(${p.rut})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="c-doc">N° Factura / Guía</Label>
                <Input
                  id="c-doc"
                  placeholder="Ej: FAC-4589"
                  value={numeroDoc}
                  onChange={(e) => setNumeroDoc(e.target.value)}
                />
              </div>
            </div>

            {/* Selector de producto para agregar */}
            <div className="p-3 rounded-xl border border-border bg-muted/20 space-y-3">
              <div className="text-xs font-bold">Agregar Producto a la Compra</div>
              <div className="space-y-2">
                <select
                  value={productoSeleccionado}
                  onChange={(e) => {
                    setProductoSeleccionado(e.target.value);
                    const prod = productos.find((p) => p.id === e.target.value);
                    if (prod) {
                      setCostoItem(String(prod.precio_costo || 0));
                    }
                  }}
                  className="w-full text-xs rounded-lg border border-border bg-background p-2 text-foreground"
                >
                  <option value="">Seleccionar producto del catálogo...</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} (Stock actual: {p.stock || 0} u.)
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[11px]">Cantidad</Label>
                    <Input
                      type="number"
                      min="1"
                      value={cantItem}
                      onChange={(e) => setCantItem(e.target.value)}
                      className="h-8 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Costo Unitario</Label>
                    <Input
                      type="number"
                      min="0"
                      value={costoItem}
                      onChange={(e) => setCostoItem(e.target.value)}
                      className="h-8 text-xs font-bold"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={agregarItemACompra}
                      className="w-full h-8 text-xs"
                    >
                      + Añadir
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Lista de items añadidos */}
            <div className="divide-y divide-border border rounded-lg p-2 max-h-48 overflow-y-auto">
              {itemsCompra.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  Aún no has añadido productos a esta compra.
                </div>
              ) : (
                itemsCompra.map((it, idx) => (
                  <div key={idx} className="py-2 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-foreground">{it.nombre}</div>
                      <div className="text-muted-foreground">
                        {it.cantidad} u. × {formatMoney(it.precio_unitario)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-foreground">
                        {formatMoney(it.cantidad * it.precio_unitario)}
                      </span>
                      <button
                        type="button"
                        onClick={() => eliminarItemCompra(idx)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-between items-center text-sm font-bold pt-2 border-t border-border">
              <span>TOTAL FACTURA:</span>
              <span className="text-primary text-lg">{formatMoney(totalCompra)}</span>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenModalCompra(false)} disabled={guardandoCompra}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardandoCompra || itemsCompra.length === 0}>
                {guardandoCompra ? "Procesando stock..." : "Confirmar Compra"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Nuevo Proveedor */}
      <Dialog open={openModalProv} onOpenChange={setOpenModalProv}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuevo Proveedor</DialogTitle>
            <DialogDescription>Registra un distribuidor o fabricante.</DialogDescription>
          </DialogHeader>

          <form onSubmit={guardarProveedor} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pv-nom">Nombre o Empresa *</Label>
              <Input
                id="pv-nom"
                placeholder="Ej: Distribuidora Central Ltda"
                value={provNombre}
                onChange={(e) => setProvNombre(e.target.value)}
                required
                disabled={guardandoProv}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pv-rut">RUT / Identificación</Label>
              <Input
                id="pv-rut"
                placeholder="Ej: 77.456.789-0"
                value={provRut}
                onChange={(e) => setProvRut(e.target.value)}
                disabled={guardandoProv}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pv-tel">Teléfono</Label>
              <Input
                id="pv-tel"
                placeholder="+56 9 8765 4321"
                value={provTel}
                onChange={(e) => setProvTel(e.target.value)}
                disabled={guardandoProv}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenModalProv(false)} disabled={guardandoProv}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardandoProv}>
                {guardandoProv ? "Guardando..." : "Guardar Proveedor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
