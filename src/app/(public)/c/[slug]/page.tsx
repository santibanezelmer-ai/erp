"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Store,
  ShoppingCart,
  Search,
  Plus,
  Minus,
  X,
  MessageCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Negocio = Database["public"]["Tables"]["negocios"]["Row"];
type Producto = Database["public"]["Tables"]["productos"]["Row"];

interface CartItem {
  producto: Producto;
  qty: number;
}

export default function CatalogoPublicoPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Cart & Search
  const [cart, setCart] = useState<CartItem[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaSel, setCategoriaSel] = useState("todas");
  const [cartModalOpen, setCartModalOpen] = useState(false);

  // Form Pedido
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [notasPedido, setNotasPedido] = useState("");
  const [enviandoPedido, setEnviandoPedido] = useState(false);

  useEffect(() => {
    const fetchCatalog = async () => {
      setLoading(true);
      const supabase = createClient();

      try {
        // 1. Obtener negocio por slug
        const { data: neg, error: negErr } = await supabase
          .from("negocios")
          .select("*")
          .eq("slug", slug)
          .maybeSingle();

        if (negErr || !neg) {
          setNotFound(true);
          return;
        }

        setNegocio(neg);

        // 2. Obtener productos activos
        const { data: prods } = await supabase
          .from("productos")
          .select("*")
          .eq("negocio_id", neg.id)
          .eq("activo", true)
          .order("nombre", { ascending: true });

        setProductos(prods || []);
      } catch (err) {
        console.error("Error al cargar catálogo:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchCatalog();
  }, [slug]);

  const categorias = ["todas", ...Array.from(new Set(productos.map((p) => p.categoria).filter(Boolean) as string[]))];

  const addToCart = (prod: Producto) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.producto.id === prod.id);
      if (existing) {
        return prev.map((i) =>
          i.producto.id === prod.id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, { producto: prod, qty: 1 }];
    });
    toast.success(`Añadido: ${prod.nombre}`);
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.producto.id === id) {
            const next = i.qty + delta;
            return next > 0 ? { ...i, qty: next } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const totalItems = cart.reduce((acc, i) => acc + i.qty, 0);
  const totalMonto = cart.reduce(
    (acc, i) => acc + i.qty * Number(i.producto.precio_venta || 0),
    0
  );

  const enviarPedidoWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocio || cart.length === 0) return;

    if (!clienteNombre.trim() || !clienteTelefono.trim()) {
      toast.error("Por favor ingresa tu nombre y teléfono de contacto");
      return;
    }

    setEnviandoPedido(true);
    const supabase = createClient();

    try {
      const itemsPayload = cart.map((i) => ({
        producto_id: i.producto.id,
        nombre: i.producto.nombre,
        qty: i.qty,
        precio: i.producto.precio_venta,
        subtotal: i.qty * Number(i.producto.precio_venta || 0),
      }));

      // 1. Guardar pedido en Supabase
      await supabase.from("pedidos_whatsapp").insert({
        negocio_id: negocio.id,
        cliente_nombre: clienteNombre.trim(),
        cliente_telefono: clienteTelefono.trim(),
        notas: notasPedido.trim() || null,
        total: totalMonto,
        items: itemsPayload as any,
        estado: "pendiente",
      });

      // 2. Construir mensaje de WhatsApp
      let msg = `*¡Hola! Quiero hacer un pedido en ${negocio.nombre}*\n\n`;
      msg += `*Cliente:* ${clienteNombre.trim()}\n`;
      msg += `*Teléfono:* ${clienteTelefono.trim()}\n\n`;
      msg += `*Detalle del pedido:*\n`;
      cart.forEach((i) => {
        msg += `• ${i.qty}× ${i.producto.nombre} - ${formatMoney(i.qty * Number(i.producto.precio_venta || 0))}\n`;
      });
      msg += `\n*TOTAL:* ${formatMoney(totalMonto)}\n`;
      if (notasPedido.trim()) {
        msg += `\n*Notas:* ${notasPedido.trim()}\n`;
      }

      // Redirigir a WhatsApp (usar teléfono del negocio si existe, o abrir wa.me)
      const telNegocio = (negocio as any).telefono || "";
      const waUrl = telNegocio
        ? `https://wa.me/${telNegocio.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(msg)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

      window.open(waUrl, "_blank");

      toast.success("¡Pedido generado! Abriendo WhatsApp...");
      setCart([]);
      setCartModalOpen(false);
      setClienteNombre("");
      setClienteTelefono("");
      setNotasPedido("");
    } catch (err: any) {
      toast.error(err.message || "Error al procesar pedido");
    } finally {
      setEnviandoPedido(false);
    }
  };

  const productosFiltrados = productos.filter((p) => {
    const q = busqueda.toLowerCase().trim();
    const matchQ =
      !q ||
      p.nombre.toLowerCase().includes(q) ||
      (p.categoria && p.categoria.toLowerCase().includes(q));
    const matchCat = categoriaSel === "todas" || p.categoria === categoriaSel;
    return matchQ && matchCat;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">Cargando catálogo...</p>
      </div>
    );
  }

  if (notFound || !negocio) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <Store className="h-12 w-12 text-muted-foreground mb-3" />
        <h1 className="text-2xl font-bold">Catálogo no encontrado</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          El negocio que buscas no existe o la dirección web es incorrecta.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/20 pb-24">
      {/* Header del Catálogo */}
      <header className="bg-card border-b border-border sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {negocio.perfil ? (
              <img
                src={negocio.perfil}
                alt={negocio.nombre}
                className="h-10 w-10 rounded-xl object-contain bg-background border p-1 shadow-xs"
              />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-sm">
                <Store className="h-5 w-5" />
              </div>
            )}
            <div>
              <h1 className="font-extrabold text-base leading-tight text-foreground">
                {negocio.nombre}
              </h1>
              <p className="text-[11px] text-muted-foreground">Catálogo y Pedidos Online</p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => setCartModalOpen(true)}
            className="gap-2 relative shadow-sm"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Ver Carrito</span>
            {totalItems > 0 && (
              <span className="bg-background text-primary text-[11px] font-black px-1.5 py-0.5 rounded-full">
                {totalItems}
              </span>
            )}
          </Button>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="max-w-4xl mx-auto px-4 py-6 w-full space-y-4">
        {/* Buscador */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar productos en el catálogo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9 bg-card shadow-xs"
          />
        </div>

        {/* Categorías */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categorias.map((c) => (
            <button
              key={c}
              onClick={() => setCategoriaSel(c)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all capitalize",
                categoriaSel === c
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-card border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {c === "todas" ? "Todos los productos" : c}
            </button>
          ))}
        </div>

        {/* Grid de Productos */}
        {productosFiltrados.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            No se encontraron productos disponibles.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {productosFiltrados.map((prod) => (
              <Card
                key={prod.id}
                className="overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow border-muted/60"
              >
                <div className="p-3 space-y-1">
                  <h3 className="font-bold text-xs line-clamp-2 text-foreground">
                    {prod.nombre}
                  </h3>
                  {prod.categoria && (
                    <span className="text-[10px] text-muted-foreground block truncate">
                      {prod.categoria}
                    </span>
                  )}
                </div>

                <div className="p-3 pt-0 flex items-center justify-between">
                  <span className="font-extrabold text-sm text-primary">
                    {formatMoney(prod.precio_venta)}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addToCart(prod)}
                    className="h-7 px-2.5 text-xs gap-1 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
                  >
                    <Plus className="h-3 w-3" />
                    Añadir
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Floating Checkout Bar en Mobile si hay items */}
      {totalItems > 0 && (
        <div className="fixed bottom-4 inset-x-4 max-w-md mx-auto z-40">
          <Button
            onClick={() => setCartModalOpen(true)}
            className="w-full h-12 shadow-xl rounded-2xl flex items-center justify-between px-5 font-bold text-sm bg-primary text-primary-foreground"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              <span>{totalItems} {totalItems === 1 ? "producto" : "productos"}</span>
            </div>
            <span>{formatMoney(totalMonto)}</span>
          </Button>
        </div>
      )}

      {/* Modal Carrito y Envío WhatsApp */}
      <Dialog open={cartModalOpen} onOpenChange={setCartModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tu Pedido</DialogTitle>
            <DialogDescription>
              Revisa los productos y envíalos directo al WhatsApp del local.
            </DialogDescription>
          </DialogHeader>

          {cart.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Tu carrito está vacío. Agrega productos del catálogo para continuar.
            </div>
          ) : (
            <form onSubmit={enviarPedidoWhatsApp} className="space-y-4 py-2">
              <div className="divide-y divide-border border rounded-xl p-3 max-h-52 overflow-y-auto space-y-1">
                {cart.map((item) => (
                  <div key={item.producto.id} className="py-2 flex items-center justify-between text-xs">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="font-semibold truncate text-foreground">{item.producto.nombre}</div>
                      <div className="text-muted-foreground">
                        {formatMoney(item.producto.precio_venta)} c/u
                      </div>
                    </div>

                    <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => updateQty(item.producto.id, -1)}
                        className="p-0.5 rounded hover:bg-background"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-5 text-center font-bold">{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => updateQty(item.producto.id, 1)}
                        className="p-0.5 rounded hover:bg-background"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="font-bold text-foreground text-right w-16">
                      {formatMoney(item.qty * Number(item.producto.precio_venta || 0))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center text-sm font-bold pt-1">
                <span>TOTAL A PAGAR:</span>
                <span className="text-primary text-xl font-black">{formatMoney(totalMonto)}</span>
              </div>

              <div className="space-y-3 pt-2 border-t border-border">
                <div className="space-y-1">
                  <Label htmlFor="cli-nom" className="text-xs">Tu Nombre Completo *</Label>
                  <Input
                    id="cli-nom"
                    placeholder="Ej: Carolina Morales"
                    value={clienteNombre}
                    onChange={(e) => setClienteNombre(e.target.value)}
                    required
                    disabled={enviandoPedido}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="cli-tel" className="text-xs">Tu Teléfono / WhatsApp *</Label>
                  <Input
                    id="cli-tel"
                    placeholder="+56 9 1234 5678"
                    value={clienteTelefono}
                    onChange={(e) => setClienteTelefono(e.target.value)}
                    required
                    disabled={enviandoPedido}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="cli-not" className="text-xs">Instrucciones o Comentarios (Opcional)</Label>
                  <Input
                    id="cli-not"
                    placeholder="Ej: Con salsa extra, o retirar a las 14:00"
                    value={notasPedido}
                    onChange={(e) => setNotasPedido(e.target.value)}
                    disabled={enviandoPedido}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="submit"
                  disabled={enviandoPedido}
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11"
                >
                  <MessageCircle className="h-4 w-4" />
                  {enviandoPedido ? "Generando..." : "Enviar Pedido por WhatsApp"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
