import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import CatalogoPublicoClient from "@/components/catalog/CatalogoPublicoClient";
import type { ThemeId } from "@/types/theme.types";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ p?: string; theme?: string; preview?: string }>;
}

function ensureAbsoluteUrl(url: string | null | undefined, fallback: string): string {
  if (!url) return fallback;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `https://operixerp.cloud${url}`;
  return `https://operixerp.cloud/${url}`;
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { p: productId } = await searchParams;

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rgyqtxoagsmkleebrmza.supabase.co";
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  const defaultLogo = "https://operixerp.cloud/icons/icon-512x512.png";
  const baseUrl = `https://operixerp.cloud/c/${slug}`;

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Obtener datos del negocio
    const { data: neg } = await supabase
      .from("negocios")
      .select("id, nombre, slug, logo_url, perfil, direccion")
      .eq("slug", slug)
      .maybeSingle();

    if (!neg) {
      return {
        title: "Tienda no encontrada | Operix ERP",
        description: "El catálogo que buscas no existe o ha cambiado su dirección.",
      };
    }

    const storeName = neg.nombre || "Catálogo y Pedidos Online";
    const rawLogo =
      neg.logo_url ||
      (neg.perfil?.startsWith("http") ? neg.perfil : null);
    const storeLogo = ensureAbsoluteUrl(rawLogo, defaultLogo);

    // 2. Si viene un producto específico (?p=...)
    if (productId) {
      const { data: prod } = await supabase
        .from("productos")
        .select("id, nombre, descripcion, precio, precio_promocional, imagen_url, categoria")
        .eq("id", productId)
        .eq("negocio_id", neg.id)
        .maybeSingle();

      if (prod) {
        const precio =
          prod.precio_promocional != null && prod.precio_promocional > 0
            ? prod.precio_promocional
            : prod.precio;

        const precioStr = new Intl.NumberFormat("es-CL", {
          style: "currency",
          currency: "CLP",
          maximumFractionDigits: 0,
        }).format(precio);

        const pageTitle = `${prod.nombre} (${precioStr}) · ${storeName}`;
        const prodDesc =
          prod.descripcion?.trim() ||
          `¡Disponible en ${storeName} por ${precioStr}! Revisa los detalles de ${prod.nombre} y haz tu pedido directamente por WhatsApp.`;

        const prodImg = ensureAbsoluteUrl(prod.imagen_url, storeLogo);
        const productUrl = `${baseUrl}?p=${prod.id}`;

        return {
          title: pageTitle,
          description: prodDesc,
          openGraph: {
            title: pageTitle,
            description: prodDesc,
            url: productUrl,
            siteName: `${storeName} en Operix ERP`,
            images: [
              {
                url: prodImg,
                width: 800,
                height: 800,
                alt: prod.nombre,
              },
            ],
            locale: "es_CL",
            type: "website",
          },
          twitter: {
            card: "summary_large_image",
            title: pageTitle,
            description: prodDesc,
            images: [prodImg],
          },
        };
      }
    }

    // 3. Metadata por defecto de la tienda (cuando no se especifica producto)
    const storeDescription = `Catálogo digital oficial de ${storeName}. Revisa nuestros productos disponibles, precios y haz tu pedido directamente por WhatsApp.`;

    return {
      title: `${storeName} | Catálogo y Pedidos Online`,
      description: storeDescription,
      openGraph: {
        title: `${storeName} · Catálogo y Pedidos Online`,
        description: storeDescription,
        url: baseUrl,
        siteName: `${storeName} en Operix ERP`,
        images: [
          {
            url: storeLogo,
            width: 800,
            height: 800,
            alt: `Logo de ${storeName}`,
          },
        ],
        locale: "es_CL",
        type: "website",
      },
      twitter: {
        card: "summary",
        title: `${storeName} · Catálogo y Pedidos Online`,
        description: storeDescription,
        images: [storeLogo],
      },
    };
  } catch (err) {
    console.error("Error al generar metadata de catálogo:", err);
    return {
      title: "Catálogo y Pedidos Online | Operix ERP",
      description: "Conoce nuestro catálogo oficial de productos y realiza tus pedidos en línea.",
    };
  }
}

export default async function CatalogoPublicoPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const { p: productId, theme, preview } = await searchParams;

  return (
    <CatalogoPublicoClient
      slug={slug}
      initialProductId={productId}
      previewTheme={(theme as ThemeId) || null}
      isPreview={preview === "true"}
    />
  );
}
