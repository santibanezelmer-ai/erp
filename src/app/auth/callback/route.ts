import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/format";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  const supabase = await createClient();
  let authSucceeded = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authSucceeded = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    authSucceeded = !error;
  }

  if (authSucceeded) {
    // Si el usuario acaba de confirmar su cuenta y tenía un negocio pendiente desde /registro, crearlo automáticamente
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("negocio_id")
          .eq("id", user.id)
          .maybeSingle();

        const pendingBusiness =
          typeof user.user_metadata?.negocio_pendiente === "string"
            ? user.user_metadata.negocio_pendiente.trim()
            : "";
        const pendingType =
          user.user_metadata?.tipo_negocio_pendiente === "restaurant" ? "restaurant" : "tienda";

        if (!profile?.negocio_id && pendingBusiness) {
          const slug = slugify(pendingBusiness) || `n-${Date.now()}`;
          await (supabase.rpc as any)("create_negocio_for_user", {
            _nombre: pendingBusiness,
            _slug: slug,
            _tipo: pendingType,
          });
        }
      }
    } catch (err) {
      console.error("[GET /auth/callback] Error completando negocio pendiente:", err);
    }

    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth-code-error`);
}
