"use client";

import { useCatalog } from "@/components/catalog/CatalogContext";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function CatalogPagination() {
  const {
    pagina,
    setPagina,
    totalPaginas,
    porPagina,
    setPorPagina,
    productosFiltrados,
  } = useCatalog();

  const totalProds = productosFiltrados.length;
  if (totalProds === 0) return null;

  const startIdx = (pagina - 1) * porPagina + 1;
  const endIdx = Math.min(pagina * porPagina, totalProds);

  // Generar números de página a mostrar
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPaginas <= 7) {
      for (let i = 1; i <= totalPaginas; i++) pages.push(i);
    } else {
      pages.push(1);
      if (pagina > 3) pages.push("...");
      const start = Math.max(2, pagina - 1);
      const end = Math.min(totalPaginas - 1, pagina + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (pagina < totalPaginas - 2) pages.push("...");
      pages.push(totalPaginas);
    }
    return pages;
  };

  return (
    <div className="pt-8 pb-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/60 text-xs">
      {/* Resumen */}
      <div className="text-muted-foreground text-center sm:text-left">
        Mostrando <strong className="text-foreground">{startIdx}</strong> a{" "}
        <strong className="text-foreground">{endIdx}</strong> de{" "}
        <strong className="text-foreground">{totalProds}</strong> productos
      </div>

      {/* Selector por Página */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground hidden md:inline">Por página:</span>
        <div className="inline-flex rounded-lg border border-border p-0.5 bg-background">
          {[12, 24, 48].map((num) => (
            <button
              key={num}
              onClick={() => setPorPagina(num)}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                porPagina === num
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      {/* Controles de Páginas */}
      {totalPaginas > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={pagina <= 1}
            onClick={() => setPagina(pagina - 1)}
            className="h-8 px-2.5 text-xs gap-1"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Anterior</span>
          </Button>

          <div className="flex items-center gap-1">
            {getPageNumbers().map((p, idx) => {
              if (p === "...") {
                return (
                  <span key={`dots-${idx}`} className="px-2 py-1 text-muted-foreground text-xs">
                    ...
                  </span>
                );
              }
              const isCurrent = p === pagina;
              return (
                <button
                  key={`page-${p}`}
                  onClick={() => setPagina(Number(p))}
                  className={`h-8 w-8 rounded-lg text-xs font-bold transition-all ${
                    isCurrent
                      ? "bg-primary text-primary-foreground shadow-2xs font-black"
                      : "border border-border bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            disabled={pagina >= totalPaginas}
            onClick={() => setPagina(pagina + 1)}
            className="h-8 px-2.5 text-xs gap-1"
          >
            <span className="hidden sm:inline">Siguiente</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
