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
  Layers,
  UtensilsCrossed,
  Plus,
  Minus,
  Trash2,
  ChefHat,
  Receipt,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  Loader2,
  Printer,
  CreditCard,
  User,
  ShoppingBag,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { imprimirTicketTermico } from "@/lib/ticket";

type Mesa = Database["public"]["Tables"]["mesas"]["Row"];
type Producto = Database["public"]["Tables"]["productos"]["Row"];
type Comanda = Database["public"]["Tables"]["comandas"]["Row"];
type ComandaItem = Database["public"]["Tables"]["comanda_items"]["Row"];

interface ItemDraft {
  producto: Producto;
  qty: number;
  precio: number;
  notas: string;
  requiere_preparacion: boolean;
}

export default function ComandasPage() {
  const { negocio, profile } = useTenant();
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);

  // Selección actual
  const [tipoPedido, setTipoPedido] = useState<"mesa" | "llevar">("mesa");
  const [mesaSeleccionada, setMesaSeleccionada] = useState<Mesa | null>(null);
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");

  // Comanda activa en la mesa (si ya existe)
  const [comandaActiva, setComandaActiva] = useState<Comanda | null>(null);
  const [itemsEnviados, setItemsEnviados] = useState<ComandaItem[]>([]);
  const [cargandoComanda, setCargandoComanda] = useState(false);

  // Nuevos ítems en borrador (por marchar/enviar a cocina)
  const [draftItems, setDraftItems] = useState<ItemDraft[]>([]);
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("todas");

  // Modal Notas Rápidas para un ítem
  const [itemNotaModal, setItemNotaModal] = useState<ItemDraft | null>(null);
  const [notaTexto, setNotaTexto] = useState("");

  // Estado de envío / guardado
  const [enviandoCocina, setEnviandoCocina] = useState(false);

  // Modal Pre-cuenta
  const [precuentaModalOpen, setPrecuentaModalOpen] = useState(false);

  // Modal Cobrar / Cerrar
  const [cerrarModalOpen, setCerrarModalOpen] = useState(false);
  const [metodoPagoCierre, setMetodoPagoCierre] = useState("efectivo");
  const [cerrandoComanda, setCerrandoComanda] = useState(false);

  const fetchData = async () => {
    if (!negocio?.id) return;
    setLoading(true);
    const supabase = createClient();

    try {
      const [mesasRes, prodsRes] = await Promise.all([
        supabase
          .from("mesas")
          .select("*")
          .eq("negocio_id", negocio.id)
          .order("numero", { ascending: true }),
        supabase
          .from("productos")
          .select("*")
          .eq("negocio_id", negocio.id)
          .eq("activo", true)
          .order("nombre", { ascending: true }),
      ]);

      setMesas(mesasRes.data || []);
      setProductos(prodsRes.data || []);
    } catch (err: any) {
      toast.error(err.message || "Error al cargar mesas y productos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [negocio?.id]);

  // Cuando se selecciona una mesa, cargar su comanda activa si existe
  const seleccionarMesa = async (mesa: Mesa) => {
    setMesaSeleccionada(mesa);
    setTipoPedido("mesa");
    setDraftItems([]);
    setCargandoComanda(true);
    const supabase = createClient();

    try {
      const { data: coms, error } = await supabase
        .from("comandas")
        .select("*")
        .eq("negocio_id", negocio!.id)
        .eq("mesa_id", mesa.id)
        .eq("estado", "abierta")
        .maybeSingle();

      if (error) throw error;

      if (coms) {
        setComandaActiva(coms);
        const { data: its } = await supabase
          .from("comanda_items")
          .select("*")
          .eq("comanda_id", coms.id)
          .order("created_at", { ascending: true });
        setItemsEnviados(its || []);
      } else {
        setComandaActiva(null);
        setItemsEnviados([]);
      }
    } catch (err: any) {
      toast.error("Error al verificar comanda de la mesa");
    } finally {
      setCargandoComanda(false);
    }
  };

  const seleccionarParaLlevar = () => {
    setMesaSeleccionada(null);
    setTipoPedido("llevar");
    setComandaActiva(null);
    setItemsEnviados([]);
    setDraftItems([]);
  };

  // Agregar producto al borrador
  const agregarAlDraft = (prod: Producto) => {
    setDraftItems((prev) => {
      const idx = prev.findIndex((i) => i.producto.id === prod.id && !i.notas);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx].qty += 1;
        return copy;
      }
      return [
        ...prev,
        {
          producto: prod,
          qty: 1,
          precio: Number(prod.precio_venta || 0),
          notas: "",
          requiere_preparacion: true,
        },
      ];
    });
  };

  const actualizarQtyDraft = (index: number, delta: number) => {
    setDraftItems((prev) => {
      const copy = [...prev];
      const newQty = copy[index].qty + delta;
      if (newQty <= 0) {
        return copy.filter((_, i) => i !== index);
      }
      copy[index].qty = newQty;
      return copy;
    });
  };

  const abrirModalNota = (item: ItemDraft) => {
    setItemNotaModal(item);
    setNotaTexto(item.notas || "");
  };

  const guardarNota = () => {
    if (!itemNotaModal) return;
    setDraftItems((prev) =>
      prev.map((i) => (i === itemNotaModal ? { ...i, notas: notaTexto } : i))
    );
    setItemNotaModal(null);
  };

  // Enviar a Cocina (Marchar platos)
  const enviarACocina = async () => {
    if (!negocio?.id) return;
    if (draftItems.length === 0) {
      toast.error("No hay productos nuevos para marchar");
      return;
    }

    setEnviandoCocina(true);
    const supabase = createClient();

    try {
      let comId = comandaActiva?.id;

      // Si no hay comanda abierta aún, crear una
      if (!comId) {
        const { data: nuevaCom, error: comErr } = await supabase
          .from("comandas")
          .insert({
            negocio_id: negocio.id,
            mesa_id: mesaSeleccionada?.id || null,
            tipo: tipoPedido,
            estado: "abierta",
            cliente_nombre: clienteNombre || null,
            cliente_telefono: clienteTelefono || null,
            mesero_id: profile?.id || null,
            total: 0,
          })
          .select("*")
          .single();

        if (comErr) throw comErr;
        comId = nuevaCom.id;
        setComandaActiva(nuevaCom);

        // Si es mesa, marcar la mesa como ocupada
        if (mesaSeleccionada?.id) {
          await supabase
            .from("mesas")
            .update({ estado: "ocupada" })
            .eq("id", mesaSeleccionada.id);
          setMesas((prev) =>
            prev.map((m) =>
              m.id === mesaSeleccionada.id ? { ...m, estado: "ocupada" } : m
            )
          );
        }
      }

      // Insertar comanda_items
      const nuevosItemsPayload = draftItems.map((d) => ({
        comanda_id: comId!,
        negocio_id: negocio.id,
        producto_id: d.producto.id,
        nombre: d.producto.nombre,
        qty: d.qty,
        precio: d.precio,
        notas: d.notas || null,
        requiere_preparacion: d.requiere_preparacion,
        estado: "pendiente",
      }));

      const { data: insertedItems, error: itemsErr } = await supabase
        .from("comanda_items")
        .insert(nuevosItemsPayload)
        .select("*");

      if (itemsErr) throw itemsErr;

      // Calcular nuevo total acumulado
      const itemsTotales = [...itemsEnviados, ...(insertedItems || [])];
      const nuevoTotal = itemsTotales.reduce(
        (acc, item) => acc + item.qty * Number(item.precio),
        0
      );

      await supabase
        .from("comandas")
        .update({ total: nuevoTotal })
        .eq("id", comId);

      setItemsEnviados(itemsTotales);
      setDraftItems([]);
      toast.success("¡Comanda marchada a cocina con éxito!");

      // Efecto sonoro de comanda enviada
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } catch {}
    } catch (err: any) {
      toast.error(err.message || "Error al enviar la comanda");
    } finally {
      setEnviandoCocina(false);
    }
  };

  // Cobrar y cerrar comanda
  const cerrarComanda = async () => {
    if (!comandaActiva || !negocio?.id) return;
    setCerrandoComanda(true);
    const supabase = createClient();

    try {
      const totalComanda = itemsEnviados.reduce(
        (acc, i) => acc + i.qty * Number(i.precio),
        0
      );

      // 1. Crear venta correspondiente
      const { data: venta, error: vErr } = await supabase
        .from("ventas")
        .insert({
          negocio_id: negocio.id,
          subtotal: totalComanda,
          total: totalComanda,
          pago: metodoPagoCierre,
          estado: "completada",
        })
        .select("id")
        .single();

      if (vErr) throw vErr;

      // 2. Registrar detalle de venta
      const detalles = itemsEnviados.map((i) => ({
        venta_id: venta.id,
        negocio_id: negocio.id,
        producto_id: i.producto_id,
        nombre: i.nombre,
        qty: i.qty,
        precio: Number(i.precio),
        subtotal: i.qty * Number(i.precio),
      }));
      await supabase.from("detalle_ventas").insert(detalles);

      // 3. Cerrar comanda
      await supabase
        .from("comandas")
        .update({
          estado: "cerrada",
          closed_at: new Date().toISOString(),
          venta_id: venta.id,
        })
        .eq("id", comandaActiva.id);

      // 4. Liberar mesa
      if (mesaSeleccionada?.id) {
        await supabase
          .from("mesas")
          .update({ estado: "libre" })
          .eq("id", mesaSeleccionada.id);

        setMesas((prev) =>
          prev.map((m) =>
            m.id === mesaSeleccionada.id ? { ...m, estado: "libre" } : m
          )
        );
      }

      toast.success("¡Comanda cobrada y cerrada exitosamente!");
      setCerrarModalOpen(false);
      setComandaActiva(null);
      setItemsEnviados([]);
      setDraftItems([]);
    } catch (err: any) {
      toast.error(err.message || "Error al cerrar la comanda");
    } finally {
      setCerrandoComanda(false);
    }
  };

  // Imprimir Pre-cuenta para el cliente
  const imprimirPrecuenta = () => {
    if (!comandaActiva && draftItems.length === 0) return;
    const todos = [
      ...itemsEnviados.map((i) => ({
        nombre: i.nombre,
        qty: i.qty,
        precio: Number(i.precio),
        subtotal: i.qty * Number(i.precio),
        nota: i.notas,
      })),
      ...draftItems.map((d) => ({
        nombre: d.producto.nombre,
        qty: d.qty,
        precio: d.precio,
        subtotal: d.qty * d.precio,
        nota: d.notas,
      })),
    ];

    const subtotal = todos.reduce((a, b) => a + b.subtotal, 0);

    imprimirTicketTermico(
      {
        negocioNombre: negocio?.nombre || "Restaurante",
        logoUrl: negocio?.perfil || null,
        folio: `PRE-${(comandaActiva?.id || "NUEVA").slice(0, 6).toUpperCase()}`,
        cajero: profile?.nombre || "Mesero",
        mesa: mesaSeleccionada ? `Mesa #${mesaSeleccionada.numero}` : "Para Llevar",
        items: todos,
        subtotal,
        total: subtotal,
        metodoPago: "Pendiente de pago",
        mensajePie: "PRE-CUENTA DE SERVICIO • Propina del 10% voluntaria sugerida",
      },
      80
    );
  };

  // Cálculos de totales
  const totalEnviado = itemsEnviados.reduce((a, b) => a + b.qty * Number(b.precio), 0);
  const totalDraft = draftItems.reduce((a, b) => a + b.qty * b.precio, 0);
  const totalGeneral = totalEnviado + totalDraft;

  // Filtro de catálogo
  const categorias = ["todas", ...Array.from(new Set(productos.map((p) => p.categoria).filter(Boolean) as string[]))];
  const productosFiltrados = productos.filter((p) => {
    const q = busquedaProducto.toLowerCase().trim();
    const matchBusqueda = !q || p.nombre.toLowerCase().includes(q) || (p.codigo && p.codigo.toLowerCase().includes(q));
    const matchCat = categoriaSeleccionada === "todas" || p.categoria === categoriaSeleccionada;
    return matchBusqueda && matchCat;
  });

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col lg:flex-row gap-4 overflow-hidden">
      {/* Columna Izquierda: Mesas y Catálogo de Platos */}
      <div className="flex-1 flex flex-col gap-3 min-w-0 bg-card rounded-xl border border-border p-4 overflow-hidden">
        {/* Selector de Mesa / Para Llevar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              1. Seleccionar Mesa o Tipo de Pedido
            </span>
            <Button
              variant={tipoPedido === "llevar" ? "default" : "outline"}
              size="sm"
              onClick={seleccionarParaLlevar}
              className="h-7 text-xs gap-1.5"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              Para Llevar
            </Button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {mesas.map((m) => {
              const selected = mesaSeleccionada?.id === m.id && tipoPedido === "mesa";
              const ocupada = m.estado === "ocupada";
              return (
                <button
                  key={m.id}
                  onClick={() => seleccionarMesa(m)}
                  className={cn(
                    "flex flex-col items-center justify-center p-2 rounded-xl border min-w-[72px] transition-all relative",
                    selected
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : ocupada
                      ? "bg-red-500/10 border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/20"
                      : "bg-background border-border text-foreground hover:bg-muted"
                  )}
                >
                  <UtensilsCrossed className="h-4 w-4 mb-1" />
                  <span className="text-xs font-bold">Mesa {m.numero}</span>
                  <span className="text-[10px] opacity-80 capitalize">{m.estado}</span>
                  {ocupada && !selected && (
                    <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Buscador de Platos y Categorías */}
        <div className="space-y-2 pt-2 border-t border-border/60">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar plato, trago o producto..."
              value={busquedaProducto}
              onChange={(e) => setBusquedaProducto(e.target.value)}
              className="pl-9 bg-background h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categorias.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoriaSeleccionada(cat)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap border capitalize transition-all",
                  categoriaSeleccionada === cat
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {cat === "todas" ? "Todos" : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Grid de Platos */}
        <div className="flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {productosFiltrados.map((prod) => (
                <button
                  key={prod.id}
                  onClick={() => agregarAlDraft(prod)}
                  className="p-3 text-left rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-muted/40 transition-all flex flex-col justify-between group h-24"
                >
                  <span className="text-xs font-bold text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                    {prod.nombre}
                  </span>
                  <div className="flex justify-between items-end pt-1">
                    <span className="text-xs font-black text-primary">
                      {formatMoney(prod.precio_venta)}
                    </span>
                    <div className="h-6 w-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Plus className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Columna Derecha: Panel de la Comanda Activa */}
      <div className="w-full lg:w-96 flex flex-col bg-card rounded-xl border border-border p-4 overflow-hidden">
        {/* Cabecera del pedido */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-primary" />
              <h2 className="text-base font-bold text-foreground">
                {tipoPedido === "mesa"
                  ? mesaSeleccionada
                    ? `Mesa #${mesaSeleccionada.numero}`
                    : "Selecciona una Mesa"
                  : "Pedido Para Llevar"}
              </h2>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {comandaActiva
                ? `Comanda #${comandaActiva.id.slice(0, 6).toUpperCase()} • Activa`
                : "Nueva Comanda"}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={imprimirPrecuenta}
            disabled={itemsEnviados.length === 0 && draftItems.length === 0}
            className="h-7 text-xs gap-1"
            title="Imprimir pre-cuenta para mesa"
          >
            <Printer className="h-3.5 w-3.5" />
            Pre-cuenta
          </Button>
        </div>

        {/* Lista de Ítems */}
        <div className="flex-1 overflow-y-auto py-2 space-y-3 pr-1">
          {cargandoComanda ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : itemsEnviados.length === 0 && draftItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center p-4">
              <Layers className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs font-semibold">Comanda vacía</p>
              <p className="text-[11px] opacity-75">Selecciona platos del menú a la izquierda</p>
            </div>
          ) : (
            <>
              {/* Ítems ya marchados a cocina */}
              {itemsEnviados.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Marchados en Cocina ({itemsEnviados.length})
                  </span>
                  <div className="space-y-1.5">
                    {itemsEnviados.map((it) => (
                      <div
                        key={it.id}
                        className="p-2 rounded-lg border border-border/80 bg-muted/20 flex items-center justify-between text-xs"
                      >
                        <div className="flex-1 pr-2">
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            <span>{it.qty}x</span>
                            <span>{it.nombre}</span>
                          </div>
                          {it.notas && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium italic">
                              "{it.notas}"
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className={cn(
                                "text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase",
                                it.estado === "pendiente"
                                  ? "bg-amber-500/20 text-amber-600"
                                  : it.estado === "preparando"
                                  ? "bg-orange-500/20 text-orange-600"
                                  : "bg-emerald-500/20 text-emerald-600"
                              )}
                            >
                              {it.estado}
                            </span>
                          </div>
                        </div>
                        <span className="font-bold text-foreground">
                          {formatMoney(it.qty * Number(it.precio))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ítems nuevos en borrador por marchar */}
              {draftItems.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-dashed border-border">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                    <Flame className="h-3 w-3" /> Por Marchar ({draftItems.length})
                  </span>
                  <div className="space-y-1.5">
                    {draftItems.map((d, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg border border-primary/30 bg-primary/5 flex items-center justify-between text-xs"
                      >
                        <div className="flex-1 pr-2">
                          <div className="font-bold text-foreground">
                            {d.producto.nombre}
                          </div>
                          {d.notas ? (
                            <button
                              onClick={() => abrirModalNota(d)}
                              className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline block text-left italic font-medium"
                            >
                              "{d.notas}"
                            </button>
                          ) : (
                            <button
                              onClick={() => abrirModalNota(d)}
                              className="text-[10px] text-muted-foreground hover:text-primary transition-colors block text-left"
                            >
                              + Agregar nota (sin sal, etc.)
                            </button>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {formatMoney(d.precio)} c/u
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => actualizarQtyDraft(idx, -1)}
                            className="h-6 w-6 rounded bg-background border flex items-center justify-center hover:bg-muted"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-5 text-center font-bold">{d.qty}</span>
                          <button
                            onClick={() => actualizarQtyDraft(idx, 1)}
                            className="h-6 w-6 rounded bg-background border flex items-center justify-center hover:bg-muted"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Resumen y Acciones */}
        <div className="pt-3 border-t border-border space-y-3">
          <div className="space-y-1 text-xs">
            {itemsEnviados.length > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Ya marchado:</span>
                <span>{formatMoney(totalEnviado)}</span>
              </div>
            )}
            {draftItems.length > 0 && (
              <div className="flex justify-between text-primary font-semibold">
                <span>Por marchar:</span>
                <span>+{formatMoney(totalDraft)}</span>
              </div>
            )}
            <div className="flex justify-between font-extrabold text-base pt-1 border-t border-border/60">
              <span>TOTAL COMANDA:</span>
              <span className="text-primary">{formatMoney(totalGeneral)}</span>
            </div>
          </div>

          <div className="space-y-2">
            {/* Botón Marchar a Cocina */}
            <Button
              onClick={enviarACocina}
              disabled={draftItems.length === 0 || enviandoCocina}
              className="w-full gap-2 font-bold"
            >
              {enviandoCocina ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Marchando...
                </>
              ) : (
                <>
                  <Flame className="h-4 w-4 text-orange-400" />
                  Marchar a Cocina {draftItems.length > 0 ? `(${draftItems.length})` : ""}
                </>
              )}
            </Button>

            {/* Botón Cobrar y Cerrar */}
            {comandaActiva && (
              <Button
                variant="outline"
                onClick={() => setCerrarModalOpen(true)}
                disabled={draftItems.length > 0}
                className="w-full gap-2 font-semibold text-xs border-emerald-600/40 text-emerald-600 hover:bg-emerald-500/10"
              >
                <CreditCard className="h-4 w-4" />
                Cobrar y Liberar Mesa ({formatMoney(totalEnviado)})
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Modal Nota Especial */}
      <Dialog open={!!itemNotaModal} onOpenChange={(v) => !v && setItemNotaModal(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Notas de Preparación</DialogTitle>
            <DialogDescription className="text-xs">
              Instrucciones especiales para cocina (ej: Sin sal, término medio, etc.)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Input
              value={notaTexto}
              onChange={(e) => setNotaTexto(e.target.value)}
              placeholder="Escribe la indicación..."
              className="text-xs"
            />

            <div className="flex flex-wrap gap-1.5">
              {[
                "Sin cebolla",
                "Sin sal",
                "Término medio",
                "Bien cocido",
                "Sin hielo",
                "Aderezo aparte",
                "Para compartir",
              ].map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setNotaTexto(sug)}
                  className="px-2 py-1 rounded-md text-[10px] bg-muted hover:bg-primary hover:text-primary-foreground border transition-all"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setItemNotaModal(null)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={guardarNota}>
              Guardar Nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Cobrar y Cerrar Comanda */}
      <Dialog open={cerrarModalOpen} onOpenChange={setCerrarModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Cobrar Comanda</DialogTitle>
            <DialogDescription className="text-xs">
              {mesaSeleccionada ? `Mesa #${mesaSeleccionada.numero}` : "Para Llevar"} •{" "}
              Total a pagar: {formatMoney(totalEnviado)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label className="text-xs">Método de Pago</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "efectivo", label: "Efectivo" },
                { id: "tarjeta", label: "Tarjeta" },
                { id: "transferencia", label: "Transfer." },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMetodoPagoCierre(m.id)}
                  className={cn(
                    "p-2 rounded-lg border text-xs font-semibold capitalize transition-all",
                    metodoPagoCierre === m.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCerrarModalOpen(false)}
              disabled={cerrandoComanda}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={cerrarComanda}
              disabled={cerrandoComanda}
              className="gap-1.5 font-bold"
            >
              {cerrandoComanda ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cobrando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmar Pago
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
