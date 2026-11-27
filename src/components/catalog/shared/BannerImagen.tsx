"use client";

import { useCatalog } from "@/components/catalog/CatalogContext";

/**
 * Banner promocional con imagen propia de la tienda (config.bannerImageUrl).
 * Reemplaza al banner de texto de la plantilla cuando hay una imagen cargada.
 * Al tocarlo muestra los productos en oferta y baja hasta el listado.
 */
export function BannerImagen() {
  const { config, negocio, setFiltroRapido } = useCatalog();
  if (!config.bannerImageUrl) return null;

  const irAOfertas = () => {
    setFiltroRapido("ofertas");
    document.querySelector("main")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="w-full bg-neutral-950">
      <button
        type="button"
        onClick={irAOfertas}
        className="block w-full max-w-3xl mx-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={config.bannerTitle || `Ver ofertas de ${negocio.nombre}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={config.bannerImageUrl}
          alt={config.bannerTitle || `Promoción de ${negocio.nombre}`}
          className="w-full h-auto max-h-[80vh] object-contain"
          loading="eager"
          fetchPriority="high"
        />
      </button>
    </section>
  );
}
