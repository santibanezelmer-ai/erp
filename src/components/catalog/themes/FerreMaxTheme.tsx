"use client";

import { useCatalog } from "@/components/catalog/CatalogContext";
import { formatMoney } from "@/lib/format";
import { CatalogPagination } from "@/components/catalog/shared/CatalogPagination";
import { CatalogViewToggle } from "@/components/catalog/shared/CatalogViewToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Hammer,
  Search,
  ShoppingCart,
  Phone,
  MapPin,
  X,
  Package,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Tag,
  ShieldCheck,
  Building2,
  Check,
  Flame,
  ArrowRight,
} from "lucide-react";

export function FerreMaxTheme() {
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
    getStock,
    variantsOf,
  } = useCatalog();

  const rawLogo =
    negocio.logo_url ||
    (negocio.perfil?.startsWith("http") ? negocio.perfil : null);

  const bannerTitle = config.bannerTitle || "Materiales, Herramientas y Construcción";
  const bannerSubtitle =
    config.bannerSubtitle ||
    "Venta por mayor y detalle. Despacho a obra o retiro inmediato en mesón.";
  const bannerBadge = config.bannerBadgeText || "🔨 Stock Disponible y Precios Claros";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      {/* Top Bar de Servicio Ferretero */}
      <div className="bg-blue-900 text-blue-100 text-xs py-1.5 px-4 font-medium">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-4">
            <span className="font-bold flex items-center gap-1">
              <Hammer className="h-3.5 w-3.5 text-orange-400" />
              Cotizaciones y Pedidos Directos a WhatsApp
            </span>
            <span className="hidden sm:inline opacity-70">
              Despacho a terreno y facturación inmediata
            </span>
          </div>
          {(negocio as any)?.telefono && (
            <div className="flex items-center gap-1 font-semibold text-white">
              <Phone className="h-3 w-3 text-orange-400" />
              <span>Venta Asistida: {(negocio as any).telefono}</span>
            </div>
          )}
        </div>
      </div>

      {/* Header Comercial Funcional */}
      <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4">
          {/* Logo del Negocio */}
          <div className="flex items-center gap-3 min-w-0">
            {rawLogo ? (
              <img
                src={rawLogo}
                alt={negocio.nombre}
                className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg object-contain bg-white p-0.5 border border-slate-200 shadow-2xs shrink-0"
              />
            ) : (
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-blue-700 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Hammer className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-black text-lg sm:text-xl text-blue-900 dark:text-blue-100 uppercase tracking-tight truncate">
                {negocio.nombre}
              </h1>
              {negocio.direccion && (
                <div className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-orange-500 shrink-0" />
                  <span>{negocio.direccion}</span>
                </div>
              )}
            </div>
          </div>

          {/* Buscador Rápido de Herramientas y Materiales */}
          <div className="hidden md:flex flex-1 max-w-lg mx-4">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-600" />
              <Input
                type="text"
                placeholder="Buscar clavos, taladros, tuberías, pintura, cemento..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-10 h-11 rounded-lg border-slate-300 bg-slate-50 dark:bg-slate-950 text-xs focus-visible:ring-blue-600 focus-visible:border-blue-600"
              />
              {busqueda && (
                <button
                  onClick={() => setBusqueda("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Carrito de Compra Ferretera */}
          <Button
            onClick={openCart}
            className="rounded-lg h-11 px-4 bg-orange-600 hover:bg-orange-700 text-white font-black shadow-sm flex items-center gap-2.5 text-xs shrink-0"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">VER PEDIDO</span>
            <span className="bg-white text-orange-700 rounded-md text-[11px] font-bold px-2 py-0.5">
              {cartCount}
            </span>
          </Button>
        </div>

        {/* Buscador móvil */}
        <div className="md:hidden px-4 pb-3 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-600" />
            <Input
              type="text"
              placeholder="Buscar materiales o herramientas..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9 h-10 rounded-lg border-slate-300 bg-slate-50 dark:bg-slate-950 text-xs"
            />
          </div>
        </div>
      </header>

      {/* Hero Ferretero */}
      <section className="bg-blue-800 text-white py-8 sm:py-12 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3 text-center md:text-left">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-orange-500 text-white text-[11px] font-black uppercase tracking-wider shadow-2xs">
              {bannerBadge}
            </span>
            <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tight leading-tight">
              {bannerTitle}
            </h2>
            <p className="text-xs sm:text-sm text-blue-100 max-w-xl">
              {bannerSubtitle}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => setFiltroRapido("ofertas")}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs h-10 px-5 gap-1.5 shadow-sm"
            >
              <Flame className="h-4 w-4" />
              Ver Ofertas
            </Button>
          </div>
        </div>
      </section>

      {/* Navegación por Departamentos */}
      {categorias.length > 1 && (
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto py-2.5 scrollbar-none">
            {categorias.map((cat) => {
              const isSelected = categoriaSel === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoriaSel(cat)}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                    isSelected
                      ? "bg-blue-700 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {cat === "todas" ? "Todos los Departamentos" : cat}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Grilla Principal con Filtros */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Barra de Filtros Rápidos */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFiltroRapido("todos")}
              className={`px-3 py-1.5 rounded font-bold transition-all ${
                filtroRapido === "todos"
                  ? "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-300"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFiltroRapido("ofertas")}
              className={`px-3 py-1.5 rounded font-bold transition-all ${
                filtroRapido === "ofertas"
                  ? "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-300"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Ofertas
            </button>
            <button
              onClick={() => setFiltroRapido("disponibles")}
              className={`px-3 py-1.5 rounded font-bold transition-all ${
                filtroRapido === "disponibles"
                  ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Con Stock Inmediato
            </button>
          </div>

          <div className="flex items-center gap-2">
            <CatalogViewToggle />

            <select
              value={ordenarPor}
              onChange={(e: any) => setOrdenarPor(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 text-xs"
            >
              <option value="destacados">Recomendados</option>
              <option value="precio_asc">Precio: Menor a Mayor</option>
              <option value="precio_desc">Precio: Mayor a Menor</option>
              <option value="nombre_asc">Nombre A-Z</option>
            </select>

            {hayFiltrosActivos && (
              <Button
                variant="ghost"
                size="sm"
                onClick={limpiarFiltros}
                className="h-7 text-xs text-blue-600 hover:text-blue-700"
              >
                Limpiar
              </Button>
            )}
          </div>
        </div>

        {/* Grilla y Lista Ferretera */}
        <div id="catalogo-productos-grid" className="scroll-mt-24 space-y-6">
          {productosFiltrados.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-8">
              <Hammer className="h-12 w-12 text-slate-400 mx-auto mb-3" />
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">
                No encontramos materiales con ese criterio
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Prueba buscando por palabras clave (ej: tornillo, disco, brocha, cable).
              </p>
            </div>
          ) : vistaModo === "cuadros" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {productosPaginados.map((p) => {
                const price = getUnitPrice(p);
                const inStock = isDisponible(p);
                const stockNum = getStock(p);
                const hasPromo = productHasPromo(p);
                const maxDisc = productMaxDiscount(p);

                return (
                  <div
                    key={p.id}
                    onClick={() => openProductDetail(p)}
                    className="group bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-500 transition-all flex flex-col justify-between overflow-hidden shadow-2xs cursor-pointer"
                  >
                    {/* Foto */}
                    <div className="relative aspect-square w-full bg-slate-50 dark:bg-slate-950 p-2 flex items-center justify-center border-b border-slate-100 dark:border-slate-800">
                      {p.imagen_url ? (
                        <img
                          src={p.imagen_url}
                          alt={p.nombre}
                          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                          loading="lazy"
                        />
                      ) : (
                        <Hammer className="h-10 w-10 text-slate-300" />
                      )}

                      {hasPromo && maxDisc > 0 && (
                        <span className="absolute top-2 left-2 bg-orange-600 text-white font-black text-[10px] px-2 py-0.5 rounded shadow-2xs">
                          -{maxDisc}%
                        </span>
                      )}

                      <div className="absolute bottom-2 right-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            inStock
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                          }`}
                        >
                          {inStock ? "STOCK DISPONIBLE" : "SIN STOCK"}
                        </span>
                      </div>
                    </div>

                    {/* Datos del Producto */}
                    <div className="p-3 flex flex-col flex-1 justify-between gap-2 text-left">
                      <div>
                        {p.categoria && (
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block truncate">
                            {p.categoria}
                          </span>
                        )}
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
                          {p.nombre}
                        </h4>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                        <div>
                          <div className="font-black text-sm sm:text-base text-blue-900 dark:text-white">
                            {formatMoney(price)}
                          </div>
                          {hasPromo && p.precio_promocional && (
                            <div className="text-[11px] text-slate-400 line-through">
                              {formatMoney(Number(p.precio_venta))}
                            </div>
                          )}
                        </div>

                        {inStock && (
                          <Button
                            size="sm"
                            onClick={(e) => handleQuickAddClick(e, p)}
                            className="h-8 px-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded transition-colors shrink-0"
                            title="Añadir a la lista"
                          >
                            <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                            Pedir
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Vista en Lista */
            <div className="space-y-2.5">
              {productosPaginados.map((p) => {
                const price = getUnitPrice(p);
                const inStock = isDisponible(p);
                const hasPromo = productHasPromo(p);
                const maxDisc = productMaxDiscount(p);

                return (
                  <div
                    key={p.id}
                    onClick={() => openProductDetail(p)}
                    className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-400 flex items-center justify-between gap-4 transition-all cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-14 w-14 sm:h-16 sm:w-16 rounded bg-slate-50 dark:bg-slate-950 p-1 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                        {p.imagen_url ? (
                          <img
                            src={p.imagen_url}
                            alt={p.nombre}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <Hammer className="h-6 w-6 text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        {p.categoria && (
                          <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider block truncate">
                            {p.categoria}
                          </span>
                        )}
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                          {p.nombre}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-black text-sm text-blue-900 dark:text-white">
                            {formatMoney(price)}
                          </span>
                          {inStock ? (
                            <span className="text-[10px] font-bold text-emerald-600">
                              • DISPONIBLE
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-rose-500">
                              • SIN STOCK
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {inStock && (
                        <Button
                          size="sm"
                          onClick={(e) => handleQuickAddClick(e, p)}
                          className="h-8 px-3 rounded bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs gap-1"
                        >
                          <ShoppingCart className="h-3 w-3" />
                          <span>Pedir</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Componente de Paginación */}
          <CatalogPagination />
        </div>
      </main>

      {/* Footer Industrial */}
      <footer className="mt-16 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-8 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto space-y-2">
          <p className="font-bold text-sm text-slate-900 dark:text-slate-200 uppercase">
            {negocio.nombre}
          </p>
          <p className="text-[11px]">
            Plataforma de catálogo ferretero y pedidos en línea por{" "}
            <a href="https://operixerp.cloud" target="_blank" className="text-blue-600 hover:underline">
              Operix ERP
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
