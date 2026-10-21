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
  Package,
  Layers,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { imprimirTicketTermico, descargarTicketPDF } from "@/lib/ticket";

type Producto = Database["public"]["Tables"]["productos"]["Row"];
type Cliente = Database["public"]["Tables"]["clientes"]["Row"];
type Variante = Database["public"]["Tables"]["producto_variantes"]["Row"];

interface CartItem {
  id: string;
  producto?: Producto;
  variante?: Variante | null;
  nombre: string;
  qty: number;
  precioUnitario: number;
  esLibre?: boolean;
}

export default function POSPage() {
  const { negocio, sucursalActiva, profile } = useTenant();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [variantes, setVariantes] = useState<Variante[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  // Variant selector modal
  const [pickVariant, setPickVariant] = useState<Producto | null>(null);

  // Search & Categories
  const [busqueda, setBusqueda] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>("todas");
  const [scannerOpen, setScannerOpen] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [descuentoGlobal, setDescuentoGlobal] = useState<number>(0);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string>("");
  const [mobileTab, setMobileTab] = useState<"catalogo" | "carrito">("catalogo");

  // Modal Nuevo Cliente Rápido
  const [modalNuevoClienteOpen, setModalNuevoClienteOpen] = useState(false);
  const [nuevoClienteNombre, setNuevoClienteNombre] = useState("");
  const [nuevoClienteTelefono, setNuevoClienteTelefono] = useState("");
  const [nuevoClienteEmail, setNuevoClienteEmail] = useState("");
  const [nuevoClienteDireccion, setNuevoClienteDireccion] = useState("");
  const [guardandoCliente, setGuardandoCliente] = useState(false);

  // Cliente actualmente seleccionado
  const clienteActual = clientes.find((c) => c.id === clienteSeleccionado);

  // Modal Item Libre / Rápido
  const [modalItemLibreOpen, setModalItemLibreOpen] = useState(false);
  const [nombreItemLibre, setNombreItemLibre] = useState("");
  const [precioItemLibre, setPrecioItemLibre] = useState("");

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

  // Fetch products, variants and clients
  const fetchData = async () => {
    if (!negocio?.id) return;
    setLoading(true);
    const supabase = createClient();

    try {
      const [prodsRes, clientesRes, varsRes] = await Promise.all([
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
        supabase
          .from("producto_variantes")
          .select("*")
          .eq("negocio_id", negocio.id)
          .eq("activo", true)
          .order("nombre", { ascending: true }),
      ]);

      setProductos(prodsRes.data || []);
      setClientes(clientesRes.data || []);
      setVariantes(varsRes.data || []);
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

  // Helper variants
  const variantsOf = (prodId: string): Variante[] => {
    return variantes.filter((v) => v.producto_id === prodId);
  };

  // Add to cart with variant support
  const addToCart = (prod: Producto, variante?: Variante | null) => {
    const itemId = variante ? `${prod.id}:${variante.id}` : prod.id;
    const precioUnitario = variante
      ? Number(variante.precio_promocional ?? variante.precio_venta ?? prod.precio_promocional ?? prod.precio_venta ?? 0)
      : Number(prod.precio_promocional ?? prod.precio_venta ?? 0);
    const stockActual = variante
      ? Number(variante.stock || 0)
      : Number(prod.stock || 0);

    const existing = cart.find((i) => i.id === itemId);

    if (!prod.sin_control_stock && existing && existing.qty >= stockActual) {
      toast.error(`Stock máximo alcanzado (${stockActual} u.)`);
      return;
    }
    if (!prod.sin_control_stock && !existing && stockActual <= 0) {
      toast.error("Producto agotado");
      return;
    }

    const nombreFinal = variante
      ? `${prod.nombre} (${variante.nombre})`
      : prod.nombre;

    setCart((prev) => {
      const item = prev.find((i) => i.id === itemId);
      if (item) {
        return prev.map((i) =>
          i.id === itemId ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [
        ...prev,
        {
          id: itemId,
          producto: prod,
          variante: variante || null,
          nombre: nombreFinal,
          qty: 1,
          precioUnitario,
        },
      ];
    });

    toast.success(`Añadido: ${nombreFinal}`);
  };

  const handleProductClick = (prod: Producto) => {
    const vs = variantsOf(prod.id);
    if (vs.length > 0) {
      setPickVariant(prod);
    } else {
      addToCart(prod);
    }
  };

  // Agregar Ítem Libre / Personalizado
  const agregarItemLibre = (e: React.FormEvent) => {
    e.preventDefault();
    const p = Math.max(0, Number(precioItemLibre) || 0);
    if (!nombreItemLibre.trim() || p <= 0) {
      toast.error("Ingresa una descripción y precio válidos");
      return;
    }
    setCart((prev) => [
      ...prev,
      {
        id: `libre-${Date.now()}`,
        nombre: nombreItemLibre.trim(),
        qty: 1,
        precioUnitario: p,
        esLibre: true,
      },
    ]);
    toast.success(`Añadido: ${nombreItemLibre.trim()}`);
    setModalItemLibreOpen(false);
    setNombreItemLibre("");
    setPrecioItemLibre("");
  };

  // Barcode search or Enter key
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!busqueda.trim()) return;
    buscarYAgregarPorCodigo(busqueda.trim());
  };

  const buscarYAgregarPorCodigo = (codeStr: string) => {
    const code = codeStr.toLowerCase().trim();

    // 1. Buscar coincidencia exacta por código de variante
    for (const p of productos) {
      const vs = variantsOf(p.id);
      const matchVar = vs.find(
        (v) => v.codigo && v.codigo.toLowerCase().trim() === code
      );
      if (matchVar) {
        addToCart(p, matchVar);
        setBusqueda("");
        return;
      }
    }

    // 2. Buscar por producto (código, código interno, o nombre)
    const match = productos.find(
      (p) =>
        (p.codigo && p.codigo.toLowerCase().trim() === code) ||
        (p.codigo_interno && p.codigo_interno.toLowerCase().trim() === code) ||
        p.nombre.toLowerCase().trim() === code
    );

    if (match) {
      const vs = variantsOf(match.id);
      if (vs.length > 0) {
        setPickVariant(match);
      } else {
        addToCart(match);
      }
      setBusqueda("");
    } else {
      toast.error(`Producto o variante "${codeStr}" no encontrado`);
    }
  };

  // Crear Cliente Rápido desde el POS
  const crearNuevoCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocio?.id || !nuevoClienteNombre.trim()) {
      toast.error("El nombre del cliente es obligatorio");
      return;
    }

    setGuardandoCliente(true);
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from("clientes")
        .insert({
          negocio_id: negocio.id,
          nombre: nuevoClienteNombre.trim(),
          telefono: nuevoClienteTelefono.trim() || null,
          email: nuevoClienteEmail.trim() || null,
          direccion: nuevoClienteDireccion.trim() || null,
          deuda_total: 0,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`Cliente "${data.nombre}" creado y seleccionado`);
      setClientes((prev) =>
        [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre))
      );
      setClienteSeleccionado(data.id);
      setModalNuevoClienteOpen(false);

      // Limpiar formulario
      setNuevoClienteNombre("");
      setNuevoClienteTelefono("");
      setNuevoClienteEmail("");
      setNuevoClienteDireccion("");
    } catch (err: any) {
      toast.error(err.message || "Error al crear cliente");
    } finally {
      setGuardandoCliente(false);
    }
  };

  // Modify quantity
  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.id === id) {
            const nextQty = i.qty + delta;
            if (nextQty <= 0) return null;
            const maxStock = i.variante
              ? Number(i.variante.stock || 0)
              : Number(i.producto?.stock || 0);
            if (i.producto && !i.producto.sin_control_stock && nextQty > maxStock) {
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
    setCart((prev) => prev.filter((i) => i.id !== id));
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
        tipo: i.esLibre ? "libre" : "producto",
        producto_id: i.producto?.id || null,
        variante_id: i.variante?.id || null,
        nombre: i.nombre,
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
          producto_id: i.producto?.id || null,
          nombre: i.nombre,
          qty: i.qty,
          precio: i.precioUnitario,
          subtotal: i.qty * i.precioUnitario,
        }));
        await supabase.from("detalle_ventas").insert(detalles);

        // Descontar stock (variantes y productos)
        for (const item of cart) {
          if (item.variante) {
            const nuevoStockVar = Math.max(0, Number(item.variante.stock || 0) - item.qty);
            await supabase
              .from("producto_variantes")
              .update({ stock: nuevoStockVar })
              .eq("id", item.variante.id);
          }
          if (item.producto && !item.producto.sin_control_stock) {
            const nuevoStock = Math.max(0, Number(item.producto.stock || 0) - item.qty);
            await supabase
              .from("productos")
              .update({ stock: nuevoStock })
              .eq("id", item.producto.id);
          }
        }

        // Si la venta es a crédito/fiado en fallback, registrar en deudas y aumentar saldo deudor
        if (metodoPago === "fiado" && clienteSeleccionado && total > 0) {
          const itemsTxt = cart
            .map((i) => `${i.qty}x ${i.nombre}`)
            .join(", ");
          await supabase.from("deudas").insert({
            negocio_id: negocio.id,
            cliente_id: clienteSeleccionado,
            venta_id: ventaId,
            monto: total,
            tipo: "deuda",
            notas: `Venta fiada: ${itemsTxt}`,
          });
          const { data: cRow } = await supabase
            .from("clientes")
            .select("deuda_total")
            .eq("id", clienteSeleccionado)
            .single();
          const dAct = Number(cRow?.deuda_total || 0);
          await supabase
            .from("clientes")
            .update({ deuda_total: dAct + total })
            .eq("id", clienteSeleccionado);
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
      setMobileTab("catalogo");
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
        logoUrl: (negocio as any)?.logo_url || (negocio?.perfil?.startsWith("http") ? negocio.perfil : null),
        folio: ultimaVenta.id.slice(0, 8).toUpperCase(),
        cajero: profile?.nombre || "Caja Principal",
        items: ultimaVenta.items.map((i) => ({
          nombre: i.nombre,
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
        nombre: i.nombre,
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
    <div className="h-[calc(100vh-8.5rem)] lg:h-[calc(100vh-6rem)] flex flex-col lg:flex-row gap-3 sm:gap-4 overflow-hidden">
      {/* Switcher Móvil: Catálogo vs Carrito */}
      <div className="flex items-center gap-1.5 lg:hidden bg-card border border-border p-1 rounded-xl shrink-0 shadow-xs">
        <button
          type="button"
          onClick={() => setMobileTab("catalogo")}
          className={cn(
            "flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer",
            mobileTab === "catalogo"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Package className="h-4 w-4" />
          <span>Catálogo</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab("carrito")}
          className={cn(
            "flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all relative cursor-pointer",
            mobileTab === "carrito"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ShoppingCart className="h-4 w-4" />
          <span>Carrito ({cart.reduce((a, b) => a + b.qty, 0)})</span>
          {cart.length > 0 && (
            <span
              className={cn(
                "ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold",
                mobileTab === "carrito"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-emerald-500 text-white animate-pulse"
              )}
            >
              {formatMoney(total)}
            </span>
          )}
        </button>
      </div>

      {/* Columna Izquierda: Catálogo y Búsqueda */}
      <div
        className={cn(
          "flex-1 flex flex-col gap-3 min-w-0 bg-card rounded-xl border border-border p-3 sm:p-4 overflow-hidden shadow-xs",
          mobileTab !== "catalogo" && "hidden lg:flex"
        )}
      >
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
                const vs = variantsOf(prod.id);
                const stockVal = vs.length > 0
                  ? vs.reduce((s, v) => s + Number(v.stock || 0), 0)
                  : Number(prod.stock || 0);
                const agotado = !prod.sin_control_stock && stockVal <= 0;

                return (
                  <button
                    key={prod.id}
                    disabled={agotado}
                    onClick={() => handleProductClick(prod)}
                    className={cn(
                      "p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all bg-background shadow-xs hover:border-primary hover:shadow-md active:scale-98 group",
                      agotado && "opacity-50 cursor-not-allowed hover:border-border hover:shadow-none"
                    )}
                  >
                    {/* Thumbnail del Producto */}
                    <div className="relative aspect-4/3 w-full bg-muted/40 rounded-lg overflow-hidden mb-2">
                      {prod.imagen_url ? (
                        <img
                          src={prod.imagen_url}
                          alt={prod.nombre}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                          <Package className="h-6 w-6 stroke-[1.5]" />
                        </div>
                      )}
                      {vs.length > 0 && (
                        <span className="absolute top-1 left-1 bg-background/90 backdrop-blur-xs text-primary font-bold text-[9px] px-1.5 py-0.5 rounded shadow-xs border">
                          {vs.length} var.
                        </span>
                      )}
                    </div>

                    <div className="flex-1 flex flex-col justify-between">
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

                      <div className="mt-2 flex items-center justify-between">
                        <span className="font-bold text-xs text-primary">
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
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Barra flotante inferior en móvil para ver carrito y total */}
        {mobileTab === "catalogo" && cart.length > 0 && (
          <div className="lg:hidden shrink-0 pt-2 border-t border-border">
            <Button
              type="button"
              onClick={() => setMobileTab("carrito")}
              className="w-full h-11 bg-primary text-primary-foreground font-bold text-sm shadow-md flex items-center justify-between px-4 rounded-xl"
            >
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                <span>Ver Carrito ({cart.reduce((a, b) => a + b.qty, 0)} ítems)</span>
              </div>
              <div className="flex items-center gap-1.5 font-black">
                <span>{formatMoney(total)}</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </Button>
          </div>
        )}
      </div>

      {/* Columna Derecha: Carrito / Ticket de Venta */}
      <div
        className={cn(
          "w-full lg:w-96 flex flex-col bg-card rounded-xl border border-border p-3 sm:p-4 shadow-sm",
          mobileTab !== "carrito" && "hidden lg:flex"
        )}
      >
        {/* Cabecera del ticket */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileTab("catalogo")}
              className="lg:hidden p-1 rounded-md text-muted-foreground hover:bg-muted mr-1"
              title="Volver al catálogo"
            >
              <ChevronRight className="h-5 w-5 rotate-180" />
            </button>
            <ShoppingCart className="h-5 w-5 text-primary" />
            <span className="font-bold text-base">Orden Actual</span>
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
              {cart.reduce((a, b) => a + b.qty, 0)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalItemLibreOpen(true)}
              className="h-7 text-xs gap-1 text-primary border-primary/40 hover:bg-primary/10"
              title="Vender producto o servicio no inventariado"
            >
              <Plus className="h-3 w-3" />
              Ítem Libre
            </Button>

            {cart.length > 0 && (
              <button
                onClick={clearCart}
                title="Vaciar carrito"
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Selector de Cliente */}
        <div className="py-2.5 border-b border-border space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold flex items-center gap-1.5 text-foreground">
              <UserCheck className="h-3.5 w-3.5 text-primary" />
              <span>Cliente Asignado</span>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalNuevoClienteOpen(true)}
              className="h-6 px-2 text-[11px] gap-1 text-primary border-primary/30 hover:bg-primary/10 shadow-xs"
            >
              <Plus className="h-3 w-3" />
              Nuevo
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <select
              value={clienteSeleccionado}
              onChange={(e) => setClienteSeleccionado(e.target.value)}
              className="w-full text-xs rounded-lg border border-border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary truncate font-medium"
            >
              <option value="">👤 Cliente Ocasional / Anónimo</option>
              {clientes.map((cli) => (
                <option key={cli.id} value={cli.id}>
                  {cli.nombre} {cli.telefono ? `(${cli.telefono})` : ""}{Number(cli.deuda_total || 0) > 0 ? ` · Deuda: ${formatMoney(cli.deuda_total)}` : ""}
                </option>
              ))}
            </select>
            {clienteSeleccionado && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => setClienteSeleccionado("")}
                title="Quitar cliente asignado"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {clienteActual && (
            <div className="text-[11px] bg-muted/60 p-1.5 rounded-md flex items-center justify-between">
              <span className="text-muted-foreground truncate">{clienteActual.telefono || "Sin teléfono"}</span>
              {Number(clienteActual.deuda_total || 0) > 0 ? (
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  Deuda: {formatMoney(clienteActual.deuda_total)}
                </span>
              ) : (
                <span className="text-emerald-600 font-semibold">Al día (Sin deuda)</span>
              )}
            </div>
          )}
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
              <div key={item.id} className="py-2 flex items-center justify-between text-xs gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate flex items-center gap-1.5">
                    <span>{item.nombre}</span>
                    {item.esLibre && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold">
                        Libre
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatMoney(item.precioUnitario)} c/u
                  </div>
                </div>

                {/* Controles de Cantidad */}
                <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg">
                  <button
                    onClick={() => updateQty(item.id, -1)}
                    className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center font-bold text-foreground">{item.qty}</span>
                  <button
                    onClick={() => updateQty(item.id, 1)}
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
                  onClick={() => removeFromCart(item.id)}
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

            {/* Selector de Cliente en Modal de Pago */}
            <div
              className={cn(
                "p-3 rounded-xl border space-y-2 transition-all",
                metodoPago === "fiado" && !clienteSeleccionado
                  ? "border-destructive bg-destructive/5"
                  : "border-border bg-muted/20"
              )}
            >
              <div className="flex items-center justify-between">
                <Label htmlFor="cobro-cliente-sel" className="text-xs font-bold flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-primary" />
                  <span>
                    Cliente Asignado{" "}
                    {metodoPago === "fiado" ? (
                      <span className="text-destructive font-black">* (Obligatorio para Fiado)</span>
                    ) : (
                      <span className="text-muted-foreground font-normal">(Opcional)</span>
                    )}
                  </span>
                </Label>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalNuevoClienteOpen(true)}
                  className="h-6 px-2 text-[11px] gap-1 text-primary border-primary/30 hover:bg-primary/10 shadow-xs"
                >
                  <Plus className="h-3 w-3" />
                  Nuevo Cliente
                </Button>
              </div>

              <div className="flex items-center gap-1.5">
                <select
                  id="cobro-cliente-sel"
                  value={clienteSeleccionado}
                  onChange={(e) => setClienteSeleccionado(e.target.value)}
                  className={cn(
                    "w-full text-xs rounded-lg border bg-background p-2 text-foreground focus:ring-1 focus:ring-primary truncate font-medium",
                    metodoPago === "fiado" && !clienteSeleccionado
                      ? "border-destructive ring-1 ring-destructive/40"
                      : "border-border"
                  )}
                >
                  <option value="">👤 Cliente Ocasional / Anónimo</option>
                  {clientes.map((cli) => (
                    <option key={cli.id} value={cli.id}>
                      {cli.nombre} {cli.telefono ? `(${cli.telefono})` : ""}{Number(cli.deuda_total || 0) > 0 ? ` · Deuda: ${formatMoney(cli.deuda_total)}` : ""}
                    </option>
                  ))}
                </select>

                {clienteSeleccionado && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => setClienteSeleccionado("")}
                    title="Quitar cliente asignado"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {clienteActual ? (
                <div className="text-[11px] bg-background border p-2 rounded-lg flex items-center justify-between">
                  <span className="text-muted-foreground truncate">
                    {clienteActual.telefono || "Sin teléfono registrado"}
                  </span>
                  {Number(clienteActual.deuda_total || 0) > 0 ? (
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      Deuda previa: {formatMoney(clienteActual.deuda_total)}
                    </span>
                  ) : (
                    <span className="text-emerald-600 font-semibold">Cliente sin deuda previa</span>
                  )}
                </div>
              ) : (
                metodoPago === "fiado" && (
                  <p className="text-[11px] text-destructive font-semibold">
                    ⚠️ Selecciona un cliente arriba o presiona "+ Nuevo Cliente" para anotar este fiado.
                  </p>
                )
              )}
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

                {/* Billetes Rápidos */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setEfectivoRecibido(String(total))}
                    className="px-2.5 py-1 text-xs rounded-md bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors shadow-xs"
                  >
                    Exacto ({formatMoney(total)})
                  </button>
                  {[1000, 2000, 5000, 10000, 20000].map((billete) => (
                    <button
                      key={billete}
                      type="button"
                      onClick={() => setEfectivoRecibido(String(billete))}
                      className="px-2 py-1 text-xs rounded-md border bg-background hover:bg-muted font-semibold transition-colors"
                    >
                      {formatMoney(billete)}
                    </button>
                  ))}
                </div>

                <div className="flex justify-between items-center text-sm pt-2 border-t border-border/60">
                  <span className="font-semibold text-muted-foreground">Vuelto (Cambio):</span>
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-500">
                    {formatMoney(vuelto)}
                  </span>
                </div>
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

      {/* Modal Item Libre / Rápido */}
      <Dialog open={modalItemLibreOpen} onOpenChange={setModalItemLibreOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Agregar Ítem Libre
            </DialogTitle>
            <DialogDescription className="text-xs">
              Vende un concepto o servicio sin necesidad de crearlo en inventario.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={agregarItemLibre} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="libre-nom" className="text-xs">Descripción o Concepto *</Label>
              <Input
                id="libre-nom"
                placeholder="Ej: Fotocopias, Reparación o Flete"
                value={nombreItemLibre}
                onChange={(e) => setNombreItemLibre(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="libre-precio" className="text-xs">Precio de Venta *</Label>
              <Input
                id="libre-precio"
                type="number"
                min="1"
                step="any"
                placeholder="0"
                value={precioItemLibre}
                onChange={(e) => setPrecioItemLibre(e.target.value)}
                required
                className="text-lg font-bold"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setModalItemLibreOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="font-bold">
                Agregar al Carrito
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Selección de Variante en POS */}
      <Dialog open={!!pickVariant} onOpenChange={(open) => !open && setPickVariant(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              <span>{pickVariant?.nombre}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Selecciona la variante que deseas añadir a la orden:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 max-h-80 overflow-y-auto">
            {pickVariant &&
              variantsOf(pickVariant.id).map((v) => {
                const vStock = Number(v.stock || 0);
                const vAgotado = !pickVariant.sin_control_stock && vStock <= 0;
                const vPrecio = Number(
                  v.precio_promocional ?? v.precio_venta ?? pickVariant.precio_promocional ?? pickVariant.precio_venta ?? 0
                );
                const vImg = v.imagen_url || pickVariant.imagen_url;

                return (
                  <button
                    key={v.id}
                    disabled={vAgotado}
                    onClick={() => {
                      addToCart(pickVariant, v);
                      setPickVariant(null);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-xl border border-border bg-card text-left transition-all hover:border-primary hover:bg-muted/40",
                      vAgotado && "opacity-50 cursor-not-allowed hover:border-border hover:bg-card"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-11 w-11 rounded-lg bg-muted overflow-hidden shrink-0 flex items-center justify-center border">
                        {vImg ? (
                          <img
                            src={vImg}
                            alt={v.nombre}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Package className="h-5 w-5 text-muted-foreground/40" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="font-bold text-xs text-foreground truncate">
                          {v.nombre}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                          <span>
                            {vAgotado
                              ? "Agotado"
                              : !pickVariant.sin_control_stock
                              ? `${vStock} u. stock`
                              : "Stock ilimitado"}
                          </span>
                          {v.codigo && (
                            <span className="font-mono text-[10px] text-muted-foreground/70">
                              #{v.codigo}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pl-2 shrink-0">
                      <span className="font-bold text-sm text-primary">
                        {formatMoney(vPrecio)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                );
              })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Crear Nuevo Cliente Rápido desde el POS */}
      <Dialog open={modalNuevoClienteOpen} onOpenChange={setModalNuevoClienteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              <span>Registrar Nuevo Cliente</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Crea el cliente y se seleccionará automáticamente para esta venta o fiado.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={crearNuevoCliente} className="space-y-3.5 py-2">
            <div className="space-y-1">
              <Label htmlFor="pos-nuevo-cli-nom" className="text-xs font-semibold">
                Nombre Completo *
              </Label>
              <Input
                id="pos-nuevo-cli-nom"
                placeholder="Ej: Carolina Morales"
                value={nuevoClienteNombre}
                onChange={(e) => setNuevoClienteNombre(e.target.value)}
                required
                autoFocus
                disabled={guardandoCliente}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="pos-nuevo-cli-tel" className="text-xs">
                  Teléfono / WhatsApp
                </Label>
                <Input
                  id="pos-nuevo-cli-tel"
                  placeholder="+56 9 1234 5678"
                  value={nuevoClienteTelefono}
                  onChange={(e) => setNuevoClienteTelefono(e.target.value)}
                  disabled={guardandoCliente}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="pos-nuevo-cli-email" className="text-xs">
                  Email (Opcional)
                </Label>
                <Input
                  id="pos-nuevo-cli-email"
                  type="email"
                  placeholder="cliente@correo.com"
                  value={nuevoClienteEmail}
                  onChange={(e) => setNuevoClienteEmail(e.target.value)}
                  disabled={guardandoCliente}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="pos-nuevo-cli-dir" className="text-xs">
                Dirección (Opcional)
              </Label>
              <Input
                id="pos-nuevo-cli-dir"
                placeholder="Calle, Número o Depto"
                value={nuevoClienteDireccion}
                onChange={(e) => setNuevoClienteDireccion(e.target.value)}
                disabled={guardandoCliente}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalNuevoClienteOpen(false)}
                disabled={guardandoCliente}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={guardandoCliente}
                className="font-bold gap-1.5"
              >
                {guardandoCliente ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Crear y Seleccionar
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
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
