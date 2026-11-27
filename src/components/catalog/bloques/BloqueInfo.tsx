"use client";

import { useCatalog } from "@/components/catalog/CatalogContext";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import { Clock, MapPin, MessageCircle } from "lucide-react";

export function BloqueInfo() {
  const { negocio, config } = useCatalog();
  const n = negocio as { nombre: string; direccion?: string | null; telefono?: string | null };
  const direccion = n.direccion?.trim();
  const horario = config.infoHorario?.trim();
  if (!direccion && !horario && !n.telefono) return null;

  const mapa = direccion
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${direccion}, Chile`)}`
    : null;

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-10">
      <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-(color:--tp-50) dark:bg-neutral-900 p-5 sm:p-6 grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">Visítanos o escríbenos</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{n.nombre}</p>
        </div>
        {direccion && (
          <div className="flex gap-3 text-sm">
            <MapPin className="h-5 w-5 shrink-0 text-(color:--tp-600)" />
            <div>
              <div className="font-semibold">Dirección</div>
              <div className="text-neutral-600 dark:text-neutral-300">{direccion}</div>
              {mapa && (
                <a href={mapa} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-(color:--tp-700) hover:underline">
                  Ver en el mapa
                </a>
              )}
            </div>
          </div>
        )}
        {horario && (
          <div className="flex gap-3 text-sm">
            <Clock className="h-5 w-5 shrink-0 text-(color:--tp-600)" />
            <div>
              <div className="font-semibold">Horario</div>
              <div className="text-neutral-600 dark:text-neutral-300 whitespace-pre-line">{horario}</div>
            </div>
          </div>
        )}
        {n.telefono && (
          <div className="flex gap-3 text-sm">
            <MessageCircle className="h-5 w-5 shrink-0 text-(color:--tp-600)" />
            <div>
              <div className="font-semibold">WhatsApp</div>
              <a
                href={enlaceWhatsApp(n.telefono, `Hola ${n.nombre}, tengo una consulta.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center rounded-full bg-(color:--tp-600) text-(color:--tp-on) text-xs font-semibold px-3 py-1.5 hover:bg-(color:--tp-700)"
              >
                Escríbenos
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
