"use client";

import { useCatalog } from "@/components/catalog/CatalogContext";
import { formatMoney } from "@/lib/format";
import { CatalogPagination } from "@/components/catalog/shared/CatalogPagination";
import { CatalogViewToggle } from "@/components/catalog/shared/CatalogViewToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Search,
  ShoppingCart,
  Phone,
  MapPin,
  X,
  Package,
  Layers,
  Store,
  ChevronRight,
  ArrowRight,
  Heart,
} from "lucide-react";

export function FashionChicTheme() {
  const {
    negocio,
    config,
    productosFiltrados,
    productosPaginados,
    vistaModo,
    categorias,
    categoriaSel,
    setCategoriaSel,
    busqueda,
    setBusqueda,
    filtroRapido,
    setFiltroRapido,
    ordenarPor,
    setOrdenarPor,
    limpiarFiltros,
    hayFiltrosActivos,
    openCart,
    cartCount,
    openProductDetail,
    handleQuickAddClick,
    getUnitPrice,
    productHasPromo,
    productMaxDiscount,
    isDisponible,
    variantsOf,
  } = useCatalog();

  const primaryCol = config.primaryColor || "#18181b"; // zinc-900 minimalista
  const bannerVisible = config.sectionsVisibility?.bannerHero !== false;
  const categoriesVisible = config.sectionsVisibility?.categoriasPills !== false;

  const rawLogo =
    negocio.logo_url ||
    (negocio.perfil?.startsWith("http") ? negocio.perfil : null);

  const bannerTitle = config.bannerTitle || "Nueva Colección de Temporada";
  const bannerSubtitle =
    config.bannerSubtitle ||
    "Prendas de diseño, calzado y accesorios exclusivos seleccionados para destacar tu estilo propio.";
  const bannerBadge = config.bannerBadgeText || "✨ New Arrivals • Edición Limitada";

  return (
    <div className="min-h-screen flex flex-col bg-[#fafaf9] dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-sans">
      {/* Top Bar Minimal */}
      <div className="bg-neutral-900 text-neutral-200 text-[11px] py-1.5 px-4 text-center font-medium tracking-widest uppercase">
        Envíos a todo el país • Atención y consultas por WhatsApp
      </div>

      {/* Header Boutique */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {rawLogo ? (
              <img
                src={rawLogo}
                alt={negocio.nombre}
                className="h-11 w-11 sm:h-12 sm:w-12 rounded-full object-cover border border-neutral-300 shadow-2xs shrink-0"
              />
            ) : (
              <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-neutral-900 text-white flex items-center justify-center shrink-0">
                <Store className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-serif font-black text-xl sm:text-2xl text-neutral-900 dark:text-white truncate tracking-tight">
                {negocio.nombre}
              </h1>
              {negocio.direccion && (
                <div className="text-[11px] text-neutral-500 truncate flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>{negocio.direccion}</span>
                </div>
              )}
            </div>
          </div>

          {/* Buscador Desktop */}
          <div className="hidden md:flex flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <Input
                type="text"
                placeholder="Buscar vestidos, chaquetas, pantalones, zapatos..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-10 h-10 rounded-full border-neutral-300 bg-neutral-50 text-xs focus-visible:ring-neutral-900"
              />
              {busqueda && (
                <button
                  onClick={() => setBusqueda("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Bolsa de Compras */}
          <Button
            onClick={openCart}
            className="rounded-full h-10 px-5 bg-neutral-900 hover:bg-neutral-800 text-white flex items-center gap-2 text-xs font-semibold shrink-0"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Bolsa</span>
            <span className="bg-white text-neutral-900 rounded-full text-[10px] font-black px-1.5 py-0.2">
              {cartCount}
            </span>
          </Button>
        </div>

        {/* Buscador Móvil */}
        <div className="md:hidden px-4 pb-3 pt-1 border-t border-neutral-100 dark:border-neutral-800">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              type="text"
              placeholder="Buscar prendas o accesorios..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9 h-10 rounded-full border-neutral-200 bg-neutral-50 text-xs"
            />
          </div>
        </div>
      </header>

      {/* Hero Editorial */}
      {bannerVisible && (
        <section className="bg-neutral-100 dark:bg-neutral-900 py-12 sm:py-16 px-4 sm:px-6 border-b border-neutral-200 dark:border-neutral-800">
          <div className="max-w-4xl mx-auto text-center space-y-3">
            <span className="text-[11px] font-bold tracking-widest uppercase text-neutral-500">
              {bannerBadge}
            </span>
            <h2 className="font-serif text-3xl sm:text-5xl font-black tracking-tight text-neutral-900 dark:text-white">
              {bannerTitle}
            </h2>
            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 max-w-xl mx-auto leading-relaxed">
              {bannerSubtitle}
            </p>
          </div>
        </section>
      )}

      {/* Categorías */}
      {categoriesVisible && categorias.length > 0 && (
        <div className="sticky top-20 z-20 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 py-3 px-4">
          <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto scrollbar-none justify-start sm:justify-center">
            <button
              onClick={() => setCategoriaSel("todas")}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                categoriaSel === "todas"
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs"
                  : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              Colección Completa
            </button>
            {categorias.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoriaSel(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                  categoriaSel === cat
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs"
                    : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Contenido Principal de Prendas */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-500">
              {productosFiltrados.length} piezas encontradas
            </span>
            {hayFiltrosActivos && (
              <button
                onClick={limpiarFiltros}
                className="text-xs text-neutral-900 dark:text-neutral-100 underline font-semibold ml-2"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <select
              value={ordenarPor}
              onChange={(e) => setOrdenarPor(e.target.value as any)}
              className="text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-1.5 font-medium"
            >
              <option value="destacados">Destacados</option>
              <option value="precio_asc">Precio: Menor a Mayor</option>
              <option value="precio_desc">Precio: Mayor a Menor</option>
              <option value="nombre_asc">Nombre A-Z</option>
            </select>
            <CatalogViewToggle />
          </div>
        </div>

        {productosPaginados.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-3">
            <p className="text-sm font-semibold">No encontramos artículos para esta búsqueda</p>
            <Button onClick={limpiarFiltros} variant="outline" size="sm" className="rounded-full text-xs">
              Ver Toda la Colección
            </Button>
          </div>
        ) : (
          /* Grid 3:4 Vertical de Moda */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {productosPaginados.map((prod) => {
              const vars = variantsOf(prod.id);
              const hasVars = vars.length > 0;
              const unitPrice = getUnitPrice(prod);
              const hasPromo = productHasPromo(prod);
              const maxDiscount = productMaxDiscount(prod);
              const disponible = isDisponible(prod);

              return (
                <div key={prod.id} className="group flex flex-col justify-between space-y-2.5">
                  <div
                    onClick={() => openProductDetail(prod)}
                    className="relative aspect-3/4 w-full bg-neutral-100 dark:bg-neutral-900 rounded-xl overflow-hidden cursor-pointer"
                  >
                    {prod.imagen_url ? (
                      <img
                        src={prod.imagen_url}
                        alt={prod.nombre}
                        className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-neutral-300">
                        <Store className="h-10 w-10" />
                        <span className="text-[10px] mt-2 font-medium tracking-widest uppercase">Moda</span>
                      </div>
                    )}

                    {hasPromo && maxDiscount > 0 && (
                      <span className="absolute top-2.5 left-2.5 bg-neutral-900 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                        Sale {maxDiscount}%
                      </span>
                    )}

                    {!disponible && (
                      <div className="absolute inset-0 bg-neutral-950/60 text-white text-xs font-bold flex items-center justify-center uppercase tracking-widest">
                        Agotado
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      {prod.categoria && (
                        <span className="text-[10px] text-neutral-500 uppercase tracking-widest truncate">
                          {prod.categoria}
                        </span>
                      )}
                    </div>

                    <h4
                      onClick={() => openProductDetail(prod)}
                      className="font-medium text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 line-clamp-1 group-hover:underline cursor-pointer"
                    >
                      {prod.nombre}
                    </h4>

                    <div className="flex items-center justify-between pt-1">
                      <span className="font-bold text-sm text-neutral-900 dark:text-white">
                        {formatMoney(unitPrice)}
                      </span>

                      <Button
                        onClick={(e) => handleQuickAddClick(e, prod)}
                        disabled={!disponible}
                        size="sm"
                        className="rounded-full h-8 px-3 text-[11px] bg-neutral-900 hover:bg-neutral-800 text-white font-semibold"
                      >
                        {hasVars ? "Tallas" : "Agregar"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <CatalogPagination />
      </main>

      {/* Footer */}
      <footer className="mt-auto bg-neutral-900 text-neutral-400 text-xs py-8 px-4 border-t border-neutral-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left text-xs">
          <div>
            <strong className="text-white">{negocio.nombre}</strong> • Boutique & Moda
          </div>
          <div>Plataforma de Catálogo por Operix ERP</div>
        </div>
      </footer>
    </div>
  );
}
