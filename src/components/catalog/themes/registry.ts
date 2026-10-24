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
  {
    id: "food",
    name: "Bistro & Food",
    tagline: "Menú digital apetitoso, cálido y pensado para restaurantes",
    description:
      "Diseño gastronómico especializado para restaurantes, pizzerías, sushi, hamburgueserías, cafeterías y delivery. Destaca fotos de platos, ingredientes, categorías de carta y pedidos directos a WhatsApp.",
    category: "gastronomia",
    compatibleRubros: [
      "Restaurantes",
      "Pizzerías",
      "Comida Rápida",
      "Sushi",
      "Cafeterías",
      "Pastelerías",
      "Delivery y Dark Kitchen",
    ],
    previewImage: "/themes/food-preview.jpg",
    version: "1.0.0",
    defaultConfig: {
      primaryColor: "#ea580c", // orange-600
      accentColor: "#f59e0b", // amber-500
      backgroundColor: "#fffaf5",
      fontFamily: "sans",
      bannerTitle: "Nuestra Carta & Especialidades del Chef",
      bannerSubtitle:
        "Platos frescos elaborados al momento con los mejores ingredientes. Haz tu pedido a la mesa o a domicilio por WhatsApp.",
      bannerBadgeText: "🔥 Cocina Abierta & Delivery Activo",
      bannerButtonText: "Ver Carta Completa",
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
    id: "market",
    name: "Market Fresh",
    tagline: "Almacén de barrio, botillería y minimarket ágil",
    description:
      "Formato de compra rápida de alta densidad con selectores de cantidad en la misma tarjeta. Perfecto para abarrotes, minimarkets, botillerías, verdulerías y tiendas de conveniencia.",
    category: "almacen",
    compatibleRubros: [
      "Minimarkets",
      "Almacenes de Barrio",
      "Botillerías y Licores",
      "Frutas y Verduras",
      "Panaderías",
      "Abarrotes y Limpieza",
    ],
    previewImage: "/themes/market-preview.jpg",
    version: "1.0.0",
    defaultConfig: {
      primaryColor: "#16a34a", // emerald-600
      accentColor: "#059669", // teal-600
      backgroundColor: "#f8faf8",
      fontFamily: "sans",
      bannerTitle: "Tu Almacén & Minimarket de Confianza",
      bannerSubtitle:
        "Abarrotes, bebidas, lácteos, snacks y productos frescos para tu día a día. Pide directo y recibe en minutos.",
      bannerBadgeText: "🥬 Precios Bajos y Calidad Siempre",
      bannerButtonText: "Ver Productos",
      sectionsVisibility: {
        bannerHero: true,
        busquedaRapida: true,
        categoriasPills: true,
        ofertasDestacadas: true,
        novedades: false,
        marcasGrid: false,
        todosLosProductos: true,
      },
    },
  },
  {
    id: "fashion",
    name: "Moda & Boutique",
    tagline: "Editorial minimalista y lookbook de temporada",
    description:
      "Estética limpia y contemporánea inspirada en revistas de moda. Tarjetas en formato vertical 3:4, selector visual de tallas y colores, ideal para boutiques de vestuario y calzado.",
    category: "moda",
    compatibleRubros: [
      "Ropa y Vestuario",
      "Boutiques",
      "Calzado y Zapatillas",
      "Accesorios y Carteras",
      "Joyería",
    ],
    previewImage: "/themes/fashion-preview.jpg",
    version: "1.0.0",
    defaultConfig: {
      primaryColor: "#18181b", // zinc-900
      accentColor: "#d97706", // amber-600
      backgroundColor: "#fafaf9",
      fontFamily: "sans",
      bannerTitle: "Nueva Colección de Temporada",
      bannerSubtitle:
        "Prendas de diseño, calzado y accesorios exclusivos seleccionados para destacar tu estilo propio.",
      bannerBadgeText: "✨ New Arrivals • Edición Limitada",
      bannerButtonText: "Explorar Colección",
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
];

export function getThemeMetadata(themeId?: string | null): ThemeMetadata {
  const found = THEMES_LIST.find((t) => t.id === themeId);
  return found || THEMES_LIST[0]; // fallback a Beauty Glow
}
