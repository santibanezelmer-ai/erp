"use client";

import { useEffect, useState } from "react";
import { useCatalog } from "@/components/catalog/CatalogContext";
import { formatMoney } from "@/lib/format";
import { isPromoActive, promoDiscountPct } from "@/lib/promo";
import { createClient } from "@/lib/supabase/client";
import type { Variante } from "@/types/theme.types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  Plus,
  Minus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Tag,
  Package,
} from "lucide-react";

export function ProductDetailModal() {
  const {
    detailProduct,
    closeProductDetail,
    variantsOf,
    marcaNombre,
    getUnitPrice,
    getStock,
    isDisponible,
    addToCart,
  } = useCatalog();

  const [images, setImages] = useState<string[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<Variante | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!detailProduct) {
      setImages([]);
      setActiveIdx(0);
      setSelectedVariant(null);
      setQty(1);
      return;
    }

    const loadImages = async () => {
      const supabase = createClient();
      const vs = variantsOf(detailProduct.id);

      // Preseleccionar primera variante con stock o la primera
      const firstAvailable = vs.find((v) => Number(v.stock || 0) > 0) || vs[0] || null;
      setSelectedVariant(firstAvailable);
      setQty(1);

      // Cargar imágenes secundarias desde producto_imagenes_public
      const { data: gallery } = await supabase
        .from("producto_imagenes_public" as any)
        .select("url, orden")
        .eq("producto_id", detailProduct.id)
        .order("orden", { ascending: true });

      const urls = (gallery || []).map((g: any) => g.url);

      if (detailProduct.imagen_url && !urls.includes(detailProduct.imagen_url)) {
        urls.unshift(detailProduct.imagen_url);
      }
      if (firstAvailable?.imagen_url && !urls.includes(firstAvailable.imagen_url)) {
        urls.unshift(firstAvailable.imagen_url);
      }

      setImages(urls);
      setActiveIdx(0);
    };

    loadImages();
  }, [detailProduct]);

  if (!detailProduct) return null;

  const productVariants = variantsOf(detailProduct.id);
  const currentPrice = getUnitPrice(detailProduct, selectedVariant);
  const currentStock = getStock(detailProduct, selectedVariant);
  const inStock = detailProduct.sin_control_stock || currentStock > 0;
  const brandName = marcaNombre(detailProduct.marca_id);

  const hasDiscount =
    isPromoActive(selectedVariant || detailProduct) &&
    (selectedVariant?.precio_promocional || detailProduct.precio_promocional);
  const discountPct = promoDiscountPct(selectedVariant || detailProduct);

  const handleVariantClick = (v: Variante) => {
    setSelectedVariant(v);
    setQty(1);
    if (v.imagen_url) {
      const idx = images.indexOf(v.imagen_url);
      if (idx !== -1) {
        setActiveIdx(idx);
      } else {
        setImages((prev) => [v.imagen_url!, ...prev]);
        setActiveIdx(0);
      }
    }
  };

  const handleAdd = () => {
    addToCart(detailProduct, selectedVariant, qty);
    closeProductDetail();
  };

  return (
    <Dialog open={!!detailProduct} onOpenChange={(open) => !open && closeProductDetail()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Gallery View */}
          <div className="space-y-3">
            <div className="relative aspect-square rounded-2xl bg-muted/40 border border-border overflow-hidden flex items-center justify-center">
              {images.length > 0 ? (
                <img
                  src={images[activeIdx]}
                  alt={detailProduct.nombre}
                  className="w-full h-full object-cover transition-all"
                />
              ) : (
                <Package className="h-16 w-16 text-muted-foreground/30" />
              )}

              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveIdx((prev) => (prev > 0 ? prev - 1 : images.length - 1))
                    }
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 backdrop-blur-xs flex items-center justify-center text-foreground hover:bg-background shadow-sm"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveIdx((prev) => (prev < images.length - 1 ? prev + 1 : 0))
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 backdrop-blur-xs flex items-center justify-center text-foreground hover:bg-background shadow-sm"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}

              {hasDiscount && discountPct > 0 && (
                <Badge className="absolute top-3 left-3 bg-rose-500 text-white font-bold text-xs shadow-sm">
                  -{discountPct}% OFF
                </Badge>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveIdx(idx)}
                    className={`h-14 w-14 rounded-lg border-2 overflow-hidden shrink-0 transition-all ${
                      activeIdx === idx
                        ? "border-primary shadow-xs"
                        : "border-border/60 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details & Actions */}
          <div className="space-y-4">
            <div>
              {brandName && (
                <span className="text-xs font-semibold text-primary uppercase tracking-wider block mb-1">
                  {brandName}
                </span>
              )}
              <h2 className="text-xl sm:text-2xl font-black text-foreground leading-tight">
                {detailProduct.nombre}
              </h2>
              {detailProduct.categoria && (
                <span className="text-xs text-muted-foreground mt-0.5 block">
                  Categoría: {detailProduct.categoria}
                </span>
              )}
            </div>

            {/* Price section */}
            <div className="flex items-baseline gap-2 pt-1 border-t border-border">
              <span className="text-2xl sm:text-3xl font-black text-foreground">
                {formatMoney(currentPrice)}
              </span>
              {hasDiscount && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatMoney(Number(selectedVariant?.precio_venta || detailProduct.precio_venta))}
                </span>
              )}
            </div>

            {/* Stock indicator */}
            <div className="text-xs">
              {inStock ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {detailProduct.sin_control_stock
                    ? "Disponible para encargo"
                    : `Disponible (${currentStock} unidades)`}
                </span>
              ) : (
                <span className="text-rose-500 font-semibold">Agotado temporalmente</span>
              )}
            </div>

            {/* Variants */}
            {productVariants.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider block">
                  Selecciona una opción:
                </span>
                <div className="flex flex-wrap gap-2">
                  {productVariants.map((v) => {
                    const isSelected = selectedVariant?.id === v.id;
                    const vStock = Number(v.stock || 0);
                    const vOut = !detailProduct.sin_control_stock && vStock <= 0;

                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={vOut}
                        onClick={() => handleVariantClick(v)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground shadow-xs"
                            : vOut
                            ? "border-border/40 bg-muted/20 text-muted-foreground/40 line-through cursor-not-allowed"
                            : "border-border bg-card text-foreground hover:border-border/80"
                        }`}
                      >
                        <span>{v.nombre}</span>
                        {v.precio_venta !== detailProduct.precio_venta && (
                          <span className="opacity-80 text-[10px]">
                            ({formatMoney(Number(v.precio_promocional || v.precio_venta))})
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Description */}
            {detailProduct.descripcion && (
              <div className="pt-2 border-t border-border">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider block mb-1">
                  Descripción
                </span>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {detailProduct.descripcion}
                </p>
              </div>
            )}

            {/* Add to Cart Actions */}
            <div className="pt-4 border-t border-border flex items-center gap-3">
              <div className="flex items-center gap-1.5 border border-border rounded-lg p-1 bg-muted/30">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-md"
                  disabled={qty <= 1}
                  onClick={() => setQty((prev) => Math.max(1, prev - 1))}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="w-8 text-center text-xs font-bold">{qty}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-md"
                  disabled={!detailProduct.sin_control_stock && qty >= currentStock}
                  onClick={() => setQty((prev) => prev + 1)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              <Button
                type="button"
                disabled={!inStock}
                onClick={handleAdd}
                className="flex-1 h-11 text-xs sm:text-sm font-bold gap-2 shadow-xs"
              >
                <ShoppingCart className="h-4 w-4" />
                Agregar al Carrito • {formatMoney(currentPrice * qty)}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
