import type { Database } from "@/types/database.types";
import type { ThemeId, ThemeCustomConfig, Marca } from "@/types/theme.types";
import { getThemeMetadata } from "@/components/catalog/themes/registry";
import type { PublicCatalog } from "@/lib/catalog-public.server";

type Negocio = Database["public"]["Tables"]["negocios"]["Row"];
type Producto = Database["public"]["Tables"]["productos"]["Row"];
type Variante = Database["public"]["Tables"]["producto_variantes"]["Row"];

export type CatalogView = {
  negocio: Negocio;
  productos: Producto[];
  variantes: Variante[];
  marcas: Marca[];
  themeId: ThemeId;
  themeConfig: ThemeCustomConfig;
};

/** Estado del catálogo que la página (servidor) entrega al cliente. */
export type CatalogInicial =
  | { estado: "ok"; data: PublicCatalog }
  | { estado: "not_found" | "inactive" | "error" };

/**
 * Convierte los datos públicos de la tienda en lo que necesitan las plantillas:
 * logo y teléfono combinados, plantilla por rubro y configuración con defaults.
 * Función pura: se usa igual en el servidor y en el navegador.
 */
export function armarCatalogo(
  data: PublicCatalog,
  opts: { isPreview?: boolean; previewTheme?: ThemeId | null } = {}
): CatalogView {
  const neg = data.negocio as unknown as Negocio;
  const cfg = data.config;

  const negocio = {
    ...neg,
    logo_url:
      cfg?.logo_url ||
      neg.logo_url ||
      (neg.perfil?.startsWith("http") || neg.perfil?.startsWith("data:") ? neg.perfil : null),
    ...(cfg?.telefono ? { telefono: cfg.telefono } : {}),
  } as Negocio;

  // Plantilla por defecto según rubro si la tienda no tiene una guardada
  let porRubro: ThemeId = "beauty";
  const tipo = (neg.tipo_negocio || "").toLowerCase();
  if (tipo.includes("auto") || tipo.includes("repuesto") || tipo.includes("mecanic")) {
    porRubro = "autoparts";
  } else if (tipo.includes("ferreter") || tipo.includes("construc") || tipo.includes("herramient")) {
    porRubro = "ferremax";
  }

  let themeId: ThemeId = (cfg?.plantilla_id as ThemeId) || porRubro;
  let config: ThemeCustomConfig = (cfg?.plantilla_config as ThemeCustomConfig) || {};

  if (opts.isPreview && cfg?.plantilla_draft) {
    config = { ...config, ...(cfg.plantilla_draft as ThemeCustomConfig) };
  }
  if (opts.previewTheme) {
    themeId = opts.previewTheme;
  }

  return {
    negocio,
    productos: data.productos as unknown as Producto[],
    variantes: data.variantes as unknown as Variante[],
    marcas: data.marcas as unknown as Marca[],
    themeId,
    themeConfig: { ...getThemeMetadata(themeId).defaultConfig, ...config },
  };
}
