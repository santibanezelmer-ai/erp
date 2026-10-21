"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  Users,
  Plus,
  Search,
  Pencil,
  Trash2,
  DollarSign,
  Phone,
  Mail,
  Loader2,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  Package,
  Printer,
  FileText,
  CheckCheck,
  BadgeDollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { imprimirTicketTermico } from "@/lib/ticket";

type Cliente = Database["public"]["Tables"]["clientes"]["Row"];

export default function ClientesPage() {
  const { negocio } = useTenant();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroDeuda, setFiltroDeuda] = useState<"todos" | "con_deuda">("todos");

  // Modal Crear / Editar
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clienteEdit, setClienteEdit] = useState<Cliente | null>(null);

  // Form states
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [direccion, setDireccion] = useState("");
  const [notas, setNotas] = useState("");

  // Modal Abonar Deuda
  const [abonoModalOpen, setAbonoModalOpen] = useState(false);
  const [clienteAbono, setClienteAbono] = useState<Cliente | null>(null);
  const [montoAbono, setMontoAbono] = useState<string>("");
  const [savingAbono, setSavingAbono] = useState(false);

  // Modal Ver Productos Fiados (Solo saldo activo, consolidado se borra)
  const [productosModalOpen, setProductosModalOpen] = useState(false);
  const [clienteProductos, setClienteProductos] = useState<Cliente | null>(null);
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [saldandoTotal, setSaldandoTotal] = useState(false);
  const [itemsFiadosPendientes, setItemsFiadosPendientes] = useState<{
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
  }[]>([]);
  const [totalCalculadoPendiente, setTotalCalculadoPendiente] = useState(0);

  const fetchClientes = async () => {
    if (!negocio?.id) return;
    setLoading(true);
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("negocio_id", negocio.id)
        .order("nombre", { ascending: true });

      if (error) throw error;
      setClientes(data || []);
    } catch (err: any) {
      toast.error(err.message || "Error al cargar clientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes();
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (p.get("filtro") === "con_deuda") {
        setFiltroDeuda("con_deuda");
      }
    }
  }, [negocio?.id]);

  const abrirCrear = () => {
    setClienteEdit(null);
    setNombre("");
    setTelefono("");
    setEmail("");
    setDireccion("");
    setNotas("");
    setModalOpen(true);
  };

  const abrirEditar = (c: Cliente) => {
    setClienteEdit(c);
    setNombre(c.nombre);
    setTelefono(c.telefono || "");
    setEmail(c.email || "");
    setDireccion(c.direccion || "");
    setNotas(c.notas || "");
    setModalOpen(true);
  };

  const guardarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocio?.id) return;

    if (!nombre.trim()) {
      toast.error("El nombre del cliente es obligatorio");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    try {
      const payload = {
        negocio_id: negocio.id,
        nombre: nombre.trim(),
        telefono: telefono.trim() || null,
        email: email.trim() || null,
        direccion: direccion.trim() || null,
        notas: notas.trim() || null,
      };

      if (clienteEdit?.id) {
        const { error } = await supabase
          .from("clientes")
          .update(payload)
          .eq("id", clienteEdit.id);

        if (error) throw error;
        toast.success("Cliente actualizado");
      } else {
        const { error } = await supabase.from("clientes").insert(payload);
        if (error) throw error;
        toast.success("Cliente creado");
      }

      setModalOpen(false);
      fetchClientes();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar el cliente");
    } finally {
      setSaving(false);
    }
  };

  const eliminarCliente = async (id: string) => {
    if (!confirm("¿Deseas eliminar este cliente?")) return;
    const supabase = createClient();
    try {
      const { error } = await supabase.from("clientes").delete().eq("id", id);
      if (error) throw error;
      toast.success("Cliente eliminado");
      fetchClientes();
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar");
    }
  };

  const abrirAbono = (c: Cliente) => {
    setClienteAbono(c);
    setMontoAbono("");
    setAbonoModalOpen(true);
  };

  const procesarAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteAbono) return;

    const monto = Number(montoAbono);
    if (isNaN(monto) || monto <= 0) {
      toast.error("Ingresa un monto válido para abonar");
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

      // 2. Registrar abono en deudas
      await supabase.from("deudas").insert({
        negocio_id: negocio!.id,
        cliente_id: clienteAbono.id,
        monto: monto,
        tipo: "pago",
        notas: `Abono a deuda de cliente: ${formatMoney(monto)}`,
      });

      toast.success(`Abono registrado. Nueva deuda: ${formatMoney(nuevaDeuda)}`);
      setAbonoModalOpen(false);
      fetchClientes();
    } catch (err: any) {
      toast.error(err.message || "Error al registrar el abono");
    } finally {
      setSavingAbono(false);
    }
  };

  const enviarRecordatorioWhatsApp = (c: Cliente) => {
    const deuda = Number(c.deuda_total || 0);
    if (!c.telefono || !c.telefono.trim()) {
      toast.error(`"${c.nombre}" no tiene un número de teléfono guardado. Edita sus datos para agregarlo.`);
      return;
    }

    // Limpiar caracteres no numéricos
    const telefonoLimpio = c.telefono.replace(/[^0-9]/g, "");
    if (!telefonoLimpio) {
      toast.error("El número de teléfono registrado no contiene dígitos válidos.");
      return;
    }

    const nombreNegocio = negocio?.nombre || "nuestro local";
    const textoMensaje = `Estimado(a) ${c.nombre}, le recordamos cordialmente que mantiene un saldo pendiente de ${formatMoney(deuda)} en ${nombreNegocio}. Por cualquier consulta o para coordinar su pago, quedamos atentos. ¡Muchas gracias!`;
    const url = `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(textoMensaje)}`;

    window.open(url, "_blank");
    toast.success("Abriendo WhatsApp Web / App...");
  };

  const abrirDetalleProductosFiados = async (c: Cliente) => {
    setClienteProductos(c);
    setProductosModalOpen(true);
    setLoadingProductos(true);
    setItemsFiadosPendientes([]);

    const deudaActual = Number(c.deuda_total || 0);
    if (deudaActual <= 0) {
      setTotalCalculadoPendiente(0);
      setLoadingProductos(false);
      return;
    }

    try {
      const supabase = createClient();

      // 1. Obtener todas las filas de la tabla deudas del cliente en orden cronológico
      const { data: deudasData, error: errDeudas } = await supabase
        .from("deudas")
        .select("*")
        .eq("cliente_id", c.id)
        .order("created_at", { ascending: true });

      if (errDeudas) throw errDeudas;

      // 2. Obtener todas las ventas fiadas del cliente en orden cronológico
      const { data: ventasData, error: errVentas } = await supabase
        .from("ventas")
        .select("id, total, created_at, estado, pago")
        .eq("cliente_id", c.id)
        .eq("pago", "fiado")
        .neq("estado", "cancelada")
        .order("created_at", { ascending: true });

      if (errVentas) throw errVentas;

      // Unificar todos los cargos (ventas y cargos manuales de deudas)
      type Cargo = {
        id: string;
        venta_id: string | null;
        monto: number;
        fecha: string;
        notas: string | null;
      };

      const cargosMap = new Map<string, Cargo>();

      // Primero las ventas directas con pago fiado
      (ventasData || []).forEach((v) => {
        cargosMap.set(`v-${v.id}`, {
          id: `v-${v.id}`,
          venta_id: v.id,
          monto: Number(v.total || 0),
          fecha: v.created_at,
          notas: `Venta Fiada #${v.id.slice(0, 8)}`,
        });
      });

      // Luego las filas de deudas
      let totalAbonos = 0;
      (deudasData || []).forEach((d) => {
        const m = Number(d.monto || 0);
        if (d.tipo === "pago") {
          totalAbonos += m;
        } else {
          // Tipo cargo / deuda
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

      // Ordenar todos los cargos por fecha ascendente (FIFO)
      const listaCargos = Array.from(cargosMap.values()).sort(
        (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
      );

      // Calcular el monto histórico que ya fue saldado/consolidado
      const totalCargosHistoricos = listaCargos.reduce((acc, crg) => acc + crg.monto, 0);
      let saldoPagado = Math.max(0, totalCargosHistoricos - deudaActual);
      if (totalAbonos > saldoPagado) {
        saldoPagado = totalAbonos;
      }

      // Aplicar filtro FIFO:
      // Cualquier compra/cargo anterior que ya haya sido cubierta por pagos SE OMITE ("lo consolidado se borra")
      const cargosPendientes: {
        cargo: Cargo;
        montoPendiente: number;
        esParcial: boolean;
      }[] = [];

      for (const crg of listaCargos) {
        if (saldoPagado >= crg.monto) {
          // Totalmente saldado -> CONSOLIDADO (se omite del detalle)
          saldoPagado -= crg.monto;
        } else if (saldoPagado > 0) {
          // Parcialmente saldado
          const rem = crg.monto - saldoPagado;
          saldoPagado = 0;
          cargosPendientes.push({
            cargo: crg,
            montoPendiente: rem,
            esParcial: true,
          });
        } else {
          // Totalmente pendiente de pago
          cargosPendientes.push({
            cargo: crg,
            montoPendiente: crg.monto,
            esParcial: false,
          });
        }
      }

      // Si no hay cargos estructurados pero hay deuda_total > 0 (ej. carga directa de saldo)
      if (cargosPendientes.length === 0 && deudaActual > 0) {
        setItemsFiadosPendientes([
          {
            id: `saldo-${c.id}`,
            fecha: new Date().toISOString(),
            nombre: "Saldo adeudado registrado en cuenta",
            qty: 1,
            precio: deudaActual,
            subtotal: deudaActual,
            esParcial: false,
            montoPendiente: deudaActual,
          },
        ]);
        setTotalCalculadoPendiente(deudaActual);
        return;
      }

      // Buscar detalles de ventas para los cargos pendientes
      const ventaIds = cargosPendientes
        .map((cp) => cp.cargo.venta_id)
        .filter(Boolean) as string[];

      let detallesPorVenta = new Map<string, any[]>();
      if (ventaIds.length > 0) {
        const { data: dets } = await supabase
          .from("detalle_ventas")
          .select("id, venta_id, nombre, qty, precio, subtotal, created_at")
          .in("venta_id", ventaIds);

        if (dets) {
          dets.forEach((d) => {
            const arr = detallesPorVenta.get(d.venta_id) || [];
            arr.push(d);
            detallesPorVenta.set(d.venta_id, arr);
          });
        }
      }

      // Ensamblar productos pendientes
      const itemsFinales: typeof itemsFiadosPendientes = [];

      for (const cp of cargosPendientes) {
        const crg = cp.cargo;
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
              subtotal: Number(p.subtotal || (Number(p.qty || 1) * Number(p.precio || 0))),
              esParcial: cp.esParcial,
              montoPendiente: cp.esParcial ? cp.montoPendiente : undefined,
            });
          });
        } else {
          // Cargo manual sin detalle desglosado
          itemsFinales.push({
            id: crg.id,
            fecha: crg.fecha,
            nombre: crg.notas || "Cargo manual fiado en cuenta",
            qty: 1,
            precio: cp.montoPendiente,
            subtotal: cp.montoPendiente,
            esParcial: cp.esParcial,
            montoPendiente: cp.montoPendiente,
          });
        }
      }

      setItemsFiadosPendientes(itemsFinales);
      setTotalCalculadoPendiente(deudaActual);
    } catch (err: any) {
      console.error("Error al obtener detalle de fiados:", err);
      toast.error(err.message || "Error al cargar productos de fiados");
    } finally {
      setLoadingProductos(false);
    }
  };

  const enviarProductosWhatsApp = () => {
    if (!clienteProductos) return;
    if (!clienteProductos.telefono || !clienteProductos.telefono.trim()) {
      toast.error("El cliente no tiene un teléfono o WhatsApp registrado");
      return;
    }
    const telLimpio = clienteProductos.telefono.replace(/[^0-9]/g, "");
    if (!telLimpio) {
      toast.error("El teléfono registrado no contiene dígitos válidos");
      return;
    }

    if (itemsFiadosPendientes.length === 0) {
      toast.info("No hay productos pendientes para enviar");
      return;
    }

    const nombreNegocio = negocio?.nombre || "nuestro local";
    const lineas = itemsFiadosPendientes
      .map((it) => `• ${it.qty}× ${it.nombre} — ${formatMoney(it.precio)}${it.qty > 1 ? ` (${formatMoney(it.subtotal)})` : ""}`)
      .join("\n");

    const mensaje = `Hola ${clienteProductos.nombre}, te saludamos de ${nombreNegocio}. Te compartimos el detalle de los productos pendientes de pago que componen tu saldo actual:\n\n${lineas}\n\nTotal saldo adeudado: ${formatMoney(clienteProductos.deuda_total)}\n\nQuedamos a tu disposición para coordinar tu pago. ¡Muchas gracias!`;

    window.open(`https://wa.me/${telLimpio}?text=${encodeURIComponent(mensaje)}`, "_blank");
    toast.success("Abriendo WhatsApp con el detalle...");
  };

  const imprimirComprobanteFiado = () => {
    if (!clienteProductos || !negocio) return;
    imprimirTicketTermico({
      negocioNombre: negocio.nombre,
      negocioRut: (negocio as any).rut || null,
      negocioTelefono: (negocio as any).telefono || null,
      negocioDireccion: (negocio as any).direccion || null,
      logoUrl: (negocio as any)?.logo_url || (negocio?.perfil?.startsWith("http") ? negocio.perfil : null),
      folio: `FIA-${clienteProductos.id.slice(0, 6).toUpperCase()}`,
      cajero: "Caja Principal",
      clienteNombre: clienteProductos.nombre,
      clienteRut: (clienteProductos as any).rut || null,
      items: itemsFiadosPendientes.map((it) => ({
        nombre: it.nombre,
        qty: it.qty,
        precio: it.precio,
        subtotal: it.subtotal,
      })),
      subtotal: Number(clienteProductos.deuda_total || 0),
      total: Number(clienteProductos.deuda_total || 0),
      metodoPago: "fiado",
      mensajePie: "ESTADO DE CUENTA FIADO - PENDIENTE DE PAGO",
    });
  };

  const saldarDeudaCompleta = async (c: Cliente) => {
    const deuda = Number(c.deuda_total || 0);
    if (deuda <= 0) {
      toast.info("Este cliente ya está al día sin saldo pendiente");
      return;
    }

    if (!confirm(`¿Confirmas saldar la totalidad de la deuda de ${c.nombre} por ${formatMoney(deuda)}? Los productos anteriores quedarán consolidados inmediatamente.`)) {
      return;
    }

    setSaldandoTotal(true);
    const supabase = createClient();

    try {
      // 1. Actualizar deuda del cliente a 0
      const { error: errCli } = await supabase
        .from("clientes")
        .update({ deuda_total: 0 })
        .eq("id", c.id);

      if (errCli) throw errCli;

      // 2. Registrar abono total en deudas
      await supabase.from("deudas").insert({
        negocio_id: negocio!.id,
        cliente_id: c.id,
        monto: deuda,
        tipo: "pago",
        notas: `Liquidación total de deuda y consolidación: ${formatMoney(deuda)}`,
      });

      toast.success(`¡Deuda de ${c.nombre} saldada completamente! Compras anteriores consolidadas.`);
      setProductosModalOpen(false);
      fetchClientes();
    } catch (err: any) {
      toast.error(err.message || "Error al liquidar la deuda");
    } finally {
      setSaldandoTotal(false);
    }
  };

  const clientesFiltrados = clientes.filter((c) => {
    const q = busqueda.toLowerCase().trim();
    const matchQ =
      !q ||
      c.nombre.toLowerCase().includes(q) ||
      (c.telefono && c.telefono.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q));

    if (filtroDeuda === "con_deuda") {
      return matchQ && Number(c.deuda_total || 0) > 0;
    }
    return matchQ;
  });

  const deudaTotalGlobal = clientes.reduce((acc, c) => acc + Number(c.deuda_total || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes y Fiados</h1>
          <p className="text-sm text-muted-foreground">
            Control de cuentas corrientes, libreta de fiados y pagos ({clientes.length} clientes)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="bg-card border border-border px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-xs flex-1 sm:flex-initial">
            <span className="text-muted-foreground mr-1.5">Deuda por Cobrar:</span>
            <span className="text-amber-600 font-bold text-sm sm:text-base">{formatMoney(deudaTotalGlobal)}</span>
          </div>

          <Link href="/fiados" className="flex-1 sm:flex-initial">
            <Button
              variant="outline"
              className="gap-2 shadow-xs border-amber-500/40 text-amber-600 hover:bg-amber-500/10 font-bold w-full justify-center"
            >
              <BadgeDollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Módulo de Fiados</span>
              <span className="sm:hidden">Fiados</span>
            </Button>
          </Link>

          <Button onClick={abrirCrear} className="gap-2 shadow-sm font-bold w-full sm:w-auto justify-center">
            <Plus className="h-4 w-4" />
            Nuevo Cliente
          </Button>
        </div>
      </div>

      {/* Buscador y filtros */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, teléfono o correo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFiltroDeuda("todos")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              filtroDeuda === "todos"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border text-muted-foreground hover:bg-muted"
            )}
          >
            Todos los Clientes
          </button>
          <button
            onClick={() => setFiltroDeuda("con_deuda")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              filtroDeuda === "con_deuda"
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-background border-border text-muted-foreground hover:bg-muted"
            )}
          >
            Solo con Deuda (Fiados)
          </button>
        </div>
      </div>

      {/* Tabla de Clientes */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs">Cargando directorio...</span>
            </div>
          ) : clientesFiltrados.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No se encontraron clientes registrados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 border-b border-border text-xs text-muted-foreground uppercase font-semibold">
                  <tr>
                    <th className="py-2.5 sm:py-3 px-3 sm:px-4">Cliente</th>
                    <th className="py-2.5 sm:py-3 px-3 sm:px-4 hidden sm:table-cell">Teléfono</th>
                    <th className="py-2.5 sm:py-3 px-3 sm:px-4 hidden md:table-cell">Correo</th>
                    <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-right">Deuda</th>
                    <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {clientesFiltrados.map((c) => {
                    const deuda = Number(c.deuda_total || 0);
                    return (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 sm:py-3 px-3 sm:px-4">
                          <div className="font-semibold text-foreground text-xs sm:text-sm">{c.nombre}</div>
                          {c.telefono && (
                            <div className="text-[11px] text-muted-foreground sm:hidden flex items-center gap-1 mt-0.5">
                              <Phone className="h-2.5 w-2.5 text-primary" />
                              {c.telefono}
                            </div>
                          )}
                          {c.direccion && (
                            <div className="text-[11px] text-muted-foreground hidden sm:block truncate max-w-xs">{c.direccion}</div>
                          )}
                        </td>
                        <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-xs text-muted-foreground hidden sm:table-cell">
                          {c.telefono ? (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {c.telefono}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-xs text-muted-foreground hidden md:table-cell">
                          {c.email ? (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {c.email}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-right">
                          {deuda > 0 ? (
                            <span className="font-bold text-xs sm:text-sm text-amber-600 dark:text-amber-500">
                              {formatMoney(deuda)}
                            </span>
                          ) : (
                            <span className="text-[11px] sm:text-xs text-emerald-600 dark:text-emerald-500 font-semibold">
                              Al día ($0)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {deuda > 0 && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => abrirDetalleProductosFiados(c)}
                                  title="Ver productos pendientes que componen esta deuda"
                                  className="h-7 text-xs px-2 gap-1 border-primary/40 text-primary hover:bg-primary/10"
                                >
                                  <Package className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">Ver Productos</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => enviarRecordatorioWhatsApp(c)}
                                  title="Enviar recordatorio de cobro por WhatsApp"
                                  className="h-7 text-xs px-2 gap-1 border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">WhatsApp</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => abrirAbono(c)}
                                  className="h-7 text-xs px-2 gap-1 border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
                                >
                                  <DollarSign className="h-3.5 w-3.5" />
                                  Abonar
                                </Button>
                              </>
                            )}
                            <button
                              onClick={() => abrirEditar(c)}
                              title="Editar"
                              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => eliminarCliente(c.id)}
                              title="Eliminar"
                              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Crear / Editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{clienteEdit ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
            <DialogDescription>
              Registra los datos de contacto y facturación del cliente.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={guardarCliente} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cli-nombre">Nombre o Razón Social *</Label>
              <Input
                id="cli-nombre"
                placeholder="Ej: María González o Almacén Los Pinos"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                disabled={saving}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cli-tel">Teléfono / WhatsApp</Label>
                <Input
                  id="cli-tel"
                  placeholder="+56 9 1234 5678"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cli-mail">Correo Electrónico</Label>
                <Input
                  id="cli-mail"
                  type="email"
                  placeholder="cliente@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cli-dir">Dirección</Label>
              <Input
                id="cli-dir"
                placeholder="Av. Principal 123, Local 4"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                disabled={saving}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando..." : "Guardar Cliente"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Abonar Deuda */}
      <Dialog open={abonoModalOpen} onOpenChange={setAbonoModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Abono a Deuda</DialogTitle>
            <DialogDescription>
              {clienteAbono?.nombre} • Deuda actual:{" "}
              <strong className="text-amber-600">{formatMoney(clienteAbono?.deuda_total)}</strong>
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={procesarAbono} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="monto-abono">Monto que paga el cliente</Label>
              <Input
                id="monto-abono"
                type="number"
                min="1"
                placeholder="Ej: 5000"
                value={montoAbono}
                onChange={(e) => setMontoAbono(e.target.value)}
                required
                disabled={savingAbono}
                className="text-lg font-bold"
              />
            </div>

            {clienteAbono && Number(clienteAbono.deuda_total || 0) > 0 && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => enviarRecordatorioWhatsApp(clienteAbono)}
                  className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 font-medium underline-offset-4 hover:underline"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Enviar recordatorio por WhatsApp
                </button>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAbonoModalOpen(false)} disabled={savingAbono}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingAbono}>
                {savingAbono ? "Registrando..." : "Registrar Pago"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Detalle de Productos Fiados Pendientes (Consolidado) */}
      <Dialog open={productosModalOpen} onOpenChange={setProductosModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Detalle de Productos Fiados
            </DialogTitle>
            <DialogDescription>
              Cliente: <strong className="text-foreground">{clienteProductos?.nombre}</strong> • Saldo activo por cobrar:{" "}
              <strong className="text-amber-600">{formatMoney(clienteProductos?.deuda_total)}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 flex-1 overflow-y-auto">
            {/* Banner de aclaración de deuda activa */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs flex items-start gap-2.5 text-muted-foreground">
              <CheckCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-foreground block">
                  Cálculo de Deuda Activa (Compras anteriores consolidadas)
                </span>
                Se visualizan únicamente los productos que componen el saldo pendiente actual ({formatMoney(clienteProductos?.deuda_total)}). Las compras previas que ya fueron pagadas han sido consolidadas y no se acumulan en este detalle.
              </div>
            </div>

            {loadingProductos ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-xs">Conciliando abonos y cargando ítems activos...</span>
              </div>
            ) : itemsFiadosPendientes.length === 0 ? (
              <div className="py-12 text-center space-y-2 border border-dashed rounded-xl">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                <h4 className="font-semibold text-sm">Sin productos pendientes</h4>
                <p className="text-xs text-muted-foreground">
                  La cuenta de este cliente se encuentra al día o los consumos anteriores ya están 100% liquidados y consolidados.
                </p>
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden shadow-2xs">
                <div className="max-h-[320px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/70 border-b border-border text-muted-foreground font-semibold sticky top-0 bg-background/95 backdrop-blur-xs">
                      <tr>
                        <th className="py-2.5 px-3">Fecha / Venta</th>
                        <th className="py-2.5 px-3">Producto / Detalle</th>
                        <th className="py-2.5 px-3 text-right">Cant.</th>
                        <th className="py-2.5 px-3 text-right">Precio</th>
                        <th className="py-2.5 px-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {itemsFiadosPendientes.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                            <span>
                              {new Date(item.fecha).toLocaleDateString("es-CL", {
                                day: "2-digit",
                                month: "short",
                              })}
                            </span>
                            {item.folio && (
                              <span className="ml-1.5 font-mono text-[10px] text-primary/80">
                                #{item.folio}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-foreground">
                            {item.nombre}
                            {item.esParcial && (
                              <span className="ml-1.5 inline-block text-[10px] text-amber-700 dark:text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded font-normal">
                                Saldo remanente
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right text-muted-foreground">{item.qty}</td>
                          <td className="py-2.5 px-3 text-right text-muted-foreground">
                            {formatMoney(item.precio)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-foreground">
                            {formatMoney(item.subtotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/40 border-t border-border font-semibold">
                      <tr>
                        <td colSpan={4} className="py-2.5 px-3 text-right text-muted-foreground">
                          Total Saldo Pendiente:
                        </td>
                        <td className="py-2.5 px-3 text-right text-amber-600 font-bold text-sm">
                          {formatMoney(totalCalculadoPendiente)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 border-t border-border">
            <div className="flex items-center gap-2 mr-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={imprimirComprobanteFiado}
                disabled={itemsFiadosPendientes.length === 0}
                className="gap-1.5 text-xs"
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimir Ticket
              </Button>

              {clienteProductos && Number(clienteProductos.deuda_total || 0) > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => saldarDeudaCompleta(clienteProductos)}
                  disabled={saldandoTotal}
                  className="gap-1.5 text-xs text-amber-600 border-amber-200 hover:bg-amber-50 dark:border-amber-900/40 dark:hover:bg-amber-950/30"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  {saldandoTotal ? "Saldando..." : "Saldar Total"}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={enviarProductosWhatsApp}
                disabled={!clienteProductos?.telefono || itemsFiadosPendientes.length === 0}
                className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Enviar Detalle por WhatsApp
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setProductosModalOpen(false)}
                className="text-xs"
              >
                Cerrar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
