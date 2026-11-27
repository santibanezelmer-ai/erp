"use client";

import { useEffect, useRef, useState } from "react";
import { useCatalog } from "@/components/catalog/CatalogContext";
import { irAlCatalogo } from "@/components/catalog/bloques/orden";
import type { ThemeCustomConfig } from "@/types/theme.types";

type Banner = { imagen: string; imagenMovil?: string };

/** Banners con imagen de la tienda (lista nueva o, si no hay, la imagen única antigua). */
export function bannersDe(config: ThemeCustomConfig): Banner[] {
  const lista = (config.banners || []).filter((b) => b?.imagen);
  if (lista.length > 0) return lista;
  return config.bannerImageUrl ? [{ imagen: config.bannerImageUrl }] : [];
}

export function tieneBannerImagen(config: ThemeCustomConfig): boolean {
  return bannersDe(config).length > 0;
}

const INTERVALO_MS = 5000;

/**
 * Banner promocional con imágenes propias de la tienda. Con varias imágenes se
 * muestra como carrusel (avance automático, puntos y deslizamiento). Cada
 * banner puede tener una versión para celular. Al tocarlo muestra las ofertas.
 */
export function BannerImagen() {
  const { config, negocio, setFiltroRapido } = useCatalog();
  const banners = bannersDe(config);
  const pista = useRef<HTMLDivElement>(null);
  const [actual, setActual] = useState(0);
  const [pausa, setPausa] = useState(false);

  // Sincroniza el punto activo con el desplazamiento (también al deslizar con el dedo)
  useEffect(() => {
    const el = pista.current;
    if (!el) return;
    const onScroll = () => setActual(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Avance automático (se pausa con el mouse encima o al tocar)
  useEffect(() => {
    if (banners.length < 2 || pausa) return;
    const t = setInterval(() => {
      const el = pista.current;
      if (!el) return;
      const sig = (Math.round(el.scrollLeft / el.clientWidth) + 1) % banners.length;
      el.scrollTo({ left: sig * el.clientWidth, behavior: "smooth" });
    }, INTERVALO_MS);
    return () => clearInterval(t);
  }, [banners.length, pausa]);

  if (banners.length === 0) return null;

  const irAOfertas = () => {
    setFiltroRapido("ofertas");
    irAlCatalogo();
  };
  const irA = (i: number) => pista.current?.scrollTo({ left: i * pista.current.clientWidth, behavior: "smooth" });
  const alt = config.bannerTitle || `Promoción de ${negocio.nombre}`;

  return (
    <section
      className="relative w-full bg-neutral-950"
      onMouseEnter={() => setPausa(true)}
      onMouseLeave={() => setPausa(false)}
      onTouchStart={() => setPausa(true)}
    >
      <div
        ref={pista}
        className="flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {banners.map((b, i) => (
          <button
            key={`${b.imagen}-${i}`}
            type="button"
            onClick={irAOfertas}
            className="snap-start shrink-0 w-full flex justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={`${alt} (${i + 1} de ${banners.length})`}
          >
            <picture className="block w-full max-w-3xl">
              {b.imagenMovil && <source media="(max-width: 640px)" srcSet={b.imagenMovil} />}
              <img
                src={b.imagen}
                alt={alt}
                className="w-full h-auto max-h-[80vh] object-contain"
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "low"}
                decoding="async"
              />
            </picture>
          </button>
        ))}
      </div>

      {banners.length > 1 && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
          {banners.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Ver banner ${i + 1}`}
              onClick={() => irA(i)}
              className={`h-2 rounded-full transition-all ${
                i === actual ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
