import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import {
  getServiceSupabase,
  mapCampaignRowToRecord,
  RecuperacionCampaignRecord,
  saveCampaignState,
} from "@/lib/recuperacion.server";

/**
 * Registra el clic del propietario en el botón "ACTIVAR MI MES GRATIS" del correo
 * y redirige al panel de la tienda (`/planes?activar_mes_gratis=1&token=...`) para que
 * el propietario revise y acepte expresamente la promoción (sin activarla por el solo clic).
 */
export async function GET(req: NextRequest) {
  const negocioId = req.nextUrl.searchParams.get("negocio");
  const token = req.nextUrl.searchParams.get("token") || "";
  const step = req.nextUrl.searchParams.get("step") === "2" ? 2 : 1;

  const destination = new URL("/planes", req.nextUrl.origin || "https://operixerp.cloud");
  destination.searchParams.set("activar_mes_gratis", "1");
  if (negocioId) destination.searchParams.set("negocio", negocioId);
  if (token) destination.searchParams.set("token", token);

  if (negocioId) {
    try {
      const supabase = getServiceSupabase() || (await createServerSupabase());
      const nowIso = new Date().toISOString();

      // 1. Actualizar en tabla recuperacion_campanas si existe
      const { data: row } = await supabase
        .from("recuperacion_campanas")
        .select("*")
        .eq("negocio_id", negocioId)
        .maybeSingle();

      if (row) {
        const base = mapCampaignRowToRecord(row);
        const updated: RecuperacionCampaignRecord = {
          ...base,
          primer_clic_at: base.primer_clic_at || nowIso,
          correo_1_abierto_at: base.correo_1_abierto_at || nowIso,
          primer_abierto_at: base.primer_abierto_at || nowIso,
          ...(step === 2
            ? {
                correo_2_clic_at: base.correo_2_clic_at || nowIso,
                correo_2_abierto_at: base.correo_2_abierto_at || nowIso,
                correo_2_estado: "clic",
              }
            : {
                correo_1_clic_at: base.correo_1_clic_at || nowIso,
                correo_1_estado: "clic",
              }),
        };
        await saveCampaignState(supabase, updated);
      } else {
        // 2. Actualizar en configuracion.modulos_override.__recuperacion_campana
        const { data: cfg } = await supabase
          .from("configuracion")
          .select("modulos_override")
          .eq("negocio_id", negocioId)
          .maybeSingle();

        const ov =
          cfg?.modulos_override && typeof cfg.modulos_override === "object"
            ? (cfg.modulos_override as Record<string, any>)
            : {};

        if (ov.__recuperacion_campana) {
          const camp = ov.__recuperacion_campana as RecuperacionCampaignRecord;
          const updated: RecuperacionCampaignRecord = {
            ...camp,
            primer_clic_at: camp.primer_clic_at || nowIso,
            primer_abierto_at: camp.primer_abierto_at || nowIso,
            ...(step === 2
              ? {
                  correo_2_clic_at: camp.correo_2_clic_at || nowIso,
                  correo_2_abierto_at: camp.correo_2_abierto_at || nowIso,
                  correo_2_estado: "clic",
                }
              : {
                  correo_1_clic_at: camp.correo_1_clic_at || nowIso,
                  correo_1_abierto_at: camp.correo_1_abierto_at || nowIso,
                  correo_1_estado: "clic",
                }),
          };
          await saveCampaignState(supabase, updated);
        }
      }
    } catch (err) {
      console.warn("[Recuperacion Click Tracking]:", err);
    }
  }

  return NextResponse.redirect(destination);
}
