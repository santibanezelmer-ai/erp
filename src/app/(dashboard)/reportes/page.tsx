"use client";

import { useEffect, useState } from "react";
import { useTenant } from "@/contexts/tenant-context";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BarChart3,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  UserCheck,
  Loader2,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ReportesPage() {
  const { negocio, sucursalActiva } = useTenant();
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<"hoy" | "7dias" | "mes" | "todos">("mes");

  // Métricas
  const [totalFacturado, setTotalFacturado] = useState(0);
  const [totalTickets, setTotalTickets] = useState(0);
  const [ticketPromedio, setTicketPromedio] = useState(0);

  // Por método de pago
  const [porMetodo, setPorMetodo] = useState<{
    efectivo: number;
    tarjeta: number;
    transferencia: number;
    fiado: number;
  }>({ efectivo: 0, tarjeta: 0, transferencia: 0, fiado: 0 });

  // Top productos
  const [topProductos, setTopProductos] = useState<{ nombre: string; totalQty: number; totalMonto: number }[]>([]);

  useEffect(() => {
    if (!negocio?.id) return;

    const fetchReportes = async () => {
      setLoading(true);
      const supabase = createClient();

      try {
        let fechaInicio: string | null = null;
        const now = new Date();

        if (periodo === "hoy") {
          now.setHours(0, 0, 0, 0);
          fechaInicio = now.toISOString();
        } else if (periodo === "7dias") {
          now.setDate(now.getDate() - 7);
          fechaInicio = now.toISOString();
        } else if (periodo === "mes") {
          now.setDate(1);
          now.setHours(0, 0, 0, 0);
          fechaInicio = now.toISOString();
        }

        // 1. Consultar ventas
        let qVentas = supabase
          .from("ventas")
          .select("id, total, pago, created_at")
          .eq("negocio_id", negocio.id)
          .neq("estado", "anulada");

        if (fechaInicio) {
          qVentas = qVentas.gte("created_at", fechaInicio);
        }
        if (sucursalActiva?.id) {
          qVentas = qVentas.eq("sucursal_id", sucursalActiva.id);
        }

        const { data: vts } = await qVentas;
        const ventasList = vts || [];

        const totalSuma = ventasList.reduce((acc, v) => acc + Number(v.total || 0), 0);
        const count = ventasList.length;
        setTotalFacturado(totalSuma);
        setTotalTickets(count);
        setTicketPromedio(count > 0 ? totalSuma / count : 0);

        // Desglose por método
        const metodos = { efectivo: 0, tarjeta: 0, transferencia: 0, fiado: 0 };
        ventasList.forEach((v) => {
          const m = (v.pago || "efectivo") as keyof typeof metodos;
          if (metodos[m] != null) {
            metodos[m] += Number(v.total || 0);
          }
        });
        setPorMetodo(metodos);

        // 2. Top productos vendidos
        if (ventasList.length > 0) {
          const ventaIds = ventasList.map((v) => v.id);
          const { data: dets } = await supabase
            .from("detalle_ventas")
            .select("nombre, qty, subtotal")
            .in("venta_id", ventaIds);

          const prodMap = new Map<string, { totalQty: number; totalMonto: number }>();
          (dets || []).forEach((d) => {
            const nom = d.nombre || "Sin nombre";
            const cur = prodMap.get(nom) || { totalQty: 0, totalMonto: 0 };
            prodMap.set(nom, {
              totalQty: cur.totalQty + Number(d.qty || 0),
              totalMonto: cur.totalMonto + Number(d.subtotal || 0),
            });
          });

          const topSorted = Array.from(prodMap.entries())
            .map(([nombre, val]) => ({ nombre, ...val }))
            .sort((a, b) => b.totalQty - a.totalQty)
            .slice(0, 5);

          setTopProductos(topSorted);
        } else {
          setTopProductos([]);
        }
      } catch (err) {
        console.error("Error al cargar reportes:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchReportes();
  }, [negocio?.id, sucursalActiva?.id, periodo]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes y Estadísticas</h1>
          <p className="text-sm text-muted-foreground">
            Métricas de ventas, rendimiento de productos y métodos de cobro
          </p>
        </div>

        {/* Filtro de Periodo */}
        <div className="flex items-center gap-1.5 bg-background border border-border p-1 rounded-xl w-full sm:w-auto overflow-x-auto scrollbar-none">
          {[
            { id: "hoy", label: "Hoy" },
            { id: "7dias", label: "7 días" },
            { id: "mes", label: "Este mes" },
            { id: "todos", label: "Todo" },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriodo(p.id as any)}
              className={cn(
                "px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex-1 sm:flex-initial text-center cursor-pointer",
                periodo === p.id
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs">Calculando balances...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tarjetas Principales */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Total Facturado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-primary">{formatMoney(totalFacturado)}</div>
                <p className="text-xs text-muted-foreground mt-1">Ingresos brutos por ventas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tickets Emitidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalTickets}</div>
                <p className="text-xs text-muted-foreground mt-1">Transacciones procesadas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Ticket Promedio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-500">
                  {formatMoney(ticketPromedio)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Gasto medio por cliente</p>
              </CardContent>
            </Card>
          </div>

          {/* Desglose por Métodos de Pago & Top Productos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Medios de Pago */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold">Ventas por Medio de Pago</CardTitle>
                <CardDescription>Distribución de cobros del periodo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-2.5">
                    <Banknote className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm font-semibold">Efectivo</span>
                  </div>
                  <span className="text-base font-bold">{formatMoney(porMetodo.efectivo)}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-2.5">
                    <CreditCard className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-semibold">Tarjeta (POS)</span>
                  </div>
                  <span className="text-base font-bold">{formatMoney(porMetodo.tarjeta)}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-2.5">
                    <ArrowRightLeft className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-semibold">Transferencia</span>
                  </div>
                  <span className="text-base font-bold">{formatMoney(porMetodo.transferencia)}</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-2.5">
                    <UserCheck className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-semibold">Fiado (Crédito)</span>
                  </div>
                  <span className="text-base font-bold text-amber-600">{formatMoney(porMetodo.fiado)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Top Productos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold">Productos Más Vendidos</CardTitle>
                <CardDescription>Top 5 artículos con mayor rotación</CardDescription>
              </CardHeader>
              <CardContent>
                {topProductos.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    No hay datos de productos en este periodo.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {topProductos.map((p, idx) => (
                      <div key={idx} className="py-3 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-3">
                          <span className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="font-semibold text-foreground">{p.nombre}</div>
                            <div className="text-xs text-muted-foreground">{p.totalQty} unidades vendidas</div>
                          </div>
                        </div>

                        <div className="font-bold text-foreground text-right">
                          {formatMoney(p.totalMonto)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
