"use client";

import type { ReactNode } from "react";
import { useCatalog } from "@/components/catalog/CatalogContext";
import { bloqueVisible, ordenBloques, whatsappFlotanteVisible, type BloqueId } from "./orden";
import { BloqueOfertas, BloqueNovedades } from "./BloqueCarrusel";
import { BloqueMarcas } from "./BloqueMarcas";
import { BloqueInfo } from "./BloqueInfo";
import { WhatsAppFlotante } from "./WhatsAppFlotante";

interface Props {
  /** Clases del contenedor raíz de la plantilla (fondo, color de texto, fuente) */
  className: string;
  /** Barra superior + cabecera de la plantilla */
  cabecera: ReactNode;
  /** Banner principal de la plantilla */
  hero: ReactNode;
  /** Categorías, filtros, grilla y paginación de la plantilla */
  catalogo: ReactNode;
  /** Pie de página de la plantilla */
  pie: ReactNode;
}

/**
 * Arma la página de la tienda: la plantilla aporta su cabecera, banner,
 * catálogo y pie con su diseño propio; los bloques centrales se muestran en el
 * orden que eligió la tienda, junto con los bloques compartidos (ofertas,
 * novedades, marcas, información) disponibles en todas las plantillas.
 */
export function ComposicionTienda({ className, cabecera, hero, catalogo, pie }: Props) {
  const { config } = useCatalog();

  const render = (id: BloqueId): ReactNode => {
    if (!bloqueVisible(config, id)) return null;
    switch (id) {
      case "hero":
        return hero;
      case "catalogo":
        return (
          <div id="catalogo" className="flex-1 flex flex-col scroll-mt-20">
            {catalogo}
          </div>
        );
      case "ofertas":
        return <BloqueOfertas />;
      case "novedades":
        return <BloqueNovedades />;
      case "marcas":
        return <BloqueMarcas />;
      case "info":
        return <BloqueInfo />;
    }
  };

  return (
    <div className={className}>
      {cabecera}
      {ordenBloques(config).map((id) => {
        const contenido = render(id);
        return contenido ? <div key={id} className="contents">{contenido}</div> : null;
      })}
      {pie}
      {whatsappFlotanteVisible(config) && <WhatsAppFlotante />}
    </div>
  );
}
