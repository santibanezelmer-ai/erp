export type PromoFields = {
  precio_venta: number | null | undefined;
  precio_promocional?: number | null;
  promo_vence_at?: string | null;
};

export const isPromoActive = (p: PromoFields | null | undefined): boolean => {
  if (!p) return false;
  const promo = Number(p.precio_promocional || 0);
  const base = Number(p.precio_venta || 0);
  if (promo <= 0 || promo >= base) return false;
  if (p.promo_vence_at && new Date(p.promo_vence_at).getTime() <= Date.now()) return false;
  return true;
};

export const effectivePrice = (p: PromoFields | null | undefined): number => {
  if (!p) return 0;
  return isPromoActive(p) ? Number(p.precio_promocional || 0) : Number(p.precio_venta || 0);
};

export const promoDiscountPct = (p: PromoFields | null | undefined): number => {
  if (!isPromoActive(p)) return 0;
  const base = Number(p!.precio_venta || 0);
  const promo = Number(p!.precio_promocional || 0);
  if (base <= 0) return 0;
  return Math.round(((base - promo) / base) * 100);
};

type ConPrecio = PromoFields & { precio_venta: number | null | undefined };

/**
 * Precio unitario real de un producto o de una de sus variantes, con la misma
 * regla en catálogo, caja (POS), comandas y crear_pedido_catalogo:
 * - la promoción sólo vale si es > 0, menor al precio base y no ha vencido;
 * - la variante usa su promoción o su precio propio; si no tiene, hereda el
 *   precio (y la promoción) del producto.
 */
export const precioUnitario = (p: ConPrecio, v?: ConPrecio | null): number => {
  if (v) {
    const base = v.precio_venta ?? p.precio_venta;
    if (v.precio_promocional != null) {
      return effectivePrice({
        precio_venta: base,
        precio_promocional: v.precio_promocional,
        promo_vence_at: v.promo_vence_at,
      });
    }
    if (v.precio_venta != null) return Number(v.precio_venta);
  }
  return effectivePrice(p);
};
