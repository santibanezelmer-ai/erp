"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Database } from "@/types/database.types";
import type {
  ThemeId,
  ThemeCustomConfig,
  Marca,
} from "@/types/theme.types";
import { getThemeMetadata } from "@/components/catalog/themes/registry";
import { CatalogProvider } from "@/components/catalog/CatalogContext";
import { ThemeRenderer } from "@/components/catalog/ThemeRenderer";
import { Store, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Negocio = Database["public"]["Tables"]["negocios"]["Row"];
type Producto = Database["public"]["Tables"]["productos"]["Row"];
type Variante = Database["public"]["Tables"]["producto_variantes"]["Row"];

interface CatalogoPublicoClientProps {
  slug: string;
  initialProductId?: string;
  previewTheme?: ThemeId | null;
  isPreview?: boolean;
}

export default function CatalogoPublicoClient({
  slug,
  initialProductId: propProductId,
  previewTheme: propTheme,
  isPreview: propIsPreview,
}: CatalogoPublicoClientProps) {
  const searchParams = useSearchParams();

  // Permite previsualizar temas en vivo desde el panel administrativo (vía props o searchParams)
  const previewThemeParam = propTheme || (searchParams?.get("theme") as ThemeId | null);
  const isPreview = propIsPreview ?? searchParams?.get("preview") === "true";
  const initialProductId = propProductId || searchParams?.get("p") || undefined;

  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [variantes, setVariantes] = useState<Variante[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [themeId, setThemeId] = useState<ThemeId>("beauty");
  const [themeConfig, setThemeConfig] = useState<ThemeCustomConfig>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [inactive, setInactive] = useState(false);

  useEffect(() => {
    const fetchCatalog = async () => {
      setLoading(true);
      setNotFound(false);
      setInactive(false);
      try {
        // El catálogo se carga desde el servidor: un visitante sin sesión
        // no tiene permisos para leer las tablas base directamente.
        const qs = isPreview ? "?preview=true" : "";
        const res = await fetch(
          `/api/public/catalogo/${encodeURIComponent(slug)}${qs}`,
          { cache: "no-store" }
        );

        if (!res.ok) {
          if (res.status === 403) {
            setInactive(true);
          } else {
            console.warn(`[Catalogo] No se pudo cargar '${slug}' (HTTP ${res.status})`);
          }
          setNotFound(true);
          return;
        }

        const payload = await res.json();
        const neg = payload.negocio as Negocio;
        const prodsRes = { data: payload.productos as Producto[] };
        const varsRes = { data: payload.variantes as Variante[] };
        const marcasRes = { data: payload.marcas as Marca[] };
        const configRes = { data: payload.config as {
          plantilla_id: string | null;
          plantilla_config: unknown;
          plantilla_draft: unknown;
          telefono: string | null;
          logo_url: string | null;
        } | null };

        const cfgData = configRes.data;

        // Combinar datos del negocio con configuración (teléfono, logo)
        const fullNegocio: Negocio = {
          ...neg,
          logo_url:
            cfgData?.logo_url ||
            neg.logo_url ||
            (neg.perfil?.startsWith("http") || neg.perfil?.startsWith("data:") ? neg.perfil : null),
          // Inyectamos teléfono de configuracion si existe
          ...((cfgData?.telefono ? { telefono: cfgData.telefono } : {}) as any),
        };
        setNegocio(fullNegocio);

        // Determinar plantilla por defecto según rubro si no tiene una guardada
        let defaultThemeByRubro: ThemeId = "beauty";
        const tipoNorm = (neg.tipo_negocio || "").toLowerCase();
        if (tipoNorm.includes("auto") || tipoNorm.includes("repuesto") || tipoNorm.includes("mecanic")) {
          defaultThemeByRubro = "autoparts";
        } else if (tipoNorm.includes("ferreter") || tipoNorm.includes("construc") || tipoNorm.includes("herramient")) {
          defaultThemeByRubro = "ferremax";
        }

        let activeTheme: ThemeId = (cfgData?.plantilla_id as ThemeId) || defaultThemeByRubro;
        let activeConfig: ThemeCustomConfig =
          (cfgData?.plantilla_config as ThemeCustomConfig) || {};

        // Si es preview y hay borrador
        if (isPreview && cfgData?.plantilla_draft) {
          activeConfig = {
            ...activeConfig,
            ...(cfgData.plantilla_draft as ThemeCustomConfig),
          };
        }

        // Si se fuerza tema por URL para vista previa
        if (previewThemeParam) {
          activeTheme = previewThemeParam;
        }

        // Fallback a defaults de la plantilla si falta configuración
        const themeMeta = getThemeMetadata(activeTheme);
        const mergedConfig: ThemeCustomConfig = {
          ...themeMeta.defaultConfig,
          ...activeConfig,
        };

        setThemeId(activeTheme);
        setThemeConfig(mergedConfig);
        setProductos(prodsRes.data || []);
        setVariantes(varsRes.data || []);
        setMarcas((marcasRes.data as unknown as Marca[]) || []);
      } catch (err) {
        console.error("Error al cargar catálogo:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchCatalog();
  }, [slug, previewThemeParam, isPreview]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Cargando catálogo en línea...
        </p>
      </div>
    );
  }

  if (notFound || !negocio) {
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
      negocio={negocio}
      productos={productos}
      variantes={variantes}
      marcas={marcas}
      themeId={themeId}
      config={themeConfig}
      initialProductId={initialProductId}
    >
      <ThemeRenderer />
    </CatalogProvider>
  );
}
