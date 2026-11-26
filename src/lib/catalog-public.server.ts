import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Carga del catálogo público (/c/[slug]) para visitantes SIN sesión.
 *
 * Los visitantes anónimos no pueden leer las tablas base (negocios,
 * configuracion, productos...) con `select("*")`: la BD sólo les concede
 * columnas puntuales y configuracion no tiene acceso anónimo (contiene
 * libredte_config, rut, etc.). Por eso el catálogo se arma aquí, en el
 * servidor, con la service role y una lista EXPLÍCITA de columnas seguras.
 *
 * NO agregar columnas sensibles: precio_costo, proveedor, notas, stock_min,
 * codigo_interno, sucursal_id, rut, plan, kds_token, libredte_config.
 */

const NEGOCIO_COLS = "id, nombre, slug, tipo_negocio, logo_url, perfil, direccion";
const CONFIG_COLS = "plantilla_id, plantilla_config, plantilla_draft, telefono, logo_url";
const PRODUCTO_COLS =
  "id, negocio_id, nombre, descripcion, categoria, categorias, precio_venta, " +
  "precio_promocional, promo_vence_at, stock, imagen_url, galeria, unidad, " +
  "cantidad_minima, is_new_arrival, marca_id, codigo, sin_control_stock, activo";
const VARIANTE_COLS =
  "id, producto_id, negocio_id, nombre, codigo, stock, precio_venta, " +
  "precio_promocional, promo_vence_at, imagen_url, activo";
const MARCA_COLS = "id, nombre, logo_url";

export type PublicCatalog = {
  negocio: Record<string, unknown>;
  config: {
    plantilla_id: string | null;
    plantilla_config: unknown;
    plantilla_draft: unknown;
    telefono: string | null;
    logo_url: string | null;
  } | null;
  productos: Record<string, unknown>[];
  variantes: Record<string, unknown>[];
  marcas: Record<string, unknown>[];
};

export type PublicCatalogResult =
  | { status: "ok"; data: PublicCatalog }
  | { status: "not_found" }
  | { status: "inactive" }
  | { status: "error"; message: string };

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function loadPublicCatalog(
  slug: string,
  { includeDraft = false }: { includeDraft?: boolean } = {}
): Promise<PublicCatalogResult> {
  const supabase = adminClient();
  if (!supabase) {
    console.error("[catalogo-publico] Falta SUPABASE_SERVICE_ROLE_KEY o NEXT_PUBLIC_SUPABASE_URL");
    return { status: "error", message: "Catálogo no configurado" };
  }

  const { data: neg, error: negErr } = await supabase
    .from("negocios")
    .select(NEGOCIO_COLS)
    .eq("slug", slug)
    .maybeSingle();

  if (negErr) {
    console.error(`[catalogo-publico] Error buscando negocio '${slug}':`, negErr);
    return { status: "error", message: "Error al cargar la tienda" };
  }
  if (!neg) return { status: "not_found" };

  const negocioId = (neg as { id: string }).id;

  // Misma regla que la BD aplica a anon (vistas *_public y crear_pedido_catalogo):
  // el catálogo público sólo está disponible con un plan activo.
  const { data: hasPro, error: proErr } = await supabase.rpc("negocio_has_pro", {
    _negocio_id: negocioId,
  });
  if (proErr) {
    console.error(`[catalogo-publico] Error verificando plan de '${slug}':`, proErr);
    return { status: "error", message: "Error al cargar la tienda" };
  }
  if (!hasPro) return { status: "inactive" };

  const [configRes, prodsRes, varsRes, marcasRes] = await Promise.all([
    supabase.from("configuracion").select(CONFIG_COLS).eq("negocio_id", negocioId).maybeSingle(),
    supabase
      .from("productos")
      .select(PRODUCTO_COLS)
      .eq("negocio_id", negocioId)
      .eq("activo", true)
      .order("nombre", { ascending: true }),
    supabase
      .from("producto_variantes")
      .select(VARIANTE_COLS)
      .eq("negocio_id", negocioId)
      .eq("activo", true)
      .order("nombre", { ascending: true }),
    supabase
      .from("marcas")
      .select(MARCA_COLS)
      .eq("negocio_id", negocioId)
      .eq("activa", true)
      .order("nombre", { ascending: true }),
  ]);

  for (const [name, res] of [
    ["configuracion", configRes],
    ["productos", prodsRes],
    ["variantes", varsRes],
    ["marcas", marcasRes],
  ] as const) {
    if (res.error) console.error(`[catalogo-publico] Error leyendo ${name} de '${slug}':`, res.error);
  }

  const cfg = configRes.data as PublicCatalog["config"];
  return {
    status: "ok",
    data: {
      negocio: neg as Record<string, unknown>,
      config: cfg
        ? { ...cfg, plantilla_draft: includeDraft ? cfg.plantilla_draft : null }
        : null,
      productos: (prodsRes.data ?? []) as unknown as Record<string, unknown>[],
      variantes: (varsRes.data ?? []) as unknown as Record<string, unknown>[],
      marcas: (marcasRes.data ?? []) as unknown as Record<string, unknown>[],
    },
  };
}
