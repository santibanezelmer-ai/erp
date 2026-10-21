"use client";

import { useCatalog } from "@/components/catalog/CatalogContext";
import { LayoutGrid, List } from "lucide-react";

export function CatalogViewToggle() {
  const { vistaModo, setVistaModo } = useCatalog();

  return (
    <div className="inline-flex rounded-lg border border-border p-0.5 bg-background shadow-2xs">
      <button
        type="button"
        onClick={() => setVistaModo("cuadros")}
        className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
          vistaModo === "cuadros"
            ? "bg-primary text-primary-foreground shadow-2xs"
            : "text-muted-foreground hover:text-foreground"
        }`}
        title="Vista en cuadros (Grilla)"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Cuadros</span>
      </button>

      <button
        type="button"
        onClick={() => setVistaModo("lista")}
        className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
          vistaModo === "lista"
            ? "bg-primary text-primary-foreground shadow-2xs"
            : "text-muted-foreground hover:text-foreground"
        }`}
        title="Vista en lista detallada"
      >
        <List className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Lista</span>
      </button>
    </div>
  );
}
