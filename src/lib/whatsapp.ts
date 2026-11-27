/**
 * Número en formato internacional para WhatsApp (solo dígitos, con código de
 * país). Los comercios suelen guardar el número chileno sin +56
 * ("983191072"); wa.me lo rechaza como inválido si falta el código de país.
 * - 9 dígitos (móvil 9XXXXXXXX o fijo 2XXXXXXXX) → se antepone 56
 * - 8 dígitos (formato antiguo de móvil)          → se antepone 569
 * - con 56 al inicio u otro código de país        → se deja igual
 */
export function numeroWhatsApp(telefono: string | null | undefined): string | null {
  let d = (telefono || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (!d) return null;
  if (d.length === 9) return `56${d}`;
  if (d.length === 8) return `569${d}`;
  return d;
}

/** Enlace wa.me al número del comercio, con mensaje opcional. */
export function enlaceWhatsApp(telefono: string | null | undefined, texto?: string): string {
  const numero = numeroWhatsApp(telefono);
  const q = texto ? `?text=${encodeURIComponent(texto)}` : "";
  return numero ? `https://wa.me/${numero}${q}` : `https://api.whatsapp.com/send${q}`;
}
