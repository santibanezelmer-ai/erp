"use client";

import { useEffect, useState } from "react";
import { useTenant } from "@/contexts/tenant-context";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import { imprimirTicketTermico } from "@/lib/ticket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Search,
  Users,
  DollarSign,
  Package,
  MessageCircle,
  Printer,
  ChevronDown,
  ChevronUp,
  Clock,
  Phone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  BadgeDollarSign,
  CheckCheck,
  Calendar,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ProductoFiadoItem {
  id: string;
  ventaId?: string;
  folio?: string;
  fecha: string;
  nombre: string;
  qty: number;
  precio: number;
  subtotal: number;
  esParcial?: boolean;
  montoPendiente?: number;
}

interface ClienteConFiado {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  deuda_total: number;
  ultimaFechaFiado?: string | null;
  productos: ProductoFiadoItem[];
  cargandoDetalle?: boolean;
}

export default function FiadosPage() {
  const { negocio, profile } = useTenant();
  const [clientes, setClientes] = useState<ClienteConFiado[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [expandedClientes, setExpandedClientes] = useState<Set<string>>(new Set());

  // Modal para abonar
  const [abonoModalOpen, setAbonoModalOpen] = useState(false);
  const [clienteAbono, setClienteAbono] = useState<ClienteConFiado | null>(null);
  const [montoAbono, setMontoAbono] = useState<string>("");
  const [savingAbono, setSavingAbono] = useState(false);

  useEffect(() => {
    if (negocio?.id) {
      cargarFiadosYProductos();
    }
  }, [negocio?.id]);

  const cargarFiadosYProductos = async () => {
    if (!negocio?.id) return;
    setLoading(true);
    const supabase = createClient();

    try {
      // 1. Obtener todos los clientes con deuda > 0 del negocio
      const { data: clientsData, error: errCli } = await supabase
        .from("clientes")
        .select("id, nombre, telefono, email, deuda_total")
        .eq("negocio_id", negocio.id)
        .gt("deuda_total", 0)
        .order("deuda_total", { ascending: false });

      if (errCli) throw errCli;

      if (!clientsData || clientsData.length === 0) {
        setClientes([]);
        setLoading(false);
        return;
      }

      const clientIds = clientsData.map((c) => c.id);

      // 2. Traer deudas y ventas fiadas en paralelo
      const [deudasRes, ventasRes] = await Promise.all([
        supabase
          .from("deudas")
          .select("id, cliente_id, venta_id, monto, tipo, notas, created_at")
          .eq("negocio_id", negocio.id)
          .in("cliente_id", clientIds)
          .order("created_at", { ascending: true }),
        supabase
          .from("ventas")
          .select("id, cliente_id, total, created_at, estado, pago")
          .eq("negocio_id", negocio.id)
          .in("cliente_id", clientIds)
          .eq("pago", "fiado")
          .neq("estado", "cancelada")
          .order("created_at", { ascending: true }),
      ]);

      const deudasData = deudasRes.data || [];
      const ventasData = ventasRes.data || [];

      // 3. Obtener los IDs de ventas fiadas para cargar detalle_ventas
      const ventaIdsSet = new Set<string>();
      ventasData.forEach((v) => ventaIdsSet.add(v.id));
      deudasData.forEach((d) => {
        if (d.venta_id) ventaIdsSet.add(d.venta_id);
      });

      const ventaIds = Array.from(ventaIdsSet);
      let detallesPorVenta = new Map<string, any[]>();

      if (ventaIds.length > 0) {
        // En chunks de 100 si son muchas
        const { data: detsData } = await supabase
          .from("detalle_ventas")
          .select("id, venta_id, nombre, qty, precio, subtotal, created_at")
          .in("venta_id", ventaIds);

        if (detsData) {
          detsData.forEach((d) => {
            const arr = detallesPorVenta.get(d.venta_id) || [];
            arr.push(d);
            detallesPorVenta.set(d.venta_id, arr);
          });
        }
      }

      // 4. Conciliar FIFO por cada cliente para saber exactamente qué productos componen su saldo actual
      const clientesProcesados: ClienteConFiado[] = clientsData.map((c) => {
        const deudaActual = Number(c.deuda_total || 0);

        // Deudas y ventas de este cliente
        const cliDeudas = deudasData.filter((d) => d.cliente_id === c.id);
        const cliVentas = ventasData.filter((v) => v.cliente_id === c.id);

        type Cargo = {
          id: string;
          venta_id: string | null;
          monto: number;
          fecha: string;
          notas: string | null;
        };

        const cargosMap = new Map<string, Cargo>();

        cliVentas.forEach((v) => {
          cargosMap.set(`v-${v.id}`, {
            id: `v-${v.id}`,
            venta_id: v.id,
            monto: Number(v.total || 0),
            fecha: v.created_at,
            notas: `Venta Fiada #${v.id.slice(0, 8)}`,
          });
        });

        let totalAbonos = 0;
        cliDeudas.forEach((d) => {
          const m = Number(d.monto || 0);
          if (d.tipo === "pago") {
            totalAbonos += m;
          } else {
            const key = d.venta_id ? `v-${d.venta_id}` : `d-${d.id}`;
            if (!cargosMap.has(key)) {
              cargosMap.set(key, {
                id: d.id,
                venta_id: d.venta_id,
                monto: m,
                fecha: d.created_at,
                notas: d.notas,
              });
            }
          }
        });

        const listaCargos = Array.from(cargosMap.values()).sort(
          (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
        );

        const totalCargosHistoricos = listaCargos.reduce((acc, crg) => acc + crg.monto, 0);
        let saldoPagado = Math.max(0, totalCargosHistoricos - deudaActual);
        if (totalAbonos > saldoPagado) {
          saldoPagado = totalAbonos;
        }

        const cargosPendientes: {
          cargo: Cargo;
          montoPendiente: number;
          esParcial: boolean;
        }[] = [];

        for (const crg of listaCargos) {
          if (saldoPagado >= crg.monto) {
            saldoPagado -= crg.monto;
          } else if (saldoPagado > 0) {
            const rem = crg.monto - saldoPagado;
            saldoPagado = 0;
            cargosPendientes.push({
              cargo: crg,
              montoPendiente: rem,
              esParcial: true,
            });
          } else {
            cargosPendientes.push({
              cargo: crg,
              montoPendiente: crg.monto,
              esParcial: false,
            });
          }
        }

        const itemsFinales: ProductoFiadoItem[] = [];
        let ultimaFecha: string | null = null;

        for (const cp of cargosPendientes) {
          const crg = cp.cargo;
          ultimaFecha = crg.fecha;

          if (crg.venta_id && detallesPorVenta.has(crg.venta_id)) {
            const prods = detallesPorVenta.get(crg.venta_id)!;
            prods.forEach((p, idx) => {
              itemsFinales.push({
                id: `${p.id || idx}-${crg.id}`,
                ventaId: crg.venta_id || undefined,
                folio: crg.venta_id?.slice(0, 8).toUpperCase(),
                fecha: crg.fecha,
                nombre: p.nombre || "Artículo sin nombre",
                qty: Number(p.qty || 1),
                precio: Number(p.precio || 0),
                subtotal: Number(p.subtotal || Number(p.qty || 1) * Number(p.precio || 0)),
                esParcial: cp.esParcial,
                montoPendiente: cp.esParcial ? cp.montoPendiente : undefined,
              });
            });
          } else {
            itemsFinales.push({
              id: crg.id,
              fecha: crg.fecha,
              nombre: crg.notas || "Cargo registrado en cuenta",
              qty: 1,
              precio: cp.montoPendiente,
              subtotal: cp.montoPendiente,
              esParcial: cp.esParcial,
              montoPendiente: cp.montoPendiente,
            });
          }
        }

        // Si no hay detalles específicos pero sí saldo deudor
        if (itemsFinales.length === 0 && deudaActual > 0) {
          itemsFinales.push({
            id: `saldo-${c.id}`,
            fecha: new Date().toISOString(),
            nombre: "Saldo adeudado pendiente en cuenta",
            qty: 1,
            precio: deudaActual,
            subtotal: deudaActual,
            esParcial: false,
            montoPendiente: deudaActual,
          });
        }

        return {
          id: c.id,
          nombre: c.nombre,
          telefono: c.telefono,
          email: c.email,
          deuda_total: deudaActual,
          ultimaFechaFiado: ultimaFecha,
          productos: itemsFinales,
        };
      });

      setClientes(clientesProcesados);
      // Por defecto, expandir el primer cliente si hay pocos
      if (clientesProcesados.length <= 3) {
        setExpandedClientes(new Set(clientesProcesados.map((c) => c.id)));
      }
    } catch (err: any) {
      console.error("Error al cargar fiados y productos:", err);
      toast.error(err.message || "Error al cargar módulo de fiados");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (clienteId: string) => {
    setExpandedClientes((prev) => {
      const next = new Set(prev);
      if (next.has(clienteId)) {
        next.delete(clienteId);
      } else {
        next.add(clienteId);
      }
      return next;
    });
  };

  const abrirModalAbono = (c: ClienteConFiado) => {
    setClienteAbono(c);
    setMontoAbono(String(c.deuda_total || ""));
    setAbonoModalOpen(true);
  };

  const procesarAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteAbono || !negocio) return;
    const monto = Number(montoAbono);
    if (isNaN(monto) || monto <= 0) {
      toast.error("Por favor ingresa un monto válido mayor a 0");
      return;
    }

    setSavingAbono(true);
    const supabase = createClient();

    try {
      const deudaActual = Number(clienteAbono.deuda_total || 0);
      const nuevaDeuda = Math.max(0, deudaActual - monto);

      // 1. Actualizar deuda del cliente
      const { error: cErr } = await supabase
        .from("clientes")
        .update({ deuda_total: nuevaDeuda })
        .eq("id", clienteAbono.id);

      if (cErr) throw cErr;

      // 2. Registrar abono en tabla deudas
      const { error: dErr } = await supabase.from("deudas").insert({
        negocio_id: negocio.id,
        cliente_id: clienteAbono.id,
        monto: monto,
        tipo: "pago",
        notas: `Abono de ${formatMoney(monto)} recibido`,
      });

      if (dErr) throw dErr;

      toast.success(
        `Abono de ${formatMoney(monto)} registrado correctamente. Nuevo saldo: ${formatMoney(nuevaDeuda)}`
      );
      setAbonoModalOpen(false);
      cargarFiadosYProductos();
    } catch (err: any) {
      toast.error(err.message || "Error al registrar abono");
    } finally {
      setSavingAbono(false);
    }
  };

  const enviarWhatsAppDetalle = (c: ClienteConFiado) => {
    if (!c.telefono || !c.telefono.trim()) {
      toast.error("El cliente no tiene un teléfono o WhatsApp registrado");
      return;
    }
    const telLimpio = c.telefono.replace(/[^0-9]/g, "");
    if (!telLimpio) {
      toast.error("El teléfono no contiene números válidos");
      return;
    }

    if (c.productos.length === 0) {
      toast.info("No hay productos pendientes para este cliente");
      return;
    }

    const nombreLocal = negocio?.nombre || "nuestro local";
    const lineas = c.productos
      .map(
        (it) =>
          `• ${it.qty}× ${it.nombre} — ${formatMoney(it.precio)}${
            it.qty > 1 ? ` (${formatMoney(it.subtotal)})` : ""
          }${it.folio ? ` [Ticket #${it.folio}]` : ""}`
      )
      .join("\n");

    const mensaje = `Hola ${c.nombre}, te saludamos de ${nombreLocal}. Te enviamos el detalle de los productos que componen tu saldo pendiente de fiado:\n\n${lineas}\n\nTotal saldo adeudado: ${formatMoney(
      c.deuda_total
    )}\n\nQuedamos a tu disposición para coordinar tu pago. ¡Muchas gracias!`;

    window.open(`https://wa.me/${telLimpio}?text=${encodeURIComponent(mensaje)}`, "_blank");
    toast.success("Abriendo WhatsApp con el detalle de productos...");
  };

  const imprimirComprobante = (c: ClienteConFiado) => {
    if (!negocio) return;
    imprimirTicketTermico({
      negocioNombre: negocio.nombre,
      negocioRut: (negocio as any).rut || null,
      negocioTelefono: (negocio as any).telefono || null,
      negocioDireccion: (negocio as any).direccion || null,
      logoUrl: (negocio as any)?.logo_url || (negocio?.perfil?.startsWith("http") ? negocio.perfil : null),
      folio: `FIA-${c.id.slice(0, 6).toUpperCase()}`,
      cajero: profile?.nombre || "Caja Principal",
      clienteNombre: c.nombre,
      clienteRut: (c as any).rut || null,
      items: c.productos.map((it) => ({
        nombre: it.nombre,
        qty: it.qty,
        precio: it.precio,
        subtotal: it.subtotal,
      })),
      subtotal: Number(c.deuda_total || 0),
      total: Number(c.deuda_total || 0),
      metodoPago: "fiado",
      mensajePie: "ESTADO DE CUENTA FIADO - PENDIENTE DE PAGO",
    });
  };

  // Filtrado
  const clientesFiltrados = clientes.filter((c) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase().trim();
    const matchCliente =
      c.nombre.toLowerCase().includes(q) ||
      (c.telefono && c.telefono.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q));

    const matchProducto = c.productos.some((p) => p.nombre.toLowerCase().includes(q));
    const matchFolio = c.productos.some((p) => p.folio && p.folio.toLowerCase().includes(q));

    return matchCliente || matchProducto || matchFolio;
  });

  const totalDeudaGlobal = clientes.reduce((acc, c) => acc + Number(c.deuda_total || 0), 0);
  const totalItemsPendientes = clientes.reduce((acc, c) => acc + c.productos.length, 0);

  return (
    <div className="space-y-6 max-w-6xl pb-14">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BadgeDollarSign className="h-6 w-6 text-primary" />
            Control de Fiados y Créditos
          </h1>
          <p className="text-sm text-muted-foreground">
            Visualiza los <strong>productos específicos</strong> adeudados por cada cliente, abona saldos y envía comprobantes.
          </p>
        </div>

        <Button
          onClick={cargarFiadosYProductos}
          variant="outline"
          size="sm"
          className="gap-2 shrink-0 shadow-xs"
        >
          <Clock className="h-4 w-4" />
          Actualizar Fiados
        </Button>
      </div>

      {/* Tarjetas Resumen KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border shadow-xs bg-card">
          <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total por Cobrar
            </CardTitle>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-black text-amber-600 dark:text-amber-500">
              {formatMoney(totalDeudaGlobal)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Saldo pendiente total acumulado</p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs bg-card">
          <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Clientes con Deuda
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-black text-foreground">{clientes.length}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Cuentas activas con saldo fiado</p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-xs bg-card">
          <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Productos Pendientes
            </CardTitle>
            <Package className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-black text-foreground">{totalItemsPendientes}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Artículos fiados pendientes de liquidación</p>
          </CardContent>
        </Card>
      </div>

      {/* Buscador y Controles */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, teléfono, producto fiado o ticket #..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9 pr-8 bg-card shadow-xs"
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (expandedClientes.size === clientesFiltrados.length) {
                setExpandedClientes(new Set());
              } else {
                setExpandedClientes(new Set(clientesFiltrados.map((c) => c.id)));
              }
            }}
            className="text-xs text-muted-foreground hover:text-foreground h-9"
          >
            {expandedClientes.size === clientesFiltrados.length ? "Colapsar Todos" : "Expandir Todos"}
          </Button>
        </div>
      </div>

      {/* Lista de Clientes y Productos Fiados */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground bg-card rounded-2xl border border-border shadow-xs">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium">Conciliando cuentas y cargando productos fiados...</p>
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <Card className="text-center py-16 px-4 border-dashed border-2">
          <div className="max-w-sm mx-auto space-y-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <h3 className="text-lg font-bold">¡Cuentas al Día!</h3>
            <p className="text-xs text-muted-foreground">
              {busqueda
                ? "No se encontraron clientes o productos que coincidan con la búsqueda."
                : "No hay clientes con saldo fiado pendiente en este momento. Todas las cuentas están liquidadas."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {clientesFiltrados.map((cliente) => {
            const isExpanded = expandedClientes.has(cliente.id);

            return (
              <Card
                key={cliente.id}
                className="overflow-hidden border-border bg-card shadow-xs hover:border-border/80 transition-all"
              >
                {/* Cabecera del Cliente */}
                <div
                  onClick={() => toggleExpand(cliente.id)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-muted/30 transition-colors select-none"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-base shrink-0 border border-primary/20">
                      {cliente.nombre.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-base text-foreground leading-tight">
                          {cliente.nombre}
                        </span>
                        <Badge variant="outline" className="text-[10px] font-semibold">
                          {cliente.productos.length} {cliente.productos.length === 1 ? "ítem" : "ítems"}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        {cliente.telefono && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-primary" />
                            {cliente.telefono}
                          </span>
                        )}
                        {cliente.ultimaFechaFiado && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Último fiado:{" "}
                            {new Date(cliente.ultimaFechaFiado).toLocaleDateString("es-CL", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
                    <div className="text-left sm:text-right">
                      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Deuda Activa
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-500">
                        {formatMoney(cliente.deuda_total)}
                      </div>
                    </div>

                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </div>

                {/* Desglose de Productos Específicos Fiados */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/10 p-4 sm:p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                        <Package className="h-4 w-4 text-primary" />
                        Productos que componen este fiado:
                      </div>

                      {/* Botones de Acción */}
                      <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => enviarWhatsAppDetalle(cliente)}
                          className="h-8 text-xs gap-1.5 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 font-semibold shadow-2xs"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          Enviar por WhatsApp
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => imprimirComprobante(cliente)}
                          className="h-8 text-xs gap-1.5 font-semibold shadow-2xs"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          Imprimir Ticket
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => abrirModalAbono(cliente)}
                          className="h-8 text-xs gap-1.5 font-bold shadow-xs bg-amber-600 hover:bg-amber-700 text-white"
                        >
                          <DollarSign className="h-3.5 w-3.5" />
                          Abonar Saldo
                        </Button>
                      </div>
                    </div>

                    {/* Tabla de Productos del Fiado */}
                    <div className="border border-border rounded-xl overflow-hidden bg-card shadow-2xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-muted/60 border-b border-border text-muted-foreground font-semibold">
                            <tr>
                              <th className="py-2.5 px-3 whitespace-nowrap">Fecha / Ticket</th>
                              <th className="py-2.5 px-3">Producto Adeudado</th>
                              <th className="py-2.5 px-3 text-right">Cant.</th>
                              <th className="py-2.5 px-3 text-right">Precio Unitario</th>
                              <th className="py-2.5 px-3 text-right">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {cliente.productos.map((item) => (
                              <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                                <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                                  <div>
                                    {new Date(item.fecha).toLocaleDateString("es-CL", {
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "2-digit",
                                    })}{" "}
                                    <span className="text-[10px]">
                                      {new Date(item.fecha).toLocaleTimeString("es-CL", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  </div>
                                  {item.folio && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 mt-0.5 font-mono">
                                      #{item.folio}
                                    </Badge>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 font-medium text-foreground">
                                  <div className="flex items-center gap-2">
                                    <span>{item.nombre}</span>
                                    {item.esParcial && (
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] px-1.5 py-0 border-amber-500/40 text-amber-600 bg-amber-500/5 font-semibold"
                                      >
                                        Parcialmente abonado
                                      </Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-right font-semibold text-foreground">
                                  {item.qty}
                                </td>
                                <td className="py-2.5 px-3 text-right text-muted-foreground">
                                  {formatMoney(item.precio)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-foreground">
                                  {formatMoney(item.subtotal)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pie de la tabla con total del cliente */}
                      <div className="bg-muted/40 border-t border-border px-4 py-2.5 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <CheckCheck className="h-3.5 w-3.5 text-primary" />
                          Compras anteriores totalmente pagadas han sido consolidadas
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-muted-foreground">Total a Cobrar:</span>
                          <span className="font-black text-sm text-amber-600 dark:text-amber-500">
                            {formatMoney(cliente.deuda_total)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Registrar Abono */}
      <Dialog open={abonoModalOpen} onOpenChange={setAbonoModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-amber-500" />
              Abonar o Liquidar Saldo Fiado
            </DialogTitle>
            <DialogDescription>
              Cliente: <strong className="text-foreground">{clienteAbono?.nombre}</strong> • Deuda actual:{" "}
              <strong className="text-amber-600">{formatMoney(clienteAbono?.deuda_total)}</strong>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={procesarAbono} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="fiado-monto-abono">Monto que paga el cliente</Label>
              <Input
                id="fiado-monto-abono"
                type="number"
                min="1"
                placeholder="Ej: 5000"
                value={montoAbono}
                onChange={(e) => setMontoAbono(e.target.value)}
                required
                disabled={savingAbono}
                className="text-lg font-bold"
              />
              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMontoAbono(String(clienteAbono?.deuda_total || 0))}
                  className="text-xs h-7 px-2"
                >
                  Pagar Deuda Total ({formatMoney(clienteAbono?.deuda_total)})
                </Button>
                {Number(clienteAbono?.deuda_total || 0) > 10000 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setMontoAbono("10000")}
                    className="text-xs h-7 px-2"
                  >
                    $10.000
                  </Button>
                )}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setAbonoModalOpen(false)} disabled={savingAbono}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingAbono} className="bg-amber-600 hover:bg-amber-700 text-white font-bold">
                {savingAbono ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Registrando...
                  </>
                ) : (
                  "Registrar Pago"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
