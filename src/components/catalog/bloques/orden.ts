import type { ThemeCustomConfig } from "@/types/theme.types";

/** Bloques centrales que la tienda puede ordenar y mostrar u ocultar. */
export const BLOQUES = [
  { id: "hero", etiqueta: "Banner principal", descripcion: "Imagen o texto de bienvenida de la plantilla" },
  { id: "ofertas", etiqueta: "Ofertas destacadas", descripcion: "Carrusel con los productos en promoción" },
  { id: "novedades", etiqueta: "Novedades", descripcion: "Carrusel con los productos marcados como nuevos" },
  { id: "catalogo", etiqueta: "Catálogo de productos", descripcion: "Categorías, filtros y todos los productos" },
  { id: "marcas", etiqueta: "Nuestras marcas", descripcion: "Logos de las marcas; al tocar una filtra el catálogo" },
  { id: "info", etiqueta: "Información de la tienda", descripcion: "Dirección, horario, mapa y WhatsApp" },
] as const;

export type BloqueId = (typeof BLOQUES)[number]["id"];

/** Orden por defecto = el aspecto de siempre (banner y luego catálogo). */
export const ORDEN_POR_DEFECTO: BloqueId[] = ["hero", "ofertas", "novedades", "catalogo", "marcas", "info"];

const IDS = new Set<string>(BLOQUES.map((b) => b.id));

/** Orden guardado, limpiando ids desconocidos y agregando al final los que falten. */
export function ordenBloques(config: ThemeCustomConfig): BloqueId[] {
  const guardado = (config.sectionsOrder || []).filter((id): id is BloqueId => IDS.has(id));
  const unicos = Array.from(new Set(guardado));
  for (const id of ORDEN_POR_DEFECTO) if (!unicos.includes(id)) unicos.push(id);
  return unicos;
}

/**
 * Si un bloque está visible. El banner y el catálogo vienen visibles (como
 * siempre); los bloques nuevos quedan ocultos hasta que la tienda los active.
 */
export function bloqueVisible(config: ThemeCustomConfig, id: BloqueId): boolean {
  switch (id) {
    case "hero":
      return config.sectionsVisibility?.bannerHero !== false;
    case "catalogo":
      return true; // el catálogo siempre se muestra (solo se puede mover)
    default:
      return config.bloques?.[id] === true;
  }
}

/** Botón flotante de WhatsApp: activo por defecto (se oculta si la tienda no tiene teléfono). */
export function whatsappFlotanteVisible(config: ThemeCustomConfig): boolean {
  return config.bloques?.whatsappFlotante !== false;
}

/** Lleva la vista al catálogo (usado por los bloques al filtrar). */
export function irAlCatalogo() {
  document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
