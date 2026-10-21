import type { ReactNode } from "react";
import type { Database } from "@/types/database.types";

export type Negocio = Database["public"]["Tables"]["negocios"]["Row"];
export type Producto = Database["public"]["Tables"]["productos"]["Row"];
export type Variante = Database["public"]["Tables"]["producto_variantes"]["Row"];
export type Marca = { id: string; nombre: string; logo_url?: string | null };

export type ThemeId = "beauty" | "autoparts" | "ferremax";

export type ThemeCategory = "belleza" | "automotriz" | "ferreteria" | "general" | "retail";

export interface ThemeSectionsVisibility {
  bannerHero?: boolean;
  busquedaRapida?: boolean;
  categoriasPills?: boolean;
  ofertasDestacadas?: boolean;
  novedades?: boolean;
  marcasGrid?: boolean;
  todosLosProductos?: boolean;
}

export interface ThemeCustomConfig {
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  fontFamily?: "sans" | "serif" | "mono";
  bannerImageUrl?: string;
  bannerTitle?: string;
  bannerSubtitle?: string;
  bannerBadgeText?: string;
  bannerButtonText?: string;
  bannerButtonLink?: string;
  sectionsVisibility?: ThemeSectionsVisibility;
  sectionsOrder?: string[];
}

export interface ThemeMetadata {
  id: ThemeId;
  name: string;
  tagline: string;
  description: string;
  category: ThemeCategory;
  compatibleRubros: string[];
  previewImage: string;
  version: string;
  defaultConfig: ThemeCustomConfig;
}

export interface CartItem {
  key: string;
  producto: Producto;
  variante?: Variante | null;
  qty: number;
}

export interface CatalogContextValue {
  negocio: Negocio;
  config: ThemeCustomConfig;
  themeId: ThemeId;
  productos: Producto[];
  productosFiltrados: Producto[];
  variantes: Variante[];
  marcas: Marca[];
  categorias: string[];
  // Filtros
  busqueda: string;
  setBusqueda: (q: string) => void;
  categoriaSel: string;
  setCategoriaSel: (c: string) => void;
  marcaSel: string;
  setMarcaSel: (m: string) => void;
  filtroRapido: "todos" | "ofertas" | "nuevos" | "disponibles";
  setFiltroRapido: (f: "todos" | "ofertas" | "nuevos" | "disponibles") => void;
  ordenarPor: "destacados" | "precio_asc" | "precio_desc" | "nombre_asc" | "descuento";
  setOrdenarPor: (o: "destacados" | "precio_asc" | "precio_desc" | "nombre_asc" | "descuento") => void;
  limpiarFiltros: () => void;
  hayFiltrosActivos: boolean;
  // Métodos de Producto
  variantsOf: (prodId: string) => Variante[];
  marcaNombre: (marcaId?: string | null) => string | null;
  productHasPromo: (p: Producto) => boolean;
  productMaxDiscount: (p: Producto) => number;
  getUnitPrice: (p: Producto, v?: Variante | null) => number;
  getStock: (p: Producto, v?: Variante | null) => number;
  isDisponible: (p: Producto) => boolean;
  // Carrito
  cart: CartItem[];
  cartCount: number;
  cartTotal: number;
  addToCart: (prod: Producto, variante?: Variante | null, cantidad?: number) => void;
  updateQty: (key: string, delta: number) => void;
  openCart: () => void;
  closeCart: () => void;
  isCartOpen: boolean;
  // Ficha de Detalle
  openProductDetail: (prod: Producto) => void;
  detailProduct: Producto | null;
  closeProductDetail: () => void;
  // Selector Rápido de Variante
  pickVariantProduct: Producto | null;
  setPickVariantProduct: (p: Producto | null) => void;
  handleQuickAddClick: (e: React.MouseEvent, p: Producto) => void;
  // Vista y Paginación
  vistaModo: "cuadros" | "lista";
  setVistaModo: (v: "cuadros" | "lista") => void;
  pagina: number;
  setPagina: (p: number) => void;
  porPagina: number;
  setPorPagina: (n: number) => void;
  totalPaginas: number;
  productosPaginados: Producto[];
}

export interface ThemeProps {
  // Las plantillas consumen el contexto mediante el hook useCatalog(), pero pueden recibir props adicionales
  className?: string;
}
