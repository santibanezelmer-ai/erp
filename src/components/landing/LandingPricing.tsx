"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Sparkles, ShieldCheck, ArrowRight, Zap, HelpCircle } from "lucide-react";

export function LandingPricing() {
  const [ciclo, setCiclo] = useState<"monthly" | "yearly">("yearly");

  return (
    <section id="precios" className="py-20 px-4 sm:px-6 w-full max-w-7xl mx-auto scroll-mt-20">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/10 text-primary text-xs font-semibold mb-4">
          <Zap className="h-3.5 w-3.5" />
          <span>Precios Transparentes en Pesos Chilenos</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground">
          Invierte en hacer crecer tu negocio, <span className="text-primary">no en software costoso</span>
        </h2>
        <p className="mt-4 text-base sm:text-lg text-muted-foreground">
          Sin costos ocultos, sin contratos de amarre ni comisiones por venta. Elige el plan que mejor se adapte a tu etapa.
        </p>

        {/* Switch Ciclo Mensual / Anual */}
        <div className="mt-8 flex items-center justify-center">
          <div className="inline-flex items-center p-1.5 rounded-full bg-muted/80 border border-border shadow-xs">
            <button
              type="button"
              onClick={() => setCiclo("monthly")}
              className={`px-5 py-2 text-xs sm:text-sm font-semibold rounded-full transition-all ${
                ciclo === "monthly"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Facturación Mensual
            </button>
            <button
              type="button"
              onClick={() => setCiclo("yearly")}
              className={`relative px-5 py-2 text-xs sm:text-sm font-semibold rounded-full transition-all flex items-center gap-1.5 ${
                ciclo === "yearly"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Facturación Anual</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  ciclo === "yearly"
                    ? "bg-amber-400 text-neutral-900"
                    : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                }`}
              >
                2 meses gratis
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto">
        {/* Plan Gratis */}
        <Card className="flex flex-col justify-between border-border bg-card/80 backdrop-blur-xs shadow-xs hover:border-border/80 transition-all">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Emprendedor
              </span>
            </div>
            <CardTitle className="text-2xl font-bold mt-1">Gratis</CardTitle>
            <CardDescription className="text-xs min-h-[32px]">
              Para almacenes pequeños y negocios que dan sus primeros pasos.
            </CardDescription>

            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-foreground">$0</span>
                <span className="text-xs text-muted-foreground">/ para siempre</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Sin tarjeta de crédito requerida</p>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pt-2">
            <div className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Incluye:
            </div>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span>Punto de Venta (POS) rápido y táctil</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span>Hasta 30 productos en inventario</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span>1 sucursal activa</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span>Emisión de boletas térmicas (58mm y 80mm)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span>Arqueo y cierre de caja ciego</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span>Soporte por comunidad</span>
              </li>
            </ul>
          </CardContent>

          <CardFooter className="pt-4 border-t border-border/60">
            <Link href="/registro" className="w-full">
              <Button variant="outline" className="w-full h-11 text-xs sm:text-sm font-semibold">
                Comenzar Gratis
              </Button>
            </Link>
          </CardFooter>
        </Card>

        {/* Plan Básico */}
        <Card className="flex flex-col justify-between border-border bg-card/90 shadow-sm hover:border-primary/50 transition-all">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Negocio Activo
              </span>
              {ciclo === "yearly" && (
                <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                  Ahorras $7.980 CLP
                </Badge>
              )}
            </div>
            <CardTitle className="text-2xl font-bold mt-1">Plan Básico</CardTitle>
            <CardDescription className="text-xs min-h-[32px]">
              Ideal para minimarkets, botillerías y tiendas de barrio consolidadas.
            </CardDescription>

            <div className="mt-4 pt-4 border-t border-border">
              {ciclo === "monthly" ? (
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-foreground">$3.990</span>
                    <span className="text-xs text-muted-foreground">CLP / mes</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Facturación mensual cancelable en cualquier momento</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-foreground">$39.900</span>
                    <span className="text-xs text-muted-foreground">CLP / año</span>
                  </div>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                    Equivalente a solo $3.325 CLP/mes (2 meses gratis)
                  </p>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pt-2">
            <div className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Todo lo del plan Gratis, más:
            </div>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span className="font-medium text-foreground">Hasta 100 productos en catálogo</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span>Hasta 2 colaboradores con accesos</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span>Control de inventario y descuento automático</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span>Reportes de ventas por período y medios de pago</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span>Exportación de datos a Excel</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span>Garantía de satisfacción de 7 días</span>
              </li>
            </ul>
          </CardContent>

          <CardFooter className="pt-4 border-t border-border/60">
            <Link href="/registro" className="w-full">
              <Button className="w-full h-11 text-xs sm:text-sm font-semibold">
                Elegir Plan Básico
              </Button>
            </Link>
          </CardFooter>
        </Card>

        {/* Plan Pro (Destacado) */}
        <Card className="flex flex-col justify-between border-2 border-primary bg-card shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-4 py-1 text-[11px] font-black tracking-wide rounded-bl-xl shadow-xs">
            MÁS POPULAR
          </div>

          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="h-4 w-4" />
                Escalamiento Total
              </span>
            </div>
            <CardTitle className="text-2xl font-bold mt-1">Plan Pro</CardTitle>
            <CardDescription className="text-xs min-h-[32px]">
              Para locales de alto flujo, restaurantes, cafeterías y negocios con sucursales.
            </CardDescription>

            <div className="mt-4 pt-4 border-t border-border">
              {ciclo === "monthly" ? (
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-foreground">$9.990</span>
                    <span className="text-xs text-muted-foreground">CLP / mes</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Acceso ilimitado a todas las herramientas</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-foreground">$99.900</span>
                    <span className="text-xs text-muted-foreground">CLP / año</span>
                  </div>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                    Equivalente a solo $8.325 CLP/mes (Ahorras $19.980 CLP)
                  </p>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pt-2">
            <div className="text-xs font-semibold text-primary uppercase tracking-wide">
              Todo lo del plan Básico, más:
            </div>
            <ul className="space-y-2 text-xs text-foreground/90">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span className="font-semibold text-foreground">Productos y variantes ILIMITADAS</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span className="font-medium">Hasta 5 sucursales independientes</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span>Hasta 10 colaboradores con roles y permisos</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span className="font-medium text-primary">
                  Catálogo Online con logo + pedidos por WhatsApp
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span className="font-medium">
                  Módulo de Fiados con desglose de productos y cobro
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span>Comandas de Cocina (KDS) y gestión de mesas</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary shrink-0" />
                <span>Soporte prioritario y atención directa</span>
              </li>
            </ul>
          </CardContent>

          <CardFooter className="pt-4 border-t border-border/60">
            <Link href="/registro" className="w-full">
              <Button size="lg" className="w-full h-12 text-xs sm:text-sm font-black shadow-lg gap-2">
                Elegir Plan Pro
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>

      {/* Trust Badges */}
      <div className="mt-12 p-6 rounded-2xl bg-muted/30 border border-border max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-around gap-6 text-center sm:text-left">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-emerald-500 shrink-0" />
          <div>
            <div className="text-sm font-bold text-foreground">Garantía de Satisfacción 7 Días</div>
            <div className="text-xs text-muted-foreground">Si no es lo que esperabas, reembolso del 100%.</div>
          </div>
        </div>

        <div className="hidden sm:block h-8 w-px bg-border" />

        <div className="flex items-center gap-3">
          <Zap className="h-8 w-8 text-primary shrink-0" />
          <div>
            <div className="text-sm font-bold text-foreground">Pagos Seguros vía Mercado Pago</div>
            <div className="text-xs text-muted-foreground">Tarjetas de crédito, débito o saldo en cuenta.</div>
          </div>
        </div>

        <div className="hidden sm:block h-8 w-px bg-border" />

        <div className="flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-amber-500 shrink-0" />
          <div>
            <div className="text-sm font-bold text-foreground">Sin Permanencia Forzada</div>
            <div className="text-xs text-muted-foreground">Cancela con 1 clic cuando tú lo decidas.</div>
          </div>
        </div>
      </div>
    </section>
  );
}
