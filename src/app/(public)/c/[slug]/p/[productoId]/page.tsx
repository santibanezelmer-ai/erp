import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import CatalogoPublicoClient from "@/components/catalog/CatalogoPublicoClient";
import { loadPublicCatalog } from "@/lib/catalog-public.server";
import { precioUnitario } from "@/lib/promo";
import { etiquetaCategoria } from "@/lib/categorias";

interface PageProps {
  params: Promise<{ slug: string; productoId: string }>;
}

const BASE = "https://operixerp.cloud";

type ProductoPublico = {
  id: string;
  nombre: string;
  descripcion?: string | null;
  imagen_url?: string | null;
  categoria?: string | null;
  marca_id?: string | null;
  precio_venta: number | null;
  precio_promocional?: number | null;
  promo_vence_at?: string | null;
  stock?: number | null;
  sin_control_stock?: boolean | null;
};

// Una sola carga por request (metadata + página)
const cargar = cache(async (slug: string, productoId: string) => {
  const res = await loadPublicCatalog(slug);
  if (res.status !== "ok") return { res, producto: null };
  const producto = (res.data.productos as unknown as ProductoPublico[]).find((p) => p.id === productoId) ?? null;
  return { res, producto };
});

function absoluta(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//.test(url)) return url;
  return `${BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, productoId } = await params;
  const { res, producto } = await cargar(slug, productoId);
  if (res.status !== "ok" || !producto) {
    return { title: "Producto no encontrado | Operix ERP", robots: { index: false } };
  }
  const tienda = (res.data.negocio as { nombre?: string }).nombre || "Tienda";
  const precio = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(
    precioUnitario(producto)
  );
  const titulo = `${producto.nombre} (${precio}) · ${tienda}`;
  const descripcion =
    producto.descripcion?.trim() ||
    `${producto.nombre} a ${precio} en ${tienda}. Haz tu pedido en línea y recibe atención directa por WhatsApp.`;
  const url = `${BASE}/c/${slug}/p/${producto.id}`;
  const imagen = absoluta(producto.imagen_url) || absoluta(res.data.config?.logo_url);

  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: url },
    openGraph: {
      title: titulo,
      description: descripcion,
      url,
      siteName: `${tienda} en Operix ERP`,
      type: "website",
      locale: "es_CL",
      ...(imagen ? { images: [{ url: imagen, width: 800, height: 800, alt: producto.nombre }] } : {}),
    },
    twitter: { card: imagen ? "summary_large_image" : "summary", title: titulo, description: descripcion, ...(imagen ? { images: [imagen] } : {}) },
  };
}

export default async function PaginaProductoRuta({ params }: PageProps) {
  const { slug, productoId } = await params;
  const { res, producto } = await cargar(slug, productoId);
  if (res.status !== "ok" || !producto) notFound();

  const tienda = (res.data.negocio as { nombre?: string }).nombre || "Tienda";
  const marcas = res.data.marcas as { id: string; nombre: string }[];
  const marca = marcas.find((m) => m.id === producto.marca_id)?.nombre;
  const url = `${BASE}/c/${slug}/p/${producto.id}`;

  // Datos estructurados schema.org/Product (precio y disponibilidad en Google)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: producto.nombre,
    ...(producto.descripcion ? { description: producto.descripcion } : {}),
    ...(producto.imagen_url ? { image: absoluta(producto.imagen_url) } : {}),
    ...(producto.categoria ? { category: etiquetaCategoria(producto.categoria) } : {}),
    ...(marca ? { brand: { "@type": "Brand", name: marca } } : {}),
    url,
    offers: {
      "@type": "Offer",
      url,
      price: precioUnitario(producto),
      priceCurrency: "CLP",
      availability:
        producto.sin_control_stock || Number(producto.stock || 0) > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: tienda },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <CatalogoPublicoClient
        inicial={{ estado: "ok", data: res.data }}
        productoPaginaId={producto.id}
      />
    </>
  );
}
