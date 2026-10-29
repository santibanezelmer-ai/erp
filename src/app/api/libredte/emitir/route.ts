import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { emitirBoletaAPIGateway, type APIGatewayConfig } from "@/lib/apigateway";
import { emitirDTELibreDTE, type LibreDTEConfig, type ItemDTE, type ReceptorDTE } from "@/lib/libredte";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ventaId, negocioId, tipoDte = 39, receptor, itemsOverride, totalOverride, medioPago } = body;

    if (!negocioId) {
      return NextResponse.json({ ok: false, error: "Falta el ID del negocio" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rgyqtxoagsmkleebrmza.supabase.co";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Obtener la configuración fiscal del negocio
    const { data: confData, error: confError } = await supabase
      .from("configuracion")
      .select("libredte_config, rut, business_name, direccion, telefono")
      .eq("negocio_id", negocioId)
      .maybeSingle();

    if (confError) {
      return NextResponse.json({ ok: false, error: "Error al cargar la configuración fiscal del negocio" }, { status: 500 });
    }

    const rawCfg = (confData?.libredte_config as any) || {};

    if (!rawCfg.activo) {
      return NextResponse.json(
        { ok: false, error: "La facturación fiscal electrónica está desactivada en la configuración del negocio." },
        { status: 400 }
      );
    }

    let itemsParaDte: ItemDTE[] = [];
    let totalDte = Number(totalOverride || 0);

    // 2. Si hay ventaId, cargar detalles de la base de datos con aislamiento de negocio
    if (ventaId) {
      const [ventaRes, detallesRes] = await Promise.all([
        supabase.from("ventas").select("*").eq("id", ventaId).eq("negocio_id", negocioId).single(),
        supabase.from("detalle_ventas").select("*").eq("venta_id", ventaId).eq("negocio_id", negocioId),
      ]);

      if (ventaRes.error || !ventaRes.data) {
        return NextResponse.json({ ok: false, error: "No se encontró la venta especificada en este negocio" }, { status: 404 });
      }

      // Prevención de duplicados (Idempotencia): si la venta ya fue emitida exitosamente, no re-emitir
      if (ventaRes.data.dte_folio && Number(ventaRes.data.dte_folio) > 0 && ventaRes.data.dte_estado === "emitido") {
        return NextResponse.json({
          ok: true,
          folio: Number(ventaRes.data.dte_folio),
          tipoDte: ventaRes.data.dte_tipo || 39,
          pdfUrl: ventaRes.data.dte_pdf_url || undefined,
          fechaEmision: ventaRes.data.dte_fecha || undefined,
          yaEmitido: true,
        });
      }

      // Bloqueo de seguridad ante resultado incierto: si está pendiente de conciliación, bloquear reintentos automáticos
      if (ventaRes.data.dte_estado === "pendiente_conciliacion") {
        return NextResponse.json(
          {
            ok: false,
            error: "Esta venta se encuentra PENDIENTE DE CONCILIACIÓN con el SII debido a un timeout previo. No se permite reintentar automáticamente para evitar duplicar el documento tributario. Verifique en el SII antes de proceder.",
            estado: "pendiente_conciliacion",
          },
          { status: 409 }
        );
      }

      totalDte = Number(ventaRes.data.total || 0);
      const dets = detallesRes.data || [];

      if (dets.length > 0) {
        itemsParaDte = dets.map((d) => ({
          nombre: d.nombre || "Producto",
          cantidad: Number(d.qty || 1),
          precioUnitario: Number(d.precio || 0),
        }));
      } else {
        itemsParaDte = [
          {
            nombre: "Venta General",
            cantidad: 1,
            precioUnitario: totalDte,
          },
        ];
      }
    } else if (itemsOverride && Array.isArray(itemsOverride)) {
      itemsParaDte = itemsOverride;
    }

    if (itemsParaDte.length === 0) {
      return NextResponse.json({ ok: false, error: "No hay productos o ítems para emitir el documento" }, { status: 400 });
    }

    let resultado: any = null;

    // 3. Determinar proveedor: API Gateway (eBoleta) o LibreDTE
    const proveedor = rawCfg.proveedor || (rawCfg.token ? "apigateway" : "libredte");

    // Validación estricta de compatibilidad de tipos de DTE
    if (proveedor === "apigateway" && Number(tipoDte) !== 39 && Number(tipoDte) !== 41) {
      return NextResponse.json(
        {
          ok: false,
          error: `El servicio eBoleta de API Gateway solo admite Boleta Electrónica (DTE 39) o Boleta Exenta (DTE 41). Para emitir Factura Electrónica (DTE ${tipoDte}), se requiere LibreDTE con certificado digital (.pfx) y folios CAF autorizados.`,
        },
        { status: 400 }
      );
    }

    // Mapeo normalizado del medio de pago (1: Efectivo, 2: Tarjeta, 3: Cheque/Transferencia/Otro)
    let codigoMedioPago: 1 | 2 | 3 = 1;
    if (medioPago === "tarjeta") {
      codigoMedioPago = 2;
    } else if (medioPago === "transferencia" || medioPago === "fiado") {
      codigoMedioPago = 3;
    } else {
      codigoMedioPago = 1;
    }

    if (proveedor === "apigateway") {
      const apiGatewayConfig: APIGatewayConfig = {
        activo: Boolean(rawCfg.activo),
        token: rawCfg.token || rawCfg.hash || "",
        rutEmisor: rawCfg.rutEmisor || confData?.rut || "",
        rutVendedor: rawCfg.rutVendedor || rawCfg.rutEmisor || confData?.rut || "",
        claveSII: rawCfg.claveSII || "",
        cdgSIISucur: Number(rawCfg.cdgSIISucur ?? 0),
        razonSocial: rawCfg.razonSocial || confData?.business_name || "",
        giro: rawCfg.giro || "",
        direccion: rawCfg.direccion || confData?.direccion || "",
        comuna: rawCfg.comuna || "Santiago",
      };

      resultado = await emitirBoletaAPIGateway(apiGatewayConfig, {
        items: itemsParaDte,
        total: totalDte,
        tipoDte: Number(tipoDte) === 41 ? 41 : 39,
        medioPago: codigoMedioPago,
        receptor: receptor ? {
          rut: receptor.rut,
          razonSocial: receptor.razonSocial,
          direccion: receptor.direccion,
          comuna: receptor.comuna,
          correo: receptor.correo,
        } : undefined,
      });
    } else {
      // LibreDTE fallback (soporta DTE 39, 41, 33, 34)
      const configLibreDTE: LibreDTEConfig = {
        activo: Boolean(rawCfg.activo),
        hash: rawCfg.hash || "",
        rutEmisor: rawCfg.rutEmisor || confData?.rut || "",
        razonSocial: rawCfg.razonSocial || confData?.business_name || "Mi Negocio",
        giro: rawCfg.giro || "Venta de productos y servicios",
        acteco: rawCfg.acteco || 477111,
        direccion: rawCfg.direccion || confData?.direccion || "Santiago",
        comuna: rawCfg.comuna || "Santiago",
        ciudad: rawCfg.ciudad || rawCfg.comuna || "Santiago",
        ambiente: rawCfg.ambiente || "certificacion",
        tipoDteDefault: rawCfg.tipoDteDefault || 39,
        emisionAutomatica: Boolean(rawCfg.emisionAutomatica),
      };

      resultado = await emitirDTELibreDTE(configLibreDTE, {
        tipoDte: Number(tipoDte) as any,
        items: itemsParaDte,
        subtotal: totalDte,
        total: totalDte,
        receptor: receptor as ReceptorDTE | undefined,
      });
    }

    // 4. Si hay ventaId, actualizar la venta con el resultado distinguiendo rechazo de resultado incierto
    if (ventaId) {
      if (resultado.ok && resultado.folio && Number(resultado.folio) > 0) {
        await supabase
          .from("ventas")
          .update({
            dte_tipo: resultado.tipoDte || 39,
            dte_folio: Number(resultado.folio),
            dte_pdf_url: resultado.pdfUrl || null,
            dte_estado: "emitido",
            dte_fecha: resultado.fechaEmision || new Date().toISOString(),
            dte_error: null,
          })
          .eq("id", ventaId)
          .eq("negocio_id", negocioId);
      } else if (resultado.errorTipo === "resultado_incierto") {
        // En caso de timeout o caída de socket con resultado incierto
        await supabase
          .from("ventas")
          .update({
            dte_tipo: Number(tipoDte) || 39,
            dte_estado: "pendiente_conciliacion",
            dte_error: resultado.error || "Resultado incierto por timeout o desconexión con el proveedor",
          })
          .eq("id", ventaId)
          .eq("negocio_id", negocioId);
      } else {
        // Rechazo explícito confirmado del SII/proveedor
        await supabase
          .from("ventas")
          .update({
            dte_tipo: Number(tipoDte) || 39,
            dte_estado: "error",
            dte_error: resultado.error || "Rechazo del SII al emitir el documento",
          })
          .eq("id", ventaId)
          .eq("negocio_id", negocioId);
      }
    }

    return NextResponse.json(resultado);
  } catch (err: any) {
    console.error("Error en /api/libredte/emitir:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error interno al procesar emisión DTE" },
      { status: 500 }
    );
  }
}
