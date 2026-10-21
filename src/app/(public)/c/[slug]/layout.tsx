import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rgyqtxoagsmkleebrmza.supabase.co";
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  let nombre = "Catálogo y Pedidos Online";
  let logoUrl = "https://operixerp.cloud/icons/icon-512x512.png";
  let descripcion =
    "Conoce nuestro catálogo oficial de productos y realiza tus pedidos en línea.";

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: neg } = await supabase
      .from("negocios")
      .select("id, nombre, slug, logo_url, perfil, direccion")
      .eq("slug", slug)
      .maybeSingle();

    if (neg) {
      if (neg.nombre) {
        nombre = neg.nombre;
        descripcion = `Catálogo digital oficial de ${neg.nombre}. Revisa nuestros productos disponibles, precios y haz tu pedido directamente por WhatsApp.`;
      }
      const rawLogo =
        neg.logo_url ||
        (neg.perfil?.startsWith("http") ? neg.perfil : null);
      if (rawLogo) {
        logoUrl = rawLogo;
      }
    }
  } catch (err) {
    console.error("Error al generar metadata de tienda:", err);
  }

  const url = `https://operixerp.cloud/c/${slug}`;

  return {
    title: `${nombre} | Catálogo y Pedidos Online`,
    description: descripcion,
    openGraph: {
      title: `${nombre} · Catálogo y Pedidos Online`,
      description: descripcion,
      url,
      siteName: `${nombre} en Operix ERP`,
      images: [
        {
          url: logoUrl,
          width: 800,
          height: 800,
          alt: `Logo de ${nombre}`,
        },
      ],
      locale: "es_CL",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `${nombre} · Catálogo y Pedidos Online`,
      description: descripcion,
      images: [logoUrl],
    },
  };
}

export default function CatalogoSlugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
