"use client";

import { useCatalog } from "@/components/catalog/CatalogContext";
import { formatMoney } from "@/lib/format";
import { CatalogPagination } from "@/components/catalog/shared/CatalogPagination";
import { CatalogViewToggle } from "@/components/catalog/shared/CatalogViewToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  UtensilsCrossed,
  ChefHat,
  Search,
  ShoppingCart,
  Phone,
  MapPin,
  Clock,
  Flame,
  Sparkles,
  Truck,
  Store,
  X,
  Package,
  Check,
  ChevronRight,
  ArrowRight,
  Coffee,
} from "lucide-react";

export function FoodBistroTheme() {
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

  const primaryCol = config.primaryColor || "#ea580c"; // orange-600 cálido apetitoso
  const bannerVisible = config.sectionsVisibility?.bannerHero !== false;
  const categoriesVisible = config.sectionsVisibility?.categoriasPills !== false;
  const ofertasVisible = config.sectionsVisibility?.ofertasDestacadas !== false;

  const rawLogo =
    negocio.logo_url ||
    (negocio.perfil?.startsWith("http") ? negocio.perfil : null);

  const bannerTitle = config.bannerTitle || "Nuestra Carta & Especialidades del Chef";
  const bannerSubtitle =
    config.bannerSubtitle ||
    "Platos frescos elaborados al momento con los mejores ingredientes. Haz tu pedido a la mesa o a domicilio por WhatsApp.";
  const bannerBadge = config.bannerBadgeText || "🔥 Cocina Abierta & Delivery Activo";

  return (
    <div className="min-h-screen flex flex-col bg-[#fffaf5] dark:bg-stone-950 text-stone-900 dark:text-stone-100 font-sans">
      {/* Top Banner de Horarios y Pedidos */}
      <div className="bg-amber-950 text-amber-100 text-xs py-2 px-4 border-b border-amber-900/40">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-[11px] sm:text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold flex items-center gap-1.5 text-amber-400">
              <ChefHat className="h-3.5 w-3.5" />
              Menú Digital & Carta Online
            </span>
            <span className="hidden md:inline-flex items-center gap-1 opacity-80">
              <Clock className="h-3 w-3 text-amber-400" />
              Preparación fresca en el instante
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <span className="inline-flex items-center gap-1 font-semibold text-amber-200">
              <Truck className="h-3.5 w-3.5 text-amber-400" />
              <span>Pide para llevar o delivery</span>
            </span>
            {(negocio as any)?.telefono && (
              <a
                href={`https://wa.me/${((negocio as any).telefono || "").replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1 text-amber-300 hover:text-white transition-colors"
              >
                <Phone className="h-3 w-3" />
                <span>{(negocio as any).telefono}</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Header del Restaurante / Cafetería */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-b border-orange-100 dark:border-stone-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          {/* Logo y Nombre del Local */}
          <div className="flex items-center gap-3 min-w-0">
            {rawLogo ? (
              <img
                src={rawLogo}
                alt={negocio.nombre}
                className="h-11 w-11 sm:h-13 sm:w-13 rounded-2xl object-cover border-2 border-orange-200 dark:border-stone-700 shadow-sm shrink-0"
              />
            ) : (
              <div className="h-11 w-11 sm:h-13 sm:w-13 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <UtensilsCrossed className="h-6 w-6" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-extrabold text-lg sm:text-2xl text-stone-900 dark:text-stone-50 truncate tracking-tight">
                {negocio.nombre}
              </h1>
              <div className="flex items-center gap-3 text-[11px] text-stone-500 dark:text-stone-400 truncate">
                {negocio.direccion && (
                  <span className="hidden sm:inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-orange-500" />
                    {negocio.direccion}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Atendiendo ahora
                </span>
              </div>
            </div>
          </div>

          {/* Buscador Rápido de Platos y Bebidas */}
          <div className="hidden md:flex flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-500" />
              <Input
                type="text"
                placeholder="Buscar pizzas, hamburguesas, sushi, postres, bebidas..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-10 h-11 rounded-full border-orange-200/80 bg-orange-50/30 dark:bg-stone-800 dark:border-stone-700 text-xs focus-visible:ring-orange-500"
              />
              {busqueda && (
                <button
                  onClick={() => setBusqueda("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Botón Carrito / Pedido */}
          <Button
            onClick={openCart}
            className="rounded-full h-11 px-5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white shadow-md flex items-center gap-2 text-xs font-bold shrink-0 transition-transform active:scale-95"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Mi Pedido</span>
            <span className="bg-white text-orange-700 rounded-full text-[11px] font-black px-2 py-0.5">
              {cartCount}
            </span>
          </Button>
        </div>

        {/* Buscador Móvil */}
        <div className="md:hidden px-4 pb-3 pt-1 border-t border-orange-50 dark:border-stone-800">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-500" />
            <Input
              type="text"
              placeholder="Buscar en la carta..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9 h-10 rounded-full border-orange-200 bg-orange-50/40 dark:bg-stone-800 text-xs"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Gastronómico */}
      {bannerVisible && (
        <section className="relative overflow-hidden bg-gradient-to-br from-amber-900 via-orange-950 to-stone-950 text-white py-10 sm:py-16 px-4 sm:px-6">
          <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#ea580c_1px,transparent_1px)] [background-size:16px_16px]" />
          
          <div className="max-w-7xl mx-auto relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="max-w-2xl space-y-3.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 text-xs font-bold tracking-wide">
                <Flame className="h-3.5 w-3.5 text-orange-400" />
                {bannerBadge}
              </span>

              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight text-amber-50">
                {bannerTitle}
              </h2>

              <p className="text-sm sm:text-base text-amber-100/80 leading-relaxed font-normal">
                {bannerSubtitle}
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => {
                    const el = document.getElementById("menu-carta");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="rounded-full bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs h-10 px-5 gap-2 shadow-lg"
                >
                  <UtensilsCrossed className="h-4 w-4" />
                  Ver Carta Completa
                </Button>
                <span className="text-xs text-amber-200/80 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  Pide directamente por WhatsApp
                </span>
              </div>
            </div>

            {/* Placa decorativa de sugerencia */}
            <div className="hidden lg:flex flex-col gap-2 p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md max-w-xs text-xs">
              <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
                <ChefHat className="h-4 w-4" />
                <span>¿Cómo pedir?</span>
              </div>
              <ol className="space-y-1.5 text-amber-100/90 list-decimal list-inside text-[11px]">
                <li>Explora los platos de nuestra carta</li>
                <li>Agrega tus favoritos a tu pedido</li>
                <li>Envíanos tu comanda lista a WhatsApp</li>
                <li>¡Cocinamos con amor para ti!</li>
              </ol>
            </div>
          </div>
        </section>
      )}

      {/* Navegación por Secciones de la Carta (Categorías) */}
      {categoriesVisible && categorias.length > 0 && (
        <nav id="menu-carta" className="sticky top-20 z-20 bg-[#fffaf5]/95 dark:bg-stone-900/95 backdrop-blur-md border-b border-orange-100 dark:border-stone-800 py-3 px-4">
          <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setCategoriaSel("todas")}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                categoriaSel === "todas"
                  ? "bg-orange-600 text-white shadow-sm"
                  : "bg-orange-100/60 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-orange-200/60"
              }`}
            >
              🍽️ Toda la Carta
            </button>
            {categorias.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoriaSel(cat)}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                  categoriaSel === cat
                    ? "bg-orange-600 text-white shadow-sm"
                    : "bg-orange-100/60 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-orange-200/60"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* Contenido Principal de Platos */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Barra de Filtros y Orden */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-orange-100 dark:border-stone-800">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none text-xs">
            <button
              onClick={() => setFiltroRapido("todos")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                filtroRapido === "todos"
                  ? "bg-orange-600 text-white"
                  : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400"
              }`}
            >
              Todos ({productosFiltrados.length})
            </button>
            <button
              onClick={() => setFiltroRapido("ofertas")}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                filtroRapido === "ofertas"
                  ? "bg-orange-600 text-white"
                  : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400"
              }`}
            >
              <Flame className="h-3 w-3 text-orange-500" />
              Promos del Día
            </button>
            <button
              onClick={() => setFiltroRapido("nuevos")}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                filtroRapido === "nuevos"
                  ? "bg-orange-600 text-white"
                  : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400"
              }`}
            >
              <Sparkles className="h-3 w-3 text-amber-500" />
              Nuevos Platos
            </button>

            {hayFiltrosActivos && (
              <button
                onClick={limpiarFiltros}
                className="text-xs text-orange-600 dark:text-orange-400 underline font-semibold ml-2 cursor-pointer"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 justify-between sm:justify-end">
            <select
              value={ordenarPor}
              onChange={(e) => setOrdenarPor(e.target.value as any)}
              className="text-xs rounded-lg border border-orange-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-1.5 font-medium"
            >
              <option value="destacados">⭐ Recomendados</option>
              <option value="precio_asc">Precio: Menor a Mayor</option>
              <option value="precio_desc">Precio: Mayor a Menor</option>
              <option value="nombre_asc">Nombre A-Z</option>
            </select>
            <CatalogViewToggle />
          </div>
        </div>

        {/* Listado de Platos */}
        {productosPaginados.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white dark:bg-stone-900 rounded-3xl border border-orange-100 dark:border-stone-800 space-y-3">
            <div className="h-16 w-16 mx-auto rounded-full bg-orange-100 dark:bg-stone-800 text-orange-600 flex items-center justify-center">
              <UtensilsCrossed className="h-8 w-8" />
            </div>
            <h3 className="font-extrabold text-lg">No encontramos platos con esos filtros</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              Intenta cambiar tu búsqueda o limpiar los filtros para ver las opciones disponibles en nuestra carta.
            </p>
            <Button
              onClick={limpiarFiltros}
              variant="outline"
              size="sm"
              className="rounded-full border-orange-200 text-orange-700 hover:bg-orange-50 font-bold"
            >
              Ver Toda la Carta
            </Button>
          </div>
        ) : vistaModo === "cuadros" ? (
          /* Cuadrícula Gastronómica */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {productosPaginados.map((prod) => {
              const vars = variantsOf(prod.id);
              const hasVars = vars.length > 0;
              const unitPrice = getUnitPrice(prod);
              const hasPromo = productHasPromo(prod);
              const maxDiscount = productMaxDiscount(prod);
              const disponible = isDisponible(prod);

              return (
                <div
                  key={prod.id}
                  className="group flex flex-col bg-white dark:bg-stone-900 rounded-2xl border border-orange-100/80 dark:border-stone-800 overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-1"
                >
                  {/* Imagen del Plato con ratio apetitoso */}
                  <div
                    onClick={() => openProductDetail(prod)}
                    className="relative aspect-4/3 w-full bg-stone-100 dark:bg-stone-800 overflow-hidden cursor-pointer"
                  >
                    {prod.imagen_url ? (
                      <img
                        src={prod.imagen_url}
                        alt={prod.nombre}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-stone-300 dark:text-stone-700 gap-1">
                        <UtensilsCrossed className="h-10 w-10 stroke-[1.5]" />
                        <span className="text-[10px] font-medium uppercase tracking-wider">Especialidad</span>
                      </div>
                    )}

                    {/* Insignias Gastronómicas */}
                    <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start">
                      {hasPromo && maxDiscount > 0 && (
                        <Badge className="bg-red-600 hover:bg-red-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full shadow-xs">
                          {maxDiscount}% OFF
                        </Badge>
                      )}
                      {prod.categoria && (
                        <span className="bg-stone-950/70 backdrop-blur-xs text-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {prod.categoria}
                        </span>
                      )}
                    </div>

                    {!disponible && (
                      <div className="absolute inset-0 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center text-white text-xs font-black uppercase tracking-wider">
                        Agotado por hoy
                      </div>
                    )}
                  </div>

                  {/* Cuerpo del Plato */}
                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <div className="space-y-1.5">
                      <h4
                        onClick={() => openProductDetail(prod)}
                        className="font-bold text-sm text-stone-900 dark:text-stone-100 group-hover:text-orange-600 transition-colors cursor-pointer line-clamp-1"
                      >
                        {prod.nombre}
                      </h4>
                      {prod.descripcion && (
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-2 leading-relaxed">
                          {prod.descripcion}
                        </p>
                      )}
                    </div>

                    {/* Precio y Botón de Pedir */}
                    <div className="pt-2 border-t border-orange-50 dark:border-stone-800 flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-stone-400 uppercase font-semibold">
                          {hasVars ? "Desde" : "Precio"}
                        </span>
                        <span className="font-extrabold text-base text-orange-600 dark:text-orange-400">
                          {formatMoney(unitPrice)}
                        </span>
                      </div>

                      <Button
                        onClick={(e) => handleQuickAddClick(e, prod)}
                        disabled={!disponible}
                        size="sm"
                        className="rounded-full h-9 px-4 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs gap-1.5 shadow-xs transition-transform active:scale-95"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        <span>{hasVars ? "Elegir" : "Pedir"}</span>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Vista Lista (Tipo Carta Clásica de Menú) */
          <div className="divide-y divide-orange-100 dark:divide-stone-800 bg-white dark:bg-stone-900 rounded-2xl border border-orange-100 dark:border-stone-800 overflow-hidden shadow-xs">
            {productosPaginados.map((prod) => {
              const vars = variantsOf(prod.id);
              const hasVars = vars.length > 0;
              const unitPrice = getUnitPrice(prod);
              const disponible = isDisponible(prod);

              return (
                <div
                  key={prod.id}
                  className="p-4 flex items-center justify-between gap-4 hover:bg-orange-50/40 dark:hover:bg-stone-800/50 transition-colors"
                >
                  <div
                    onClick={() => openProductDetail(prod)}
                    className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl bg-stone-100 dark:bg-stone-800 overflow-hidden shrink-0 cursor-pointer"
                  >
                    {prod.imagen_url ? (
                      <img src={prod.imagen_url} alt={prod.nombre} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-stone-300">
                        <UtensilsCrossed className="h-6 w-6" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4
                        onClick={() => openProductDetail(prod)}
                        className="font-bold text-sm text-stone-900 dark:text-stone-100 hover:text-orange-600 cursor-pointer truncate"
                      >
                        {prod.nombre}
                      </h4>
                      {prod.categoria && (
                        <span className="text-[10px] bg-orange-100 dark:bg-stone-800 text-orange-800 dark:text-orange-300 px-2 py-0.2 rounded-full font-semibold shrink-0">
                          {prod.categoria}
                        </span>
                      )}
                    </div>
                    {prod.descripcion && (
                      <p className="text-xs text-stone-500 line-clamp-1">{prod.descripcion}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-extrabold text-sm sm:text-base text-orange-600">
                      {formatMoney(unitPrice)}
                    </span>
                    <Button
                      onClick={(e) => handleQuickAddClick(e, prod)}
                      disabled={!disponible}
                      size="sm"
                      className="rounded-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs"
                    >
                      {hasVars ? "Opciones" : "Pedir"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Paginación */}
        <CatalogPagination />
      </main>

      {/* Footer Gastronómico */}
      <footer className="mt-auto bg-stone-900 text-stone-400 text-xs py-8 px-4 border-t border-stone-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="space-y-1">
            <div className="font-bold text-white text-sm flex items-center justify-center sm:justify-start gap-1.5">
              <UtensilsCrossed className="h-4 w-4 text-orange-500" />
              <span>{negocio.nombre}</span>
            </div>
            {negocio.direccion && <p className="text-[11px]">{negocio.direccion}</p>}
          </div>

          <div className="text-[11px] text-stone-500">
            Catálogo y Menú Digital impulsado por <strong className="text-stone-300">Operix ERP</strong>
          </div>
        </div>
      </footer>
    </div>
  );
}
