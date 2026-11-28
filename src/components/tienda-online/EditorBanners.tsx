"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ThemeCustomConfig } from "@/types/theme.types";
import { bannersDe } from "@/components/catalog/shared/BannerImagen";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Smartphone, Trash2 } from "lucide-react";

const MAX_BANNERS = 5;

interface Props {
  config: ThemeCustomConfig;
  negocioId: string | undefined;
  onChange: (cambio: (prev: ThemeCustomConfig) => ThemeCustomConfig) => void;
}

/** Sube una imagen al bucket de la tienda y devuelve su URL pública. */
async function subir(negocioId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("El archivo debe ser una imagen (JPG, PNG o WebP)");
  if (file.size > 5 * 1024 * 1024) throw new Error("La imagen debe pesar menos de 5 MB");
  const supabase = createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const ruta = `${negocioId}/banners/banner-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error } = await supabase.storage
    .from("producto-imgs")
    .upload(ruta, file, { upsert: true, cacheControl: "31536000", contentType: file.type });
  if (error) throw error;
  return supabase.storage.from("producto-imgs").getPublicUrl(ruta).data.publicUrl;
}

/**
 * Editor de banners rotativos: hasta 5 imágenes, cada una con versión opcional
 * para celular. Guarda en config.banners (y deja de usar bannerImageUrl).
 */
export function EditorBanners({ config, negocioId, onChange }: Props) {
  const banners = bannersDe(config);
  const [subiendo, setSubiendo] = useState<string | null>(null);

  const guardar = (lista: typeof banners) =>
    onChange((prev) => ({ ...prev, banners: lista, bannerImageUrl: undefined }));

  const conArchivo = async (clave: string, e: React.ChangeEvent<HTMLInputElement>, aplicar: (url: string) => void) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !negocioId) return;
    setSubiendo(clave);
    try {
      aplicar(await subir(negocioId, file));
      toast.success("Imagen cargada. Publica los cambios para mostrarla en tu tienda.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message;
      toast.error(msg || "Error al subir la imagen");
    } finally {
      setSubiendo(null);
    }
  };

  const mover = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= banners.length) return;
    const l = [...banners];
    [l[i], l[j]] = [l[j], l[i]];
    guardar(l);
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs">
        Banners con imagen (opcional, hasta {MAX_BANNERS}; con 2 o más rotan solos)
      </Label>

      {banners.map((b, i) => (
        <div key={`${b.imagen}-${i}`} className="flex gap-2 rounded-lg border p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.imagen} alt={`Banner ${i + 1}`} className="h-20 w-28 shrink-0 object-cover rounded bg-muted" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="text-xs font-semibold">Banner {i + 1}</div>
            <div className="flex flex-wrap gap-1.5">
              <Button asChild type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-[11px]">
                <label className="cursor-pointer">
                  {subiendo === `m${i}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Smartphone className="h-3 w-3" />}
                  {b.imagenMovil ? "Cambiar versión celular" : "Versión para celular"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={!!subiendo}
                    onChange={(e) =>
                      conArchivo(`m${i}`, e, (url) => guardar(banners.map((x, k) => (k === i ? { ...x, imagenMovil: url } : x))))
                    }
                  />
                </label>
              </Button>
              {b.imagenMovil && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => guardar(banners.map((x, k) => (k === i ? { imagen: x.imagen } : x)))}
                >
                  Quitar versión celular
                </Button>
              )}
            </div>
            {b.imagenMovil && <div className="text-[10px] text-muted-foreground">✓ Tiene versión vertical para celulares</div>}
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted disabled:opacity-30">
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button type="button" aria-label="Bajar" disabled={i === banners.length - 1} onClick={() => mover(i, 1)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted disabled:opacity-30">
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Eliminar banner"
              onClick={() => guardar(banners.filter((_, k) => k !== i))}
              className="h-6 w-6 flex items-center justify-center rounded text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}

      {banners.length < MAX_BANNERS && (
        <label className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-4 text-center text-xs text-muted-foreground cursor-pointer hover:border-primary/50 hover:bg-muted/40 transition-colors">
          {subiendo === "nuevo" ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          <span className="font-semibold text-foreground">
            {banners.length === 0 ? "Subir imagen promocional" : "Agregar otro banner"}
          </span>
          <span>
            JPG, PNG o WebP, máx. 5 MB. Ideal: horizontal para computador (1920×600) y, en cada banner, una
            versión vertical para celular (1080×1350). Al tocarla lleva a las ofertas.
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={!!subiendo}
            onChange={(e) => conArchivo("nuevo", e, (url) => guardar([...banners, { imagen: url }]))}
          />
        </label>
      )}
    </div>
  );
}
