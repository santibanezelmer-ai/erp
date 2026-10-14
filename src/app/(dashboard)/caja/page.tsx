"use client";

import { useEffect, useState } from "react";
import { useTenant } from "@/contexts/tenant-context";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Wallet,
  DollarSign,
  ArrowDownCircle,
  ArrowUpCircle,
  Lock,
  Unlock,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";

type CajaSesion = Database["public"]["Tables"]["caja_sesiones"]["Row"];
type MovimientoFlujo = Database["public"]["Tables"]["flujo_caja"]["Row"];

export default function CajaPage() {
  const { negocio, sucursalActiva, user } = useTenant();
  const [sesionActiva, setSesionActiva] = useState<CajaSesion | null>(null);
  const [historialSesiones, setHistorialSesiones] = useState<CajaSesion[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoFlujo[]>([]);
  const [loading, setLoading] = useState(true);

  // Totales turno activo
  const [ventasEfectivo, setVentasEfectivo] = useState(0);
  const [ventasOtras, setVentasOtras] = useState(0);

  // Modal Apertura
  const [openModalApertura, setOpenModalApertura] = useState(false);
  const [montoInicial, setMontoInicial] = useState<string>("50000");
  const [abriendo, setAbriendo] = useState(false);

  // Modal Cierre / Arqueo
  const [openModalCierre, setOpenModalCierre] = useState(false);
  const [montoContado, setMontoContado] = useState<string>("");
  const [notasCierre, setNotasCierre] = useState("");
  const [cerrando, setCerrando] = useState(false);

  // Modal Ingreso / Egreso manual
  const [openModalMovimiento, setOpenModalMovimiento] = useState(false);
  const [tipoMov, setTipoMov] = useState<"ingreso" | "egreso">("ingreso");
  const [montoMov, setMontoMov] = useState<string>("");
  const [motivoMov, setMotivoMov] = useState("");
  const [guardandoMov, setGuardandoMov] = useState(false);

  const fetchCajaData = async () => {
    if (!negocio?.id) return;
    setLoading(true);
    const supabase = createClient();

    try {
      // 1. Buscar si hay una sesión abierta en esta sucursal
      let queryActiva = supabase
        .from("caja_sesiones")
        .select("*")
        .eq("negocio_id", negocio.id)
        .eq("estado", "abierta")
        .order("abierta_at", { ascending: false })
        .limit(1);

      if (sucursalActiva?.id) {
        queryActiva = queryActiva.eq("sucursal_id", sucursalActiva.id);
      }

      const { data: actData } = await queryActiva;
      const activa = actData?.[0] || null;
      setSesionActiva(activa);

      if (activa) {
        // Cargar ventas en efectivo desde que se abrió la caja
        let qVentas = supabase
          .from("ventas")
          .select("total, pago")
          .eq("negocio_id", negocio.id)
          .gte("created_at", activa.abierta_at);

        if (sucursalActiva?.id) {
          qVentas = qVentas.eq("sucursal_id", sucursalActiva.id);
        }

        const { data: vts } = await qVentas;
        const efectivoSum = (vts || [])
          .filter((v) => v.pago === "efectivo")
          .reduce((acc, v) => acc + Number(v.total || 0), 0);
        const otrasSum = (vts || [])
          .filter((v) => v.pago !== "efectivo")
          .reduce((acc, v) => acc + Number(v.total || 0), 0);

        setVentasEfectivo(efectivoSum);
        setVentasOtras(otrasSum);

        // Cargar movimientos manuales de flujo de caja
        const { data: movs } = await supabase
          .from("flujo_caja")
          .select("*")
          .eq("negocio_id", negocio.id)
          .gte("created_at", activa.abierta_at)
          .order("created_at", { ascending: false });

        setMovimientos(movs || []);
      }

      // Historial últimas 10 sesiones
      const { data: hist } = await supabase
        .from("caja_sesiones")
        .select("*")
        .eq("negocio_id", negocio.id)
        .order("abierta_at", { ascending: false })
        .limit(10);

      setHistorialSesiones(hist || []);
    } catch (err: any) {
      toast.error(err.message || "Error al cargar la caja");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCajaData();
  }, [negocio?.id, sucursalActiva?.id]);

  // Cálculos de saldo de gaveta
  const sumaIngresosManuales = movimientos
    .filter((m) => m.tipo === "ingreso")
    .reduce((acc, m) => acc + Number(m.monto || 0), 0);
  const sumaEgresosManuales = movimientos
    .filter((m) => m.tipo === "egreso")
    .reduce((acc, m) => acc + Number(m.monto || 0), 0);

  const saldoEsperado =
    Number(sesionActiva?.monto_inicial || 0) +
    ventasEfectivo +
    sumaIngresosManuales -
    sumaEgresosManuales;

  const diferenciaCierre = Number(montoContado || 0) - saldoEsperado;

  // Acciones
  const abrirCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocio?.id) return;

    setAbriendo(true);
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from("caja_sesiones")
        .insert({
          negocio_id: negocio.id,
          sucursal_id: sucursalActiva?.id || null,
          usuario_id: user?.id || null,
          monto_inicial: Number(montoInicial) || 0,
          estado: "abierta",
          abierta_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      toast.success("Turno de caja abierto correctamente");
      setOpenModalApertura(false);
      fetchCajaData();
    } catch (err: any) {
      toast.error(err.message || "Error al abrir la caja");
    } finally {
      setAbriendo(false);
    }
  };

  const cerrarCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sesionActiva) return;

    setCerrando(true);
    const supabase = createClient();

    try {
      const contado = Number(montoContado) || 0;
      const { error } = await supabase
        .from("caja_sesiones")
        .update({
          estado: "cerrada",
          cerrada_at: new Date().toISOString(),
          cerrada_por: user?.id || null,
          monto_esperado: saldoEsperado,
          monto_contado: contado,
          diferencia: contado - saldoEsperado,
          notas: notasCierre.trim() || null,
        })
        .eq("id", sesionActiva.id);

      if (error) throw error;
      toast.success("Turno de caja cerrado y arqueado");
      setOpenModalCierre(false);
      fetchCajaData();
    } catch (err: any) {
      toast.error(err.message || "Error al cerrar la caja");
    } finally {
      setCerrando(false);
    }
  };

  const registrarMovimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocio?.id) return;
    const monto = Number(montoMov);
    if (isNaN(monto) || monto <= 0) {
      toast.error("Monto inválido");
      return;
    }

    setGuardandoMov(true);
    const supabase = createClient();

    try {
      const { error } = await supabase.from("flujo_caja").insert({
        negocio_id: negocio.id,
        usuario_id: user?.id || null,
        tipo: tipoMov,
        monto,
        descripcion: motivoMov.trim() || (tipoMov === "ingreso" ? "Ingreso manual" : "Retiro / Gasto"),
      });

      if (error) throw error;
      toast.success(tipoMov === "ingreso" ? "Ingreso de efectivo anotado" : "Retiro de efectivo anotado");
      setOpenModalMovimiento(false);
      setMontoMov("");
      setMotivoMov("");
      fetchCajaData();
    } catch (err: any) {
      toast.error(err.message || "Error al registrar movimiento");
    } finally {
      setGuardandoMov(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Caja y Arqueo de Turno</h1>
          <p className="text-sm text-muted-foreground">
            Control de efectivo en gaveta, ventas por medio de pago y cierre de turno
          </p>
        </div>

        {sesionActiva ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpenModalMovimiento(true)}
              className="gap-1.5 text-xs"
            >
              Movimiento de Efectivo (+ / -)
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setMontoContado(String(saldoEsperado));
                setOpenModalCierre(true);
              }}
              className="gap-1.5 text-xs shadow-sm"
            >
              <Lock className="h-3.5 w-3.5" />
              Cerrar Turno / Arqueo
            </Button>
          </div>
        ) : (
          <Button onClick={() => setOpenModalApertura(true)} className="gap-2 shadow-sm">
            <Unlock className="h-4 w-4" />
            Abrir Turno de Caja
          </Button>
        )}
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs">Consultando estado de caja...</span>
        </div>
      ) : !sesionActiva ? (
        /* Caja Cerrada Estado */
        <Card className="text-center py-16 border-dashed border-2">
          <CardContent className="space-y-4 max-w-md mx-auto">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <Lock className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold">La caja se encuentra cerrada</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Para empezar a registrar ventas en el POS y controlar el efectivo, abre un turno indicando el fondo inicial.
              </p>
            </div>
            <Button onClick={() => setOpenModalApertura(true)} className="gap-2">
              <Unlock className="h-4 w-4" />
              Abrir Turno Ahora
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Caja Abierta Dashboard */
        <div className="space-y-6">
          {/* Tarjetas de Métricas del Turno */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Saldo Esperado en Gaveta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-primary">{formatMoney(saldoEsperado)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Efectivo total que debe haber físicamente
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Fondo Inicial
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatMoney(sesionActiva.monto_inicial)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Abierto a las{" "}
                  {new Date(sesionActiva.abierta_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Ventas en Efectivo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-500">
                  +{formatMoney(ventasEfectivo)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Ingresado por POS en efectivo</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tarjetas y Otros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-500">
                  {formatMoney(ventasOtras)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Débito, crédito y transferencia</p>
              </CardContent>
            </Card>
          </div>

          {/* Movimientos de flujo manuales */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-bold">Movimientos del Turno</CardTitle>
                <CardDescription>Entradas y salidas de dinero registradas manualmente</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => setOpenModalMovimiento(true)} className="text-xs">
                + Agregar Movimiento
              </Button>
            </CardHeader>
            <CardContent>
              {movimientos.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No hay retiros ni ingresos manuales durante este turno.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {movimientos.map((m) => (
                    <div key={m.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        {m.tipo === "ingreso" ? (
                          <ArrowDownCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                        ) : (
                          <ArrowUpCircle className="h-4 w-4 text-destructive shrink-0" />
                        )}
                        <div>
                          <div className="font-semibold text-foreground">
                            {m.descripcion || (m.tipo === "ingreso" ? "Ingreso manual" : "Retiro de efectivo")}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {new Date(m.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </div>

                      <div
                        className={cn(
                          "font-bold text-sm",
                          m.tipo === "ingreso"
                            ? "text-emerald-600 dark:text-emerald-500"
                            : "text-destructive"
                        )}
                      >
                        {m.tipo === "ingreso" ? "+" : "-"}
                        {formatMoney(m.monto)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Historial de Turnos Anteriores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            Historial de Cierres de Turno
          </CardTitle>
          <CardDescription>Últimas 10 sesiones de caja cerradas</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-4">Fecha Apertura</th>
                  <th className="py-2.5 px-4">Fecha Cierre</th>
                  <th className="py-2.5 px-4 text-right">Inicial</th>
                  <th className="py-2.5 px-4 text-right">Esperado</th>
                  <th className="py-2.5 px-4 text-right">Contado</th>
                  <th className="py-2.5 px-4 text-right">Diferencia</th>
                  <th className="py-2.5 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {historialSesiones.map((s) => {
                  const dif = Number(s.diferencia || 0);
                  return (
                    <tr key={s.id} className="hover:bg-muted/30">
                      <td className="py-2.5 px-4">
                        {new Date(s.abierta_at).toLocaleString([], {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground">
                        {s.cerrada_at
                          ? new Date(s.cerrada_at).toLocaleString([], {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "En curso..."}
                      </td>
                      <td className="py-2.5 px-4 text-right">{formatMoney(s.monto_inicial)}</td>
                      <td className="py-2.5 px-4 text-right">{formatMoney(s.monto_esperado)}</td>
                      <td className="py-2.5 px-4 text-right font-medium">
                        {s.monto_contado != null ? formatMoney(s.monto_contado) : "—"}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold">
                        {s.diferencia != null ? (
                          dif === 0 ? (
                            <span className="text-emerald-600">Exacto ($0)</span>
                          ) : dif > 0 ? (
                            <span className="text-blue-600">+{formatMoney(dif)}</span>
                          ) : (
                            <span className="text-destructive">{formatMoney(dif)}</span>
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full font-semibold text-[10px] uppercase",
                            s.estado === "abierta"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {s.estado}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Apertura */}
      <Dialog open={openModalApertura} onOpenChange={setOpenModalApertura}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Abrir Turno de Caja</DialogTitle>
            <DialogDescription>
              Ingresa el monto de efectivo inicial (sencillo / cambio en gaveta).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={abrirCaja} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="monto-inicial">Fondo Inicial en Efectivo</Label>
              <Input
                id="monto-inicial"
                type="number"
                min="0"
                value={montoInicial}
                onChange={(e) => setMontoInicial(e.target.value)}
                required
                className="text-lg font-bold"
                disabled={abriendo}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenModalApertura(false)} disabled={abriendo}>
                Cancelar
              </Button>
              <Button type="submit" disabled={abriendo}>
                {abriendo ? "Abriendo..." : "Confirmar Apertura"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Cierre / Arqueo */}
      <Dialog open={openModalCierre} onOpenChange={setOpenModalCierre}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Arqueo y Cierre de Turno</DialogTitle>
            <DialogDescription>
              Cuenta el dinero en físico que tienes en la gaveta y digítalo aquí.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={cerrarCaja} className="space-y-4 py-2">
            <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Fondo inicial:</span>
                <span>{formatMoney(sesionActiva?.monto_inicial)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Ventas efectivo:</span>
                <span>+{formatMoney(ventasEfectivo)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-foreground pt-1 border-t border-border">
                <span>Saldo Teórico Esperado:</span>
                <span className="text-primary">{formatMoney(saldoEsperado)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="monto-contado">Dinero Físico Contado</Label>
              <Input
                id="monto-contado"
                type="number"
                value={montoContado}
                onChange={(e) => setMontoContado(e.target.value)}
                required
                className="text-xl font-bold"
                disabled={cerrando}
              />
            </div>

            {/* Descuadre preview */}
            <div className="p-3 rounded-lg border border-border flex items-center justify-between text-xs font-semibold">
              <span className="text-muted-foreground">Diferencia (Sobrante / Faltante):</span>
              <span
                className={cn(
                  "text-sm font-black",
                  diferenciaCierre === 0
                    ? "text-emerald-600"
                    : diferenciaCierre > 0
                    ? "text-blue-600"
                    : "text-destructive"
                )}
              >
                {diferenciaCierre === 0 ? "Cuadrada ($0)" : formatMoney(diferenciaCierre)}
              </span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notas-cierre">Notas de Cierre (Opcional)</Label>
              <Input
                id="notas-cierre"
                placeholder="Observaciones de descuadre o turno..."
                value={notasCierre}
                onChange={(e) => setNotasCierre(e.target.value)}
                disabled={cerrando}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenModalCierre(false)} disabled={cerrando}>
                Cancelar
              </Button>
              <Button type="submit" variant="destructive" disabled={cerrando}>
                {cerrando ? "Cerrando turno..." : "Confirmar Cierre de Caja"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Movimiento Manual */}
      <Dialog open={openModalMovimiento} onOpenChange={setOpenModalMovimiento}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Movimiento de Efectivo</DialogTitle>
            <DialogDescription>Registra un retiro o aporte de dinero en gaveta.</DialogDescription>
          </DialogHeader>

          <form onSubmit={registrarMovimiento} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipoMov("ingreso")}
                className={cn(
                  "py-2 rounded-lg text-xs font-bold border transition-all",
                  tipoMov === "ingreso"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground"
                )}
              >
                + Entrada
              </button>
              <button
                type="button"
                onClick={() => setTipoMov("egreso")}
                className={cn(
                  "py-2 rounded-lg text-xs font-bold border transition-all",
                  tipoMov === "egreso"
                    ? "bg-destructive text-destructive-foreground border-destructive"
                    : "border-border text-muted-foreground"
                )}
              >
                - Salida / Gasto
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="monto-mov">Monto</Label>
              <Input
                id="monto-mov"
                type="number"
                min="1"
                placeholder="Ej: 10000"
                value={montoMov}
                onChange={(e) => setMontoMov(e.target.value)}
                required
                className="text-lg font-bold"
                disabled={guardandoMov}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="motivo-mov">Motivo / Descripción</Label>
              <Input
                id="motivo-mov"
                placeholder="Ej: Compra de insumos, pago delivery, etc."
                value={motivoMov}
                onChange={(e) => setMotivoMov(e.target.value)}
                required
                disabled={guardandoMov}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenModalMovimiento(false)} disabled={guardandoMov}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardandoMov}>
                {guardandoMov ? "Guardando..." : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
