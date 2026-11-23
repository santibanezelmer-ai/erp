import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface GeoInfo {
  countryCode: string | null;
  countryName: string | null;
  region: string | null;
  city: string | null;
  timezone: string | null;
  source: "vercel-edge" | "cloudflare" | "browser" | "unknown";
  capturedAt: string;
}

const COUNTRY_NAMES: Record<string, string> = {
  CL: "Chile",
  AR: "Argentina",
  PE: "Perú",
  CO: "Colombia",
  MX: "México",
  UY: "Uruguay",
  PY: "Paraguay",
  BO: "Bolivia",
  EC: "Ecuador",
  VE: "Venezuela",
  BR: "Brasil",
  ES: "España",
  US: "Estados Unidos",
  PA: "Panamá",
  CR: "Costa Rica",
  DO: "República Dominicana",
  GT: "Guatemala",
  SV: "El Salvador",
  HN: "Honduras",
  NI: "Nicaragua",
};

function decodeHeader(val: string | null): string | null {
  if (!val) return null;
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
}

function extractGeoFromHeaders(req: NextRequest, bodyHints?: { timezone?: string; locale?: string }): GeoInfo {
  const vercelCountry = req.headers.get("x-vercel-ip-country");
  const vercelRegion = decodeHeader(req.headers.get("x-vercel-ip-country-region"));
  const vercelCity = decodeHeader(req.headers.get("x-vercel-ip-city"));
  const vercelTz = req.headers.get("x-vercel-ip-timezone");

  const cfCountry = req.headers.get("cf-ipcountry");
  const cfCity = decodeHeader(req.headers.get("cf-ipcity"));

  const countryCode = (vercelCountry || cfCountry || null)?.toUpperCase() || null;
  let countryName = countryCode ? COUNTRY_NAMES[countryCode] || countryCode : null;

  // Fallback discreto usando zona horaria del navegador si estamos en localhost/desarrollo sin headers CDN
  const tz = vercelTz || bodyHints?.timezone || null;
  let city = vercelCity || cfCity || null;

  if (!countryName && tz) {
    if (tz.includes("Santiago") || tz.includes("Punta_Arenas")) {
      countryName = "Chile";
      if (!city) city = tz.split("/")[1]?.replace(/_/g, " ") || "Santiago";
    } else if (tz.includes("Buenos_Aires") || tz.includes("Cordoba") || tz.includes("Mendoza")) {
      countryName = "Argentina";
      if (!city) city = tz.split("/").pop()?.replace(/_/g, " ") || "Buenos Aires";
    } else if (tz.includes("Lima")) {
      countryName = "Perú";
      if (!city) city = "Lima";
    } else if (tz.includes("Bogota")) {
      countryName = "Colombia";
      if (!city) city = "Bogotá";
    } else if (tz.includes("Mexico_City") || tz.includes("Monterrey")) {
      countryName = "México";
      if (!city) city = tz.split("/").pop()?.replace(/_/g, " ") || "Ciudad de México";
    }
  }

  const source: GeoInfo["source"] = vercelCountry
    ? "vercel-edge"
    : cfCountry
    ? "cloudflare"
    : tz
    ? "browser"
    : "unknown";

  return {
    countryCode,
    countryName,
    region: vercelRegion,
    city,
    timezone: tz,
    source,
    capturedAt: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const geo = extractGeoFromHeaders(req);
  return NextResponse.json({ geo });
}

/**
 * Registra de forma silenciosa y discreta el país y ciudad desde donde se creó o accedió la tienda.
 * Guarda la metadata en `configuracion.modulos_override.__geo` sin alterar ninguna funcionalidad del ERP
 * ni requerir permisos de GPS del usuario.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const geo = extractGeoFromHeaders(req, {
      timezone: body?.timezone,
      locale: body?.locale,
    });

    if (!geo.countryName && !geo.city) {
      return NextResponse.json({ ok: true, skipped: true, geo });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    // Obtener el negocio del usuario
    let negocioId: string | null = body?.negocioId || null;
    if (!negocioId) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("negocio_id")
        .eq("id", user.id)
        .maybeSingle();
      negocioId = prof?.negocio_id || null;
    }

    if (!negocioId) {
      return NextResponse.json({ ok: true, geo, saved: false });
    }

    // Leer configuración actual para no sobrescribir si ya tenía origen de creación registrado
    const { data: cfg } = await supabase
      .from("configuracion")
      .select("id, modulos_override")
      .eq("negocio_id", negocioId)
      .maybeSingle();

    const currentOverrides =
      cfg?.modulos_override && typeof cfg.modulos_override === "object" && !Array.isArray(cfg.modulos_override)
        ? (cfg.modulos_override as Record<string, any>)
        : {};

    // Si ya tiene __geo con ciudad y país de creación, lo conservamos y solo actualizamos lastGeo y la última actividad humana
    const nowIso = new Date().toISOString();
    const existingCreationGeo = currentOverrides.__geo;
    const updatedOverrides = {
      ...currentOverrides,
      __last_human_activity_at: nowIso,
      __geo: existingCreationGeo?.countryName
        ? existingCreationGeo
        : {
            countryCode: geo.countryCode,
            countryName: geo.countryName,
            region: geo.region,
            city: geo.city,
            timezone: geo.timezone,
            source: geo.source,
            capturedAt: geo.capturedAt,
          },
      __last_geo: {
        countryCode: geo.countryCode,
        countryName: geo.countryName,
        city: geo.city,
        capturedAt: geo.capturedAt,
      },
    };

    if (cfg?.id) {
      await supabase
        .from("configuracion")
        .update({ modulos_override: updatedOverrides })
        .eq("negocio_id", negocioId);
    } else {
      await supabase.from("configuracion").insert({
        negocio_id: negocioId,
        modulos_override: updatedOverrides,
      });
    }

    return NextResponse.json({ ok: true, saved: true, geo: updatedOverrides.__geo });
  } catch (err: any) {
    console.warn("[GeoTrack] Error silencioso:", err?.message);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
