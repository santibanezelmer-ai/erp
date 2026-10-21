"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import type { Database } from "@/types/database.types";
import { isPromoActive, effectivePrice, promoDiscountPct } from "@/lib/promo";
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
  ChevronLeft,
  X,
  Flame,
  Sparkles,
  CheckCircle2,
  Filter,
  ArrowUpDown,
  Tag,
  Info,
  Check,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Negocio = Database["public"]["Tables"]["negocios"]["Row"];
type Producto = Database["public"]["Tables"]["productos"]["Row"];
type Variante = Database["public"]["Tables"]["producto_variantes"]["Row"];
type Marca = { id: string; nombre: string; logo_url?: string | null };

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
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartModalOpen, setCartModalOpen] = useState(false);

  // Filters & Search states
  const [busqueda, setBusqueda] = useState("");
  const [categoriaSel, setCategoriaSel] = useState("todas");
  const [marcaSel, setMarcaSel] = useState("todas");
  const [filtroRapido, setFiltroRapido] = useState<"todos" | "ofertas" | "nuevos" | "disponibles">("todos");
  const [ordenarPor, setOrdenarPor] = useState<"destacados" | "precio_asc" | "precio_desc" | "nombre_asc" | "descuento">("destacados");

  // Variant selector modal (quick add)
  const [pickVariant, setPickVariant] = useState<Producto | null>(null);

  // Rich In-Page Product Detail Modal
  const [detailProduct, setDetailProduct] = useState<Producto | null>(null);
  const [detailImages, setDetailImages] = useState<string[]>([]);
  const [detailIdx, setDetailIdx] = useState(0);
  const [detailSelectedVariant, setDetailSelectedVariant] = useState<Variante | null>(null);
  const [detailQty, setDetailQty] = useState(1);

  // Form Pedido WhatsApp
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

        // 2. Obtener productos activos, variantes y marcas en paralelo
        const [prodsRes, varsRes, marcasRes] = await Promise.all([
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
          supabase
            .from("marcas_public" as any)
            .select("id, nombre, logo_url")
            .eq("negocio_id", neg.id)
            .order("nombre", { ascending: true }),
        ]);

        setProductos(prodsRes.data || []);
        setVariantes(varsRes.data || []);
        setMarcas((marcasRes.data as unknown as Marca[]) || []);
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

  const marcaNombre = (marcaId?: string | null): string | null => {
    if (!marcaId) return null;
    return marcas.find((m) => m.id === marcaId)?.nombre || null;
  };

  const productHasPromo = (p: Producto): boolean => {
    return isPromoActive(p) || variantsOf(p.id).some((v) => isPromoActive(v));
  };

  const productMaxDiscount = (p: Producto): number => {
    const pcts = [
      promoDiscountPct(p),
      ...variantsOf(p.id).map((v) => promoDiscountPct(v)),
    ];
    return Math.max(0, ...pcts);
  };

  const getUnitPrice = (p: Producto, v?: Variante | null): number => {
    if (v) {
      return effectivePrice(v.precio_promocional != null ? v : p);
    }
    return effectivePrice(p);
  };

  const getStock = (p: Producto, v?: Variante | null): number => {
    if (p.sin_control_stock) return Infinity;
    if (v) return Number(v.stock || 0);
    const vs = variantsOf(p.id);
    if (vs.length > 0) return vs.reduce((acc, curr) => acc + Number(curr.stock || 0), 0);
    return Number(p.stock || 0);
  };

  const isDisponible = (p: Producto): boolean => {
    if (p.sin_control_stock) return true;
    return getStock(p) > 0;
  };

  // Carga de imágenes para el Modal de Detalle Ampliado
  useEffect(() => {
    if (!detailProduct) {
      setDetailImages([]);
      setDetailIdx(0);
      setDetailSelectedVariant(null);
      setDetailQty(1);
      return;
    }

    const loadGallery = async () => {
      const supabase = createClient();
      const vs = variantsOf(detailProduct.id);

      // Si el producto tiene variantes, preseleccionar la primera disponible
      const primeraConStock = vs.find((v) => Number(v.stock || 0) > 0) || vs[0] || null;
      setDetailSelectedVariant(primeraConStock);
      setDetailQty(1);

      // Consultar galería adicional en producto_imagenes_public
      const { data: galleryRows } = await supabase
        .from("producto_imagenes_public" as any)
        .select("url, orden")
        .eq("producto_id", detailProduct.id)
        .order("orden", { ascending: true });

      const urls = (galleryRows || []).map((r: any) => r.url);

      // Agregar foto principal del producto si no está en la galería
      if (detailProduct.imagen_url && !urls.includes(detailProduct.imagen_url)) {
        urls.unshift(detailProduct.imagen_url);
      }

      // Si la variante inicial tiene foto y no está en la galería, añadirla al inicio
      if (primeraConStock?.imagen_url && !urls.includes(primeraConStock.imagen_url)) {
        urls.unshift(primeraConStock.imagen_url);
      }

      setDetailImages(urls);
      setDetailIdx(0);
    };

    loadGallery();
  }, [detailProduct]);

  // Manejo de cambio de variante en vista ampliada
  const handleVariantSelectInDetail = (v: Variante) => {
    setDetailSelectedVariant(v);
    setDetailQty(1);
    if (v.imagen_url) {
      const foundIdx = detailImages.indexOf(v.imagen_url);
      if (foundIdx !== -1) {
        setDetailIdx(foundIdx);
      } else {
        setDetailImages((prev) => [v.imagen_url!, ...prev]);
        setDetailIdx(0);
      }
    }
  };

  // Categorías presentes en los productos
  const categorias = [
    "todas",
    ...Array.from(new Set(productos.map((p) => p.categoria).filter(Boolean) as string[])),
  ];

  // Conteo de productos para filtros
  const countOfertas = productos.filter((p) => productHasPromo(p)).length;
  const countNuevos = productos.filter((p) => p.is_new_arrival).length;
  const countDisponibles = productos.filter((p) => isDisponible(p)).length;

  const countPorCat = (cat: string) => {
    if (cat === "todas") return productos.length;
    return productos.filter((p) => p.categoria === cat).length;
  };

  // Filtrado
  const productosFiltrados = productos.filter((p) => {
    // 1. Busqueda por texto (nombre, categoria, descripcion, marca, codigo, variante)
    const q = busqueda.toLowerCase().trim();
    if (q) {
      const matchNombre = p.nombre.toLowerCase().includes(q);
      const matchCat = p.categoria && p.categoria.toLowerCase().includes(q);
      const matchDesc = p.descripcion && p.descripcion.toLowerCase().includes(q);
      const matchMarca = p.marca_id && marcaNombre(p.marca_id)?.toLowerCase().includes(q);
      const matchCodigo = p.codigo && p.codigo.toLowerCase().includes(q);
      const matchVar = variantsOf(p.id).some((v) => v.nombre.toLowerCase().includes(q));
      if (!matchNombre && !matchCat && !matchDesc && !matchMarca && !matchCodigo && !matchVar) {
        return false;
      }
    }

    // 2. Filtro de Categoría
    if (categoriaSel !== "todas" && p.categoria !== categoriaSel) {
      return false;
    }

    // 3. Filtro de Marca
    if (marcaSel !== "todas" && p.marca_id !== marcaSel) {
      return false;
    }

    // 4. Filtro rápido
    if (filtroRapido === "ofertas" && !productHasPromo(p)) return false;
    if (filtroRapido === "nuevos" && !p.is_new_arrival) return false;
    if (filtroRapido === "disponibles" && !isDisponible(p)) return false;

    return true;
  });

  // Ordenamiento
  productosFiltrados.sort((a, b) => {
    const dispA = isDisponible(a) ? 1 : 0;
    const dispB = isDisponible(b) ? 1 : 0;

    if (ordenarPor === "precio_asc") {
      const prA = getUnitPrice(a);
      const prB = getUnitPrice(b);
      return prA - prB;
    }
    if (ordenarPor === "precio_desc") {
      const prA = getUnitPrice(a);
      const prB = getUnitPrice(b);
      return prB - prA;
    }
    if (ordenarPor === "nombre_asc") {
      return a.nombre.localeCompare(b.nombre);
    }
    if (ordenarPor === "descuento") {
      return productMaxDiscount(b) - productMaxDiscount(a);
    }

    // Por defecto ("destacados"): disponibles primero, luego ofertas
    if (dispA !== dispB) return dispB - dispA;
    const promoA = productHasPromo(a) ? 1 : 0;
    const promoB = productHasPromo(b) ? 1 : 0;
    if (promoA !== promoB) return promoB - promoA;

    return 0;
  });

  const hayFiltrosActivos =
    busqueda.trim() !== "" ||
    categoriaSel !== "todas" ||
    marcaSel !== "todas" ||
    filtroRapido !== "todos" ||
    ordenarPor !== "destacados";

  const limpiarFiltros = () => {
    setBusqueda("");
    setCategoriaSel("todas");
    setMarcaSel("todas");
    setFiltroRapido("todos");
    setOrdenarPor("destacados");
  };

  // Carrito
  const addToCart = (prod: Producto, variante?: Variante | null, cantidad = 1) => {
    const key = variante ? `${prod.id}:${variante.id}` : prod.id;
    const maxStock = getStock(prod, variante);

    setCart((prev) => {
      const existing = prev.find((i) => i.key === key);
      const currentQty = existing ? existing.qty : 0;
      const targetQty = currentQty + cantidad;

      if (!prod.sin_control_stock && targetQty > maxStock) {
        toast.error(`Stock máximo disponible alcanzado (${maxStock} u.)`);
        return prev;
      }

      if (existing) {
        return prev.map((i) =>
          i.key === key ? { ...i, qty: i.qty + cantidad } : i
        );
      }

      return [
        ...prev,
        {
          key,
          producto: prod,
          variante: variante || null,
          qty: cantidad,
        },
      ];
    });

    const itemLabel = variante
      ? `${prod.nombre} (${variante.nombre})`
      : prod.nombre;
    toast.success(`Añadido: ${cantidad > 1 ? `${cantidad}× ` : ""}${itemLabel}`);
  };

  const handleQuickAddClick = (e: React.MouseEvent, prod: Producto) => {
    e.stopPropagation();
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

  const logoTienda = (negocio as any)?.logo_url || (negocio?.perfil?.startsWith("http") || negocio?.perfil?.startsWith("data:") ? negocio.perfil : null);

  return (
    <div className="min-h-screen flex flex-col bg-muted/20 pb-28">
      {/* Header del Catálogo */}
      <header className="bg-card border-b border-border sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {logoTienda ? (
              <img
                src={logoTienda}
                alt={negocio.nombre}
                className="h-10 w-10 rounded-xl object-contain bg-background border p-1 shadow-xs"
              />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-sm">
                <Store className="h-5 w-5" />
              </div>
            )}
            <div>
              <h1 className="font-extrabold text-base leading-tight text-foreground truncate max-w-[200px] sm:max-w-xs">
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
            className="gap-2 relative shadow-sm font-semibold"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Carrito</span>
            {totalItems > 0 && (
              <span className="bg-background text-primary text-[11px] font-black px-1.5 py-0.5 rounded-full shadow-xs">
                {totalItems}
              </span>
            )}
          </Button>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="max-w-5xl mx-auto px-4 py-5 w-full space-y-4">
        {/* Barra de Búsqueda y Ordenamiento */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          <div className="relative sm:col-span-8">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, tono, marca, categoría o código..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9 pr-8 bg-card shadow-xs"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="sm:col-span-4 flex items-center gap-2">
            <div className="relative w-full">
              <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <select
                value={ordenarPor}
                onChange={(e) => setOrdenarPor(e.target.value as any)}
                className="w-full h-9 pl-8 pr-2.5 text-xs rounded-md border border-border bg-card text-foreground font-medium shadow-xs focus:ring-1 focus:ring-primary truncate"
              >
                <option value="destacados">⭐ Destacados y Ofertas</option>
                <option value="precio_asc">💵 Menor a Mayor Precio</option>
                <option value="precio_desc">💎 Mayor a Menor Precio</option>
                <option value="nombre_asc">🔤 Nombre (A - Z)</option>
                <option value="descuento">🔥 Mayor Descuento %</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabs de Filtro Rápido (Todos, Ofertas, Nuevos, Con Stock) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setFiltroRapido("todos")}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all shadow-2xs",
              filtroRapido === "todos"
                ? "bg-foreground text-background border-foreground shadow-xs"
                : "bg-card border-border text-muted-foreground hover:bg-muted"
            )}
          >
            Todos ({productos.length})
          </button>

          {countOfertas > 0 && (
            <button
              type="button"
              onClick={() => setFiltroRapido(filtroRapido === "ofertas" ? "todos" : "ofertas")}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all flex items-center gap-1.5 shadow-2xs",
                filtroRapido === "ofertas"
                  ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                  : "bg-card border-border text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              )}
            >
              <Flame className="h-3.5 w-3.5 fill-current" />
              <span>Ofertas ({countOfertas})</span>
            </button>
          )}

          {countNuevos > 0 && (
            <button
              type="button"
              onClick={() => setFiltroRapido(filtroRapido === "nuevos" ? "todos" : "nuevos")}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all flex items-center gap-1.5 shadow-2xs",
                filtroRapido === "nuevos"
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                  : "bg-card border-border text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Novedades ({countNuevos})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setFiltroRapido(filtroRapido === "disponibles" ? "todos" : "disponibles")}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all flex items-center gap-1.5 shadow-2xs",
              filtroRapido === "disponibles"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                : "bg-card border-border text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Solo con Stock ({countDisponibles})</span>
          </button>
        </div>

        {/* Fila de Filtros Secundarios: Categorías y Marcas */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
          {/* Categorías Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none flex-1">
            {categorias.map((c) => {
              const count = countPorCat(c);
              if (c !== "todas" && count === 0) return null;

              return (
                <button
                  key={c}
                  onClick={() => setCategoriaSel(c)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap border transition-all capitalize flex items-center gap-1",
                    categoriaSel === c
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-card border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <span>{c === "todas" ? "Todas las Categorías" : c}</span>
                  <span className={cn(
                    "text-[10px] px-1 rounded-full font-bold",
                    categoriaSel === c ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Filtro por Marca si existen */}
          {marcas.length > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={marcaSel}
                onChange={(e) => setMarcaSel(e.target.value)}
                className="h-8 text-xs rounded-lg border border-border bg-card px-2.5 py-1 text-foreground font-medium shadow-2xs focus:ring-1 focus:ring-primary"
              >
                <option value="todas">Todas las Marcas ({marcas.length})</option>
                {marcas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Barra de Filtros Activos con Botón Limpiar */}
        {hayFiltrosActivos && (
          <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-card border border-border/80 text-xs shadow-2xs">
            <span className="text-muted-foreground font-semibold flex items-center gap-1">
              <Filter className="h-3 w-3 text-primary" />
              Filtros:
            </span>

            {busqueda && (
              <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded-md text-[11px] font-medium">
                Texto: "{busqueda}"
                <button onClick={() => setBusqueda("")} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {categoriaSel !== "todas" && (
              <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded-md text-[11px] font-medium">
                Categoría: {categoriaSel}
                <button onClick={() => setCategoriaSel("todas")} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {marcaSel !== "todas" && (
              <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded-md text-[11px] font-medium">
                Marca: {marcaNombre(marcaSel)}
                <button onClick={() => setMarcaSel("todas")} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            {filtroRapido !== "todos" && (
              <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded-md text-[11px] font-medium capitalize">
                Filtro: {filtroRapido}
                <button onClick={() => setFiltroRapido("todos")} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}

            <span className="text-muted-foreground ml-auto text-[11px]">
              {productosFiltrados.length} {productosFiltrados.length === 1 ? "producto" : "productos"}
            </span>

            <button
              onClick={limpiarFiltros}
              className="text-primary hover:underline font-bold text-[11px] ml-2"
            >
              Limpiar todo
            </button>
          </div>
        )}

        {/* Grid de Productos */}
        {productosFiltrados.length === 0 ? (
          <div className="py-20 text-center space-y-2 bg-card rounded-2xl border border-dashed p-6">
            <Package className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <h3 className="font-bold text-sm text-foreground">No encontramos productos con estos filtros</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Intenta cambiar la categoría o buscar con otra palabra clave.
            </p>
            {hayFiltrosActivos && (
              <Button size="sm" variant="outline" onClick={limpiarFiltros} className="mt-2 text-xs">
                Restablecer Filtros
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {productosFiltrados.map((prod) => {
              const vs = variantsOf(prod.id);
              const stockNum = getStock(prod);
              const isAgotado = !prod.sin_control_stock && stockNum <= 0;
              const tienePromo = productHasPromo(prod);
              const maxDesc = productMaxDiscount(prod);
              const nombreMarca = marcaNombre(prod.marca_id);

              return (
                <Card
                  key={prod.id}
                  onClick={() => setDetailProduct(prod)}
                  className={cn(
                    "overflow-hidden flex flex-col justify-between hover:shadow-lg transition-all border-muted/60 group cursor-pointer bg-card rounded-2xl relative",
                    tienePromo && "ring-1 ring-amber-400/50"
                  )}
                >
                  {/* Imagen del Producto */}
                  <div className="relative aspect-square w-full overflow-hidden bg-muted/30">
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
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground/30 bg-muted/20">
                        <Package className="h-10 w-10 stroke-[1.5]" />
                      </div>
                    )}

                    {/* Overlay al hacer hover con icono de ver */}
                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="bg-background/90 text-foreground text-[11px] font-bold px-2.5 py-1 rounded-full shadow-md flex items-center gap-1 backdrop-blur-xs">
                        <Eye className="h-3 w-3" />
                        Ver detalle
                      </span>
                    </div>

                    {/* Badges Flotantes en la Imagen */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1 items-start pointer-events-none z-10">
                      {tienePromo && maxDesc > 0 && (
                        <span className="text-[10px] font-black uppercase bg-amber-500 text-white px-2 py-0.5 rounded-full shadow-xs flex items-center gap-0.5">
                          <Flame className="h-2.5 w-2.5 fill-current" />
                          -{maxDesc}%
                        </span>
                      )}

                      {prod.is_new_arrival && !tienePromo && (
                        <span className="text-[10px] font-bold uppercase bg-blue-600 text-white px-2 py-0.5 rounded-full shadow-xs">
                          Nuevo
                        </span>
                      )}

                      {vs.length > 0 && (
                        <span className="text-[10px] font-bold bg-background/90 backdrop-blur-xs text-foreground px-2 py-0.5 rounded-full shadow-xs border">
                          {vs.length} opciones
                        </span>
                      )}
                    </div>

                    {isAgotado && (
                      <span className="absolute top-2 right-2 text-[10px] font-bold bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full shadow-xs z-10">
                        Agotado
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3 space-y-1">
                    {nombreMarca && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/90 block truncate">
                        {nombreMarca}
                      </span>
                    )}

                    <h3
                      className="font-bold text-xs leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors"
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

                  {/* Precios y Botón */}
                  <div className="p-3 pt-0 flex items-center justify-between gap-1">
                    <div>
                      {tienePromo ? (
                        <div className="leading-tight">
                          <span className="line-through text-[11px] text-muted-foreground block">
                            {formatMoney(prod.precio_venta)}
                          </span>
                          <span className="font-extrabold text-sm text-amber-600 dark:text-amber-400">
                            {formatMoney(effectivePrice(prod))}
                          </span>
                        </div>
                      ) : (
                        <span className="font-extrabold text-sm text-primary">
                          {formatMoney(prod.precio_venta)}
                        </span>
                      )}
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isAgotado}
                      onClick={(e) => handleQuickAddClick(e, prod)}
                      className={cn(
                        "h-7 px-2.5 text-xs gap-1 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground transition-all shadow-2xs",
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

      {/* Modal Rápido Selector de Variantes (Click desde botón Opciones) */}
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
            <DialogDescription className="text-xs">
              Selecciona una opción para añadir al carrito:
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

      {/* VISTA AMPLIADA DEL PRODUCTO (MODAL ENRIQUECIDO SIN RECARGA NI NAVEGACIÓN) */}
      <Dialog
        open={!!detailProduct}
        onOpenChange={(open) => !open && setDetailProduct(null)}
      >
        <DialogContent className="sm:max-w-xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">
          {detailProduct && (() => {
            const vs = variantsOf(detailProduct.id);
            const activeVar = detailSelectedVariant;
            const stockActual = getStock(detailProduct, activeVar);
            const agotado = !detailProduct.sin_control_stock && stockActual <= 0;
            const precioActual = getUnitPrice(detailProduct, activeVar);
            const tienePromo = isPromoActive(activeVar || detailProduct);
            const basePrecio = Number((activeVar?.precio_venta ?? detailProduct.precio_venta) || 0);
            const descuentoPct = tienePromo && basePrecio > 0 ? Math.round(((basePrecio - precioActual) / basePrecio) * 100) : 0;
            const nombreMarca = marcaNombre(detailProduct.marca_id);

            return (
              <>
                <DialogHeader className="p-4 sm:p-5 pb-2 shrink-0 border-b border-border bg-card">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    {nombreMarca && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                        {nombreMarca}
                      </span>
                    )}
                    {detailProduct.categoria && (
                      <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                        {detailProduct.categoria}
                      </span>
                    )}
                    {detailProduct.codigo && (
                      <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                        #{detailProduct.codigo}
                      </span>
                    )}
                  </div>
                  <DialogTitle className="text-base sm:text-lg font-extrabold text-foreground leading-snug">
                    {detailProduct.nombre}
                  </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                  {/* Galería de Imágenes */}
                  <div className="space-y-2">
                    <div className="relative aspect-4/3 sm:aspect-16/10 w-full bg-muted/40 rounded-xl overflow-hidden border flex items-center justify-center">
                      {detailImages.length > 0 ? (
                        <img
                          src={detailImages[detailIdx] || detailProduct.imagen_url || ""}
                          alt={detailProduct.nombre}
                          className={cn(
                            "w-full h-full object-contain",
                            agotado && "opacity-50 grayscale"
                          )}
                        />
                      ) : (
                        <Package className="h-16 w-16 text-muted-foreground/30" />
                      )}

                      {/* Flechas de Navegación de Galería */}
                      {detailImages.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setDetailIdx((i) => (i - 1 + detailImages.length) % detailImages.length)
                            }
                            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/85 hover:bg-background border shadow-md flex items-center justify-center text-foreground transition-all"
                            aria-label="Foto anterior"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDetailIdx((i) => (i + 1) % detailImages.length)
                            }
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/85 hover:bg-background border shadow-md flex items-center justify-center text-foreground transition-all"
                            aria-label="Siguiente foto"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </>
                      )}

                      {/* Badges sobre la foto */}
                      <div className="absolute top-2 left-2 flex flex-col gap-1 z-10 pointer-events-none">
                        {tienePromo && descuentoPct > 0 && (
                          <span className="text-xs font-black uppercase bg-amber-500 text-white px-2 py-0.5 rounded-full shadow-md flex items-center gap-1">
                            <Flame className="h-3 w-3 fill-current" />
                            -{descuentoPct}% DCTO
                          </span>
                        )}
                        {detailProduct.is_new_arrival && (
                          <span className="text-xs font-bold uppercase bg-blue-600 text-white px-2 py-0.5 rounded-full shadow-md">
                            Nuevo
                          </span>
                        )}
                      </div>

                      {agotado && (
                        <div className="absolute inset-0 bg-background/60 backdrop-blur-2xs flex items-center justify-center pointer-events-none">
                          <span className="bg-destructive text-destructive-foreground font-black text-sm uppercase px-4 py-1.5 rounded-full shadow-lg">
                            Agotado
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Miniaturas de la Galería */}
                    {detailImages.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                        {detailImages.map((url, idx) => (
                          <button
                            key={url + idx}
                            type="button"
                            onClick={() => setDetailIdx(idx)}
                            className={cn(
                              "h-12 w-12 rounded-lg border overflow-hidden shrink-0 transition-all",
                              idx === detailIdx
                                ? "ring-2 ring-primary border-primary scale-105"
                                : "opacity-60 hover:opacity-100"
                            )}
                          >
                            <img src={url} alt="" className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Bloque de Precios y Stock */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-card border border-border/80">
                    <div>
                      <div className="text-[11px] font-semibold text-muted-foreground uppercase">
                        Precio
                      </div>
                      <div className="flex items-baseline gap-2">
                        {tienePromo && basePrecio > precioActual && (
                          <span className="line-through text-sm text-muted-foreground font-semibold">
                            {formatMoney(basePrecio)}
                          </span>
                        )}
                        <span className="text-2xl font-black text-primary">
                          {formatMoney(precioActual)}
                        </span>
                      </div>
                      {tienePromo && basePrecio > precioActual && (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold block mt-0.5">
                          ¡Ahorras {formatMoney(basePrecio - precioActual)}!
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] font-semibold text-muted-foreground uppercase mb-1">
                        Disponibilidad
                      </div>
                      {detailProduct.sin_control_stock ? (
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          ✓ En Stock Ilimitado
                        </span>
                      ) : agotado ? (
                        <span className="text-xs font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                          ✕ Agotado
                        </span>
                      ) : stockActual <= 3 ? (
                        <span className="text-xs font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
                          ⚠️ ¡Últimas {stockActual} u.!
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          ✓ {stockActual} disponibles
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Selector de Variantes (si el producto tiene) */}
                  {vs.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold flex items-center gap-1.5">
                          <Layers className="h-4 w-4 text-primary" />
                          <span>Opciones / Variantes disponibles ({vs.length}):</span>
                        </Label>
                        {activeVar && (
                          <span className="text-xs font-bold text-primary">
                            Seleccionada: {activeVar.nombre}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {vs.map((v) => {
                          const vStock = Number(v.stock || 0);
                          const vAgotado = !detailProduct.sin_control_stock && vStock <= 0;
                          const isSelected = activeVar?.id === v.id;
                          const vImg = v.imagen_url || detailProduct.imagen_url;

                          return (
                            <button
                              key={v.id}
                              type="button"
                              disabled={vAgotado}
                              onClick={() => handleVariantSelectInDetail(v)}
                              className={cn(
                                "p-2 rounded-xl border text-left flex items-center gap-2 transition-all relative overflow-hidden",
                                isSelected
                                  ? "border-primary ring-2 ring-primary/30 bg-primary/5 shadow-xs"
                                  : "border-border hover:border-primary/50 bg-card",
                                vAgotado && "opacity-40 cursor-not-allowed hover:border-border"
                              )}
                            >
                              <div className="h-9 w-9 rounded-md bg-muted overflow-hidden shrink-0 border flex items-center justify-center">
                                {vImg ? (
                                  <img src={vImg} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <Package className="h-4 w-4 text-muted-foreground/40" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-[11px] truncate text-foreground">
                                  {v.nombre}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {vAgotado ? "Agotado" : `${vStock} u.`}
                                </div>
                              </div>
                              {isSelected && (
                                <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Descripción Completa */}
                  {detailProduct.descripcion && (
                    <div className="space-y-1.5 pt-1">
                      <Label className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                        <Info className="h-3.5 w-3.5 text-primary" />
                        <span>Descripción del Producto:</span>
                      </Label>
                      <div className="text-xs text-foreground/80 leading-relaxed bg-muted/30 p-3 rounded-xl border whitespace-pre-wrap">
                        {detailProduct.descripcion}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer de Acción con Stepper de Cantidad */}
                <div className="p-4 sm:p-5 border-t border-border bg-card shrink-0 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">Cantidad:</span>
                      <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border">
                        <button
                          type="button"
                          disabled={detailQty <= 1 || agotado}
                          onClick={() => setDetailQty((q) => Math.max(1, q - 1))}
                          className="h-7 w-7 rounded flex items-center justify-center hover:bg-background disabled:opacity-40"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center font-bold text-xs">{detailQty}</span>
                        <button
                          type="button"
                          disabled={(!detailProduct.sin_control_stock && detailQty >= stockActual) || agotado}
                          onClick={() => setDetailQty((q) => q + 1)}
                          className="h-7 w-7 rounded flex items-center justify-center hover:bg-background disabled:opacity-40"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-muted-foreground block">Subtotal</span>
                      <span className="text-lg font-black text-primary">
                        {formatMoney(precioActual * detailQty)}
                      </span>
                    </div>
                  </div>

                  <Button
                    disabled={agotado}
                    onClick={() => {
                      addToCart(detailProduct, activeVar, detailQty);
                      setDetailProduct(null);
                    }}
                    className="w-full h-11 font-bold gap-2 text-sm shadow-md"
                  >
                    {agotado ? (
                      "Producto Agotado"
                    ) : (
                      <>
                        <ShoppingCart className="h-4 w-4" />
                        <span>
                          Agregar {detailQty > 1 ? `${detailQty} u. ` : ""}al Carrito · {formatMoney(precioActual * detailQty)}
                        </span>
                      </>
                    )}
                  </Button>
                </div>
              </>
            );
          })()}
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
