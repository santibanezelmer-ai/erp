"use client";

import type { ThemeCustomConfig } from "@/types/theme.types";
import { BLOQUES, ordenBloques, bloqueVisible, whatsappFlotanteVisible, type BloqueId } from "@/components/catalog/bloques/orden";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowDown, ArrowUp, Lock } from "lucide-react";

interface Props {
  config: ThemeCustomConfig;
  /** Aplica cambios parciales al borrador */
  onChange: (cambio: (prev: ThemeCustomConfig) => ThemeCustomConfig) => void;
}

const OPCIONES_CATALOGO = [
  { key: "categoriasPills", label: "Barra de categorías" },
  { key: "ofertasDestacadas", label: "Filtro rápido \"En oferta\"" },
  { key: "novedades", label: "Etiqueta \"Nuevo\" en productos" },
  { key: "marcasGrid", label: "Filtro por marca" },
] as const;

export function EditorBloques({ config, onChange }: Props) {
  const orden = ordenBloques(config);
  const porId = Object.fromEntries(BLOQUES.map((b) => [b.id, b]));

  const mover = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= orden.length) return;
    const nuevo = [...orden];
    [nuevo[i], nuevo[j]] = [nuevo[j], nuevo[i]];
    onChange((prev) => ({ ...prev, sectionsOrder: nuevo }));
  };

  const alternar = (id: BloqueId, activo: boolean) =>
    onChange((prev) =>
      id === "hero"
        ? { ...prev, sectionsVisibility: { ...prev.sectionsVisibility, bannerHero: activo } }
        : { ...prev, bloques: { ...prev.bloques, [id]: activo } }
    );

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Orden de la página
        </div>
        {orden.map((id, i) => {
          const b = porId[id];
          const visible = bloqueVisible(config, id);
          const fijo = id === "catalogo";
          return (
            <div
              key={id}
              className={`flex items-center gap-2 rounded-lg border p-2 ${visible ? "bg-card" : "bg-muted/40 opacity-70"}`}
            >
              <div className="flex flex-col">
                <button
                  type="button"
                  aria-label={`Subir ${b.etiqueta}`}
                  disabled={i === 0}
                  onClick={() => mover(i, -1)}
                  className="h-5 w-6 flex items-center justify-center rounded hover:bg-muted disabled:opacity-30"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Bajar ${b.etiqueta}`}
                  disabled={i === orden.length - 1}
                  onClick={() => mover(i, 1)}
                  className="h-5 w-6 flex items-center justify-center rounded hover:bg-muted disabled:opacity-30"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold">{b.etiqueta}</div>
                <div className="text-[10px] text-muted-foreground truncate">{b.descripcion}</div>
              </div>
              {fijo ? (
                <Lock className="h-3.5 w-3.5 text-muted-foreground mr-1" aria-label="Siempre visible" />
              ) : (
                <Switch checked={visible} onCheckedChange={(v) => alternar(id, v)} aria-label={`Mostrar ${b.etiqueta}`} />
              )}
            </div>
          );
        })}
      </div>

      {bloqueVisible(config, "info") && (
        <div className="space-y-1">
          <Label className="text-xs">Horario de atención (bloque de información)</Label>
          <Textarea
            rows={2}
            value={config.infoHorario || ""}
            placeholder={"Lun a Vie 10:00–19:00\nSáb 10:00–14:00"}
            onChange={(e) => onChange((prev) => ({ ...prev, infoHorario: e.target.value }))}
            className="text-xs"
          />
          <p className="text-[10px] text-muted-foreground">
            La dirección y el teléfono se toman de los datos del negocio.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Opciones del catálogo
        </div>
        {OPCIONES_CATALOGO.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between">
            <Label htmlFor={`sec-${key}`} className="text-xs font-medium cursor-pointer">
              {label}
            </Label>
            <Switch
              id={`sec-${key}`}
              checked={config.sectionsVisibility?.[key] !== false}
              onCheckedChange={(v) =>
                onChange((prev) => ({ ...prev, sectionsVisibility: { ...prev.sectionsVisibility, [key]: v } }))
              }
            />
          </div>
        ))}
        <div className="flex items-center justify-between pt-1">
          <Label htmlFor="sec-wsp" className="text-xs font-medium cursor-pointer">
            Botón flotante de WhatsApp
          </Label>
          <Switch
            id="sec-wsp"
            checked={whatsappFlotanteVisible(config)}
            onCheckedChange={(v) => onChange((prev) => ({ ...prev, bloques: { ...prev.bloques, whatsappFlotante: v } }))}
          />
        </div>
      </div>
    </div>
  );
}
