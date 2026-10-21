"use client";

import { useEffect, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import type {
  ThemeId,
  ThemeCustomConfig,
  Marca,
} from "@/types/theme.types";
import { getThemeMetadata } from "@/components/catalog/themes/registry";
import { CatalogProvider } from "@/components/catalog/CatalogContext";
import { ThemeRenderer } from "@/components/catalog/ThemeRenderer";
import { Store, Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Negocio = Database["public"]["Tables"]["negocios"]["Row"];
type Producto = Database["public"]["Tables"]["productos"]["Row"];
type Variante = Database["public"]["Tables"]["producto_variantes"]["Row"];

export default function CatalogoPublicoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;
  const searchParams = useSearchParams();

  // Permite previsualizar temas en vivo desde el panel administrativo
  const previewThemeParam = searchParams.get("theme") as ThemeId | null;
  const isPreview = searchParams.get("preview") === "true";

  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [variantes, setVariantes] = useState<Variante[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [themeId, setThemeId] = useState<ThemeId>("beauty");
  const [themeConfig, setThemeConfig] = useState<ThemeCustomConfig>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchCatalog = async () => {
      setLoading(true);
      const supabase = createClient();

      try {
        // 1. Obtener negocio por slug
        const { data: neg, error: negErr } = await supabase
          .from("negocios")
          .select("*")
          .eq("slug", slug)
          .maybeSingle();

        if (negErr || !neg) {
          console.warn(`[Catalogo] Negocio no encontrado para slug '${slug}':`, negErr);
          setNotFound(true);
          return;
        }

        // 2. Obtener configuración de plantilla y datos en paralelo
        const [configRes, prodsRes, varsRes, marcasRes] = await Promise.all([
          supabase
            .from("configuracion")
            .select("plantilla_id, plantilla_config, plantilla_draft, telefono, logo_url")
            .eq("negocio_id", neg.id)
            .maybeSingle(),
          supabase
            .from("productos")
            .select("*")
            .eq("negocio_id", neg.id)
            .eq("activo", true)
            .order("nombre", { ascending: true }),
          supabase
            .from("producto_variantes")
            .select("*")
            .eq("negocio_id", neg.id)
            .eq("activo", true)
            .order("nombre", { ascending: true }),
          supabase
            .from("marcas_public" as any)
            .select("id, nombre, logo_url")
            .eq("negocio_id", neg.id)
            .order("nombre", { ascending: true }),
        ]);

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
        <h1 className="text-2xl font-bold tracking-tight">Tienda no encontrada</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          El catálogo que buscas no existe o ha cambiado su dirección.
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
    >
      <ThemeRenderer />
    </CatalogProvider>
  );
}
