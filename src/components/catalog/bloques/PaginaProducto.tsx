"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useCatalog } from "@/components/catalog/CatalogContext";
import { DetalleProducto } from "@/components/catalog/shared/DetalleProducto";
import { etiquetaCategoria } from "@/lib/categorias";
import type { Producto } from "@/types/theme.types";
import { ChevronLeft, LayoutGrid } from "lucide-react";
import { Carrusel } from "./BloqueCarrusel";

/** Página propia de un producto: migas, detalle completo y productos relacionados. */
export function PaginaProducto() {
  const { productos, productoPaginaId, negocio, isDisponible } = useCatalog();
  const producto = productos.find((p) => p.id === productoPaginaId);

  const relacionados = useMemo(() => {
    if (!producto) return [];
    const mismaCat = (p: Producto) =>
      p.id !== producto.id && isDisponible(p) && !!producto.categoria && p.categoria === producto.categoria;
    const mismaMarca = (p: Producto) =>
      p.id !== producto.id && isDisponible(p) && !!producto.marca_id && p.marca_id === producto.marca_id;
    const lista = [...productos.filter(mismaCat), ...productos.filter((p) => !mismaCat(p) && mismaMarca(p))];
    return lista.slice(0, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productos, producto?.id]);

  const inicio = `/c/${negocio.slug}`;

  if (!producto) {
    return (
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-16 text-center space-y-3">
        <h1 className="text-xl font-bold">Producto no disponible</h1>
        <p className="text-sm text-muted-foreground">Este producto ya no está en el catálogo.</p>
        <Link href={inicio} className="inline-flex items-center gap-1 text-sm font-semibold text-(color:--tp-700) hover:underline">
          <LayoutGrid className="h-4 w-4" /> Ver todos los productos
        </Link>
      </main>
    );
  }

  return (
    <main className="flex-1 w-full">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <nav aria-label="Migas de pan" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link href={inicio} className="inline-flex items-center gap-1 font-semibold hover:text-foreground">
            <ChevronLeft className="h-3.5 w-3.5" />
            {negocio.nombre}
          </Link>
          {producto.categoria && (
            <>
              <span>/</span>
              <span>{etiquetaCategoria(producto.categoria)}</span>
            </>
          )}
        </nav>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <DetalleProducto key={producto.id} producto={producto} modo="pagina" />
        </div>
      </div>

      {relacionados.length > 0 && (
        <div className="pb-8">
          <Carrusel titulo="También te puede interesar" icono={<LayoutGrid className="h-5 w-5" />} productos={relacionados} />
        </div>
      )}
    </main>
  );
}
