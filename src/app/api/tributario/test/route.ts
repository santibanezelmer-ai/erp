import { NextResponse } from "next/server";
import { probarConexionSimpleAPI } from "@/lib/simpleapi";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { descifrarDato } from "@/lib/tributario-crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    let apiKey = body?.apiKey;

    // Si no se proporcionó apiKey explícita, buscar la guardada en la base de datos
    if (!apiKey) {
      const userSupabase = await createServerClient();
      const { data: { user } } = await userSupabase.auth.getUser();

      if (user) {
        const { data: profile } = await userSupabase
          .from("profiles")
          .select("negocio_id")
          .eq("id", user.id)
          .single();

        if (profile?.negocio_id) {
          const serviceDb: any = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rgyqtxoagsmkleebrmza.supabase.co",
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
          );

          const { data: cfg } = await serviceDb
            .from("configuracion_tributaria")
            .select("simpleapi_key")
            .eq("negocio_id", profile.negocio_id)
            .maybeSingle();

          if (cfg?.simpleapi_key) {
            apiKey = descifrarDato(cfg.simpleapi_key);
          }
        }
      }
    }

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, mensaje: "Debe ingresar una API Key para probar la conexión." },
        { status: 400 }
      );
    }

    const res = await probarConexionSimpleAPI(apiKey);
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, mensaje: err.message || "Error al conectar con SimpleAPI" },
      { status: 500 }
    );
  }
}
