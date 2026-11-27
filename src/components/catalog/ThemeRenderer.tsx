"use client";

import { useEffect, useMemo } from "react";

import { useCatalog } from "@/components/catalog/CatalogContext";
import { getThemeMetadata } from "@/components/catalog/themes/registry";
import { estiloTienda } from "@/lib/tienda-estilo";
import { BeautyGlowTheme } from "@/components/catalog/themes/BeautyGlowTheme";
import { AutoPartsProTheme } from "@/components/catalog/themes/AutoPartsProTheme";
import { FerreMaxTheme } from "@/components/catalog/themes/FerreMaxTheme";
import { FoodBistroTheme } from "@/components/catalog/themes/FoodBistroTheme";
import { MarketFreshTheme } from "@/components/catalog/themes/MarketFreshTheme";
import { FashionChicTheme } from "@/components/catalog/themes/FashionChicTheme";

export function ThemeRenderer() {
  const { themeId, config } = useCatalog();
  const { style, className, fuenteCss } = useMemo(
    () => estiloTienda(themeId, config, getThemeMetadata(themeId).defaultConfig),
    [themeId, config]
  );

  // Los modales (carrito, detalle) se abren en un portal fuera de este
  // contenedor: se copian las mismas variables al <body> mientras la tienda
  // está montada.
  useEffect(() => {
    const body = document.body;
    const entradas = Object.entries(style as Record<string, string>);
    entradas.forEach(([k, v]) => body.style.setProperty(k, v));
    const clases = className.split(" ");
    body.classList.add(...clases);
    return () => {
      entradas.forEach(([k]) => body.style.removeProperty(k));
      body.classList.remove(...clases);
    };
  }, [style, className]);

  return (
    <div className={className} style={style}>
      {fuenteCss && <link rel="stylesheet" href={fuenteCss} precedence="default" />}
      <Plantilla themeId={themeId} />
    </div>
  );
}

function Plantilla({ themeId }: { themeId: string }) {
  switch (themeId) {
    case "autoparts":
      return <AutoPartsProTheme />;
    case "ferremax":
      return <FerreMaxTheme />;
    case "food":
      return <FoodBistroTheme />;
    case "market":
      return <MarketFreshTheme />;
    case "fashion":
      return <FashionChicTheme />;
    case "beauty":
    default:
      return <BeautyGlowTheme />;
  }
}
