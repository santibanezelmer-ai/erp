"use client";

import { useEffect, useState, useRef } from "react";
import { useTenant } from "@/contexts/tenant-context";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ShoppingCart,
  Search,
  Barcode,
  Camera,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  UserCheck,
  CheckCircle2,
  Printer,
  Download,
  Loader2,
  X,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { imprimirTicketTermico, descargarTicketPDF } from "@/lib/ticket";

type Producto = Database["public"]["Tables"]["productos"]["Row"];
type Cliente = Database["public"]["Tables"]["clientes"]["Row"];

interface CartItem {
  producto: Producto;
  qty: number;
  precioUnitario: number;
}

export default function POSPage() {
  const { negocio, sucursalActiva, profile } = useTenant();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Categories
  const [busqueda, setBusqueda] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>("todas");
  const [scannerOpen, setScannerOpen] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [descuentoGlobal, setDescuentoGlobal] = useState<number>(0);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string>("");

  // Payment Modal
  const [pagoModalOpen, setPagoModalOpen] = useState(false);
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "tarjeta" | "transferencia" | "fiado">("efectivo");
  const [efectivoRecibido, setEfectivoRecibido] = useState<string>("");
  const [procesandoVenta, setProcesandoVenta] = useState(false);

  // Success Ticket Modal
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [ultimaVenta, setUltimaVenta] = useState<{
    id: string;
    total: number;
    subtotal: number;
    descuento: number;
    pago: string;
    efectivoRecibido: number | null;
    vuelto: number;
    items: CartItem[];
  } | null>(null);

  // Fetch products and clients
  const fetchData = async () => {
    if (!negocio?.id) return;
    setLoading(true);
    const supabase = createClient();

    try {
      const [prodsRes, clientesRes] = await Promise.all([
        supabase
          .from("productos")
          .select("*")
          .eq("negocio_id", negocio.id)
          .eq("activo", true)
          .order("nombre", { ascending: true }),
        supabase
          .from("clientes")
          .select("*")
          .eq("negocio_id", negocio.id)
          .order("nombre", { ascending: true }),
      ]);

      setProductos(prodsRes.data || []);
      setClientes(clientesRes.data || []);
    } catch (err: any) {
      toast.error(err.message || "Error al cargar datos del POS");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [negocio?.id]);

  // Extract unique categories
  const categorias = ["todas", ...Array.from(new Set(productos.map((p) => p.categoria).filter(Boolean) as string[]))];

  // Add to cart
  const addToCart = (prod: Producto) => {
    const stockActual = Number(prod.stock || 0);
    const existing = cart.find((i) => i.producto.id === prod.id);

    if (!prod.sin_control_stock && existing && existing.qty >= stockActual) {
      toast.error(`Stock máximo alcanzado (${stockActual} u.)`);
      return;
    }
    if (!prod.sin_control_stock && !existing && stockActual <= 0) {
      toast.error("Producto agotado");
      return;
    }

    setCart((prev) => {
      const item = prev.find((i) => i.producto.id === prod.id);
      if (item) {
        return prev.map((i) =>
          i.producto.id === prod.id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, { producto: prod, qty: 1, precioUnitario: Number(prod.precio_venta || 0) }];
    });
  };

  // Barcode search or Enter key
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!busqueda.trim()) return;
    buscarYAgregarPorCodigo(busqueda.trim());
  };

  const buscarYAgregarPorCodigo = (codeStr: string) => {
    const code = codeStr.toLowerCase();
    const match = productos.find(
      (p) =>
        (p.codigo && p.codigo.toLowerCase() === code) ||
        (p.codigo_interno && p.codigo_interno.toLowerCase() === code) ||
        p.nombre.toLowerCase() === code
    );

    if (match) {
      addToCart(match);
      setBusqueda("");
      toast.success(`Agregado al carrito: ${match.nombre}`);
    } else {
      toast.error(`Producto "${codeStr}" no encontrado`);
    }
  };

  // Modify quantity
  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.producto.id === id) {
            const nextQty = i.qty + delta;
            if (nextQty <= 0) return null;
            if (!i.producto.sin_control_stock && nextQty > Number(i.producto.stock || 0)) {
              toast.error("No hay más stock disponible");
              return i;
            }
            return { ...i, qty: nextQty };
          }
          return i;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((i) => i.producto.id !== id));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
    setDescuentoGlobal(0);
    setClienteSeleccionado("");
  };

  // Calculations
  const subtotal = cart.reduce((acc, i) => acc + i.qty * i.precioUnitario, 0);
  const total = Math.max(0, subtotal - descuentoGlobal);
  const vuelto =
    metodoPago === "efectivo" && Number(efectivoRecibido) >= total
      ? Number(efectivoRecibido) - total
      : 0;

  // Filtered products list for grid
  const productosFiltrados = productos.filter((p) => {
    const q = busqueda.toLowerCase().trim();
    const matchQ =
      !q ||
      p.nombre.toLowerCase().includes(q) ||
      (p.codigo && p.codigo.toLowerCase().includes(q));

    const matchCat =
      categoriaSeleccionada === "todas" || p.categoria === categoriaSeleccionada;

    return matchQ && matchCat;
  });

  // Open Checkout
  const abrirCobro = () => {
    if (cart.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }
    setMetodoPago("efectivo");
    setEfectivoRecibido(String(total));
    setPagoModalOpen(true);
  };

  // Execute Sale
  const finalizarVenta = async () => {
    if (!negocio?.id) return;
    if (cart.length === 0) return;

    if (metodoPago === "fiado" && !clienteSeleccionado) {
      toast.error("Para ventas fiadas debes seleccionar un cliente");
      return;
    }

    if (metodoPago === "efectivo" && Number(efectivoRecibido) < total) {
      toast.error("El monto en efectivo recibido es menor al total");
      return;
    }

    setProcesandoVenta(true);
    const supabase = createClient();

    try {
      const lineas = cart.map((i) => ({
        tipo: "producto",
        producto_id: i.producto.id,
        variante_id: null,
        nombre: i.producto.nombre,
        qty: i.qty,
        precio: i.precioUnitario,
        subtotal: i.qty * i.precioUnitario,
        descuento: 0,
      }));

      // Intentar primero con RPC crear_venta_pos
      const { data: rpcData, error: rpcError } = await (supabase.rpc as any)("crear_venta_pos", {
        _lineas: lineas,
        _subtotal: subtotal,
        _descuento: descuentoGlobal,
        _total: total,
        _pago: metodoPago,
        _efectivo_rec: metodoPago === "efectivo" ? Number(efectivoRecibido) : null,
        _cliente_id: clienteSeleccionado || null,
        _sucursal_id: sucursalActiva?.id || null,
      });

      let ventaId = rpcData?.venta_id;

      if (rpcError) {
        // Fallback robusto directo en caso de que el RPC aún no esté expuesto
        const { data: vData, error: vErr } = await supabase
          .from("ventas")
          .insert({
            negocio_id: negocio.id,
            sucursal_id: sucursalActiva?.id || null,
            subtotal,
            descuento: descuentoGlobal,
            total,
            pago: metodoPago,
            efectivo_rec: metodoPago === "efectivo" ? Number(efectivoRecibido) : null,
            cliente_id: clienteSeleccionado || null,
            estado: "completada",
          })
          .select("id")
          .single();

        if (vErr) throw vErr;
        ventaId = vData.id;

        // Insertar detalles
        const detalles = cart.map((i) => ({
          venta_id: ventaId,
          negocio_id: negocio.id,
          producto_id: i.producto.id,
          nombre: i.producto.nombre,
          qty: i.qty,
          precio: i.precioUnitario,
          subtotal: i.qty * i.precioUnitario,
        }));
        await supabase.from("detalle_ventas").insert(detalles);

        // Descontar stock
        for (const item of cart) {
          if (!item.producto.sin_control_stock) {
            const nuevoStock = Math.max(0, Number(item.producto.stock || 0) - item.qty);
            await supabase.from("productos").update({ stock: nuevoStock }).eq("id", item.producto.id);
          }
        }
      }

      setUltimaVenta({
        id: ventaId || `V-${Date.now().toString().slice(-6)}`,
        total,
        subtotal,
        descuento: descuentoGlobal,
        pago: metodoPago,
        efectivoRecibido: metodoPago === "efectivo" ? Number(efectivoRecibido) : null,
        vuelto,
        items: [...cart],
      });

      setPagoModalOpen(false);
      setTicketModalOpen(true);
      toast.success("¡Venta registrada con éxito!");

      // Limpiar y refrescar catálogo de stock
      setCart([]);
      setDescuentoGlobal(0);
      setClienteSeleccionado("");
      fetchData();
    } catch (err: any) {
      console.error("Error en checkout:", err);
      toast.error(err.message || "Error al procesar la venta");
    } finally {
      setProcesandoVenta(false);
    }
  };

  const handleImprimirTicket = (ancho: 58 | 80 = 80) => {
    if (!ultimaVenta || !negocio) return;
    imprimirTicketTermico(
      {
        negocioNombre: negocio.nombre,
        negocioRut: (negocio as any).rut || null,
        negocioTelefono: (negocio as any).telefono || null,
        negocioDireccion: (negocio as any).direccion || null,
        sucursalNombre: sucursalActiva?.nombre || null,
        logoUrl: negocio.perfil || null,
        folio: ultimaVenta.id.slice(0, 8).toUpperCase(),
        cajero: profile?.nombre || "Caja Principal",
        items: ultimaVenta.items.map((i) => ({
          nombre: i.producto.nombre,
          qty: i.qty,
          precio: i.precioUnitario,
          subtotal: i.qty * i.precioUnitario,
        })),
        subtotal: ultimaVenta.subtotal,
        descuento: ultimaVenta.descuento,
        total: ultimaVenta.total,
        metodoPago: ultimaVenta.pago,
        efectivoRecibido: ultimaVenta.efectivoRecibido,
        vuelto: ultimaVenta.vuelto,
      },
      ancho
    );
  };

  const handleDescargarPDF = () => {
    if (!ultimaVenta || !negocio) return;
    descargarTicketPDF({
      negocioNombre: negocio.nombre,
      negocioRut: (negocio as any).rut || null,
      negocioTelefono: (negocio as any).telefono || null,
      negocioDireccion: (negocio as any).direccion || null,
      sucursalNombre: sucursalActiva?.nombre || null,
      folio: ultimaVenta.id.slice(0, 8).toUpperCase(),
      cajero: profile?.nombre || "Caja Principal",
      items: ultimaVenta.items.map((i) => ({
        nombre: i.producto.nombre,
        qty: i.qty,
        precio: i.precioUnitario,
        subtotal: i.qty * i.precioUnitario,
      })),
      subtotal: ultimaVenta.subtotal,
      descuento: ultimaVenta.descuento,
      total: ultimaVenta.total,
      metodoPago: ultimaVenta.pago,
      efectivoRecibido: ultimaVenta.efectivoRecibido,
      vuelto: ultimaVenta.vuelto,
    });
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col lg:flex-row gap-4 overflow-hidden">
      {/* Columna Izquierda: Catálogo y Búsqueda */}
      <div className="flex-1 flex flex-col gap-3 min-w-0 bg-card rounded-xl border border-border p-4 overflow-hidden">
        {/* Barra superior de búsqueda */}
        <div className="flex items-center gap-2">
          <form onSubmit={handleBarcodeSubmit} className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={barcodeInputRef}
              placeholder="Buscar por nombre o escanear código de barras (Enter)..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9 pr-10 bg-background"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </form>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setScannerOpen(true)}
            className="shrink-0 h-9 w-9 text-primary hover:bg-primary/10"
            title="Escanear código con cámara de dispositivo"
          >
            <Camera className="h-4 w-4" />
          </Button>
        </div>

        {/* Categorías Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categorias.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoriaSeleccionada(cat)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-all capitalize",
                categoriaSeleccionada === cat
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {cat === "todas" ? "Todas las categorías" : cat}
            </button>
          ))}
        </div>

        {/* Grid de Productos */}
        <div className="flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs">Cargando productos...</span>
            </div>
          ) : productosFiltrados.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center p-8">
              <Barcode className="h-10 w-10 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium">No se encontraron productos</p>
              <p className="text-xs opacity-75">Prueba con otro término de búsqueda</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5">
              {productosFiltrados.map((prod) => {
                const stockVal = Number(prod.stock || 0);
                const agotado = !prod.sin_control_stock && stockVal <= 0;

                return (
                  <button
                    key={prod.id}
                    disabled={agotado}
                    onClick={() => addToCart(prod)}
                    className={cn(
                      "p-3 rounded-xl border text-left flex flex-col justify-between transition-all bg-background shadow-xs hover:border-primary hover:shadow-md active:scale-98",
                      agotado && "opacity-50 cursor-not-allowed hover:border-border hover:shadow-none"
                    )}
                  >
                    <div>
                      <div className="font-semibold text-xs leading-snug line-clamp-2 text-foreground">
                        {prod.nombre}
                      </div>
                      {prod.categoria && (
                        <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {prod.categoria}
                        </div>
                      )}
                    </div>

                    <div className="mt-2.5 flex items-center justify-between">
                      <span className="font-bold text-sm text-primary">
                        {formatMoney(prod.precio_venta)}
                      </span>
                      {!prod.sin_control_stock && (
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full font-semibold",
                            agotado
                              ? "bg-destructive/10 text-destructive"
                              : stockVal <= (prod.stock_min || 5)
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-500"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {agotado ? "Agotado" : `${stockVal} u.`}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Columna Derecha: Carrito / Ticket de Venta */}
      <div className="w-full lg:w-96 flex flex-col bg-card rounded-xl border border-border p-4 shadow-sm">
        {/* Cabecera del ticket */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <span className="font-bold text-base">Orden Actual</span>
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
              {cart.reduce((a, b) => a + b.qty, 0)} items
            </span>
          </div>

          {cart.length > 0 && (
            <button
              onClick={clearCart}
              title="Vaciar carrito"
              className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Vaciar
            </button>
          )}
        </div>

        {/* Selector de Cliente */}
        <div className="py-2.5 border-b border-border">
          <select
            value={clienteSeleccionado}
            onChange={(e) => setClienteSeleccionado(e.target.value)}
            className="w-full text-xs rounded-lg border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary"
          >
            <option value="">Cliente Ocasional / Anónimo</option>
            {clientes.map((cli) => (
              <option key={cli.id} value={cli.id}>
                {cli.nombre} {cli.telefono ? `(${cli.telefono})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Lista de Items en Carrito */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/60 my-2 pr-1">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center p-6">
              <ShoppingCart className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs font-medium">El carrito está vacío</p>
              <p className="text-[11px] opacity-70">Haz clic en los productos para agregarlos</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.producto.id} className="py-2 flex items-center justify-between text-xs gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate">{item.producto.nombre}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatMoney(item.precioUnitario)} c/u
                  </div>
                </div>

                {/* Controles de Cantidad */}
                <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg">
                  <button
                    onClick={() => updateQty(item.producto.id, -1)}
                    className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center font-bold text-foreground">{item.qty}</span>
                  <button
                    onClick={() => updateQty(item.producto.id, 1)}
                    className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>

                <div className="text-right w-16">
                  <div className="font-bold text-foreground">
                    {formatMoney(item.qty * item.precioUnitario)}
                  </div>
                </div>

                <button
                  onClick={() => removeFromCart(item.producto.id)}
                  className="p-1 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Resumen de Totales y Botón de Cobro */}
        <div className="pt-3 border-t border-border space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatMoney(subtotal)}</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Descuento</span>
            <div className="flex items-center gap-1 w-24">
              <Input
                type="number"
                min="0"
                value={descuentoGlobal || ""}
                onChange={(e) => setDescuentoGlobal(Math.max(0, Number(e.target.value)))}
                placeholder="0"
                className="h-7 text-xs text-right p-1"
              />
            </div>
          </div>

          <div className="flex justify-between text-base font-extrabold text-foreground pt-1 border-t border-border/60">
            <span>TOTAL A COBRAR</span>
            <span className="text-primary text-xl">{formatMoney(total)}</span>
          </div>

          <Button
            onClick={abrirCobro}
            disabled={cart.length === 0}
            className="w-full h-12 text-sm font-bold gap-2 shadow-md mt-2"
          >
            <Banknote className="h-5 w-5" />
            Cobrar {formatMoney(total)}
          </Button>
        </div>
      </div>

      {/* Modal de Cobro */}
      <Dialog open={pagoModalOpen} onOpenChange={setPagoModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Procesar Pago</DialogTitle>
            <DialogDescription>
              Selecciona el método de pago para registrar la venta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="text-center p-3 rounded-xl bg-primary/10 border border-primary/20">
              <div className="text-xs text-muted-foreground font-semibold uppercase">Total a Pagar</div>
              <div className="text-3xl font-black text-primary">{formatMoney(total)}</div>
            </div>

            {/* Métodos de Pago */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMetodoPago("efectivo")}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all",
                  metodoPago === "efectivo"
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "border-border hover:bg-muted text-muted-foreground"
                )}
              >
                <Banknote className="h-4 w-4" />
                Efectivo
              </button>

              <button
                type="button"
                onClick={() => setMetodoPago("tarjeta")}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all",
                  metodoPago === "tarjeta"
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "border-border hover:bg-muted text-muted-foreground"
                )}
              >
                <CreditCard className="h-4 w-4" />
                Tarjeta (POS)
              </button>

              <button
                type="button"
                onClick={() => setMetodoPago("transferencia")}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all",
                  metodoPago === "transferencia"
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "border-border hover:bg-muted text-muted-foreground"
                )}
              >
                <ArrowRightLeft className="h-4 w-4" />
                Transferencia
              </button>

              <button
                type="button"
                onClick={() => setMetodoPago("fiado")}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all",
                  metodoPago === "fiado"
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "border-border hover:bg-muted text-muted-foreground"
                )}
              >
                <UserCheck className="h-4 w-4" />
                Fiado (Crédito)
              </button>
            </div>

            {/* Inputs según método */}
            {metodoPago === "efectivo" && (
              <div className="space-y-3 p-3 rounded-xl border border-border bg-muted/20">
                <div className="space-y-1.5">
                  <Label htmlFor="efectivo-rec" className="text-xs">Efectivo Recibido</Label>
                  <Input
                    id="efectivo-rec"
                    type="number"
                    value={efectivoRecibido}
                    onChange={(e) => setEfectivoRecibido(e.target.value)}
                    className="text-lg font-bold"
                  />
                </div>

                <div className="flex justify-between items-center text-sm pt-2 border-t border-border/60">
                  <span className="font-semibold text-muted-foreground">Vuelto (Cambio):</span>
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-500">
                    {formatMoney(vuelto)}
                  </span>
                </div>
              </div>
            )}

            {metodoPago === "fiado" && !clienteSeleccionado && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-400">
                ⚠️ Debes seleccionar un cliente registrado para anotar la deuda por fiado.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPagoModalOpen(false)} disabled={procesandoVenta}>
              Cancelar
            </Button>
            <Button
              onClick={finalizarVenta}
              disabled={procesandoVenta || (metodoPago === "fiado" && !clienteSeleccionado)}
              className="gap-2"
            >
              {procesandoVenta ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmar Cobro
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Ticket de Éxito */}
      <Dialog open={ticketModalOpen} onOpenChange={setTicketModalOpen}>
        <DialogContent className="sm:max-w-sm text-center">
          <div className="py-4 space-y-4">
            <div className="h-12 w-12 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-500 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-7 w-7" />
            </div>

            <div>
              <h3 className="text-lg font-bold">¡Venta Registrada!</h3>
              <p className="text-xs text-muted-foreground">Ticket #{ultimaVenta?.id.slice(0, 8).toUpperCase()}</p>
            </div>

            <div className="p-3 rounded-lg border border-border bg-muted/20 text-xs space-y-1.5 text-left">
              <div className="flex justify-between font-bold">
                <span>Total:</span>
                <span>{formatMoney(ultimaVenta?.total)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground capitalize">
                <span>Método:</span>
                <span>{ultimaVenta?.pago}</span>
              </div>
              {ultimaVenta?.pago === "efectivo" && (
                <div className="flex justify-between font-bold text-emerald-600">
                  <span>Vuelto:</span>
                  <span>{formatMoney(ultimaVenta?.vuelto)}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleImprimirTicket(80)}
                className="gap-1.5 text-xs font-semibold"
              >
                <Printer className="h-3.5 w-3.5 text-primary" />
                Imprimir 80mm
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleImprimirTicket(58)}
                className="gap-1.5 text-xs font-semibold"
              >
                <Printer className="h-3.5 w-3.5 text-primary" />
                Imprimir 58mm
              </Button>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDescargarPDF}
                className="flex-1 gap-1.5 text-xs text-muted-foreground"
              >
                <Download className="h-3.5 w-3.5" />
                Descargar PDF
              </Button>
              <Button
                size="sm"
                onClick={() => setTicketModalOpen(false)}
                className="flex-1 text-xs font-bold"
              >
                Nueva Venta
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lector de Código de Barras con Cámara */}
      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => buscarYAgregarPorCodigo(code)}
      />
    </div>
  );
}
