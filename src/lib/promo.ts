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
