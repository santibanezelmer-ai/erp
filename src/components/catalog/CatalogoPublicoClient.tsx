"use client";

import { useMemo } from "react";
import type { ThemeId } from "@/types/theme.types";
import { CatalogProvider } from "@/components/catalog/CatalogContext";
import { ThemeRenderer } from "@/components/catalog/ThemeRenderer";
import { armarCatalogo, type CatalogInicial } from "@/lib/catalog-view";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface CatalogoPublicoClientProps {
  /** Datos de la tienda ya cargados en el servidor (la página llega completa al navegador y a Google). */
  inicial: CatalogInicial;
  initialProductId?: string;
  previewTheme?: ThemeId | null;
  isPreview?: boolean;
}

export default function CatalogoPublicoClient({
  inicial,
  initialProductId,
  previewTheme,
  isPreview,
}: CatalogoPublicoClientProps) {
  const vista = useMemo(
    () =>
      inicial.estado === "ok"
        ? armarCatalogo(inicial.data, { isPreview, previewTheme })
        : null,
    [inicial, isPreview, previewTheme]
  );

  const inactive = inicial.estado === "inactive";
  const negocio = vista?.negocio ?? null;
  const notFound = !vista;

  if (notFound || !negocio || !vista) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background text-foreground">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Store className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          {inactive ? "Tienda no disponible" : "Tienda no encontrada"}
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          {inactive
            ? "Este catálogo no está disponible en este momento. Vuelve a intentarlo más tarde."
            : "El catálogo que buscas no existe o ha cambiado su dirección."}
        </p>
        <Link href="/" className="mt-6">
          <Button variant="outline" size="sm">
            Ir al Inicio de Operix ERP
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <CatalogProvider
      negocio={vista.negocio}
      productos={vista.productos}
      variantes={vista.variantes}
      marcas={vista.marcas}
      themeId={vista.themeId}
      config={vista.themeConfig}
      initialProductId={initialProductId}
    >
      <ThemeRenderer />
    </CatalogProvider>
  );
}
