import type { CSSProperties } from "react";
import type { ThemeCustomConfig, ThemeId } from "@/types/theme.types";

/**
 * Estilo visual propio de cada tienda (color de marca, acento y tipografía).
 *
 * Las plantillas no usan colores fijos para la marca: usan variables CSS
 * --tp-<tono> (primario) y --ta-<tono> (acento), con tonos 50…950 como Tailwind.
 * Aquí se generan a partir del color elegido con color-mix(): los tonos más
 * claros se mezclan con blanco y los más oscuros con negro. El color elegido
 * corresponde al tono "ancla" de cada plantilla (p. ej. rose-600 en Belleza),
 * así que con los colores por defecto la tienda se ve igual que antes.
 */

const TONOS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
type Tono = (typeof TONOS)[number];

// % del color de marca en la mezcla según la distancia al tono ancla
const MEZCLA_CLARA = [85, 70, 50, 32, 18, 9, 5, 3, 2, 1]; // con blanco
const MEZCLA_OSCURA = [82, 66, 52, 38, 28, 20, 14, 10, 7, 5]; // con negro

/** Tono de Tailwind al que corresponde el color elegido en cada plantilla. */
export const ANCLA_PRIMARIO: Record<ThemeId, Tono> = {
  beauty: 600,
  autoparts: 500,
  ferremax: 600,
  food: 600,
  market: 600,
  fashion: 900,
};
export const ANCLA_ACENTO: Record<ThemeId, Tono> = {
  beauty: 500,
  autoparts: 500,
  ferremax: 500,
  food: 500,
  market: 600,
  fashion: 600,
};

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function colorValido(c: string | null | undefined): c is string {
  return !!c && HEX.test(c.trim());
}

/** Blanco u oscuro según la luminancia del color, para texto legible encima. */
export function colorSobre(hex: string): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  // Contraste con blanco vs. con casi negro: se elige el mayor
  return (1.05) / (L + 0.05) >= (L + 0.05) / (0.0056 + 0.05) ? "#ffffff" : "#111111";
}

function escala(prefijo: string, color: string, ancla: Tono): Record<string, string> {
  const vars: Record<string, string> = { [`--${prefijo}`]: color };
  const iA = TONOS.indexOf(ancla);
  TONOS.forEach((t, i) => {
    const d = i - iA;
    vars[`--${prefijo}-${t}`] =
      d === 0
        ? `var(--${prefijo})`
        : d < 0
        ? `color-mix(in oklab, var(--${prefijo}) ${MEZCLA_CLARA[-d - 1]}%, white)`
        : `color-mix(in oklab, var(--${prefijo}) ${MEZCLA_OSCURA[d - 1]}%, black)`;
  });
  vars[`--${prefijo}-on`] = colorSobre(color);
  return vars;
}

export type FuenteTienda = NonNullable<ThemeCustomConfig["fontFamily"]>;

/** Fuentes opcionales (Google Fonts). "plantilla" = la tipografía original de la plantilla. */
export const FUENTES: Record<
  string,
  { etiqueta: string; titulos: string; texto: string; googleCss?: string }
> = {
  plantilla: { etiqueta: "La de la plantilla", titulos: "", texto: "" },
  moderna: {
    etiqueta: "Moderna (Poppins)",
    titulos: "'Poppins', ui-sans-serif, system-ui, sans-serif",
    texto: "'Poppins', ui-sans-serif, system-ui, sans-serif",
    googleCss: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap",
  },
  elegante: {
    etiqueta: "Elegante (Playfair + Lato)",
    titulos: "'Playfair Display', ui-serif, Georgia, serif",
    texto: "'Lato', ui-sans-serif, system-ui, sans-serif",
    googleCss:
      "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;900&family=Lato:wght@400;700&display=swap",
  },
  amigable: {
    etiqueta: "Amigable (Nunito)",
    titulos: "'Nunito', ui-rounded, ui-sans-serif, system-ui, sans-serif",
    texto: "'Nunito', ui-rounded, ui-sans-serif, system-ui, sans-serif",
    googleCss: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap",
  },
};

/** Valores antiguos del tipo (sans/serif/mono) se tratan como "la de la plantilla". */
export function fuenteElegida(config: ThemeCustomConfig) {
  const f = config.fontFamily && FUENTES[config.fontFamily] ? config.fontFamily : "plantilla";
  return { id: f, ...FUENTES[f] };
}

export function estiloTienda(
  themeId: ThemeId,
  config: ThemeCustomConfig,
  defaults: ThemeCustomConfig
): { style: CSSProperties; className: string; fuenteCss?: string } {
  const primario = colorValido(config.primaryColor) ? config.primaryColor.trim() : defaults.primaryColor || "#e11d48";
  const acento = colorValido(config.accentColor) ? config.accentColor.trim() : defaults.accentColor || primario;

  const fuente = fuenteElegida(config);
  const vars: Record<string, string> = {
    ...escala("tp", primario, ANCLA_PRIMARIO[themeId] ?? 600),
    ...escala("ta", acento, ANCLA_ACENTO[themeId] ?? 500),
  };
  // Los componentes compartidos (carrito, paginación, detalle) usan el
  // "primary" de la app: dentro de la tienda pasa a ser el color de marca.
  vars["--primary"] = "var(--tp)";
  vars["--primary-foreground"] = "var(--tp-on)";
  vars["--ring"] = "var(--tp)";
  if (fuente.titulos) {
    vars["--tf-titulos"] = fuente.titulos;
    vars["--tf-texto"] = fuente.texto;
  }

  return {
    style: vars as CSSProperties,
    className: fuente.titulos ? "tienda-estilo tienda-fuente" : "tienda-estilo",
    fuenteCss: fuente.googleCss,
  };
}
