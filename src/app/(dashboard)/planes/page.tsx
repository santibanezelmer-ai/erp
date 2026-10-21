"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PLANES, formatPrecio, type Ciclo, type PlanId } from "@/lib/mercadopago";
import { useTenant } from "@/contexts/tenant-context";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Sparkles,
  Loader2,
  CreditCard,
  ShieldCheck,
  Calendar,
  Clock,
  ArrowRight,
  Zap,
  Tag,
} from "lucide-react";
import { toast } from "sonner";

interface SuscripcionInfo {
  plan: string;
  estado: string;
  ciclo: string | null;
  vence_at: string | null;
  proximo_cobro_at: string | null;
  mp_payer_email: string | null;
}

interface PagoInfo {
  id: string;
  payment_id: string | null;
  monto: number;
  moneda: string;
  estado: string;
  created_at: string;
}

export default function PlanesPage() {
  const { negocio } = useTenant();
  const [cicloGlobal, setCicloGlobal] = useState<Ciclo>("monthly");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [suscripcion, setSuscripcion] = useState<SuscripcionInfo | null>(null);
  const [pagos, setPagos] = useState<PagoInfo[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const planActual = negocio?.plan || "free";

  useEffect(() => {
    cargarEstadoSuscripcion();
  }, [negocio?.id]);

  const cargarEstadoSuscripcion = async () => {
    if (!negocio?.id) return;
    setLoadingData(true);
    const supabase = createClient();

    try {
      const { data: susData } = await supabase
        .from("suscripciones")
        .select("plan, estado, ciclo, vence_at, proximo_cobro_at, mp_payer_email")
        .eq("negocio_id", negocio.id)
        .maybeSingle();

      setSuscripcion(susData as any);
      if (susData?.ciclo === "yearly") {
        setCicloGlobal("yearly");
      }

      const { data: pagosData } = await supabase
        .from("mp_pagos")
        .select("id, payment_id, monto, moneda, estado, created_at")
        .eq("negocio_id", negocio.id)
        .order("created_at", { ascending: false })
        .limit(5);

      setPagos((pagosData as any) || []);
    } catch (err) {
      console.error("Error al cargar suscripción:", err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleSuscribir = async (planId: PlanId, cicloElegido: Ciclo) => {
    const actionKey = `${planId}-${cicloElegido}`;
    setLoadingAction(actionKey);
    try {
      const res = await fetch("/api/mercadopago/suscribir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId, ciclo: cicloElegido }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al procesar el pago");

      toast.info("Redirigiendo a la pasarela segura de Mercado Pago...");
      window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || "Error al conectar con Mercado Pago");
      setLoadingAction(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-14">
      {/* Encabezado */}
      <div className="text-center space-y-3">
        <Badge variant="outline" className="px-3 py-1 text-xs gap-1 border-primary/30 text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Membresías Oficiales Operix ERP
        </Badge>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          Planes Básico y Pro · Mensual y Anual
        </h1>
        <p className="text-muted-foreground text-sm max-w-lg mx-auto">
          Elige la modalidad que prefieras. En los <strong>planes anuales obtienes 2 meses gratis</strong> y aseguras la tarifa de tu negocio por todo el año.
        </p>

        {/* Toggle Selector de Modalidad */}
        <div className="inline-flex items-center p-1 bg-muted rounded-xl border border-border shadow-xs mt-2">
          <button
            type="button"
            onClick={() => setCicloGlobal("monthly")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              cicloGlobal === "monthly"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Facturación Mensual
          </button>
          <button
            type="button"
            onClick={() => setCicloGlobal("yearly")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              cicloGlobal === "yearly"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
            Facturación Anual
            <span className="bg-emerald-500/10 text-emerald-600 text-[10px] font-black px-1.5 py-0.5 rounded-full border border-emerald-500/20">
              2 Meses Gratis
            </span>
          </button>
        </div>
      </div>

      {/* Estado Actual de la Suscripción */}
      {suscripcion && suscripcion.estado === "activa" && (
        <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-xs">
          <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-600 hover:bg-emerald-600 font-bold uppercase text-[10px]">
                  Suscripción Activa
                </Badge>
                <span className="font-extrabold text-foreground capitalize">
                  Plan {suscripcion.plan} ({suscripcion.ciclo === "yearly" ? "Anual" : "Mensual"})
                </span>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                {suscripcion.proximo_cobro_at
                  ? `Próxima renovación automática: ${new Date(suscripcion.proximo_cobro_at).toLocaleDateString("es-CL")}`
                  : suscripcion.vence_at
                  ? `Válido hasta: ${new Date(suscripcion.vence_at).toLocaleDateString("es-CL")}`
                  : "Plan vigente y activo"}
              </p>
            </div>
            <div className="text-xs text-muted-foreground">
              Procesado de forma segura por <span className="font-bold text-foreground">Mercado Pago</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid de Planes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {PLANES.map((plan) => {
          const precioMensual = plan.precios.monthly.amount;
          const precioAnual = plan.precios.yearly.amount;
          const precioActual = plan.precios[cicloGlobal].amount;

          // Ahorro anual: 12 meses mensuales - 1 año anual
          const ahorroAnual = precioMensual * 12 - precioAnual;
          const equivalenteMensual = Math.round(precioAnual / 12);

          const esPlanActual = planActual === plan.id;
          const loadingMensual = loadingAction === `${plan.id}-monthly`;
          const loadingAnual = loadingAction === `${plan.id}-yearly`;

          return (
            <Card
              key={plan.id}
              className={`flex flex-col relative overflow-hidden transition-all bg-card ${
                plan.highlighted
                  ? "border-primary ring-2 ring-primary/20 shadow-md"
                  : "border-border shadow-xs hover:border-primary/40"
              }`}
            >
              {plan.highlighted && (
                <div className="bg-primary text-primary-foreground text-[11px] font-black py-1.5 text-center tracking-wider uppercase flex items-center justify-center gap-1 shadow-xs">
                  <Sparkles className="h-3 w-3" /> Recomendado para Escalar Ventas
                </div>
              )}

              <CardHeader className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl font-bold flex items-center gap-2">
                    <span>{plan.name}</span>
                  </CardTitle>
                  {esPlanActual && (
                    <Badge variant="secondary" className="text-[10px] font-bold">
                      Plan Actual
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs">{plan.tagline}</CardDescription>

                {/* Precios y Ahorro */}
                <div className="pt-3 space-y-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-black text-foreground">
                      {formatPrecio(precioActual)}
                    </span>
                    <span className="text-muted-foreground text-xs font-semibold">
                      {cicloGlobal === "yearly" ? " / año (CLP)" : " / mes (CLP)"}
                    </span>
                  </div>

                  {cicloGlobal === "yearly" ? (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15 border-emerald-500/20 text-[10px] font-bold">
                        Ahorras {formatPrecio(ahorroAnual)} / año
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        (Equivale a {formatPrecio(equivalenteMensual)}/mes)
                      </span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground pt-1 flex items-center gap-1">
                      <Tag className="h-3 w-3 text-emerald-600" />
                      <span>
                        O ahorra pagando anual: <strong>{formatPrecio(precioAnual)}/año</strong> (2 meses gratis)
                      </span>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex-1 space-y-3 pt-2">
                <div className="text-xs font-bold text-foreground tracking-tight">Incluye todas estas ventajas:</div>
                <ul className="space-y-2.5 text-xs">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-muted-foreground">
                      <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="leading-snug">{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="pt-4 border-t border-border mt-auto flex flex-col gap-2">
                {/* Botón Principal según el ciclo seleccionado */}
                <Button
                  onClick={() => handleSuscribir(plan.id, cicloGlobal)}
                  disabled={loadingMensual || loadingAnual || esPlanActual}
                  className="w-full gap-2 font-bold h-11 text-sm shadow-xs"
                  variant={plan.highlighted ? "default" : "outline"}
                >
                  {loadingMensual || loadingAnual ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Conectando con Mercado Pago...
                    </>
                  ) : esPlanActual ? (
                    "Plan Actual de tu Negocio"
                  ) : cicloGlobal === "yearly" ? (
                    <>
                      <Zap className="h-4 w-4 text-amber-300" />
                      Suscribirme Plan {plan.name} Anual ({formatPrecio(precioAnual)})
                      <ArrowRight className="h-4 w-4 ml-auto" />
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" />
                      Suscribirme Plan {plan.name} Mensual ({formatPrecio(precioMensual)})
                      <ArrowRight className="h-4 w-4 ml-auto" />
                    </>
                  )}
                </Button>

                {/* Botón Alternativo directo para el otro ciclo */}
                {!esPlanActual && (
                  <button
                    type="button"
                    onClick={() => handleSuscribir(plan.id, cicloGlobal === "yearly" ? "monthly" : "yearly")}
                    disabled={loadingMensual || loadingAnual}
                    className="text-[11px] text-muted-foreground hover:text-foreground text-center py-1 transition-colors underline-offset-4 hover:underline"
                  >
                    {cicloGlobal === "yearly"
                      ? `O contrata la opción mensual por ${formatPrecio(precioMensual)}/mes`
                      : `O aprovecha 2 meses gratis con el plan anual por ${formatPrecio(precioAnual)}/año`}
                  </button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Historial de Pagos Recientes */}
      {pagos.length > 0 && (
        <Card className="border-border shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Historial de Pagos Recientes
            </CardTitle>
            <CardDescription className="text-xs">
              Registros y comprobantes de facturación procesados por Mercado Pago
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border text-xs">
              {pagos.map((p) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-foreground">
                      Pago de suscripción · {formatPrecio(p.monto)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString("es-CL", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <Badge
                    variant={p.estado === "aprobada" ? "default" : "secondary"}
                    className={`capitalize text-[10px] ${
                      p.estado === "aprobada" ? "bg-emerald-600 hover:bg-emerald-600" : ""
                    }`}
                  >
                    {p.estado}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sello de Seguridad y Políticas */}
      <div className="flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground text-center pt-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>
            Tus pagos y renovaciones se procesan de forma 100% segura mediante cobro recurrente certificado por{" "}
            <strong className="text-foreground">Mercado Pago Chile</strong>.
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 text-muted-foreground pt-1">
          <span>🛡️ Garantía de satisfacción de 7 días</span>
          <span>•</span>
          <Link href="/devoluciones" target="_blank" className="hover:text-primary underline">
            Política de Devoluciones y Cancelación
          </Link>
          <span>•</span>
          <Link href="/terminos" target="_blank" className="hover:text-primary underline">
            Términos de Servicio
          </Link>
          <span>•</span>
          <Link href="/privacidad" target="_blank" className="hover:text-primary underline">
            Privacidad
          </Link>
        </div>
      </div>
    </div>
  );
}
