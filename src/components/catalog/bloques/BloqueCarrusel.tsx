"use client";

import { useMemo, useRef } from "react";
import { useCatalog } from "@/components/catalog/CatalogContext";
import { formatMoney } from "@/lib/format";
import type { Producto } from "@/types/theme.types";
import { ChevronLeft, ChevronRight, Flame, Package, Sparkles, Tag } from "lucide-react";
import { irAlCatalogo } from "./orden";

const MAX = 12;

function Carrusel({
  titulo,
  icono,
  productos,
  verTodo,
}: {
  titulo: string;
  icono: React.ReactNode;
  productos: Producto[];
  verTodo: () => void;
}) {
  const { openProductDetail, getUnitPrice, productMaxDiscount } = useCatalog();
  const pista = useRef<HTMLDivElement>(null);
  if (productos.length === 0) return null;

  const mover = (dir: 1 | -1) =>
    pista.current?.scrollBy({ left: dir * pista.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-8">
      <div className="flex items-end justify-between gap-3 mb-3">
        <h2 className="flex items-center gap-2 text-lg sm:text-xl font-bold tracking-tight">
          <span className="text-(color:--tp-600)">{icono}</span>
          {titulo}
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={verTodo}
            className="text-xs font-semibold text-(color:--tp-700) hover:underline mr-1"
          >
            Ver todo
          </button>
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => mover(-1)}
            className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full border border-black/10 dark:border-white/15 hover:bg-(color:--tp-50) dark:hover:bg-white/5"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Siguiente"
            onClick={() => mover(1)}
            className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full border border-black/10 dark:border-white/15 hover:bg-(color:--tp-50) dark:hover:bg-white/5"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={pista}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {productos.map((p) => {
          const precio = getUnitPrice(p);
          const base = Number(p.precio_venta || 0);
          const desc = productMaxDiscount(p);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => openProductDetail(p)}
              className="snap-start shrink-0 w-[44%] sm:w-[23%] lg:w-[18%] text-left rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-neutral-900 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="relative aspect-square bg-(color:--tp-50) dark:bg-neutral-800 flex items-center justify-center">
                {p.imagen_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imagen_url} alt={p.nombre} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-8 w-8 text-(color:--tp-300)" />
                )}
                {desc > 0 && (
                  <span className="absolute top-2 left-2 rounded-full bg-(color:--tp-600) text-(color:--tp-on) text-[10px] font-bold px-2 py-0.5">
                    -{desc}%
                  </span>
                )}
              </div>
              <div className="p-2.5 space-y-0.5">
                <div className="text-xs font-semibold line-clamp-2 min-h-[2rem]">{p.nombre}</div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-bold text-(color:--tp-700) dark:text-(color:--tp-400)">
                    {formatMoney(precio)}
                  </span>
                  {precio < base && (
                    <span className="text-[10px] text-neutral-400 line-through">{formatMoney(base)}</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function BloqueOfertas() {
  const { productos, productHasPromo, isDisponible, productMaxDiscount, setFiltroRapido } = useCatalog();
  const lista = useMemo(
    () =>
      productos
        .filter((p) => productHasPromo(p) && isDisponible(p))
        .sort((a, b) => productMaxDiscount(b) - productMaxDiscount(a))
        .slice(0, MAX),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [productos]
  );
  return (
    <Carrusel
      titulo="Ofertas destacadas"
      icono={<Tag className="h-5 w-5" />}
      productos={lista}
      verTodo={() => {
        setFiltroRapido("ofertas");
        irAlCatalogo();
      }}
    />
  );
}

export function BloqueNovedades() {
  const { productos, isDisponible, setFiltroRapido } = useCatalog();
  const lista = useMemo(
    () => productos.filter((p) => p.is_new_arrival && isDisponible(p)).slice(0, MAX),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [productos]
  );
  return (
    <Carrusel
      titulo="Novedades"
      icono={<Sparkles className="h-5 w-5" />}
      productos={lista}
      verTodo={() => {
        setFiltroRapido("nuevos");
        irAlCatalogo();
      }}
    />
  );
}

export function BloqueMasVendidos() {
  const { productos, masVendidos, isDisponible, limpiarFiltros } = useCatalog();
  const lista = useMemo(() => {
    const porId = new Map(productos.map((p) => [p.id, p]));
    return masVendidos
      .map((id) => porId.get(id))
      .filter((p): p is Producto => !!p && isDisponible(p))
      .slice(0, MAX);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productos, masVendidos]);
  return (
    <Carrusel
      titulo="Más vendidos"
      icono={<Flame className="h-5 w-5" />}
      productos={lista}
      verTodo={() => {
        limpiarFiltros();
        irAlCatalogo();
      }}
    />
  );
}
