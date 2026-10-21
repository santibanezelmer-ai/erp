"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Store,
  ShoppingCart,
  Search,
  Plus,
  Minus,
  MessageCircle,
  Loader2,
  Package,
  Layers,
  ChevronRight,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Negocio = Database["public"]["Tables"]["negocios"]["Row"];
type Producto = Database["public"]["Tables"]["productos"]["Row"];
type Variante = Database["public"]["Tables"]["producto_variantes"]["Row"];

interface CartItem {
  key: string;
  producto: Producto;
  variante?: Variante | null;
  qty: number;
}

export default function CatalogoPublicoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [variantes, setVariantes] = useState<Variante[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Cart & Search
  const [cart, setCart] = useState<CartItem[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaSel, setCategoriaSel] = useState("todas");
  const [cartModalOpen, setCartModalOpen] = useState(false);

  // Variant & Product detail modals
  const [pickVariant, setPickVariant] = useState<Producto | null>(null);
  const [detailProduct, setDetailProduct] = useState<Producto | null>(null);

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

        // 2. Obtener productos activos y sus variantes en paralelo
        const [prodsRes, varsRes] = await Promise.all([
          supabase
            .from("productos")
            .select("*")
            .eq("negocio_id", neg.id)
            .eq("activo", true)
            .order("nombre", { ascending: true }),
          supabase
            .from("producto_variantes")
            .select("*")
            .eq("negocio_id", neg.id)
            .eq("activo", true)
            .order("nombre", { ascending: true }),
        ]);

        setProductos(prodsRes.data || []);
        setVariantes(varsRes.data || []);
      } catch (err) {
        console.error("Error al cargar catálogo:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchCatalog();
  }, [slug]);

  const variantsOf = (prodId: string): Variante[] => {
    return variantes.filter((v) => v.producto_id === prodId);
  };

  const getUnitPrice = (p: Producto, v?: Variante | null): number => {
    if (v && v.precio_promocional != null) return Number(v.precio_promocional);
    if (v && v.precio_venta != null) return Number(v.precio_venta);
    if (p.precio_promocional != null) return Number(p.precio_promocional);
    return Number(p.precio_venta || 0);
  };

  const getStock = (p: Producto, v?: Variante | null): number => {
    if (p.sin_control_stock) return Infinity;
    if (v) return Number(v.stock || 0);
    const vs = variantsOf(p.id);
    if (vs.length > 0) return vs.reduce((acc, curr) => acc + Number(curr.stock || 0), 0);
    return Number(p.stock || 0);
  };

  const categorias = [
    "todas",
    ...Array.from(new Set(productos.map((p) => p.categoria).filter(Boolean) as string[])),
  ];

  const addToCart = (prod: Producto, variante?: Variante | null) => {
    const key = variante ? `${prod.id}:${variante.id}` : prod.id;
    const maxStock = getStock(prod, variante);

    setCart((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing && !prod.sin_control_stock && existing.qty >= maxStock) {
        toast.error(`Stock máximo alcanzado (${maxStock} u.)`);
        return prev;
      }

      if (existing) {
        return prev.map((i) =>
          i.key === key ? { ...i, qty: i.qty + 1 } : i
        );
      }

      return [
        ...prev,
        {
          key,
          producto: prod,
          variante: variante || null,
          qty: 1,
        },
      ];
    });

    const itemLabel = variante
      ? `${prod.nombre} (${variante.nombre})`
      : prod.nombre;
    toast.success(`Añadido: ${itemLabel}`);
  };

  const handleAddClick = (prod: Producto) => {
    const vs = variantsOf(prod.id);
    if (vs.length > 0) {
      setPickVariant(prod);
    } else {
      addToCart(prod);
    }
  };

  const updateQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.key === key) {
            const next = i.qty + delta;
            const maxStock = getStock(i.producto, i.variante);
            if (delta > 0 && !i.producto.sin_control_stock && next > maxStock) {
              toast.error("No hay más unidades disponibles");
              return i;
            }
            return next > 0 ? { ...i, qty: next } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const totalItems = cart.reduce((acc, i) => acc + i.qty, 0);
  const totalMonto = cart.reduce(
    (acc, i) => acc + i.qty * getUnitPrice(i.producto, i.variante),
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
      const itemsPayload = cart.map((i) => {
        const unitPrice = getUnitPrice(i.producto, i.variante);
        const nom = i.variante
          ? `${i.producto.nombre} (${i.variante.nombre})`
          : i.producto.nombre;
        return {
          producto_id: i.producto.id,
          variante_id: i.variante?.id || null,
          nombre: nom,
          qty: i.qty,
          precio: unitPrice,
          subtotal: i.qty * unitPrice,
        };
      });

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
        const nom = i.variante
          ? `${i.producto.nombre} · ${i.variante.nombre}`
          : i.producto.nombre;
        const unitPrice = getUnitPrice(i.producto, i.variante);
        msg += `• ${i.qty}× ${nom} - ${formatMoney(i.qty * unitPrice)}\n`;
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
        <p className="text-sm text-muted-foreground font-medium">
          Cargando catálogo...
        </p>
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
              <p className="text-[11px] text-muted-foreground">
                Catálogo y Pedidos Online
              </p>
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
            {productosFiltrados.map((prod) => {
              const vs = variantsOf(prod.id);
              const stockNum = getStock(prod);
              const isAgotado = !prod.sin_control_stock && stockNum <= 0;

              return (
                <Card
                  key={prod.id}
                  className="overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow border-muted/60 group"
                >
                  {/* Imagen del Producto */}
                  <div
                    className="relative aspect-square w-full overflow-hidden bg-muted/40 cursor-pointer"
                    onClick={() => setDetailProduct(prod)}
                  >
                    {prod.imagen_url ? (
                      <img
                        src={prod.imagen_url}
                        alt={prod.nombre}
                        loading="lazy"
                        decoding="async"
                        className={cn(
                          "h-full w-full object-cover transition-transform duration-300 group-hover:scale-105",
                          isAgotado && "opacity-40 grayscale"
                        )}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground/30 bg-muted/30">
                        <Package className="h-10 w-10 stroke-[1.5]" />
                      </div>
                    )}

                    {/* Badges */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1 items-start pointer-events-none">
                      {vs.length > 0 && (
                        <span className="text-[10px] font-bold bg-background/90 backdrop-blur-xs text-foreground px-2 py-0.5 rounded-full shadow-xs border">
                          {vs.length} opciones
                        </span>
                      )}
                    </div>

                    {isAgotado && (
                      <span className="absolute top-2 right-2 text-[10px] font-bold bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full shadow-xs">
                        Agotado
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3 space-y-1">
                    <h3
                      onClick={() => setDetailProduct(prod)}
                      className="font-bold text-xs line-clamp-2 text-foreground cursor-pointer hover:text-primary transition-colors"
                      title={prod.nombre}
                    >
                      {prod.nombre}
                    </h3>
                    {prod.categoria && (
                      <span className="text-[10px] text-muted-foreground block truncate">
                        {prod.categoria}
                      </span>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="p-3 pt-0 flex items-center justify-between gap-1">
                    <span className="font-extrabold text-sm text-primary">
                      {vs.length > 0 && vs.some((v) => v.precio_venta != null)
                        ? formatMoney(Math.min(...vs.map((v) => Number(v.precio_venta || prod.precio_venta || 0))))
                        : formatMoney(prod.precio_venta)}
                    </span>

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isAgotado}
                      onClick={() => handleAddClick(prod)}
                      className={cn(
                        "h-7 px-2.5 text-xs gap-1 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground transition-all",
                        isAgotado && "border-border text-muted-foreground opacity-50"
                      )}
                    >
                      {isAgotado ? (
                        "Agotado"
                      ) : vs.length > 0 ? (
                        <>
                          <Layers className="h-3 w-3" />
                          <span>Opciones</span>
                        </>
                      ) : (
                        <>
                          <Plus className="h-3 w-3" />
                          <span>Añadir</span>
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              );
            })}
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
              <span>
                {totalItems} {totalItems === 1 ? "producto" : "productos"}
              </span>
            </div>
            <span>{formatMoney(totalMonto)}</span>
          </Button>
        </div>
      )}

      {/* Modal Selector de Variantes */}
      <Dialog
        open={!!pickVariant}
        onOpenChange={(open) => !open && setPickVariant(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Layers className="h-5 w-5 text-primary" />
              <span>{pickVariant?.nombre}</span>
            </DialogTitle>
            <DialogDescription>
              Selecciona una de las opciones disponibles para agregar a tu carrito:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 max-h-80 overflow-y-auto">
            {pickVariant &&
              variantsOf(pickVariant.id).map((v) => {
                const vStock = getStock(pickVariant, v);
                const vAgotado = !pickVariant.sin_control_stock && vStock <= 0;
                const vPrecio = getUnitPrice(pickVariant, v);
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
                      "w-full flex items-center justify-between p-3 rounded-xl border border-border bg-card text-left transition-all hover:border-primary hover:bg-muted/30",
                      vAgotado && "opacity-50 cursor-not-allowed hover:border-border hover:bg-card"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-12 w-12 rounded-lg bg-muted overflow-hidden shrink-0 flex items-center justify-center border">
                        {vImg ? (
                          <img
                            src={vImg}
                            alt={v.nombre}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Package className="h-6 w-6 text-muted-foreground/40" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="font-bold text-xs text-foreground truncate">
                          {v.nombre}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {vAgotado
                            ? "Agotado"
                            : !pickVariant.sin_control_stock
                            ? `${vStock} u. disponibles`
                            : "Disponible"}
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

      {/* Modal Detalle de Producto */}
      <Dialog
        open={!!detailProduct}
        onOpenChange={(open) => !open && setDetailProduct(null)}
      >
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          {detailProduct && (
            <div className="space-y-4">
              <div className="aspect-square w-full rounded-xl bg-muted overflow-hidden relative border">
                {detailProduct.imagen_url ? (
                  <img
                    src={detailProduct.imagen_url}
                    alt={detailProduct.nombre}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground/30">
                    <Package className="h-16 w-16" />
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-lg font-extrabold text-foreground">
                  {detailProduct.nombre}
                </h2>
                {detailProduct.categoria && (
                  <span className="text-xs text-muted-foreground block">
                    Categoría: {detailProduct.categoria}
                  </span>
                )}
                <div className="text-xl font-black text-primary mt-2">
                  {formatMoney(detailProduct.precio_venta)}
                </div>
              </div>

              {detailProduct.descripcion && (
                <div className="text-xs text-muted-foreground leading-relaxed bg-muted/40 p-3 rounded-lg border">
                  {detailProduct.descripcion}
                </div>
              )}

              {/* Botón para añadir o elegir variante */}
              <Button
                onClick={() => {
                  const p = detailProduct;
                  setDetailProduct(null);
                  handleAddClick(p);
                }}
                disabled={!detailProduct.sin_control_stock && getStock(detailProduct) <= 0}
                className="w-full font-bold h-11 gap-2"
              >
                {!detailProduct.sin_control_stock && getStock(detailProduct) <= 0
                  ? "Producto Agotado"
                  : variantsOf(detailProduct.id).length > 0
                  ? "Elegir Variante y Añadir"
                  : "Añadir al Carrito"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
              <div className="divide-y divide-border border rounded-xl p-3 max-h-56 overflow-y-auto space-y-1">
                {cart.map((item) => {
                  const unitPrice = getUnitPrice(item.producto, item.variante);
                  return (
                    <div
                      key={item.key}
                      className="py-2 flex items-center justify-between text-xs"
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="font-semibold truncate text-foreground">
                          {item.producto.nombre}
                          {item.variante && (
                            <span className="text-primary font-bold ml-1">
                              ({item.variante.nombre})
                            </span>
                          )}
                        </div>
                        <div className="text-muted-foreground">
                          {formatMoney(unitPrice)} c/u
                        </div>
                      </div>

                      <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                        <button
                          type="button"
                          onClick={() => updateQty(item.key, -1)}
                          className="p-0.5 rounded hover:bg-background"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-5 text-center font-bold">
                          {item.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.key, 1)}
                          className="p-0.5 rounded hover:bg-background"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      <div className="font-bold text-foreground text-right w-16">
                        {formatMoney(item.qty * unitPrice)}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center text-sm font-bold pt-1">
                <span>TOTAL A PAGAR:</span>
                <span className="text-primary text-xl font-black">
                  {formatMoney(totalMonto)}
                </span>
              </div>

              <div className="space-y-3 pt-2 border-t border-border">
                <div className="space-y-1">
                  <Label htmlFor="cli-nom" className="text-xs">
                    Tu Nombre Completo *
                  </Label>
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
                  <Label htmlFor="cli-tel" className="text-xs">
                    Tu Teléfono / WhatsApp *
                  </Label>
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
                  <Label htmlFor="cli-not" className="text-xs">
                    Instrucciones o Comentarios (Opcional)
                  </Label>
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
                  {enviandoPedido
                    ? "Generando..."
                    : "Enviar Pedido por WhatsApp"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
