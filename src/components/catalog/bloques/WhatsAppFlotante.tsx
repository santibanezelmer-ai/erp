"use client";

import { useCatalog } from "@/components/catalog/CatalogContext";
import { enlaceWhatsApp } from "@/lib/whatsapp";

/** Botón flotante de WhatsApp (abajo a la izquierda, para no tapar el carrito). */
export function WhatsAppFlotante() {
  const { negocio, isCartOpen, detailProduct } = useCatalog();
  const n = negocio as { nombre: string; telefono?: string | null };
  if (!n.telefono || isCartOpen || detailProduct) return null;

  return (
    <a
      href={enlaceWhatsApp(n.telefono, `Hola ${n.nombre}, tengo una consulta.`)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      className="fixed bottom-4 left-4 z-40 h-14 w-14 rounded-full bg-[#25D366] text-white shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true">
        <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.4 9.4 0 0 1-4.79-1.31l-.34-.2-3.56.93.95-3.47-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.23-9.42 9.43-9.42 2.52 0 4.88.98 6.66 2.76a9.36 9.36 0 0 1 2.76 6.67c0 5.2-4.23 9.42-9.44 9.42zm8.02-17.44A11.26 11.26 0 0 0 12.04.75C5.8.75.72 5.83.72 12.07c0 2 .52 3.94 1.51 5.65L.62 23.25l5.66-1.48a11.3 11.3 0 0 0 5.75 1.47h.01c6.24 0 11.32-5.08 11.32-11.32 0-3.03-1.18-5.87-3.3-8.01z" />
      </svg>
    </a>
  );
}
