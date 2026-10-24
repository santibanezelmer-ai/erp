"use client";

import { useCatalog } from "@/components/catalog/CatalogContext";
import { BeautyGlowTheme } from "@/components/catalog/themes/BeautyGlowTheme";
import { AutoPartsProTheme } from "@/components/catalog/themes/AutoPartsProTheme";
import { FerreMaxTheme } from "@/components/catalog/themes/FerreMaxTheme";
import { FoodBistroTheme } from "@/components/catalog/themes/FoodBistroTheme";
import { MarketFreshTheme } from "@/components/catalog/themes/MarketFreshTheme";
import { FashionChicTheme } from "@/components/catalog/themes/FashionChicTheme";

export function ThemeRenderer() {
  const { themeId } = useCatalog();

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
