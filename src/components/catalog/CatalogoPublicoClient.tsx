"use client";

import { useEffect, useMemo, useState } from "react";
import type { ThemeId, ThemeCustomConfig } from "@/types/theme.types";
import { getThemeMetadata } from "@/components/catalog/themes/registry";
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

  // Vista previa en vivo desde el editor de Tienda Online (mismo origen):
  // aplica el borrador sin guardarlo.
  const [enVivo, setEnVivo] = useState<{ themeId: ThemeId; config: ThemeCustomConfig } | null>(null);
  useEffect(() => {
    if (!isPreview) return;
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { type?: string; themeId?: ThemeId; config?: ThemeCustomConfig };
      if (d?.type !== "operix:preview-config" || !d.themeId || !d.config) return;
      setEnVivo({ themeId: d.themeId, config: d.config });
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [isPreview]);

  const themeId = enVivo?.themeId ?? vista?.themeId;
  const themeConfig = enVivo
    ? { ...getThemeMetadata(enVivo.themeId).defaultConfig, ...enVivo.config }
    : vista?.themeConfig;

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
      themeId={themeId!}
      config={themeConfig!}
      initialProductId={initialProductId}
    >
      <ThemeRenderer />
    </CatalogProvider>
  );
}
