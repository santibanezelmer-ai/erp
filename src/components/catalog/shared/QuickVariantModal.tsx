"use client";

import { useCatalog } from "@/components/catalog/CatalogContext";
import { formatMoney } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";

export function QuickVariantModal() {
  const {
    pickVariantProduct,
    setPickVariantProduct,
    variantsOf,
    addToCart,
    getStock,
    getUnitPrice,
  } = useCatalog();

  if (!pickVariantProduct) return null;

  const variants = variantsOf(pickVariantProduct.id);

  return (
    <Dialog open={!!pickVariantProduct} onOpenChange={(open) => !open && setPickVariantProduct(null)}>
      <DialogContent className="max-w-md p-5">
        <DialogHeader className="pb-3 border-b border-border">
          <DialogTitle className="text-base font-bold">
            Selecciona una opción
          </DialogTitle>
          <DialogDescription className="text-xs">
            {pickVariantProduct.nombre} está disponible en las siguientes opciones:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-3 max-h-60 overflow-y-auto">
          {variants.map((v) => {
            const vStock = getStock(pickVariantProduct, v);
            const isOut = !pickVariantProduct.sin_control_stock && vStock <= 0;
            const price = getUnitPrice(pickVariantProduct, v);

            return (
              <div
                key={v.id}
                className="flex items-center justify-between p-3 rounded-xl border border-border bg-card/70 hover:bg-muted/40 transition-colors"
              >
                <div>
                  <div className="font-semibold text-xs sm:text-sm text-foreground">
                    {v.nombre}
                  </div>
                  <div className="text-xs text-primary font-bold mt-0.5">
                    {formatMoney(price)}
                    {!pickVariantProduct.sin_control_stock && (
                      <span className="text-[10px] text-muted-foreground font-normal ml-2">
                        ({vStock} disp.)
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  size="sm"
                  disabled={isOut}
                  onClick={() => {
                    addToCart(pickVariantProduct, v, 1);
                    setPickVariantProduct(null);
                  }}
                  className="gap-1.5 text-xs h-8"
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Agregar
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
