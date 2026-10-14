export type CurrencyDef = { code: string; label: string; locale: string; decimals: number };

export const CURRENCIES: CurrencyDef[] = [
  { code: "CLP", label: "CLP — Peso chileno", locale: "es-CL", decimals: 0 },
  { code: "USD", label: "USD — Dólar estadounidense", locale: "en-US", decimals: 2 },
  { code: "EUR", label: "EUR — Euro", locale: "es-ES", decimals: 2 },
  { code: "MXN", label: "MXN — Peso mexicano", locale: "es-MX", decimals: 2 },
  { code: "ARS", label: "ARS — Peso argentino", locale: "es-AR", decimals: 2 },
  { code: "COP", label: "COP — Peso colombiano", locale: "es-CO", decimals: 0 },
  { code: "PEN", label: "PEN — Sol peruano", locale: "es-PE", decimals: 2 },
  { code: "BOB", label: "BOB — Boliviano", locale: "es-BO", decimals: 2 },
  { code: "UYU", label: "UYU — Peso uruguayo", locale: "es-UY", decimals: 2 },
  { code: "PYG", label: "PYG — Guaraní", locale: "es-PY", decimals: 0 },
  { code: "BRL", label: "BRL — Real brasileño", locale: "pt-BR", decimals: 2 },
  { code: "GTQ", label: "GTQ — Quetzal", locale: "es-GT", decimals: 2 },
  { code: "CRC", label: "CRC — Colón costarricense", locale: "es-CR", decimals: 2 },
  { code: "DOP", label: "DOP — Peso dominicano", locale: "es-DO", decimals: 2 },
  { code: "VES", label: "VES — Bolívar", locale: "es-VE", decimals: 2 },
];

const STORAGE_KEY = "operix.moneda";
const DEFAULT = CURRENCIES[0];

let current: CurrencyDef = DEFAULT;

if (typeof window !== "undefined") {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) current = CURRENCIES.find((c) => c.code === saved) || DEFAULT;
  } catch { /* ignore */ }
}

export const getCurrency = () => current;

export const setCurrency = (code?: string | null) => {
  const next = CURRENCIES.find((c) => c.code === code) || DEFAULT;
  current = next;
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(STORAGE_KEY, next.code); } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent("operix:currency", { detail: next.code }));
  }
  return next;
};

export const formatMoney = (n: number | null | undefined, code?: string) => {
  const c = (code && CURRENCIES.find((x) => x.code === code)) || current;
  return new Intl.NumberFormat(c.locale, {
    style: "currency",
    currency: c.code,
    minimumFractionDigits: c.decimals,
    maximumFractionDigits: c.decimals,
  }).format(Number(n || 0));
};

/** Alias histórico: ahora respeta la moneda configurada del negocio. */
export const formatCLP = (n: number | null | undefined) => formatMoney(n);

export const slugify = (s: string) =>
  s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
