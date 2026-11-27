"use client";

import { useEffect, useState } from "react";
import { useCatalog } from "@/components/catalog/CatalogContext";
import { formatMoney } from "@/lib/format";
import { isPromoActive, promoDiscountPct } from "@/lib/promo";
import { etiquetaCategoria } from "@/lib/categorias";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import type { Producto, Variante } from "@/types/theme.types";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Minus,
  Package,
  Plus,
  Share2,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";

const ORIGEN_CANONICO = "https://operixerp.cloud";

/**
 * URL pública de la página del producto. Por defecto usa el dominio canónico
 * (igual en servidor y navegador, sin desajustes de hidratación); al compartir
 * se pasa el origen actual.
 */
export function urlProducto(slug: string, productoId: string, origin: string = ORIGEN_CANONICO) {
  return `${origin}/c/${slug}/p/${productoId}`;
}

interface Props {
  producto: Producto;
  /** "modal": dentro del diálogo; "pagina": página propia del producto (título h1, botón de WhatsApp) */
  modo: "modal" | "pagina";
  /** Se llama después de agregar al carrito (el modal se cierra) */
  onAgregado?: () => void;
}

/**
 * Detalle de un producto: galería, precio, stock, variantes, cantidad, carrito
 * y compartir. Lo usan el modal de detalle y la página propia del producto.
 * Montar con key={producto.id} para reiniciar el estado al cambiar de producto.
 */
export function DetalleProducto({ producto, modo, onAgregado }: Props) {
  const { variantsOf, marcaNombre, getUnitPrice, getStock, addToCart, negocio } = useCatalog();

  const variantes = variantsOf(producto.id);
  const primeraDisponible = variantes.find((v) => Number(v.stock || 0) > 0) || variantes[0] || null;

  const [images, setImages] = useState<string[]>(() =>
    [primeraDisponible?.imagen_url, producto.imagen_url].filter((u, i, a): u is string => !!u && a.indexOf(u) === i)
  );
  const [activeIdx, setActiveIdx] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<Variante | null>(primeraDisponible);
  const [qty, setQty] = useState(1);

  // Galería adicional desde el servidor (no depende de la sesión del navegador)
  useEffect(() => {
    let vivo = true;
    fetch(`/api/public/producto-imagenes/${encodeURIComponent(producto.id)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((gal: { url: string }[]) => {
        if (!vivo || !Array.isArray(gal)) return;
        setImages((prev) => [...prev, ...gal.map((g) => g.url).filter((u) => u && !prev.includes(u))]);
      })
      .catch((err) => console.warn("[Catalogo] No se pudo cargar la galería:", err));
    return () => {
      vivo = false;
    };
  }, [producto.id]);

  const precio = getUnitPrice(producto, selectedVariant);
  const precioBase = Number(selectedVariant?.precio_venta ?? producto.precio_venta ?? 0);
  const stock = getStock(producto, selectedVariant);
  const enStock = producto.sin_control_stock || stock > 0;
  const marca = marcaNombre(producto.marca_id);
  const conPromo = precio < precioBase;
  const pct = conPromo ? promoDiscountPct(isPromoActive(selectedVariant) ? selectedVariant : producto) || Math.round((1 - precio / precioBase) * 100) : 0;
  const n = negocio as { nombre: string; slug: string; telefono?: string | null };

  const elegirVariante = (v: Variante) => {
    setSelectedVariant(v);
    setQty(1);
    if (v.imagen_url) {
      const idx = images.indexOf(v.imagen_url);
      if (idx !== -1) setActiveIdx(idx);
      else {
        setImages((prev) => [v.imagen_url!, ...prev]);
        setActiveIdx(0);
      }
    }
  };

  const agregar = () => {
    addToCart(producto, selectedVariant, qty);
    onAgregado?.();
  };

  const compartir = async () => {
    const url = urlProducto(n.slug, producto.id, window.location.origin);
    const texto = `¡Mira este producto en ${n.nombre}!: ${producto.nombre} a ${formatMoney(precio)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: producto.nombre, text: texto, url });
      } catch {
        // el usuario canceló
      }
    } else if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(`${texto}\n${url}`);
        toast.success("¡Enlace del producto copiado al portapapeles!");
      } catch {
        toast.info("Enlace: " + url);
      }
    }
  };

  const Titulo = modo === "pagina" ? "h1" : "h2";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
      {/* Galería */}
      <div className="space-y-3 min-w-0">
        <div className="relative aspect-square rounded-2xl bg-muted/40 border border-border overflow-hidden flex items-center justify-center">
          {images.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={images[activeIdx]}
              alt={producto.nombre}
              className="w-full h-full object-cover"
              loading={modo === "pagina" ? "eager" : "lazy"}
              fetchPriority={modo === "pagina" ? "high" : "auto"}
              decoding="async"
            />
          ) : (
            <Package className="h-16 w-16 text-muted-foreground/30" />
          )}

          {images.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Imagen anterior"
                onClick={() => setActiveIdx((i) => (i > 0 ? i - 1 : images.length - 1))}
                className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 backdrop-blur-xs flex items-center justify-center hover:bg-background shadow-sm"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Imagen siguiente"
                onClick={() => setActiveIdx((i) => (i < images.length - 1 ? i + 1 : 0))}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 backdrop-blur-xs flex items-center justify-center hover:bg-background shadow-sm"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}

          {pct > 0 && (
            <span className="absolute top-3 left-3 rounded-full bg-(color:--tp-600) text-(color:--tp-on) font-bold text-xs px-2.5 py-1 shadow-sm">
              -{pct}% OFF
            </span>
          )}
        </div>

        {images.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {images.map((img, idx) => (
              <button
                key={img}
                type="button"
                aria-label={`Ver imagen ${idx + 1}`}
                onClick={() => setActiveIdx(idx)}
                className={`h-14 w-14 rounded-lg border-2 overflow-hidden shrink-0 transition-all ${
                  activeIdx === idx ? "border-primary shadow-xs" : "border-border/60 opacity-60 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Datos y compra */}
      <div className="space-y-4 min-w-0">
        <div>
          {marca && (
            <span className="text-xs font-semibold text-primary uppercase tracking-wider block mb-1">{marca}</span>
          )}
          <Titulo className="text-xl sm:text-2xl font-black text-foreground leading-tight">{producto.nombre}</Titulo>
          {producto.categoria && (
            <span className="text-xs text-muted-foreground mt-0.5 block">
              Categoría: {etiquetaCategoria(producto.categoria)}
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-2 pt-1 border-t border-border">
          <span className="text-2xl sm:text-3xl font-black text-foreground">{formatMoney(precio)}</span>
          {conPromo && <span className="text-sm text-muted-foreground line-through">{formatMoney(precioBase)}</span>}
        </div>

        <div className="text-xs">
          {enStock ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {producto.sin_control_stock
                ? "Disponible para encargo"
                : `Disponible (${stock} ${stock === 1 ? "unidad" : "unidades"})`}
            </span>
          ) : (
            <span className="text-rose-500 font-semibold">Agotado temporalmente</span>
          )}
        </div>

        {variantes.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border">
            <span className="text-xs font-bold text-foreground uppercase tracking-wider block">Selecciona una opción:</span>
            <div className="flex flex-wrap gap-2">
              {variantes.map((v) => {
                const sel = selectedVariant?.id === v.id;
                const agotada = !producto.sin_control_stock && Number(v.stock || 0) <= 0;
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={agotada}
                    onClick={() => elegirVariante(v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                      sel
                        ? "border-primary bg-primary text-primary-foreground shadow-xs"
                        : agotada
                        ? "border-border/40 bg-muted/20 text-muted-foreground/40 line-through cursor-not-allowed"
                        : "border-border bg-card text-foreground hover:border-border/80"
                    }`}
                  >
                    <span>{v.nombre}</span>
                    {getUnitPrice(producto, v) !== getUnitPrice(producto) && (
                      <span className="opacity-80 text-[10px]">({formatMoney(getUnitPrice(producto, v))})</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {producto.descripcion && (
          <div className="pt-2 border-t border-border">
            <span className="text-xs font-bold text-foreground uppercase tracking-wider block mb-1">Descripción</span>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {producto.descripcion}
            </p>
          </div>
        )}

        <div className="pt-4 border-t border-border space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-muted-foreground">Cantidad:</span>
            <div className="flex items-center gap-1 border border-border rounded-lg p-1 bg-muted/30">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-md"
                aria-label="Menos"
                disabled={qty <= 1}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="w-8 text-center text-xs font-bold">{qty}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-md"
                aria-label="Más"
                disabled={!producto.sin_control_stock && qty >= stock}
                onClick={() => setQty((q) => q + 1)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <Button
            type="button"
            disabled={!enStock}
            onClick={agregar}
            className="w-full h-11 text-xs sm:text-sm font-bold gap-2 shadow-xs justify-center"
          >
            <ShoppingCart className="h-4 w-4 shrink-0" />
            <span>Agregar al Carrito • {formatMoney(precio * qty)}</span>
          </Button>

          {modo === "pagina" && n.telefono && (
            <a
              href={enlaceWhatsApp(n.telefono, `Hola ${n.nombre}, tengo una consulta sobre "${producto.nombre}": ${urlProducto(n.slug, producto.id)}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-10 rounded-md border border-border text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-muted transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              Consultar por WhatsApp
            </a>
          )}

          <button
            type="button"
            onClick={compartir}
            className="w-full py-1 text-center text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Compartir este producto</span>
          </button>
        </div>
      </div>
    </div>
  );
}
