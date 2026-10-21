// Helpers server-only para la API de MercadoPago.
import { createHmac, timingSafeEqual } from "crypto";

const MP_API = "https://api.mercadopago.com";

function accessToken(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN no está configurado");
  return token;
}

export async function mpFetch<T = any>(
  path: string,
  init?: RequestInit & { idempotencyKey?: string }
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken()}`);
  headers.set("Content-Type", "application/json");
  if (init?.idempotencyKey) headers.set("X-Idempotency-Key", init.idempotencyKey);

  const res = await fetch(`${MP_API}${path}`, { ...init, headers });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg = body?.message || body?.error || `MercadoPago error ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return body as T;
}

export function verifyMpSignature(opts: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
}): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return true; // Si no hay secret configurado, permite verificación directa por API
  if (!opts.signatureHeader || !opts.dataId) return false;

  try {
    const parts = Object.fromEntries(
      opts.signatureHeader.split(",").map((p) => {
        const [k, ...rest] = p.split("=");
        return [k.trim(), rest.join("=").trim()];
      })
    ) as Record<string, string>;

    const ts = parts["ts"];
    const v1 = parts["v1"];
    if (!ts || !v1) return false;

    const manifest = `id:${opts.dataId.toLowerCase()};${
      opts.requestId ? `request-id:${opts.requestId};` : ""
    }ts:${ts};`;

    const expected = createHmac("sha256", secret).update(manifest).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(v1);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch (err) {
    console.error("Error al verificar firma MP:", err);
    return false;
  }
}

export function buildExternalReference(o: {
  negocioId: string;
  userId: string;
  plan: string;
  ciclo: string;
}) {
  return [o.negocioId, o.userId, o.plan, o.ciclo].join("|");
}

export function parseExternalReference(ref: string | null | undefined) {
  if (!ref) return null;
  const [negocioId, userId, plan, ciclo] = ref.split("|");
  if (!negocioId || !plan) return null;
  return { negocioId, userId, plan, ciclo };
}
