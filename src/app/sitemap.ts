import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const BASE = "https://operixerp.cloud";

// Se regenera como máximo una vez por hora
export const revalidate = 3600;

/**
 * Mapa del sitio para buscadores: portada, tiendas públicas activas (con plan)
 * y la página de cada producto activo. Se arma con la service role y solo
 * expone URLs que ya son públicas.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entradas: MetadataRoute.Sitemap = [{ url: BASE, changeFrequency: "weekly", priority: 1 }];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return entradas;

  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data: negocios } = await supabase.from("negocios").select("id, slug").not("slug", "is", null);
    if (!negocios?.length) return entradas;

    // Solo tiendas con catálogo público disponible (plan activo)
    const activos = (
      await Promise.all(
        negocios.map(async (n) => {
          const { data } = await supabase.rpc("negocio_has_pro", { _negocio_id: n.id });
          return data ? n : null;
        })
      )
    ).filter((n): n is { id: string; slug: string } => !!n);
    if (!activos.length) return entradas;

    const slugPorId = new Map(activos.map((n) => [n.id, n.slug]));
    for (const n of activos) {
      entradas.push({ url: `${BASE}/c/${n.slug}`, changeFrequency: "daily", priority: 0.8 });
    }

    const { data: productos } = await supabase
      .from("productos")
      .select("id, negocio_id, updated_at")
      .in("negocio_id", activos.map((n) => n.id))
      .eq("activo", true)
      .limit(45000);

    for (const p of productos ?? []) {
      const slug = slugPorId.get(p.negocio_id);
      if (!slug) continue;
      entradas.push({
        url: `${BASE}/c/${slug}/p/${p.id}`,
        ...(p.updated_at ? { lastModified: new Date(p.updated_at) } : {}),
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  } catch (err) {
    console.error("[sitemap] Error generando el mapa del sitio:", err);
  }
  return entradas;
}
