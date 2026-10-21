"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTenant } from "@/contexts/tenant-context";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  ShoppingCart,
  AlertTriangle,
  Users,
  ArrowUpRight,
  Plus,
  Loader2,
  TrendingUp,
} from "lucide-react";

export default function DashboardPage() {
  const { negocio, sucursalActiva } = useTenant();
  const [loading, setLoading] = useState(true);
  const [ventasHoy, setVentasHoy] = useState(0);
  const [totalMontoHoy, setTotalMontoHoy] = useState(0);
  const [productosBajoStock, setProductosBajoStock] = useState(0);
  const [totalClientes, setTotalClientes] = useState(0);
  const [ultimasVentas, setUltimasVentas] = useState<any[]>([]);

  useEffect(() => {
    if (!negocio?.id) return;

    const fetchKPIs = async () => {
      setLoading(true);
      const supabase = createClient();

      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayIso = today.toISOString();

        // 1. Ventas de hoy
        let queryVentas = supabase
          .from("ventas")
          .select("id, total, created_at, pago, sucursal_id")
          .eq("negocio_id", negocio.id)
          .gte("created_at", todayIso);

        if (sucursalActiva?.id) {
          queryVentas = queryVentas.eq("sucursal_id", sucursalActiva.id);
        }

        const { data: ventas } = await queryVentas;
        const countVentas = ventas?.length || 0;
        const sumMonto = (ventas || []).reduce((acc, v) => acc + Number(v.total || 0), 0);
        setVentasHoy(countVentas);
        setTotalMontoHoy(sumMonto);

        // 2. Últimas 5 ventas
        let queryUltimas = supabase
          .from("ventas")
          .select("id, total, created_at, pago")
          .eq("negocio_id", negocio.id)
          .order("created_at", { ascending: false })
          .limit(5);

        if (sucursalActiva?.id) {
          queryUltimas = queryUltimas.eq("sucursal_id", sucursalActiva.id);
        }

        const { data: ultimas } = await queryUltimas;
        setUltimasVentas(ultimas || []);

        // 3. Productos con stock crítico
        const { count: bajoStockCount } = await supabase
          .from("productos")
          .select("id", { count: "exact", head: true })
          .eq("negocio_id", negocio.id)
          .lte("stock", 5)
          .eq("activo", true);

        setProductosBajoStock(bajoStockCount || 0);

        // 4. Clientes registrados
        const { count: clientesCount } = await supabase
          .from("clientes")
          .select("id", { count: "exact", head: true })
          .eq("negocio_id", negocio.id);

        setTotalClientes(clientesCount || 0);
      } catch (err) {
        console.error("Error cargando KPIs:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchKPIs();
  }, [negocio?.id, sucursalActiva?.id]);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard General</h1>
          <p className="text-sm text-muted-foreground">
            Resumen en tiempo real de {negocio?.nombre} • {sucursalActiva?.nombre || "Todas las sucursales"}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Link href="/productos" className="flex-1 sm:flex-initial">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs w-full justify-center">
              <Plus className="h-3.5 w-3.5" />
              Nuevo Producto
            </Button>
          </Link>

          <Link href="/pos" className="flex-1 sm:flex-initial">
            <Button size="sm" className="gap-1.5 text-xs shadow-sm w-full justify-center">
              <ShoppingCart className="h-3.5 w-3.5" />
              Abrir POS
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ventas Hoy
            </CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatMoney(totalMontoHoy)}</div>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                  {ventasHoy} {ventasHoy === 1 ? "ticket emitido" : "tickets emitidos"}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tickets Emitidos
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold">{ventasHoy}</div>
                <p className="text-xs text-muted-foreground mt-1">Transacciones procesadas hoy</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Stock Crítico
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-500">
                  {productosBajoStock}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Productos con 5 o menos u.</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Clientes Registrados
            </CardTitle>
            <Users className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold">{totalClientes}</div>
                <p className="text-xs text-muted-foreground mt-1">Directorio de clientes</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales & Quick Shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold">Últimas Ventas</CardTitle>
              <CardDescription>Transacciones recientes en el punto de venta</CardDescription>
            </div>
            <Link
              href="/ventas"
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            >
              Ver todas <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : ultimasVentas.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Aún no hay ventas registradas hoy.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {ultimasVentas.map((v) => (
                  <div key={v.id} className="py-3 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-semibold text-foreground">
                        Ticket #{v.id.slice(0, 8).toUpperCase()}
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {v.pago || "Efectivo"} •{" "}
                        {new Date(v.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <div className="font-bold text-foreground text-right">
                      {formatMoney(v.total)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick actions card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold">Accesos Rápidos</CardTitle>
            <CardDescription>Operaciones frecuentes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <Link
              href="/pos"
              className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/60 transition-colors text-sm font-medium"
            >
              <div className="flex items-center gap-2.5">
                <ShoppingCart className="h-4 w-4 text-primary" />
                <span>Cobrar en POS</span>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            <Link
              href="/productos"
              className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/60 transition-colors text-sm font-medium"
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>Gestionar Inventario</span>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            <Link
              href="/clientes"
              className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/60 transition-colors text-sm font-medium"
            >
              <div className="flex items-center gap-2.5">
                <Users className="h-4 w-4 text-purple-500" />
                <span>Clientes y Fiados</span>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            <Link
              href="/caja"
              className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/60 transition-colors text-sm font-medium"
            >
              <div className="flex items-center gap-2.5">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                <span>Arqueo y Cierre de Caja</span>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
