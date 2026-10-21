"use client";

import { useCatalog } from "@/components/catalog/CatalogContext";
import { BeautyGlowTheme } from "@/components/catalog/themes/BeautyGlowTheme";
import { AutoPartsProTheme } from "@/components/catalog/themes/AutoPartsProTheme";
import { FerreMaxTheme } from "@/components/catalog/themes/FerreMaxTheme";

export function ThemeRenderer() {
  const { themeId } = useCatalog();

  switch (themeId) {
    case "autoparts":
      return <AutoPartsProTheme />;
    case "ferremax":
      return <FerreMaxTheme />;
    case "beauty":
    default:
      return <BeautyGlowTheme />;
  }
}
