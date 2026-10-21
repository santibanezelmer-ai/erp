import type { ThemeId, ThemeMetadata, ThemeCustomConfig } from "@/types/theme.types";

export const THEMES_LIST: ThemeMetadata[] = [
  {
    id: "beauty",
    name: "Beauty Glow",
    tagline: "Elegancia editorial, moderna y sofisticada",
    description:
      "Diseñada especialmente para cosméticos, maquillaje, skincare, perfumería y moda. Estética refinada con banners tipo revista, tarjetas estilizadas y selector visual de tonos y variantes.",
    category: "belleza",
    compatibleRubros: ["Maquillaje", "Cosmética", "Skincare", "Peluquería", "Moda y Accesorios"],
    previewImage: "/themes/beauty-preview.jpg",
    version: "1.0.0",
    defaultConfig: {
      primaryColor: "#e11d48", // rose-600
      accentColor: "#f43f5e",
      backgroundColor: "#fff1f2",
      fontFamily: "sans",
      bannerTitle: "Realza Tu Esencia y Belleza",
      bannerSubtitle: "Descubre nuestra selección exclusiva en maquillaje, cuidado facial y fragancias。",
      bannerBadgeText: "✨ Colección Exclusiva",
      bannerButtonText: "Ver Ofertas Especiales",
      sectionsVisibility: {
        bannerHero: true,
        busquedaRapida: true,
        categoriasPills: true,
        ofertasDestacadas: true,
        novedades: true,
        marcasGrid: false,
        todosLosProductos: true,
      },
    },
  },
  {
    id: "autoparts",
    name: "AutoParts Pro",
    tagline: "Precisión técnica y alto rendimiento",
    description:
      "Estética técnica en paleta oscura de alto contraste. Ideal para repuestos automotrices, lubricantes, baterías, accesorios y talleres. Buscador prominente y filtro de marcas comerciales.",
    category: "automotriz",
    compatibleRubros: ["Repuestos", "Mecánica", "Lubricantes", "Baterías", "Motos y Autos"],
    previewImage: "/themes/autoparts-preview.jpg",
    version: "1.0.0",
    defaultConfig: {
      primaryColor: "#eab308", // amber-500
      accentColor: "#f59e0b",
      backgroundColor: "#09090b",
      fontFamily: "sans",
      bannerTitle: "Repuestos y Accesorios de Confianza",
      bannerSubtitle: "Calidad certificada para el óptimo rendimiento y seguridad de tu vehículo.",
      bannerBadgeText: "⚡ Despacho Rápido y Garantía",
      bannerButtonText: "Buscar Repuestos",
      sectionsVisibility: {
        bannerHero: true,
        busquedaRapida: true,
        categoriasPills: true,
        ofertasDestacadas: true,
        novedades: true,
        marcasGrid: true,
        todosLosProductos: true,
      },
    },
  },
  {
    id: "ferremax",
    name: "FerreMax",
    tagline: "Industrial, funcional y directo al grano",
    description:
      "Diseño optimizado para ferreterías, materiales de construcción, herramientas y pinturerías. Alta densidad de información, unidades de venta claras y stock visible para compras ágiles.",
    category: "ferreteria",
    compatibleRubros: ["Ferretería", "Construcción", "Herramientas", "Pinturas", "Electricidad y Gasfitería"],
    previewImage: "/themes/ferremax-preview.jpg",
    version: "1.0.0",
    defaultConfig: {
      primaryColor: "#2563eb", // blue-600
      accentColor: "#f97316", // orange-500
      backgroundColor: "#f8fafc",
      fontFamily: "sans",
      bannerTitle: "Todo Para Tu Obra y Proyecto",
      bannerSubtitle: "Herramientas profesionales, fijaciones y materiales al mejor precio por mayor y detalle.",
      bannerBadgeText: "🔨 Stock Permanente",
      bannerButtonText: "Explorar Catálogo",
      sectionsVisibility: {
        bannerHero: true,
        busquedaRapida: true,
        categoriasPills: true,
        ofertasDestacadas: true,
        novedades: false,
        marcasGrid: true,
        todosLosProductos: true,
      },
    },
  },
];

export function getThemeMetadata(themeId?: string | null): ThemeMetadata {
  const found = THEMES_LIST.find((t) => t.id === themeId);
  return found || THEMES_LIST[0]; // fallback a Beauty Glow
}
