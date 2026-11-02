"use client";

import { useEffect, useState } from "react";
import { useTenant } from "@/contexts/tenant-context";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Landmark,
  FileSpreadsheet,
  Printer,
  FileText,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  exportarLibroVentasAExcel,
  type DteVentaReporte,
  type LibroVentasResumen,
} from "@/lib/excel";
import { toast } from "sonner";

export default function ReportesPage() {
  const { negocio, sucursalActiva } = useTenant();
  const [tabActiva, setTabActiva] = useState<"general" | "fiscal">("general");

  // Métricas generales
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<"hoy" | "7dias" | "mes" | "todos">("mes");
  const [totalFacturado, setTotalFacturado] = useState(0);
  const [totalTickets, setTotalTickets] = useState(0);
  const [ticketPromedio, setTicketPromedio] = useState(0);
  const [porMetodo, setPorMetodo] = useState<{
    efectivo: number;
    tarjeta: number;
    transferencia: number;
    fiado: number;
  }>({ efectivo: 0, tarjeta: 0, transferencia: 0, fiado: 0 });
  const [topProductos, setTopProductos] = useState<{ nombre: string; totalQty: number; totalMonto: number }[]>([]);

  // Estado Libro de Ventas Fiscal (SII / F29)
  const [mesFiscal, setMesFiscal] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [loadingFiscal, setLoadingFiscal] = useState(false);
  const [dtesFiscales, setDtesFiscales] = useState<DteVentaReporte[]>([]);
  const [resumenFiscal, setResumenFiscal] = useState<LibroVentasResumen | null>(null);
  const [configFiscal, setConfigFiscal] = useState<{ rut: string; razonSocial: string }>({
    rut: "",
    razonSocial: "",
  });

  // 1. Cargar métricas generales
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

  // 2. Cargar Libro de Ventas Fiscal (SII / F29)
  useEffect(() => {
    if (!negocio?.id || tabActiva !== "fiscal") return;

    const fetchFiscal = async () => {
      setLoadingFiscal(true);
      const supabase = createClient();
      try {
        const [yearStr, monthStr] = mesFiscal.split("-");
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);

        const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)).toISOString();
        const endOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0)).toISOString();

        // 1. Obtener datos de la empresa
        const { data: cfgData } = await supabase
          .from("configuracion")
          .select("rut, business_name, libredte_config")
          .eq("negocio_id", negocio.id)
          .maybeSingle();

        const rawCfg = (cfgData?.libredte_config as Record<string, any>) || {};
        const rutEmisor = rawCfg.rutEmisor || cfgData?.rut || (negocio as any).rut || "Sin RUT";
        const razonSocial = rawCfg.razonSocial || cfgData?.business_name || negocio.nombre || "Mi Empresa";

        setConfigFiscal({ rut: rutEmisor, razonSocial });

        // 2. Consultar ventas con DTE emitido
        const { data: vts, error } = await supabase
          .from("ventas")
          .select("id, total, subtotal, dte_tipo, dte_folio, dte_estado, dte_fecha, dte_pdf_url, pago, created_at, estado")
          .eq("negocio_id", negocio.id)
          .eq("dte_estado", "emitido")
          .gte("created_at", startOfMonth)
          .lt("created_at", endOfMonth)
          .order("dte_folio", { ascending: true });

        if (error) throw error;

        const rawList = vts || [];

        // Mapear DTEs con desglose de neto e IVA
        const dteRows: DteVentaReporte[] = rawList.map((v) => {
          const tot = Number(v.total || 0);
          const tipo = Number(v.dte_tipo || 39);
          let neto = 0;
          let iva = 0;
          let exento = 0;

          if (tipo === 41) {
            exento = tot;
          } else {
            neto = Math.round(tot / 1.19);
            iva = tot - neto;
          }

          return {
            folio: Number(v.dte_folio || 0),
            tipoDte: tipo,
            fecha: v.dte_fecha || v.created_at ? new Date(v.dte_fecha || v.created_at).toLocaleString("es-CL") : "",
            cliente: "Consumidor Final",
            medioPago: v.pago || "efectivo",
            montoExento: exento,
            montoNeto: neto,
            iva,
            montoTotal: tot,
            estado: "Emitido",
            pdfUrl: v.dte_pdf_url || null,
          };
        });

        // 3. Generar nombres de meses
        const mesesNombres = [
          "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
          "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ];
        const periodoNombre = `${mesesNombres[month - 1]} ${year}`;

        // DTE 39 (Boleta Afecta)
        const dte39List = dteRows.filter((d) => d.tipoDte === 39);
        const folios39 = dte39List.map((d) => d.folio).filter((f) => f > 0);
        const boletasAfectasCount = dte39List.length;
        const boletasAfectasFolioMin = folios39.length > 0 ? Math.min(...folios39) : null;
        const boletasAfectasFolioMax = folios39.length > 0 ? Math.max(...folios39) : null;
        const boletasAfectasTotal = dte39List.reduce((acc, d) => acc + d.montoTotal, 0);
        const boletasAfectasNeto = dte39List.reduce((acc, d) => acc + d.montoNeto, 0);
        const boletasAfectasIva = dte39List.reduce((acc, d) => acc + d.iva, 0);

        // DTE 41 (Boleta Exenta)
        const dte41List = dteRows.filter((d) => d.tipoDte === 41);
        const folios41 = dte41List.map((d) => d.folio).filter((f) => f > 0);
        const boletasExentasCount = dte41List.length;
        const boletasExentasFolioMin = folios41.length > 0 ? Math.min(...folios41) : null;
        const boletasExentasFolioMax = folios41.length > 0 ? Math.max(...folios41) : null;
        const boletasExentasTotal = dte41List.reduce((acc, d) => acc + d.montoExento, 0);

        // DTE 33 (Factura Electrónica)
        const dte33List = dteRows.filter((d) => d.tipoDte === 33);
        const folios33 = dte33List.map((d) => d.folio).filter((f) => f > 0);
        const facturasCount = dte33List.length;
        const facturasFolioMin = folios33.length > 0 ? Math.min(...folios33) : null;
        const facturasFolioMax = folios33.length > 0 ? Math.max(...folios33) : null;
        const facturasTotal = dte33List.reduce((acc, d) => acc + d.montoTotal, 0);
        const facturasNeto = dte33List.reduce((acc, d) => acc + d.montoNeto, 0);
        const facturasIva = dte33List.reduce((acc, d) => acc + d.iva, 0);

        const resumen: LibroVentasResumen = {
          periodo: periodoNombre,
          rutEmisor,
          razonSocial,
          boletasAfectasCount,
          boletasAfectasFolioMin,
          boletasAfectasFolioMax,
          boletasAfectasNeto,
          boletasAfectasIva,
          boletasAfectasTotal,
          boletasExentasCount,
          boletasExentasFolioMin,
          boletasExentasFolioMax,
          boletasExentasTotal,
          facturasCount,
          facturasFolioMin,
          facturasFolioMax,
          facturasNeto,
          facturasIva,
          facturasTotal,
          totalDocumentos: dteRows.length,
          totalNeto: boletasAfectasNeto + facturasNeto,
          totalIvaDebito: boletasAfectasIva + facturasIva,
          totalExento: boletasExentasTotal,
          totalFacturadoBruto: boletasAfectasTotal + boletasExentasTotal + facturasTotal,
        };

        setDtesFiscales(dteRows);
        setResumenFiscal(resumen);
      } catch (err: any) {
        console.error("Error al cargar libro de ventas:", err);
        toast.error("Error al cargar el libro fiscal de ventas");
      } finally {
        setLoadingFiscal(false);
      }
    };

    fetchFiscal();
  }, [negocio?.id, tabActiva, mesFiscal]);

  // Generar opciones de meses (últimos 12 meses)
  const generarOpcionesMeses = () => {
    const opciones = [];
    const now = new Date();
    const mesesNombres = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = `${mesesNombres[d.getMonth()]} ${d.getFullYear()}`;
      opciones.push({ val, label });
    }
    return opciones;
  };

  // Imprimir reporte formal F29
  const handleImprimirReporteF29 = () => {
    if (!resumenFiscal) return;

    const printWin = window.open("", "_blank", "width=850,height=700");
    if (!printWin) {
      alert("Por favor permite ventanas emergentes para imprimir el reporte tributario.");
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Libro de Ventas F29 - ${resumenFiscal.periodo} - ${resumenFiscal.razonSocial}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; color: #111; padding: 24px; line-height: 1.4; }
            .header { border-bottom: 2px solid #222; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
            .title { font-size: 18px; font-weight: 800; text-transform: uppercase; margin: 0 0 4px 0; }
            .subtitle { font-size: 12px; color: #555; }
            .box { background: #f9f9f9; border: 1px solid #ddd; border-radius: 6px; padding: 12px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; margin-bottom: 20px; }
            th { background: #f0f0f0; border: 1px solid #ccc; padding: 6px 8px; text-align: left; font-size: 11px; text-transform: uppercase; }
            td { border: 1px solid #ddd; padding: 6px 8px; font-size: 11px; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .footer { border-top: 1px solid #ddd; padding-top: 12px; font-size: 10px; color: #777; text-align: center; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">Libro de Ventas y Cuadratura F29</div>
              <div class="subtitle">Documentos Tributarios Electrónicos Emitidos ante el SII</div>
            </div>
            <div style="text-align: right;">
              <div class="font-bold" style="font-size: 13px;">${resumenFiscal.razonSocial}</div>
              <div>RUT: ${resumenFiscal.rutEmisor}</div>
              <div class="font-bold" style="color: #047857; margin-top: 2px;">Periodo: ${resumenFiscal.periodo}</div>
            </div>
          </div>

          <div class="box">
            <strong>Resumen de Declaración para Formulario 29 (F29):</strong>
            <table>
              <thead>
                <tr>
                  <th>Tipo Documento</th>
                  <th class="text-right">Docs</th>
                  <th>Folio Desde</th>
                  <th>Folio Hasta</th>
                  <th class="text-right">Monto Exento</th>
                  <th class="text-right">Monto Neto</th>
                  <th class="text-right">IVA Débito (19%)</th>
                  <th class="text-right">Total Bruto</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="font-bold">Boleta Electrónica Afecta (DTE 39)</td>
                  <td class="text-right">${resumenFiscal.boletasAfectasCount}</td>
                  <td>${resumenFiscal.boletasAfectasFolioMin ?? "N/A"}</td>
                  <td>${resumenFiscal.boletasAfectasFolioMax ?? "N/A"}</td>
                  <td class="text-right">$0</td>
                  <td class="text-right font-bold">${formatMoney(resumenFiscal.boletasAfectasNeto)}</td>
                  <td class="text-right font-bold" style="color: #b91c1c;">${formatMoney(resumenFiscal.boletasAfectasIva)}</td>
                  <td class="text-right font-bold">${formatMoney(resumenFiscal.boletasAfectasTotal)}</td>
                </tr>
                <tr>
                  <td class="font-bold">Boleta Electrónica Exenta (DTE 41)</td>
                  <td class="text-right">${resumenFiscal.boletasExentasCount}</td>
                  <td>${resumenFiscal.boletasExentasFolioMin ?? "N/A"}</td>
                  <td>${resumenFiscal.boletasExentasFolioMax ?? "N/A"}</td>
                  <td class="text-right font-bold">${formatMoney(resumenFiscal.boletasExentasTotal)}</td>
                  <td class="text-right">$0</td>
                  <td class="text-right">$0</td>
                  <td class="text-right font-bold">${formatMoney(resumenFiscal.boletasExentasTotal)}</td>
                </tr>
                <tr>
                  <td class="font-bold">Factura Electrónica (DTE 33)</td>
                  <td class="text-right">${resumenFiscal.facturasCount}</td>
                  <td>${resumenFiscal.facturasFolioMin ?? "N/A"}</td>
                  <td>${resumenFiscal.facturasFolioMax ?? "N/A"}</td>
                  <td class="text-right">$0</td>
                  <td class="text-right font-bold">${formatMoney(resumenFiscal.facturasNeto)}</td>
                  <td class="text-right font-bold" style="color: #b91c1c;">${formatMoney(resumenFiscal.facturasIva)}</td>
                  <td class="text-right font-bold">${formatMoney(resumenFiscal.facturasTotal)}</td>
                </tr>
                <tr style="background: #f4f4f4; font-weight: bold; font-size: 12px;">
                  <td>TOTAL DECLARACIÓN F29</td>
                  <td class="text-right">${resumenFiscal.totalDocumentos}</td>
                  <td colspan="2" style="text-align: center;">-</td>
                  <td class="text-right">${formatMoney(resumenFiscal.totalExento)}</td>
                  <td class="text-right">${formatMoney(resumenFiscal.totalNeto)}</td>
                  <td class="text-right" style="color: #b91c1c;">${formatMoney(resumenFiscal.totalIvaDebito)}</td>
                  <td class="text-right">${formatMoney(resumenFiscal.totalFacturadoBruto)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style="font-size: 11px; margin-bottom: 8px;">
            <strong>Detalle de Folios Emitidos (${dtesFiscales.length} documentos):</strong>
          </div>
          <table>
            <thead>
              <tr>
                <th>Folio</th>
                <th>Tipo</th>
                <th>Fecha</th>
                <th>Medio Pago</th>
                <th class="text-right">Monto Neto</th>
                <th class="text-right">IVA (19%)</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${
                dtesFiscales.length === 0
                  ? `<tr><td colspan="7" style="text-align:center; color:#777; padding:12px;">No se registraron documentos emitidos en este mes.</td></tr>`
                  : dtesFiscales
                      .map(
                        (d) => `
                <tr>
                  <td class="font-bold">#${d.folio}</td>
                  <td>${d.tipoDte === 39 ? "Boleta Afecta (39)" : d.tipoDte === 41 ? "Boleta Exenta (41)" : "Factura (33)"}</td>
                  <td>${d.fecha}</td>
                  <td style="text-transform: capitalize;">${d.medioPago}</td>
                  <td class="text-right">${formatMoney(d.montoNeto)}</td>
                  <td class="text-right">${formatMoney(d.iva)}</td>
                  <td class="text-right font-bold">${formatMoney(d.montoTotal)}</td>
                </tr>
              `
                      )
                      .join("")
              }
            </tbody>
          </table>

          <div class="footer">
            Reporte generado automáticamente por Operix ERP (operixerp.cloud) · Fecha: ${new Date().toLocaleString("es-CL")}
          </div>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `;

    printWin.document.write(htmlContent);
    printWin.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Encabezado y Selector de Pestañas */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reportes y Finanzas</h1>
          <p className="text-sm text-muted-foreground">
            Métricas comerciales, rendimiento de ventas y Libro Fiscal F29 del SII
          </p>
        </div>

        {/* Switcher de Módulos */}
        <div className="flex items-center gap-1.5 bg-muted/50 border border-border p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setTabActiva("general")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
              tabActiva === "general"
                ? "bg-background text-foreground shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BarChart3 className="h-4 w-4 text-primary" />
            <span>Resumen y Estadísticas</span>
          </button>

          <button
            type="button"
            onClick={() => setTabActiva("fiscal")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
              tabActiva === "fiscal"
                ? "bg-background text-foreground shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Landmark className="h-4 w-4 text-emerald-600" />
            <span>Libro de Ventas (F29)</span>
            <span className="text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.2 rounded">
              SII
            </span>
          </button>
        </div>
      </div>

      {/* ────────────────── PESTAÑA 1: RESUMEN Y ESTADÍSTICAS ────────────────── */}
      {tabActiva === "general" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-base font-bold">Rendimiento Comercial</h2>
              <p className="text-xs text-muted-foreground">Filtrar por rango temporal</p>
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
      )}

      {/* ────────────────── PESTAÑA 2: LIBRO DE VENTAS FISCAL (SII / F29) ────────────────── */}
      {tabActiva === "fiscal" && (
        <div className="space-y-6">
          {/* Barra Superior con Selector de Mes y Acciones de Descarga */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card border border-border p-4 rounded-xl shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block">
                  Periodo Tributario (Mes a declarar)
                </label>
                <select
                  value={mesFiscal}
                  onChange={(e) => setMesFiscal(e.target.value)}
                  className="bg-background border border-border font-bold text-sm rounded-lg px-2.5 py-1 text-foreground focus:ring-1 focus:ring-primary outline-none cursor-pointer"
                >
                  {generarOpcionesMeses().map((op) => (
                    <option key={op.val} value={op.val}>
                      {op.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleImprimirReporteF29}
                disabled={loadingFiscal || !resumenFiscal}
                className="gap-1.5 text-xs font-bold h-9"
              >
                <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Imprimir Resumen F29</span>
              </Button>

              <Button
                size="sm"
                onClick={() => {
                  if (resumenFiscal) {
                    exportarLibroVentasAExcel(resumenFiscal, dtesFiscales);
                    toast.success("¡Libro de Ventas descargado en Excel con éxito!");
                  }
                }}
                disabled={loadingFiscal || !resumenFiscal || dtesFiscales.length === 0}
                className="gap-1.5 text-xs font-bold h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Descargar Libro Excel (.xlsx)</span>
              </Button>
            </div>
          </div>

          {loadingFiscal ? (
            <div className="py-24 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
              <span className="text-xs">Consolidando DTEs y calculando cuadratura F29...</span>
            </div>
          ) : resumenFiscal ? (
            <div className="space-y-6">
              {/* Tarjetas de Cuadratura F29 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-emerald-500/5 border-emerald-500/20">
                  <CardHeader className="pb-1.5">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Base Imponible Neta
                    </CardTitle>
                    <CardDescription className="text-[11px]">Línea F29 Boletas Afectas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-400">
                      {formatMoney(resumenFiscal.totalNeto)}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">Ventas netas sin IVA</p>
                  </CardContent>
                </Card>

                <Card className="bg-rose-500/5 border-rose-500/20">
                  <CardHeader className="pb-1.5">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                      Débito Fiscal IVA (19%)
                    </CardTitle>
                    <CardDescription className="text-[11px]">Impuesto acumulado a pagar</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400">
                      {formatMoney(resumenFiscal.totalIvaDebito)}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">IVA 19% generado</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-1.5">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Ventas Exentas
                    </CardTitle>
                    <CardDescription className="text-[11px]">DTE 41 sin IVA</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl sm:text-3xl font-bold">
                      {formatMoney(resumenFiscal.totalExento)}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">Línea exenta F29</p>
                  </CardContent>
                </Card>

                <Card className="bg-primary/5 border-primary/20">
                  <CardHeader className="pb-1.5">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-primary">
                      Total Bruto Facturado
                    </CardTitle>
                    <CardDescription className="text-[11px]">Total ingresado con IVA</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl sm:text-3xl font-black text-primary">
                      {formatMoney(resumenFiscal.totalFacturadoBruto)}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {resumenFiscal.totalDocumentos} documentos emitidos
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Tabla de Resumen por Tipo de Documento */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center justify-between">
                    <span>Resumen Oficial de Documentos Emitidos (SII)</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      Empresa: <strong>{resumenFiscal.razonSocial}</strong> · RUT: {resumenFiscal.rutEmisor}
                    </span>
                  </CardTitle>
                  <CardDescription>
                    Totales clasificados por tipo de DTE para cuadratura con la propuesta F29 del SII
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto border border-border rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                        <tr>
                          <th className="py-2.5 px-3">Tipo de DTE</th>
                          <th className="py-2.5 px-3 text-center">Cantidad</th>
                          <th className="py-2.5 px-3 text-center">Folio Desde</th>
                          <th className="py-2.5 px-3 text-center">Folio Hasta</th>
                          <th className="py-2.5 px-3 text-right">Monto Exento</th>
                          <th className="py-2.5 px-3 text-right">Monto Neto</th>
                          <th className="py-2.5 px-3 text-right">Débito Fiscal IVA</th>
                          <th className="py-2.5 px-3 text-right">Total Bruto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        <tr className="hover:bg-muted/20">
                          <td className="py-3 px-3 font-bold flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                            <span>Boleta Electrónica Afecta (DTE 39)</span>
                          </td>
                          <td className="py-3 px-3 text-center font-bold">{resumenFiscal.boletasAfectasCount}</td>
                          <td className="py-3 px-3 text-center font-mono">{resumenFiscal.boletasAfectasFolioMin ?? "—"}</td>
                          <td className="py-3 px-3 text-center font-mono">{resumenFiscal.boletasAfectasFolioMax ?? "—"}</td>
                          <td className="py-3 px-3 text-right text-muted-foreground">$0</td>
                          <td className="py-3 px-3 text-right font-bold">{formatMoney(resumenFiscal.boletasAfectasNeto)}</td>
                          <td className="py-3 px-3 text-right font-bold text-rose-600 dark:text-rose-400">
                            {formatMoney(resumenFiscal.boletasAfectasIva)}
                          </td>
                          <td className="py-3 px-3 text-right font-black">{formatMoney(resumenFiscal.boletasAfectasTotal)}</td>
                        </tr>

                        <tr className="hover:bg-muted/20">
                          <td className="py-3 px-3 font-bold flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                            <span>Boleta Electrónica Exenta (DTE 41)</span>
                          </td>
                          <td className="py-3 px-3 text-center font-bold">{resumenFiscal.boletasExentasCount}</td>
                          <td className="py-3 px-3 text-center font-mono">{resumenFiscal.boletasExentasFolioMin ?? "—"}</td>
                          <td className="py-3 px-3 text-center font-mono">{resumenFiscal.boletasExentasFolioMax ?? "—"}</td>
                          <td className="py-3 px-3 text-right font-bold">{formatMoney(resumenFiscal.boletasExentasTotal)}</td>
                          <td className="py-3 px-3 text-right text-muted-foreground">$0</td>
                          <td className="py-3 px-3 text-right text-muted-foreground">$0</td>
                          <td className="py-3 px-3 text-right font-black">{formatMoney(resumenFiscal.boletasExentasTotal)}</td>
                        </tr>

                        <tr className="hover:bg-muted/20">
                          <td className="py-3 px-3 font-bold flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-purple-500"></span>
                            <span>Factura Electrónica (DTE 33)</span>
                          </td>
                          <td className="py-3 px-3 text-center font-bold">{resumenFiscal.facturasCount}</td>
                          <td className="py-3 px-3 text-center font-mono">{resumenFiscal.facturasFolioMin ?? "—"}</td>
                          <td className="py-3 px-3 text-center font-mono">{resumenFiscal.facturasFolioMax ?? "—"}</td>
                          <td className="py-3 px-3 text-right text-muted-foreground">$0</td>
                          <td className="py-3 px-3 text-right font-bold">{formatMoney(resumenFiscal.facturasNeto)}</td>
                          <td className="py-3 px-3 text-right font-bold text-rose-600 dark:text-rose-400">
                            {formatMoney(resumenFiscal.facturasIva)}
                          </td>
                          <td className="py-3 px-3 text-right font-black">{formatMoney(resumenFiscal.facturasTotal)}</td>
                        </tr>

                        {/* Fila Total */}
                        <tr className="bg-muted/40 font-bold border-t-2 border-border text-sm">
                          <td className="py-3 px-3 uppercase tracking-wider text-foreground">
                            TOTAL FORMULARIO 29
                          </td>
                          <td className="py-3 px-3 text-center text-primary font-black">
                            {resumenFiscal.totalDocumentos}
                          </td>
                          <td colSpan={2} className="py-3 px-3 text-center text-muted-foreground">
                            -
                          </td>
                          <td className="py-3 px-3 text-right">{formatMoney(resumenFiscal.totalExento)}</td>
                          <td className="py-3 px-3 text-right text-emerald-700 dark:text-emerald-400">
                            {formatMoney(resumenFiscal.totalNeto)}
                          </td>
                          <td className="py-3 px-3 text-right text-rose-600 dark:text-rose-400">
                            {formatMoney(resumenFiscal.totalIvaDebito)}
                          </td>
                          <td className="py-3 px-3 text-right text-foreground font-black">
                            {formatMoney(resumenFiscal.totalFacturadoBruto)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Detalle Documento por Documento */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center justify-between">
                    <span>Detalle de Boletas y DTEs ({dtesFiscales.length})</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      Periodo: {resumenFiscal.periodo}
                    </span>
                  </CardTitle>
                  <CardDescription>
                    Registro individual de folios oficiales autorizados por el SII
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {dtesFiscales.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
                      <Clock className="h-8 w-8 text-muted-foreground/40 mb-1" />
                      <p className="font-semibold text-foreground">No hay boletas ni facturas emitidas en {resumenFiscal.periodo}</p>
                      <p className="text-xs text-muted-foreground max-w-sm">
                        Las ventas emitidas ante el SII mediante API Gateway o LibreDTE aparecerán aquí automáticamente para su declaración mensual.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-border rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Folio</th>
                            <th className="py-2.5 px-3">Tipo DTE</th>
                            <th className="py-2.5 px-3">Fecha Emisión</th>
                            <th className="py-2.5 px-3">Medio de Pago</th>
                            <th className="py-2.5 px-3 text-right">Neto ($)</th>
                            <th className="py-2.5 px-3 text-right">IVA 19% ($)</th>
                            <th className="py-2.5 px-3 text-right">Total ($)</th>
                            <th className="py-2.5 px-3 text-center">PDF SII</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {dtesFiscales.map((d, idx) => (
                            <tr key={idx} className="hover:bg-muted/20">
                              <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                                #{d.folio}
                              </td>
                              <td className="py-2.5 px-3">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] font-bold",
                                    d.tipoDte === 39
                                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                      : d.tipoDte === 41
                                      ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30"
                                      : "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30"
                                  )}
                                >
                                  {d.tipoDte === 39 ? "Boleta 39" : d.tipoDte === 41 ? "Exenta 41" : "Factura 33"}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 text-muted-foreground">{d.fecha}</td>
                              <td className="py-2.5 px-3 capitalize text-muted-foreground">{d.medioPago}</td>
                              <td className="py-2.5 px-3 text-right font-medium">{formatMoney(d.montoNeto)}</td>
                              <td className="py-2.5 px-3 text-right text-rose-600 dark:text-rose-400 font-medium">
                                {formatMoney(d.iva)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-foreground">
                                {formatMoney(d.montoTotal)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {d.pdfUrl ? (
                                  <a
                                    href={d.pdfUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-bold"
                                  >
                                    <FileText className="h-3 w-3" />
                                    <span>Ver PDF</span>
                                    <ExternalLink className="h-2.5 w-2.5" />
                                  </a>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground italic">No disp.</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
