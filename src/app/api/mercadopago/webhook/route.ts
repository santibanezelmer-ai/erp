import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyMpSignature, mpFetch, parseExternalReference } from "@/lib/mercadopago.server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  return NextResponse.json({ ok: true, status: "webhook_active" });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    let payload: any = null;
    try {
      payload = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      payload = null;
    }

    const topic: string =
      payload?.type ||
      payload?.topic ||
      payload?.action ||
      req.nextUrl.searchParams.get("type") ||
      req.nextUrl.searchParams.get("topic") ||
      "";

    const dataId: string | null =
      payload?.data?.id?.toString() ??
      req.nextUrl.searchParams.get("data.id") ??
      req.nextUrl.searchParams.get("id");

    const signatureHeader = req.headers.get("x-signature");
    const requestId = req.headers.get("x-request-id");

    const valid = verifyMpSignature({
      signatureHeader,
      requestId,
      dataId,
    });

    if (!valid && process.env.NODE_ENV === "production") {
      console.warn("[MP Webhook] Firma de seguridad inválida");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const admin = getAdminClient();

    // 1. Evento de suscripción (preapproval)
    if (topic.includes("preapproval") && !topic.includes("authorized_payment") && dataId) {
      await handlePreapproval(admin, dataId);
    }
    // 2. Evento de pago autorizado de cuota
    else if (topic.includes("authorized_payment") && dataId) {
      await handleAuthorizedPayment(admin, dataId);
    }
    // 3. Evento de pago regular
    else if (topic.includes("payment") && dataId) {
      await handlePayment(admin, dataId);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[MP Webhook Handler Error]:", err);
    // Respondemos 200 para evitar que Mercado Pago reintente infinitamente
    return NextResponse.json({ ok: false, error: err.message }, { status: 200 });
  }
}

async function handlePreapproval(admin: any, id: string) {
  const pre = await mpFetch<any>(`/preapproval/${id}`);
  const ref = parseExternalReference(pre?.external_reference);
  if (!ref) return;

  const status: string = pre?.status ?? "";
  const estado =
    status === "authorized"
      ? "activa"
      : status === "pending"
      ? "pendiente"
      : status === "paused"
      ? "suspendida"
      : "cancelada";

  await admin.from("suscripciones").upsert(
    {
      negocio_id: ref.negocioId,
      plan: ref.plan,
      ciclo: ref.ciclo,
      estado,
      proveedor: "mercadopago",
      mp_preapproval_id: id,
      mp_payer_email: pre?.payer_email ?? null,
      proximo_cobro_at: pre?.next_payment_date ?? null,
    },
    { onConflict: "negocio_id" }
  );

  await admin
    .from("negocios")
    .update({ plan: estado === "activa" ? ref.plan : "free" })
    .eq("id", ref.negocioId);
}

async function handleAuthorizedPayment(admin: any, id: string) {
  const ap = await mpFetch<any>(`/authorized_payments/${id}`);
  const preapprovalId: string | undefined = ap?.preapproval_id;

  let ref = parseExternalReference(ap?.external_reference);
  if (!ref && preapprovalId) {
    const pre = await mpFetch<any>(`/preapproval/${preapprovalId}`);
    ref = parseExternalReference(pre?.external_reference);
  }
  if (!ref) return;

  const status: string = ap?.payment?.status ?? ap?.status ?? "";
  const aprobado = status === "approved" || status === "processed";
  const monto: number = ap?.transaction_amount ?? ap?.payment?.transaction_amount ?? 0;

  const paymentId = (ap?.payment?.id ?? ap?.id)?.toString();

  await admin.from("mp_pagos").upsert(
    {
      negocio_id: ref.negocioId,
      user_id: ref.userId ?? null,
      preapproval_id: preapprovalId ?? null,
      payment_id: paymentId ?? null,
      plan: ref.plan,
      ciclo: ref.ciclo,
      monto,
      moneda: "CLP",
      estado: aprobado ? "aprobada" : status || "pendiente",
      detalle: `Cuota suscripción ${ref.plan} (${ref.ciclo})`,
      raw: ap,
    },
    { onConflict: "payment_id" }
  );

  if (aprobado) {
    // Calcular vencimiento
    const venceAt = new Date();
    if (ref.ciclo === "yearly") {
      venceAt.setMonth(venceAt.getMonth() + 12);
    } else {
      venceAt.setMonth(venceAt.getMonth() + 1);
    }

    await admin.from("suscripciones").upsert(
      {
        negocio_id: ref.negocioId,
        plan: ref.plan,
        ciclo: ref.ciclo,
        estado: "activa",
        proveedor: "mercadopago",
        mp_preapproval_id: preapprovalId ?? null,
        ultimo_pago_at: new Date().toISOString(),
        vence_at: venceAt.toISOString(),
      },
      { onConflict: "negocio_id" }
    );

    await admin
      .from("negocios")
      .update({ plan: ref.plan })
      .eq("id", ref.negocioId);
  }
}

async function handlePayment(admin: any, id: string) {
  const payment = await mpFetch<any>(`/v1/payments/${id}`);
  const ref = parseExternalReference(payment?.external_reference);
  if (!ref) return;

  const status: string = payment?.status ?? "";
  const aprobado = status === "approved";

  await admin.from("mp_pagos").upsert(
    {
      negocio_id: ref.negocioId,
      user_id: ref.userId ?? null,
      payment_id: id,
      plan: ref.plan,
      ciclo: ref.ciclo,
      monto: payment?.transaction_amount ?? 0,
      moneda: "CLP",
      estado: aprobado ? "aprobada" : status,
      detalle: payment?.description ?? `Pago ${ref.plan}`,
      raw: payment,
    },
    { onConflict: "payment_id" }
  );
}
