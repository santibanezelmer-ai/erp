"use client";

import { ShoppingBag, TrendingUp, Users, AlertTriangle, CheckCircle2, Clock, Utensils, Receipt } from "lucide-react";

export function LandingHeroMockup() {
  return (
    <div className="relative mx-auto w-full max-w-5xl rounded-2xl border border-border/70 bg-card/70 p-3 sm:p-5 shadow-2xl backdrop-blur-md">
      {/* Window Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3 mb-4 px-1">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-red-500/80" />
          <div className="h-3 w-3 rounded-full bg-amber-500/80" />
          <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
          <span className="ml-2 text-xs font-medium text-muted-foreground hidden sm:inline">
            operixerp.cloud — Panel de Control en Tiempo Real
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Caja Abierta • Sucursal Principal
          </span>
        </div>
      </div>

      {/* Mockup Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 text-left">
        {/* KPI 1 */}
        <div className="p-4 rounded-xl border border-border bg-background/80 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium">Ventas de Hoy</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-foreground">$384.500 <span className="text-xs font-normal text-muted-foreground">CLP</span></div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium flex items-center gap-1">
            <span>↑ 24% vs. ayer</span> • <span>42 tickets emitidos</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="p-4 rounded-xl border border-border bg-background/80 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium">Fiados y Créditos</span>
            <Users className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-foreground">$64.200 <span className="text-xs font-normal text-muted-foreground">por cobrar</span></div>
          <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
            <span>5 clientes</span> • <span className="text-primary font-medium">Recordatorio WhatsApp activo</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="p-4 rounded-xl border border-border bg-background/80 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium">Pedidos Online & KDS</span>
            <Utensils className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-foreground">6 activos</div>
          <div className="text-[11px] text-primary font-medium mt-1 flex items-center gap-1">
            <span>2 en preparación</span> • <span>4 mesas ocupadas</span>
          </div>
        </div>
      </div>

      {/* POS Preview Strip */}
      <div className="mt-4 p-4 rounded-xl border border-border bg-muted/30 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        <div className="lg:col-span-8 space-y-2 text-left">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Última Venta POS Emitida #1049
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
              Hace 2 min
            </span>
          </div>
          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
            <span>2x Bebida Coca-Cola 1.5L ($3.600)</span>
            <span>1x Pan Hallulla 1Kg ($1.990)</span>
            <span>1x Queso Gauda 250g ($2.490)</span>
          </div>
        </div>

        <div className="lg:col-span-4 flex items-center justify-start lg:justify-end gap-3">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Total Pagado (Débito)</div>
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">$8.080 CLP</div>
          </div>
          <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>
    </div>
  );
}
