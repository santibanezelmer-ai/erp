"use client";

import { useCatalog } from "@/components/catalog/CatalogContext";
import { formatMoney } from "@/lib/format";
import { CatalogPagination } from "@/components/catalog/shared/CatalogPagination";
import { CatalogViewToggle } from "@/components/catalog/shared/CatalogViewToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingBag,
  Store,
  Search,
  ShoppingCart,
  Phone,
  MapPin,
  Sparkles,
  Truck,
  Check,
  X,
  Plus,
  Minus,
  Tag,
  Clock,
  Layers,
} from "lucide-react";

export function MarketFreshTheme() {
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
    cart,
    addToCart,
    updateQty,
    openProductDetail,
    handleQuickAddClick,
    getUnitPrice,
    productHasPromo,
    productMaxDiscount,
    isDisponible,
    variantsOf,
  } = useCatalog();

  const primaryCol = config.primaryColor || "#16a34a"; // emerald-600
  const bannerVisible = config.sectionsVisibility?.bannerHero !== false;
  const categoriesVisible = config.sectionsVisibility?.categoriasPills !== false;

  const rawLogo =
    negocio.logo_url ||
    (negocio.perfil?.startsWith("http") ? negocio.perfil : null);

  const bannerTitle = config.bannerTitle || "Tu Almacén & Minimarket de Confianza";
  const bannerSubtitle =
    config.bannerSubtitle ||
    "Abarrotes, bebidas, lácteos, snacks y productos frescos para tu día a día. Pide directo y recibe en minutos.";
  const bannerBadge = config.bannerBadgeText || "🥬 Precios Bajos y Calidad Siempre";

  return (
    <div className="min-h-screen flex flex-col bg-[#f8faf8] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      {/* Top Bar de Servicio */}
      <div className="bg-emerald-900 text-emerald-100 text-xs py-1.5 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-[11px] sm:text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold flex items-center gap-1.5 text-emerald-300">
              <Store className="h-3.5 w-3.5" />
              Minimarket & Abarrotes Online
            </span>
            <span className="hidden sm:inline opacity-80">
              • Entrega rápida en tu barrio o retiro en mesón
            </span>
          </div>

          {(negocio as any)?.telefono && (
            <a
              href={`https://wa.me/${((negocio as any).telefono || "").replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-emerald-200 hover:text-white transition-colors font-semibold"
            >
              <Phone className="h-3 w-3" />
              <span>Pedidos: {(negocio as any).telefono}</span>
            </a>
          )}
        </div>
      </div>

      {/* Header Comercial */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-emerald-100 dark:border-zinc-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {rawLogo ? (
              <img
                src={rawLogo}
                alt={negocio.nombre}
                className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl object-contain bg-white p-0.5 border border-emerald-200 shadow-2xs shrink-0"
              />
            ) : (
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Store className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-black text-lg sm:text-xl text-emerald-950 dark:text-emerald-100 truncate tracking-tight">
                {negocio.nombre}
              </h1>
              {negocio.direccion && (
                <div className="text-[11px] text-zinc-500 truncate flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
                  <span>{negocio.direccion}</span>
                </div>
              )}
            </div>
          </div>

          {/* Buscador Rápido de Abarrotes */}
          <div className="hidden md:flex flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
              <Input
                type="text"
                placeholder="Buscar arroz, bebidas, pan, leche, café, limpieza..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-10 h-10 rounded-xl border-emerald-200 bg-emerald-50/20 text-xs focus-visible:ring-emerald-600"
              />
              {busqueda && (
                <button
                  onClick={() => setBusqueda("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Botón Canasta */}
          <Button
            onClick={openCart}
            className="rounded-xl h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-2 text-xs font-bold shrink-0"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Canasta</span>
            <span className="bg-emerald-900 text-white rounded-full text-[10px] font-black px-1.5 py-0.2">
              {cartCount}
            </span>
          </Button>
        </div>

        {/* Buscador Móvil */}
        <div className="md:hidden px-4 pb-3 pt-1 border-t border-emerald-50 dark:border-zinc-800">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
            <Input
              type="text"
              placeholder="Buscar en el minimarket..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9 h-10 rounded-xl border-emerald-200 bg-emerald-50/20 text-xs"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Fresco */}
      {bannerVisible && (
        <section className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white py-8 sm:py-12 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-2xl space-y-2.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white/20 text-white text-[11px] font-bold">
                <Sparkles className="h-3 w-3" />
                {bannerBadge}
              </span>
              <h2 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
                {bannerTitle}
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100 leading-relaxed font-normal">
                {bannerSubtitle}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Categorías Pills */}
      {categoriesVisible && categorias.length > 0 && (
        <div className="sticky top-18 z-20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-emerald-100 dark:border-zinc-800 py-2.5 px-4">
          <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setCategoriaSel("todas")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                categoriaSel === "todas"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-emerald-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-emerald-100/60"
              }`}
            >
              🛒 Todos los Productos
            </button>
            {categorias.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoriaSel(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                  categoriaSel === cat
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-emerald-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-emerald-100/60"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grid de Productos */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-emerald-100 dark:border-zinc-800">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none text-xs">
            <button
              onClick={() => setFiltroRapido("todos")}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                filtroRapido === "todos"
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              }`}
            >
              Todos ({productosFiltrados.length})
            </button>
            <button
              onClick={() => setFiltroRapido("ofertas")}
              className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                filtroRapido === "ofertas"
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              }`}
            >
              <Tag className="h-3 w-3 text-emerald-500" />
              Ofertas
            </button>
            {hayFiltrosActivos && (
              <button
                onClick={limpiarFiltros}
                className="text-xs text-emerald-600 dark:text-emerald-400 underline font-semibold ml-2 cursor-pointer"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 justify-between sm:justify-end">
            <select
              value={ordenarPor}
              onChange={(e) => setOrdenarPor(e.target.value as any)}
              className="text-xs rounded-lg border border-emerald-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 font-medium"
            >
              <option value="destacados">⭐ Más Vendidos</option>
              <option value="precio_asc">Precio: Menor a Mayor</option>
              <option value="precio_desc">Precio: Mayor a Menor</option>
              <option value="nombre_asc">Nombre A-Z</option>
            </select>
            <CatalogViewToggle />
          </div>
        </div>

        {productosPaginados.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white dark:bg-zinc-900 rounded-2xl border border-emerald-100 dark:border-zinc-800 space-y-3">
            <Store className="h-10 w-10 mx-auto text-emerald-500" />
            <h3 className="font-bold text-base">No hay productos en esta sección</h3>
            <p className="text-xs text-zinc-500">Prueba buscando otro producto o limpiando los filtros.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {productosPaginados.map((prod) => {
              const vars = variantsOf(prod.id);
              const hasVars = vars.length > 0;
              const unitPrice = getUnitPrice(prod);
              const hasPromo = productHasPromo(prod);
              const maxDiscount = productMaxDiscount(prod);
              const disponible = isDisponible(prod);

              // Comprobar si ya está en el carrito
              const inCart = cart.find((c) => c.producto.id === prod.id && !c.variante);
              const cartItemQty = inCart ? inCart.qty : 0;

              return (
                <div
                  key={prod.id}
                  className="flex flex-col justify-between bg-white dark:bg-zinc-900 rounded-xl border border-emerald-100 dark:border-zinc-800 overflow-hidden shadow-2xs hover:shadow-sm transition-all"
                >
                  <div
                    onClick={() => openProductDetail(prod)}
                    className="relative aspect-square w-full bg-zinc-50 dark:bg-zinc-800 overflow-hidden cursor-pointer p-2 flex items-center justify-center"
                  >
                    {prod.imagen_url ? (
                      <img
                        src={prod.imagen_url}
                        alt={prod.nombre}
                        className="max-h-full max-w-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <ShoppingBag className="h-10 w-10 text-zinc-300" />
                    )}

                    {hasPromo && maxDiscount > 0 && (
                      <span className="absolute top-2 left-2 bg-red-600 text-white font-extrabold text-[9px] px-1.5 py-0.2 rounded">
                        -{maxDiscount}%
                      </span>
                    )}

                    {!disponible && (
                      <div className="absolute inset-0 bg-black/60 text-white text-[10px] font-bold flex items-center justify-center uppercase">
                        Agotado
                      </div>
                    )}
                  </div>

                  <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                    <div>
                      {prod.categoria && (
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold uppercase block truncate">
                          {prod.categoria}
                        </span>
                      )}
                      <h4
                        onClick={() => openProductDetail(prod)}
                        className="font-bold text-xs text-zinc-900 dark:text-zinc-100 line-clamp-2 hover:text-emerald-600 cursor-pointer mt-0.5"
                      >
                        {prod.nombre}
                      </h4>
                    </div>

                    <div className="space-y-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                      <div className="font-extrabold text-sm text-emerald-700 dark:text-emerald-400">
                        {formatMoney(unitPrice)}
                      </div>

                      {hasVars ? (
                        <Button
                          onClick={(e) => handleQuickAddClick(e, prod)}
                          size="sm"
                          disabled={!disponible}
                          className="w-full h-8 text-[11px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        >
                          Opciones
                        </Button>
                      ) : cartItemQty > 0 ? (
                        /* Selector Rápido + / - sin abrir modal */
                        <div className="flex items-center justify-between bg-emerald-50 dark:bg-zinc-800 rounded-lg p-0.5 border border-emerald-200 dark:border-zinc-700">
                          <button
                            type="button"
                            onClick={() => inCart && updateQty(inCart.key, -1)}
                            className="h-7 w-7 flex items-center justify-center rounded-md bg-white dark:bg-zinc-700 text-emerald-800 font-bold hover:bg-emerald-100 shadow-2xs"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-xs font-black text-emerald-900 dark:text-emerald-100 px-2">
                            {cartItemQty}
                          </span>
                          <button
                            type="button"
                            onClick={() => inCart && updateQty(inCart.key, 1)}
                            className="h-7 w-7 flex items-center justify-center rounded-md bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-2xs"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <Button
                          onClick={() => addToCart(prod, null, 1)}
                          size="sm"
                          disabled={!disponible}
                          className="w-full h-8 text-[11px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1 shadow-2xs"
                        >
                          <Plus className="h-3 w-3" />
                          Agregar
                        </Button>
                      )}
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
      <footer className="mt-auto bg-zinc-900 text-zinc-400 text-xs py-6 px-4 border-t border-zinc-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left text-[11px]">
          <div>
            <strong>{negocio.nombre}</strong> {negocio.direccion ? `• ${negocio.direccion}` : ""}
          </div>
          <div>Almacén Online impulsado por Operix ERP</div>
        </div>
      </footer>
    </div>
  );
}
