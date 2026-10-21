import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPlan, MP_CURRENCY, type Ciclo, type PlanId } from "@/lib/mercadopago";
import { mpFetch, buildExternalReference } from "@/lib/mercadopago.server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = (await req.json()) as { plan: PlanId; ciclo: Ciclo };
    const { plan: planId, ciclo } = body;

    if (!planId || !ciclo) {
      return NextResponse.json({ error: "Parámetros incompletos" }, { status: 400 });
    }

    const { data: prof } = await supabase
      .from("profiles")
      .select("negocio_id, email, nombre")
      .eq("id", user.id)
      .maybeSingle();

    if (!prof?.negocio_id) {
      return NextResponse.json(
        { error: "Tu cuenta de usuario no tiene un negocio vinculado" },
        { status: 400 }
      );
    }

    const plan = getPlan(planId);
    const precio = plan.precios[ciclo];
    const origin = req.nextUrl.origin || "https://operixerp.cloud";

    // Crear suscripción en Mercado Pago
    const preapproval = await mpFetch<any>("/preapproval", {
      method: "POST",
      idempotencyKey: `${prof.negocio_id}-${planId}-${ciclo}-${Date.now()}`,
      body: JSON.stringify({
        reason: `Operix ERP · Plan ${plan.name} (${ciclo === "yearly" ? "Anual" : "Mensual"})`,
        external_reference: buildExternalReference({
          negocioId: prof.negocio_id,
          userId: user.id,
          plan: planId,
          ciclo,
        }),
        payer_email: prof.email || user.email,
        back_url: `${origin}/planes?mp=ok`,
        status: "pending",
        auto_recurring: {
          frequency: precio.frequency,
          frequency_type: precio.frequency_type,
          transaction_amount: precio.amount,
          currency_id: MP_CURRENCY,
        },
      }),
    });

    const initPoint = preapproval?.init_point || preapproval?.sandbox_init_point;
    if (!initPoint) {
      throw new Error("Mercado Pago no devolvió el link de pago");
    }

    // Registrar estado pendiente en suscripciones
    await supabase.from("suscripciones").upsert(
      {
        negocio_id: prof.negocio_id,
        plan: planId,
        ciclo,
        estado: "pendiente",
        proveedor: "mercadopago",
        mp_preapproval_id: preapproval.id,
        mp_payer_email: prof.email || user.email,
        notas: `Suscripción Mercado Pago ${plan.name}`,
      },
      { onConflict: "negocio_id" }
    );

    return NextResponse.json({ url: initPoint, preapprovalId: preapproval.id });
  } catch (err: any) {
    console.error("Error al crear suscripción MP:", err);
    return NextResponse.json(
      { error: err.message || "Error al procesar suscripción en Mercado Pago" },
      { status: 500 }
    );
  }
}
