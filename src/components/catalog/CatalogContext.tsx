"use client";

import React, { createContext, useContext, useState, useMemo, useEffect } from "react";
import type {
  CatalogContextValue,
  Negocio,
  Producto,
  Variante,
  Marca,
  CartItem,
  ThemeId,
  ThemeCustomConfig,
} from "@/types/theme.types";
import { isPromoActive, effectivePrice, promoDiscountPct } from "@/lib/promo";
import { formatMoney } from "@/lib/format";
import { toast } from "sonner";
import { CartModal } from "@/components/catalog/shared/CartModal";
import { ProductDetailModal } from "@/components/catalog/shared/ProductDetailModal";
import { QuickVariantModal } from "@/components/catalog/shared/QuickVariantModal";

const CatalogContext = createContext<CatalogContextValue | undefined>(undefined);

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) {
    throw new Error("useCatalog debe ser utilizado dentro de un CatalogProvider");
  }
  return context;
}

interface CatalogProviderProps {
  children: React.ReactNode;
  negocio: Negocio;
  productos: Producto[];
  variantes: Variante[];
  marcas: Marca[];
  themeId: ThemeId;
  config: ThemeCustomConfig;
}

export function CatalogProvider({
  children,
  negocio,
  productos,
  variantes,
  marcas,
  themeId,
  config,
}: CatalogProviderProps) {
  // Filtros y Búsqueda
  const [busqueda, setBusqueda] = useState("");
  const [categoriaSel, setCategoriaSel] = useState("todas");
  const [marcaSel, setMarcaSel] = useState("todas");
  const [filtroRapido, setFiltroRapido] = useState<"todos" | "ofertas" | "nuevos" | "disponibles">("todos");
  const [ordenarPor, setOrdenarPor] = useState<"destacados" | "precio_asc" | "precio_desc" | "nombre_asc" | "descuento">("destacados");

  // Vista (cuadros / lista) y Paginación
  const [vistaModo, setVistaModo] = useState<"cuadros" | "lista">("cuadros");
  const [pagina, setPaginaState] = useState<number>(1);
  const [porPagina, setPorPaginaState] = useState<number>(12);

  const setPagina = (p: number) => {
    setPaginaState(p);
    if (typeof window !== "undefined") {
      const el = document.getElementById("catalogo-productos-grid");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const setPorPagina = (n: number) => {
    setPorPaginaState(n);
    setPaginaState(1);
  };

  // Reset de página al cambiar cualquier filtro
  useEffect(() => {
    setPaginaState(1);
  }, [busqueda, categoriaSel, marcaSel, filtroRapido, ordenarPor]);

  // Carrito
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Ficha de Detalle
  const [detailProduct, setDetailProduct] = useState<Producto | null>(null);

  // Selector rápido de variante
  const [pickVariantProduct, setPickVariantProduct] = useState<Producto | null>(null);

  // Helper de variantes
  const variantsOf = (prodId: string): Variante[] => {
    return variantes.filter((v) => v.producto_id === prodId);
  };

  const marcaNombre = (marcaId?: string | null): string | null => {
    if (!marcaId) return null;
    return marcas.find((m) => m.id === marcaId)?.nombre || null;
  };

  const productHasPromo = (p: Producto): boolean => {
    return isPromoActive(p) || variantsOf(p.id).some((v) => isPromoActive(v));
  };

  const productMaxDiscount = (p: Producto): number => {
    const pcts = [
      promoDiscountPct(p),
      ...variantsOf(p.id).map((v) => promoDiscountPct(v)),
    ];
    return Math.max(0, ...pcts);
  };

  const getUnitPrice = (p: Producto, v?: Variante | null): number => {
    if (v) {
      return effectivePrice(v.precio_promocional != null ? v : p);
    }
    return effectivePrice(p);
  };

  const getStock = (p: Producto, v?: Variante | null): number => {
    if (p.sin_control_stock) return Infinity;
    if (v) return Number(v.stock || 0);
    const vs = variantsOf(p.id);
    if (vs.length > 0) return vs.reduce((acc, curr) => acc + Number(curr.stock || 0), 0);
    return Number(p.stock || 0);
  };

  const isDisponible = (p: Producto): boolean => {
    if (p.sin_control_stock) return true;
    return getStock(p) > 0;
  };

  // Categorías presentes
  const categorias = useMemo(() => {
    return [
      "todas",
      ...Array.from(new Set(productos.map((p) => p.categoria).filter(Boolean) as string[])),
    ];
  }, [productos]);

  // Filtrado y Ordenamiento
  const productosFiltrados = useMemo(() => {
    const res = productos.filter((p) => {
      // 1. Busqueda por texto
      const q = busqueda.toLowerCase().trim();
      if (q) {
        const matchNombre = p.nombre.toLowerCase().includes(q);
        const matchCat = p.categoria && p.categoria.toLowerCase().includes(q);
        const matchDesc = p.descripcion && p.descripcion.toLowerCase().includes(q);
        const matchMarca = p.marca_id && marcaNombre(p.marca_id)?.toLowerCase().includes(q);
        const matchCodigo = p.codigo && p.codigo.toLowerCase().includes(q);
        const matchVar = variantsOf(p.id).some((v) => v.nombre.toLowerCase().includes(q));
        if (!matchNombre && !matchCat && !matchDesc && !matchMarca && !matchCodigo && !matchVar) {
          return false;
        }
      }

      // 2. Filtro Categoría
      if (categoriaSel !== "todas" && p.categoria !== categoriaSel) {
        return false;
      }

      // 3. Filtro Marca
      if (marcaSel !== "todas" && p.marca_id !== marcaSel) {
        return false;
      }

      // 4. Filtro rápido
      if (filtroRapido === "ofertas" && !productHasPromo(p)) return false;
      if (filtroRapido === "nuevos" && !p.is_new_arrival) return false;
      if (filtroRapido === "disponibles" && !isDisponible(p)) return false;

      return true;
    });

    // Ordenar
    res.sort((a, b) => {
      const dispA = isDisponible(a) ? 1 : 0;
      const dispB = isDisponible(b) ? 1 : 0;

      if (ordenarPor === "precio_asc") {
        return getUnitPrice(a) - getUnitPrice(b);
      }
      if (ordenarPor === "precio_desc") {
        return getUnitPrice(b) - getUnitPrice(a);
      }
      if (ordenarPor === "nombre_asc") {
        return a.nombre.localeCompare(b.nombre);
      }
      if (ordenarPor === "descuento") {
        return productMaxDiscount(b) - productMaxDiscount(a);
      }

      // Por defecto "destacados": disponibles primero, luego ofertas
      if (dispA !== dispB) return dispB - dispA;
      const promoA = productHasPromo(a) ? 1 : 0;
      const promoB = productHasPromo(b) ? 1 : 0;
      if (promoA !== promoB) return promoB - promoA;

      return 0;
    });

    return res;
  }, [productos, busqueda, categoriaSel, marcaSel, filtroRapido, ordenarPor, marcas, variantes]);

  // Paginación y corte de productos
  const totalPaginas = Math.max(1, Math.ceil(productosFiltrados.length / porPagina));
  const productosPaginados = useMemo(() => {
    const start = (pagina - 1) * porPagina;
    return productosFiltrados.slice(start, start + porPagina);
  }, [productosFiltrados, pagina, porPagina]);

  const hayFiltrosActivos =
    busqueda.trim() !== "" ||
    categoriaSel !== "todas" ||
    marcaSel !== "todas" ||
    filtroRapido !== "todos" ||
    ordenarPor !== "destacados";

  const limpiarFiltros = () => {
    setBusqueda("");
    setCategoriaSel("todas");
    setMarcaSel("todas");
    setFiltroRapido("todos");
    setOrdenarPor("destacados");
  };

  // Carrito actions
  const addToCart = (prod: Producto, variante?: Variante | null, cantidad = 1) => {
    const key = variante ? `${prod.id}:${variante.id}` : prod.id;
    const maxStock = getStock(prod, variante);

    setCart((prev) => {
      const existing = prev.find((i) => i.key === key);
      const currentQty = existing ? existing.qty : 0;
      const targetQty = currentQty + cantidad;

      if (!prod.sin_control_stock && targetQty > maxStock) {
        toast.error(`Stock máximo disponible alcanzado (${maxStock} u.)`);
        return prev;
      }

      if (existing) {
        return prev.map((i) =>
          i.key === key ? { ...i, qty: i.qty + cantidad } : i
        );
      }

      return [
        ...prev,
        {
          key,
          producto: prod,
          variante: variante || null,
          qty: cantidad,
        },
      ];
    });

    const itemLabel = variante ? `${prod.nombre} (${variante.nombre})` : prod.nombre;
    toast.success(`Añadido: ${cantidad > 1 ? `${cantidad}× ` : ""}${itemLabel}`);
  };

  const updateQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.key === key) {
            const next = i.qty + delta;
            const maxStock = getStock(i.producto, i.variante);
            if (delta > 0 && !i.producto.sin_control_stock && next > maxStock) {
              toast.error("No hay más unidades disponibles");
              return i;
            }
            return next > 0 ? { ...i, qty: next } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const cartCount = cart.reduce((acc, i) => acc + i.qty, 0);
  const cartTotal = cart.reduce(
    (acc, i) => acc + i.qty * getUnitPrice(i.producto, i.variante),
    0
  );

  const handleQuickAddClick = (e: React.MouseEvent, prod: Producto) => {
    e.stopPropagation();
    const vs = variantsOf(prod.id);
    if (vs.length > 0) {
      setPickVariantProduct(prod);
    } else {
      addToCart(prod);
    }
  };

  const value: CatalogContextValue = {
    negocio,
    config,
    themeId,
    productos,
    productosFiltrados,
    variantes,
    marcas,
    categorias,
    busqueda,
    setBusqueda,
    categoriaSel,
    setCategoriaSel,
    marcaSel,
    setMarcaSel,
    filtroRapido,
    setFiltroRapido,
    ordenarPor,
    setOrdenarPor,
    limpiarFiltros,
    hayFiltrosActivos,
    variantsOf,
    marcaNombre,
    productHasPromo,
    productMaxDiscount,
    getUnitPrice,
    getStock,
    isDisponible,
    cart,
    cartCount,
    cartTotal,
    addToCart,
    updateQty,
    openCart: () => setIsCartOpen(true),
    closeCart: () => setIsCartOpen(false),
    isCartOpen,
    openProductDetail: (p: Producto) => setDetailProduct(p),
    detailProduct,
    closeProductDetail: () => setDetailProduct(null),
    pickVariantProduct,
    setPickVariantProduct,
    handleQuickAddClick,
    vistaModo,
    setVistaModo,
    pagina,
    setPagina,
    porPagina,
    setPorPagina,
    totalPaginas,
    productosPaginados,
  };

  return (
    <CatalogContext.Provider value={value}>
      {children}
      <CartModal />
      <ProductDetailModal />
      <QuickVariantModal />
    </CatalogContext.Provider>
  );
}
