"use client";

import { useCatalog } from "@/components/catalog/CatalogContext";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Wrench,
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
} from "lucide-react";

export function AutoPartsProTheme() {
  const {
    negocio,
    config,
    productosFiltrados,
    categorias,
    categoriaSel,
    setCategoriaSel,
    marcas,
    marcaSel,
    setMarcaSel,
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
    marcaNombre,
  } = useCatalog();

  const rawLogo =
    negocio.logo_url ||
    (negocio.perfil?.startsWith("http") ? negocio.perfil : null);

  const bannerTitle = config.bannerTitle || "Repuestos y Accesorios Automotrices";
  const bannerSubtitle =
    config.bannerSubtitle ||
    "Encuentra repuestos originales y alternativos con garantía y despacho inmediato.";
  const bannerBadge = config.bannerBadgeText || "⚡ Despacho Rápido y Stock Real";

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950 text-neutral-100 font-sans selection:bg-amber-500 selection:text-neutral-950">
      {/* Top Banner de Garantía Técnica */}
      <div className="bg-neutral-900 border-b border-neutral-800 text-xs py-2 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-neutral-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-amber-400 font-semibold">
              <ShieldCheck className="h-3.5 w-3.5" />
              Garantía en todos los repuestos
            </span>
            <span className="hidden md:inline text-neutral-600">•</span>
            <span className="hidden md:inline">Atención técnica directa por WhatsApp</span>
          </div>
          {(negocio as any)?.telefono && (
            <div className="flex items-center gap-1.5 text-neutral-300">
              <Phone className="h-3 w-3 text-amber-400" />
              <span>Consultas mecánicas: {(negocio as any).telefono}</span>
            </div>
          )}
        </div>
      </div>

      {/* Header Automotriz Técnico */}
      <header className="sticky top-0 z-30 bg-neutral-900/95 backdrop-blur-md border-b border-neutral-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4">
          {/* Logo y Nombre */}
          <div className="flex items-center gap-3 min-w-0">
            {rawLogo ? (
              <img
                src={rawLogo}
                alt={negocio.nombre}
                className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl object-contain bg-neutral-950 p-1 border border-neutral-800 shrink-0"
              />
            ) : (
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center shrink-0">
                <Wrench className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-black text-lg sm:text-xl text-white tracking-tight uppercase truncate">
                {negocio.nombre}
              </h1>
              {negocio.direccion && (
                <div className="text-[11px] text-neutral-400 truncate flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-amber-400 shrink-0" />
                  <span>{negocio.direccion}</span>
                </div>
              )}
            </div>
          </div>

          {/* Buscador Técnico Central Prominente (SKU / Pieza / Modelo) */}
          <div className="hidden md:flex flex-1 max-w-lg mx-4">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400" />
              <Input
                type="text"
                placeholder="Buscar por código de pieza, SKU, marca o repuesto..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-10 h-11 rounded-xl border-neutral-700 bg-neutral-950 text-xs text-neutral-100 placeholder:text-neutral-500 focus-visible:ring-amber-400 focus-visible:border-amber-400 font-mono"
              />
              {busqueda && (
                <button
                  onClick={() => setBusqueda("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Carrito de Pedido Técnico */}
          <Button
            onClick={openCart}
            className="rounded-xl h-11 px-4 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black shadow-lg flex items-center gap-2.5 text-xs shrink-0 tracking-wide"
          >
            <ShoppingCart className="h-4 w-4 stroke-[2.5]" />
            <span className="hidden sm:inline">COTIZACIÓN / PEDIDO</span>
            <span className="bg-neutral-950 text-amber-400 rounded-md text-[11px] font-mono font-bold px-2 py-0.5">
              {cartCount}
            </span>
          </Button>
        </div>

        {/* Buscador Móvil */}
        <div className="md:hidden px-4 pb-3 pt-1 border-t border-neutral-800">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400" />
            <Input
              type="text"
              placeholder="Buscar pieza, código o marca..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9 h-10 rounded-xl border-neutral-700 bg-neutral-950 text-xs text-neutral-100 placeholder:text-neutral-500 font-mono"
            />
          </div>
        </div>
      </header>

      {/* Hero Técnico de Alta Potencia */}
      <section className="relative bg-gradient-to-b from-neutral-900 to-neutral-950 py-10 sm:py-16 px-4 sm:px-6 border-b border-neutral-800">
        <div className="max-w-5xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Zap className="h-3.5 w-3.5" />
            <span>{bannerBadge}</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white uppercase leading-tight">
            {bannerTitle}
          </h2>

          <p className="text-xs sm:text-sm text-neutral-400 max-w-xl mx-auto font-normal">
            {bannerSubtitle}
          </p>
        </div>
      </section>

      {/* Layout Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Marcas Comerciales (si existen) */}
        {marcas.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-amber-400" />
              Filtrar por Fabricante / Marca:
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setMarcaSel("todas")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                  marcaSel === "todas"
                    ? "bg-amber-500 text-neutral-950 border-amber-500 font-black"
                    : "bg-neutral-900 text-neutral-300 border-neutral-800 hover:border-neutral-700"
                }`}
              >
                Todas las marcas
              </button>
              {marcas.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMarcaSel(m.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                    marcaSel === m.id
                      ? "bg-amber-500 text-neutral-950 border-amber-500 font-bold"
                      : "bg-neutral-900 text-neutral-300 border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  {m.nombre}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Categorías Técnicas */}
        {categorias.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {categorias.map((cat) => {
              const isSelected = categoriaSel === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoriaSel(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border ${
                    isSelected
                      ? "bg-neutral-100 text-neutral-950 border-neutral-100 shadow-sm"
                      : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-700 hover:text-white"
                  }`}
                >
                  {cat === "todas" ? "Todos los Repuestos" : cat}
                </button>
              );
            })}
          </div>
        )}

        {/* Toolbar de Filtros */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-900 p-3 rounded-xl border border-neutral-800 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFiltroRapido("todos")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                filtroRapido === "todos"
                  ? "bg-neutral-800 text-amber-400 font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Catálogo Completo
            </button>
            <button
              onClick={() => setFiltroRapido("ofertas")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                filtroRapido === "ofertas"
                  ? "bg-neutral-800 text-amber-400 font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Liquidación / Ofertas
            </button>
            <button
              onClick={() => setFiltroRapido("disponibles")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                filtroRapido === "disponibles"
                  ? "bg-neutral-800 text-amber-400 font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              En Bodega
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={ordenarPor}
              onChange={(e: any) => setOrdenarPor(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-neutral-300 focus:outline-hidden"
            >
              <option value="destacados">Orden: Relevancia</option>
              <option value="precio_asc">Precio: Menor a Mayor</option>
              <option value="precio_desc">Precio: Mayor a Menor</option>
              <option value="nombre_asc">Nombre A-Z</option>
            </select>

            {hayFiltrosActivos && (
              <Button
                variant="ghost"
                size="sm"
                onClick={limpiarFiltros}
                className="h-7 text-xs text-amber-400 hover:text-amber-300"
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        </div>

        {/* Grilla de Repuestos */}
        {productosFiltrados.length === 0 ? (
          <div className="text-center py-20 bg-neutral-900 rounded-2xl border border-neutral-800 p-8">
            <Wrench className="h-12 w-12 text-neutral-600 mx-auto mb-3" />
            <h3 className="font-bold text-lg text-white">No se encontraron repuestos</h3>
            <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
              Verifica el código o término ingresado. Puedes consultar directamente por WhatsApp si buscas una pieza específica.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {productosFiltrados.map((p) => {
              const price = getUnitPrice(p);
              const inStock = isDisponible(p);
              const stockNum = getStock(p);
              const brand = marcaNombre(p.marca_id);
              const hasPromo = productHasPromo(p);
              const maxDisc = productMaxDiscount(p);

              return (
                <div
                  key={p.id}
                  onClick={() => openProductDetail(p)}
                  className="group bg-neutral-900 rounded-xl border border-neutral-800 hover:border-amber-500/60 transition-all flex flex-col justify-between overflow-hidden shadow-xs cursor-pointer"
                >
                  {/* Imagen del Repuesto */}
                  <div className="relative aspect-square w-full bg-neutral-950 p-3 flex items-center justify-center border-b border-neutral-800 overflow-hidden">
                    {p.imagen_url ? (
                      <img
                        src={p.imagen_url}
                        alt={p.nombre}
                        className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                        loading="lazy"
                      />
                    ) : (
                      <Wrench className="h-12 w-12 text-neutral-700" />
                    )}

                    {hasPromo && maxDisc > 0 && (
                      <Badge className="absolute top-2 left-2 bg-amber-500 text-neutral-950 font-black text-[10px] rounded-md">
                        -{maxDisc}%
                      </Badge>
                    )}

                    {/* Badge de Disponibilidad */}
                    <div className="absolute bottom-2 right-2">
                      {inStock ? (
                        <span className="text-[10px] font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 px-2 py-0.5 rounded">
                          EN BODEGA
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono bg-rose-950/80 text-rose-400 border border-rose-800/80 px-2 py-0.5 rounded">
                          POR ENCARGO
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ficha Técnica */}
                  <div className="p-3.5 flex flex-col flex-1 justify-between gap-2 text-left">
                    <div>
                      <div className="flex items-center justify-between gap-1 text-[11px] mb-1">
                        {brand ? (
                          <span className="font-bold text-amber-400 uppercase truncate">
                            {brand}
                          </span>
                        ) : (
                          <span className="text-neutral-500 uppercase truncate">
                            {p.categoria || "Repuesto"}
                          </span>
                        )}
                        {p.codigo && (
                          <span className="font-mono text-[10px] text-neutral-400 bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-800 shrink-0">
                            #{p.codigo}
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-xs sm:text-sm text-neutral-100 line-clamp-2 leading-snug group-hover:text-amber-400 transition-colors">
                        {p.nombre}
                      </h4>
                    </div>

                    <div className="pt-2 border-t border-neutral-800 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-mono font-black text-sm sm:text-base text-white">
                          {formatMoney(price)}
                        </div>
                      </div>

                      {inStock && (
                        <Button
                          size="sm"
                          onClick={(e) => handleQuickAddClick(e, p)}
                          className="h-8 px-2.5 bg-neutral-800 hover:bg-amber-500 hover:text-neutral-950 text-neutral-200 text-xs font-bold rounded-lg transition-colors shrink-0"
                          title="Añadir a cotización"
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

      {/* Footer Técnico */}
      <footer className="mt-16 border-t border-neutral-800 bg-neutral-900 py-8 px-4 text-center text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto space-y-2">
          <p className="font-bold text-sm text-neutral-300 uppercase tracking-wider">
            {negocio.nombre}
          </p>
          <p className="text-[11px] text-neutral-500">
            Plataforma de ventas y catálogos en línea por{" "}
            <a href="https://operixerp.cloud" target="_blank" className="text-amber-400 hover:underline">
              Operix ERP
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
