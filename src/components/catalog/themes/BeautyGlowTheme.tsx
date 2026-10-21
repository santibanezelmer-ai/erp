"use client";

import { useCatalog } from "@/components/catalog/CatalogContext";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Search,
  ShoppingCart,
  Heart,
  ChevronRight,
  ArrowRight,
  Store,
  MapPin,
  Phone,
  SlidersHorizontal,
  X,
  Package,
} from "lucide-react";

export function BeautyGlowTheme() {
  const {
    negocio,
    config,
    productosFiltrados,
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

  const primaryCol = config.primaryColor || "#e11d48";
  const bannerVisible = config.sectionsVisibility?.bannerHero !== false;
  const categoriesVisible = config.sectionsVisibility?.categoriasPills !== false;
  const ofertasVisible = config.sectionsVisibility?.ofertasDestacadas !== false;

  const rawLogo =
    negocio.logo_url ||
    (negocio.perfil?.startsWith("http") ? negocio.perfil : null);

  const bannerTitle = config.bannerTitle || "Realza Tu Esencia y Belleza";
  const bannerSubtitle =
    config.bannerSubtitle ||
    "Descubre nuestra selección exclusiva en maquillaje, cuidado facial y fragancias.";
  const bannerBadge = config.bannerBadgeText || "✨ Colección Exclusiva";

  return (
    <div className="min-h-screen flex flex-col bg-[#fffbfb] dark:bg-neutral-950 text-foreground font-sans">
      {/* Top Banner Elegante */}
      <div className="bg-rose-950 text-rose-100 text-[11px] py-1.5 px-4 text-center font-medium tracking-wider flex items-center justify-center gap-2">
        <Sparkles className="h-3 w-3 text-rose-300" />
        <span>Envíos rápidos y pedidos directos a WhatsApp • Atención personalizada</span>
      </div>

      {/* Header Editorial */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border-b border-rose-100 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 min-w-0">
            {rawLogo ? (
              <img
                src={rawLogo}
                alt={negocio.nombre}
                className="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-cover border border-rose-200 shadow-xs shrink-0"
              />
            ) : (
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
                <Store className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-serif font-black text-lg sm:text-xl text-neutral-900 dark:text-white truncate tracking-tight">
                {negocio.nombre}
              </h1>
              <div className="flex items-center gap-3 text-[11px] text-neutral-500 truncate">
                {negocio.direccion && (
                  <span className="hidden sm:inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-rose-400" />
                    {negocio.direccion}
                  </span>
                )}
                {(negocio as any)?.telefono && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3 text-rose-400" />
                    {(negocio as any).telefono}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Search bar Desktop */}
          <div className="hidden md:flex flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-rose-400" />
              <Input
                type="text"
                placeholder="Buscar sombras, labiales, cremas..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-9 h-10 rounded-full border-rose-200 bg-rose-50/40 text-xs focus-visible:ring-rose-400"
              />
              {busqueda && (
                <button
                  onClick={() => setBusqueda("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Cart Button */}
          <Button
            onClick={openCart}
            className="rounded-full h-10 px-4 bg-rose-600 hover:bg-rose-700 text-white shadow-sm flex items-center gap-2 text-xs font-semibold shrink-0"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Bolsa</span>
            <span className="bg-white text-rose-700 rounded-full text-[10px] font-black px-1.5 py-0.2">
              {cartCount}
            </span>
          </Button>
        </div>

        {/* Mobile search bar */}
        <div className="md:hidden px-4 pb-3 pt-1 border-t border-rose-50 dark:border-neutral-800">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-rose-400" />
            <Input
              type="text"
              placeholder="Buscar productos..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-8 h-9 rounded-full border-rose-200 bg-rose-50/40 text-xs"
            />
          </div>
        </div>
      </header>

      {/* Hero Banner Editorial */}
      {bannerVisible && (
        <section className="relative overflow-hidden bg-gradient-to-r from-rose-100 via-rose-50 to-amber-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-800 py-12 sm:py-20 px-4 sm:px-6 border-b border-rose-100 dark:border-neutral-800">
          <div className="max-w-4xl mx-auto text-center space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/80 dark:bg-neutral-800 text-rose-600 border border-rose-200 shadow-xs">
              {bannerBadge}
            </span>
            <h2 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-neutral-900 dark:text-white leading-tight">
              {bannerTitle}
            </h2>
            <p className="text-xs sm:text-base text-neutral-600 dark:text-neutral-300 max-w-xl mx-auto font-light leading-relaxed">
              {bannerSubtitle}
            </p>
            {config.bannerButtonText && (
              <div className="pt-2">
                <Button
                  onClick={() => setFiltroRapido("ofertas")}
                  className="rounded-full bg-neutral-900 text-white hover:bg-neutral-800 text-xs px-6 h-10 font-medium"
                >
                  {config.bannerButtonText}
                </Button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Categories Bar */}
        {categoriesVisible && categorias.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {categorias.map((cat) => {
              const isSelected = categoriaSel === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoriaSel(cat)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                    isSelected
                      ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                      : "bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-rose-100 dark:border-neutral-800 hover:border-rose-300"
                  }`}
                >
                  {cat === "todas" ? "Todas las Colecciones" : cat}
                </button>
              );
            })}
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-neutral-900 p-3 rounded-2xl border border-rose-100 dark:border-neutral-800 text-xs">
          {/* Quick Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setFiltroRapido("todos")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                filtroRapido === "todos"
                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFiltroRapido("ofertas")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                filtroRapido === "ofertas"
                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              En Oferta
            </button>
            <button
              onClick={() => setFiltroRapido("nuevos")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                filtroRapido === "nuevos"
                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Novedades
            </button>
            <button
              onClick={() => setFiltroRapido("disponibles")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                filtroRapido === "disponibles"
                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              En Stock
            </button>
          </div>

          {/* Sort & Reset */}
          <div className="flex items-center gap-2">
            <select
              value={ordenarPor}
              onChange={(e: any) => setOrdenarPor(e.target.value)}
              className="bg-transparent border border-rose-200 dark:border-neutral-700 rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-hidden"
            >
              <option value="destacados">Destacados</option>
              <option value="precio_asc">Precio: Menor a Mayor</option>
              <option value="precio_desc">Precio: Mayor a Menor</option>
              <option value="nombre_asc">Nombre A-Z</option>
              <option value="descuento">Mayor Descuento</option>
            </select>

            {hayFiltrosActivos && (
              <Button
                variant="ghost"
                size="sm"
                onClick={limpiarFiltros}
                className="h-7 text-xs text-rose-600 hover:text-rose-700 p-1"
              >
                Limpiar
              </Button>
            )}
          </div>
        </div>

        {/* Product Cards Grid */}
        {productosFiltrados.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-neutral-900 rounded-3xl border border-rose-100 dark:border-neutral-800 p-8">
            <Package className="h-12 w-12 text-rose-300 mx-auto mb-3" />
            <h3 className="font-serif text-lg font-bold text-neutral-800 dark:text-neutral-100">
              No se encontraron productos
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Intenta cambiar los términos de búsqueda o remover los filtros aplicados.
            </p>
            {hayFiltrosActivos && (
              <Button
                onClick={limpiarFiltros}
                variant="outline"
                size="sm"
                className="mt-4 rounded-full text-xs"
              >
                Ver todos los productos
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {productosFiltrados.map((p) => {
              const price = getUnitPrice(p);
              const hasPromo = productHasPromo(p);
              const maxDisc = productMaxDiscount(p);
              const inStock = isDisponible(p);
              const variants = variantsOf(p.id);

              return (
                <div
                  key={p.id}
                  onClick={() => openProductDetail(p)}
                  className="group relative bg-white dark:bg-neutral-900 rounded-2xl border border-rose-100 dark:border-neutral-800 overflow-hidden shadow-2xs hover:shadow-md transition-all duration-300 flex flex-col justify-between cursor-pointer"
                >
                  {/* Photo Container */}
                  <div className="relative aspect-4/5 w-full bg-rose-50/50 dark:bg-neutral-800 overflow-hidden flex items-center justify-center">
                    {p.imagen_url ? (
                      <img
                        src={p.imagen_url}
                        alt={p.nombre}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <Package className="h-12 w-12 text-rose-200" />
                    )}

                    {/* Badges */}
                    <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 z-10">
                      {hasPromo && maxDisc > 0 && (
                        <span className="bg-rose-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow-xs">
                          -{maxDisc}%
                        </span>
                      )}
                      {p.is_new_arrival && (
                        <span className="bg-neutral-900 text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow-xs">
                          NUEVO
                        </span>
                      )}
                    </div>

                    {!inStock && (
                      <div className="absolute inset-0 bg-white/70 dark:bg-neutral-950/70 backdrop-blur-2xs flex items-center justify-center">
                        <span className="text-[11px] font-bold text-neutral-800 dark:text-neutral-200 bg-white dark:bg-neutral-900 px-3 py-1 rounded-full border border-border shadow-xs">
                          Agotado
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Body Info */}
                  <div className="p-3.5 sm:p-4 flex flex-col flex-1 justify-between gap-2">
                    <div>
                      {p.categoria && (
                        <span className="text-[10px] font-medium text-rose-500 uppercase tracking-wider block truncate">
                          {p.categoria}
                        </span>
                      )}
                      <h4 className="font-medium text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 line-clamp-2 leading-snug group-hover:text-rose-600 transition-colors">
                        {p.nombre}
                      </h4>
                    </div>

                    <div className="pt-2 border-t border-rose-50 dark:border-neutral-800 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm sm:text-base text-neutral-900 dark:text-white">
                          {formatMoney(price)}
                        </div>
                        {hasPromo && p.precio_promocional && (
                          <div className="text-[11px] text-muted-foreground line-through">
                            {formatMoney(Number(p.precio_venta))}
                          </div>
                        )}
                      </div>

                      {inStock && (
                        <Button
                          size="icon"
                          onClick={(e) => handleQuickAddClick(e, p)}
                          className="h-8 w-8 rounded-full bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white dark:bg-neutral-800 dark:text-rose-300 dark:hover:bg-rose-600 dark:hover:text-white transition-colors shrink-0"
                          title="Añadir a la bolsa"
                        >
                          <ShoppingCart className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer Editorial */}
      <footer className="mt-16 border-t border-rose-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 py-8 px-4 text-center text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto space-y-2">
          <p className="font-serif font-bold text-sm text-neutral-800 dark:text-neutral-200">
            {negocio.nombre}
          </p>
          <p className="text-[11px]">
            Catálogo y pedidos en línea impulsado por{" "}
            <a href="https://operixerp.cloud" target="_blank" className="text-rose-600 hover:underline">
              Operix ERP
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
