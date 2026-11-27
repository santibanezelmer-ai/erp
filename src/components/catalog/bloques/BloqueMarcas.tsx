"use client";

import { useCatalog } from "@/components/catalog/CatalogContext";
import { irAlCatalogo } from "./orden";

export function BloqueMarcas() {
  const { marcas, productos, setMarcaSel } = useCatalog();
  // Solo marcas con productos en la tienda
  const conProductos = new Set(productos.map((p) => p.marca_id).filter(Boolean));
  const lista = marcas.filter((m) => conProductos.has(m.id));
  if (lista.length === 0) return null;

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-10">
      <h2 className="text-lg sm:text-xl font-bold tracking-tight mb-3">Nuestras marcas</h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {lista.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              setMarcaSel(m.id);
              irAlCatalogo();
            }}
            className="aspect-[3/2] rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-neutral-900 flex items-center justify-center p-3 hover:border-(color:--tp-300) hover:shadow-sm transition-all"
            title={`Ver productos de ${m.nombre}`}
          >
            {m.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.logo_url} alt={m.nombre} loading="lazy" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-xs font-bold text-center text-neutral-600 dark:text-neutral-300">{m.nombre}</span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
