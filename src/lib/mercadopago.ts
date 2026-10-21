// Configuración de planes para MercadoPago (browser-safe).
export type PlanId = "basico" | "pro";
export type Ciclo = "monthly" | "yearly";

export const MP_CURRENCY = "CLP";

export type PlanPrecio = {
  amount: number;
  frequency: number;
  frequency_type: "months";
};

export type PlanConfig = {
  id: PlanId;
  name: string;
  tagline: string;
  highlighted?: boolean;
  features: string[];
  precios: Record<Ciclo, PlanPrecio>;
};

export const PLANES: PlanConfig[] = [
  {
    id: "basico",
    name: "Básico",
    tagline: "Para pequeños comercios y negocios que inician",
    features: [
      "Hasta 100 productos",
      "Hasta 2 colaboradores",
      "1 sucursal activa",
      "Punto de Venta (POS) y Boletas térmicas",
      "Control de inventario y stock",
      "Reportes de ventas",
    ],
    precios: {
      monthly: { amount: 3990, frequency: 1, frequency_type: "months" },
      yearly: { amount: 39900, frequency: 12, frequency_type: "months" },
    },
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Todo lo que necesitas para escalar tu negocio",
    highlighted: true,
    features: [
      "Productos y variantes ilimitadas",
      "Hasta 10 colaboradores",
      "Hasta 5 sucursales",
      "Catálogo digital público con pedidos por WhatsApp",
      "Gestión de Clientes y Fiados (Créditos)",
      "Comandas de cocina y mesas (Restaurantes)",
      "Soporte prioritario",
    ],
    precios: {
      monthly: { amount: 9990, frequency: 1, frequency_type: "months" },
      yearly: { amount: 99900, frequency: 12, frequency_type: "months" },
    },
  },
];

export function getPlan(id: PlanId): PlanConfig {
  const p = PLANES.find((x) => x.id === id);
  if (!p) throw new Error(`Plan desconocido: ${id}`);
  return p;
}

export function formatPrecio(amount: number) {
  try {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${amount.toLocaleString("es-CL")} CLP`;
  }
}
