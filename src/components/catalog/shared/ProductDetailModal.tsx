"use client";

import Link from "next/link";
import { useCatalog } from "@/components/catalog/CatalogContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ExternalLink } from "lucide-react";
import { DetalleProducto } from "./DetalleProducto";

/** Detalle rápido del producto en un diálogo, sin salir del catálogo. */
export function ProductDetailModal() {
  const { detailProduct, closeProductDetail, negocio, productoPaginaId } = useCatalog();
  // En la página propia del producto el detalle ya está en pantalla
  if (!detailProduct || productoPaginaId === detailProduct.id) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && closeProductDetail()}>
      <DialogContent className="max-w-md sm:max-w-2xl md:max-w-3xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="sr-only">
          <DialogTitle>{detailProduct.nombre}</DialogTitle>
          <DialogDescription>{detailProduct.descripcion || `Detalle y compra de ${detailProduct.nombre}`}</DialogDescription>
        </DialogHeader>
        <DetalleProducto key={detailProduct.id} producto={detailProduct} modo="modal" onAgregado={closeProductDetail} />
        <Link
          href={`/c/${negocio.slug}/p/${detailProduct.id}`}
          className="mt-1 inline-flex items-center justify-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3" />
          Ver página del producto
        </Link>
      </DialogContent>
    </Dialog>
  );
}
