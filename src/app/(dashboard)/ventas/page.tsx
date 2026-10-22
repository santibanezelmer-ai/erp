"use client";

import { useEffect, useState } from "react";
import { useTenant } from "@/contexts/tenant-context";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import type { Database } from "@/types/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Receipt,
  Search,
  Eye,
  RotateCcw,
  Calendar,
  Loader2,
  DollarSign,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  Printer,
  Download,
  FileSpreadsheet,
  Landmark,
  FileText,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { imprimirTicketTermico, descargarTicketPDF } from "@/lib/ticket";
import { exportarVentasAExcel } from "@/lib/excel";

type Venta = Database["public"]["Tables"]["ventas"]["Row"];
type DetalleVenta = Database["public"]["Tables"]["detalle_ventas"]["Row"];

export default function VentasPage() {
  const { negocio, sucursalActiva } = useTenant();
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroPago, setFiltroPago] = useState<string>("todos");

  // Modal Detalle
  const [modalDetalleOpen, setModalDetalleOpen] = useState(false);
  const [ventaSeleccionada, setVentaSeleccionada] = useState<Venta | null>(null);
  const [detalles, setDetalles] = useState<DetalleVenta[]>([]);
  const [loadingDetalles, setLoadingDetalles] = useState(false);
  const [configFiscal, setConfigFiscal] = useState<any>(null);

  const fetchVentas = async () => {
    if (!negocio?.id) return;
    setLoading(true);
    const supabase = createClient();

    try {
      const [ventasRes, cfgRes] = await Promise.all([
        (() => {
          let q = supabase
            .from("ventas")
            .select("*")
            .eq("negocio_id", negocio.id)
            .order("created_at", { ascending: false })
            .limit(100);
          if (sucursalActiva?.id) {
            q = q.eq("sucursal_id", sucursalActiva.id);
          }
          return q;
        })(),
        supabase
          .from("configuracion")
          .select("libredte_config, rut, business_name, direccion, telefono")
          .eq("negocio_id", negocio.id)
          .maybeSingle(),
      ]);

      if (ventasRes.error) throw ventasRes.error;
      setVentas(ventasRes.data || []);

      if (cfgRes.data) {
        const rawConfig = (cfgRes.data.libredte_config as Record<string, any>) || {};
        setConfigFiscal({
          ...rawConfig,
          negocioRut: cfgRes.data.rut,
          negocioName: cfgRes.data.business_name,
          negocioDir: cfgRes.data.direccion,
          negocioTel: cfgRes.data.telefono,
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Error al cargar el historial de ventas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVentas();
  }, [negocio?.id, sucursalActiva?.id]);

  const verDetalle = async (venta: Venta) => {
    setVentaSeleccionada(venta);
    setModalDetalleOpen(true);
    setLoadingDetalles(true);
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from("detalle_ventas")
        .select("*")
        .eq("venta_id", venta.id);

      if (error) throw error;
      setDetalles(data || []);
    } catch (err: any) {
      toast.error(err.message || "Error al cargar los detalles");
    } finally {
      setLoadingDetalles(false);
    }
  };

  const anularVenta = async (venta: Venta) => {
    if (venta.estado === "anulada") {
      toast.info("Esta venta ya se encuentra anulada");
      return;
    }

    if (!confirm("¿Deseas anular esta venta y devolver el stock a inventario?")) return;
    const supabase = createClient();

    try {
      // 1. Marcar venta como anulada
      const { error: vErr } = await supabase
        .from("ventas")
        .update({ estado: "anulada" })
        .eq("id", venta.id);

      if (vErr) throw vErr;

      // 2. Obtener los detalles para devolver stock
      const { data: items } = await supabase
        .from("detalle_ventas")
        .select("producto_id, qty")
        .eq("venta_id", venta.id);

      if (items && items.length > 0) {
        for (const it of items) {
          if (it.producto_id) {
            // Incrementar stock
            const { data: prod } = await supabase
              .from("productos")
              .select("stock, sin_control_stock")
              .eq("id", it.producto_id)
              .maybeSingle();

            if (prod && !prod.sin_control_stock) {
              await supabase
                .from("productos")
                .update({ stock: (prod.stock || 0) + (it.qty || 1) })
                .eq("id", it.producto_id);
            }
          }
        }
      }

      toast.success("Venta anulada y stock devuelto");
      fetchVentas();
      if (modalDetalleOpen && ventaSeleccionada?.id === venta.id) {
        setModalDetalleOpen(false);
      }
    } catch (err: any) {
      toast.error(err.message || "Error al anular la venta");
    }
  };

  const [emitiendoDte, setEmitiendoDte] = useState(false);

  const emitirDteVenta = async (v: Venta, tipoDte: 39 | 33) => {
    if (!negocio?.id) return;
    setEmitiendoDte(true);
    try {
      toast.info("Emitiendo documento en LibreDTE ante el SII...");
      const res = await fetch("/api/libredte/emitir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ventaId: v.id,
          negocioId: negocio.id,
          tipoDte,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`¡${tipoDte === 33 ? "Factura" : "Boleta"} Electrónica Folio #${data.folio} emitida ante el SII con éxito!`);
        fetchVentas();
        if (ventaSeleccionada && ventaSeleccionada.id === v.id) {
          setVentaSeleccionada({
            ...ventaSeleccionada,
            dte_tipo: data.tipoDte,
            dte_folio: data.folio,
            dte_pdf_url: data.pdfUrl,
            dte_estado: "emitido",
          } as any);
        }
      } else {
        toast.error(data.error || "No se pudo emitir el DTE");
      }
    } catch (err: any) {
      toast.error(err.message || "Error al comunicar con LibreDTE");
    } finally {
      setEmitiendoDte(false);
    }
  };

  const handleExportarExcel = () => {
    if (ventasFiltradas.length === 0) {
      toast.info("No hay ventas para exportar");
      return;
    }
    exportarVentasAExcel(ventasFiltradas, negocio?.nombre || "Operix");
    toast.success("Archivo Excel de ventas generado");
  };

  const handleImprimirTicketModal = (ancho: 58 | 80 = 80) => {
    if (!ventaSeleccionada || !negocio) return;
    const esDte = Boolean(ventaSeleccionada.dte_folio);
    imprimirTicketTermico(
      {
        negocioNombre: configFiscal?.razonSocial || configFiscal?.negocioName || negocio.nombre,
        negocioRut: configFiscal?.rutEmisor || configFiscal?.negocioRut || (negocio as any).rut || null,
        negocioGiro: configFiscal?.giro || null,
        negocioDireccion: configFiscal?.direccion || configFiscal?.negocioDir || (negocio as any).direccion || null,
        negocioComuna: configFiscal?.comuna || null,
        negocioCiudad: configFiscal?.ciudad || null,
        negocioTelefono: configFiscal?.negocioTel || (negocio as any).telefono || null,
        sucursalNombre: sucursalActiva?.nombre || null,
        logoUrl: (negocio as any)?.logo_url || (negocio?.perfil?.startsWith("http") ? negocio.perfil : null),
        folio: esDte ? String(ventaSeleccionada.dte_folio) : ventaSeleccionada.id.slice(0, 8).toUpperCase(),
        fecha: ventaSeleccionada.created_at,
        items: detalles.map((d) => ({
          nombre: d.nombre || "Ítem",
          qty: Number(d.qty || 1),
          precio: Number(d.precio),
          subtotal: Number(d.subtotal),
        })),
        subtotal: Number(ventaSeleccionada.subtotal || 0),
        descuento: Number(ventaSeleccionada.descuento || 0),
        total: Number(ventaSeleccionada.total || 0),
        metodoPago: ventaSeleccionada.pago || "efectivo",
        efectivoRecibido: (ventaSeleccionada as any).efectivo_rec || null,
        dteTipo: ventaSeleccionada.dte_tipo || (esDte ? 39 : null),
        dteFolio: ventaSeleccionada.dte_folio,
        dteEsOficial: esDte,
        dtePdfUrl: ventaSeleccionada.dte_pdf_url,
        cdgSIISucur: configFiscal?.cdgSIISucur ?? 0,
      },
      ancho
    );
  };

  const handleDescargarPDFModal = () => {
    if (!ventaSeleccionada || !negocio) return;
    const esDte = Boolean(ventaSeleccionada.dte_folio);
    descargarTicketPDF({
      negocioNombre: configFiscal?.razonSocial || configFiscal?.negocioName || negocio.nombre,
      negocioRut: configFiscal?.rutEmisor || configFiscal?.negocioRut || (negocio as any).rut || null,
      negocioGiro: configFiscal?.giro || null,
      negocioDireccion: configFiscal?.direccion || configFiscal?.negocioDir || (negocio as any).direccion || null,
      negocioComuna: configFiscal?.comuna || null,
      negocioCiudad: configFiscal?.ciudad || null,
      negocioTelefono: configFiscal?.negocioTel || (negocio as any).telefono || null,
      sucursalNombre: sucursalActiva?.nombre || null,
      folio: esDte ? String(ventaSeleccionada.dte_folio) : ventaSeleccionada.id.slice(0, 8).toUpperCase(),
      fecha: ventaSeleccionada.created_at,
      items: detalles.map((d) => ({
        nombre: d.nombre || "Ítem",
        qty: Number(d.qty || 1),
        precio: Number(d.precio),
        subtotal: Number(d.subtotal),
      })),
      subtotal: Number(ventaSeleccionada.subtotal || 0),
      descuento: Number(ventaSeleccionada.descuento || 0),
      total: Number(ventaSeleccionada.total || 0),
      metodoPago: ventaSeleccionada.pago || "efectivo",
      efectivoRecibido: (ventaSeleccionada as any).efectivo_rec || null,
      dteTipo: ventaSeleccionada.dte_tipo || (esDte ? 39 : null),
      dteFolio: ventaSeleccionada.dte_folio,
      dteEsOficial: esDte,
      dtePdfUrl: ventaSeleccionada.dte_pdf_url,
      cdgSIISucur: configFiscal?.cdgSIISucur ?? 0,
    });
  };

  const ventasFiltradas = ventas.filter((v) => {
    const q = busqueda.toLowerCase().trim();
    const matchQ =
      !q ||
      v.id.toLowerCase().includes(q) ||
      (v.pago && v.pago.toLowerCase().includes(q));

    const matchPago = filtroPago === "todos" || v.pago === filtroPago;
    return matchQ && matchPago;
  });

  const totalVentasMonto = ventasFiltradas
    .filter((v) => v.estado !== "anulada")
    .reduce((acc, v) => acc + Number(v.total || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Historial de Ventas</h1>
          <p className="text-sm text-muted-foreground">
            Consulta facturación, tickets emitidos y anulación de ventas
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportarExcel}
            className="gap-2 text-xs font-semibold flex-1 sm:flex-initial justify-center"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span className="hidden sm:inline">Exportar Excel</span>
            <span className="sm:hidden">Exportar</span>
          </Button>

          <div className="flex items-center justify-between sm:justify-start gap-2 bg-card border border-border px-3 py-1.5 rounded-xl text-xs font-semibold shadow-xs flex-1 sm:flex-initial">
            <span className="text-muted-foreground">Total:</span>
            <span className="text-primary text-sm sm:text-base font-bold">{formatMoney(totalVentasMonto)}</span>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por ID de ticket o pago..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1">
          {["todos", "efectivo", "tarjeta", "transferencia", "fiado"].map((metodo) => (
            <button
              key={metodo}
              onClick={() => setFiltroPago(metodo)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize whitespace-nowrap",
                filtroPago === metodo
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {metodo}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla de Ventas */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs">Cargando ventas...</span>
            </div>
          ) : ventasFiltradas.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No se encontraron ventas registradas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 border-b border-border text-xs text-muted-foreground uppercase font-semibold">
                  <tr>
                    <th className="py-2.5 sm:py-3 px-3 sm:px-4">Ticket</th>
                    <th className="py-2.5 sm:py-3 px-3 sm:px-4">Fecha</th>
                    <th className="py-2.5 sm:py-3 px-3 sm:px-4">Pago</th>
                    <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-right hidden md:table-cell">Subtotal</th>
                    <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-right hidden md:table-cell">Descuento</th>
                    <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-right">Total</th>
                    <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center hidden sm:table-cell">DTE (SII)</th>
                    <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center">Estado</th>
                    <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ventasFiltradas.map((v) => (
                    <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 font-mono font-bold text-xs text-foreground">
                        #{v.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(v.created_at).toLocaleString([], {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4">
                        <span className="capitalize text-xs font-semibold px-2 py-0.5 rounded-full bg-muted">
                          {v.pago || "Efectivo"}
                        </span>
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-right text-xs text-muted-foreground hidden md:table-cell">
                        {formatMoney(v.subtotal)}
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-right text-xs text-muted-foreground hidden md:table-cell">
                        {Number(v.descuento || 0) > 0 ? (
                          <span className="text-amber-600 font-semibold">
                            -{formatMoney(v.descuento)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-right font-bold text-xs sm:text-sm text-foreground">
                        {formatMoney(v.total)}
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center hidden sm:table-cell">
                        {(v as any).dte_folio ? (
                          <a
                            href={(v as any).dte_pdf_url || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Ver PDF Oficial DTE de LibreDTE"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full hover:bg-emerald-500/20 transition-colors"
                          >
                            <Landmark className="h-3 w-3" />
                            <span>
                              {(v as any).dte_tipo === 33 ? "Factura" : "Boleta"} #{(v as any).dte_folio}
                            </span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ) : (v as any).dte_estado === "error" ? (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] text-destructive bg-destructive/10 px-2 py-0.5 rounded-full font-bold cursor-pointer"
                            title={(v as any).dte_error || "Error al emitir DTE"}
                            onClick={() => verDetalle(v)}
                          >
                            <AlertCircle className="h-3 w-3" />
                            Error DTE
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/60 italic">Ticket</span>
                        )}
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-center">
                        {v.estado === "anulada" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-destructive font-semibold">
                            <XCircle className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Anulada</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-500 font-semibold">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Completada</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => verDetalle(v)}
                            title="Ver detalles"
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {v.estado !== "anulada" && (
                            <button
                              onClick={() => anularVenta(v)}
                              title="Anular venta"
                              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Detalle de Venta */}
      <Dialog open={modalDetalleOpen} onOpenChange={setModalDetalleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalle del Ticket</DialogTitle>
            <DialogDescription>
              Ticket #{ventaSeleccionada?.id.slice(0, 8).toUpperCase()} •{" "}
              {ventaSeleccionada &&
                new Date(ventaSeleccionada.created_at).toLocaleString([], {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {loadingDetalles ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="divide-y divide-border border rounded-lg p-2 max-h-60 overflow-y-auto">
                  {detalles.map((d) => (
                    <div key={d.id} className="py-2 flex justify-between items-center text-xs">
                      <div>
                        <div className="font-semibold text-foreground">{d.nombre || "Producto"}</div>
                        <div className="text-muted-foreground">
                          {d.qty} u. × {formatMoney(d.precio)}
                        </div>
                      </div>
                      <div className="font-bold text-foreground">{formatMoney(d.subtotal)}</div>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-1 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal:</span>
                    <span>{formatMoney(ventaSeleccionada?.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Descuento:</span>
                    <span>{formatMoney(ventaSeleccionada?.descuento)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base text-foreground pt-1 border-t border-border/60">
                    <span>TOTAL:</span>
                    <span className="text-primary">{formatMoney(ventaSeleccionada?.total)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground capitalize pt-1">
                    <span>Método de pago:</span>
                    <span>{ventaSeleccionada?.pago}</span>
                  </div>
                </div>

                {/* Sección Documento Tributario LibreDTE (SII) */}
                <div className="p-3 rounded-xl border border-border bg-card space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <Landmark className="h-4 w-4 text-primary" />
                      <span>Documento Tributario (SII)</span>
                    </span>

                    {(ventaSeleccionada as any)?.dte_folio ? (
                      <span className="font-mono font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded text-[11px]">
                        {(ventaSeleccionada as any)?.dte_tipo === 33 ? "Factura" : "Boleta"} #{(ventaSeleccionada as any)?.dte_folio}
                      </span>
                    ) : (ventaSeleccionada as any)?.dte_estado === "error" ? (
                      <span className="text-[10px] text-destructive bg-destructive/10 px-2 py-0.5 rounded font-bold">
                        Error Emisión
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic">Ticket Interno</span>
                    )}
                  </div>

                  {(ventaSeleccionada as any)?.dte_pdf_url ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => window.open((ventaSeleccionada as any).dte_pdf_url, "_blank")}
                      className="w-full h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs justify-center"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>Ver Documento Oficial SII (PDF LibreDTE)</span>
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  ) : (
                    <div className="pt-1 flex flex-col gap-1.5">
                      {(ventaSeleccionada as any)?.dte_error && (
                        <p className="text-[11px] text-destructive bg-destructive/5 p-1.5 rounded border border-destructive/20">
                          <strong>Aviso:</strong> {(ventaSeleccionada as any).dte_error}
                        </p>
                      )}
                      {ventaSeleccionada?.estado !== "anulada" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => emitirDteVenta(ventaSeleccionada!, 39)}
                          disabled={emitiendoDte}
                          className="w-full h-8 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10 font-bold justify-center"
                        >
                          {emitiendoDte ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Landmark className="h-3.5 w-3.5" />}
                          <span>{emitiendoDte ? "Emitiendo en LibreDTE..." : "Emitir Boleta Electrónica SII"}</span>
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleImprimirTicketModal(80)}
                      className="gap-1.5 text-xs font-semibold"
                    >
                      <Printer className="h-3.5 w-3.5 text-primary" />
                      Imprimir 80mm
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleImprimirTicketModal(58)}
                      className="gap-1.5 text-xs font-semibold"
                    >
                      <Printer className="h-3.5 w-3.5 text-primary" />
                      Imprimir 58mm
                    </Button>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDescargarPDFModal}
                    className="w-full gap-1.5 text-xs text-muted-foreground"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Descargar Ticket PDF
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
