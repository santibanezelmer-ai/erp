import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { emitirDTELibreDTE, type LibreDTEConfig, type ItemDTE, type ReceptorDTE } from "@/lib/libredte";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ventaId, negocioId, tipoDte = 39, receptor, itemsOverride, totalOverride } = body;

    if (!negocioId) {
      return NextResponse.json({ ok: false, error: "Falta el ID del negocio" }, { status: 400 });
    }

    // Inicializar cliente Supabase con service role para lectura de configuración
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rgyqtxoagsmkleebrmza.supabase.co";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Obtener la configuración de LibreDTE del negocio
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
        { ok: false, error: "La facturación con LibreDTE está desactivada en la configuración del negocio." },
        { status: 400 }
      );
    }

    const config: LibreDTEConfig = {
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

    let itemsParaDte: ItemDTE[] = [];
    let totalDte = Number(totalOverride || 0);

    // 2. Si hay ventaId, cargar detalles de la base de datos
    if (ventaId) {
      const [ventaRes, detallesRes] = await Promise.all([
        supabase.from("ventas").select("*").eq("id", ventaId).single(),
        supabase.from("detalle_ventas").select("*").eq("venta_id", ventaId),
      ]);

      if (ventaRes.error) {
        return NextResponse.json({ ok: false, error: "No se encontró la venta especificada" }, { status: 404 });
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
      return NextResponse.json({ ok: false, error: "No hay productos o ítems para emitir el DTE" }, { status: 400 });
    }

    // 3. Emitir el DTE en LibreDTE
    const resultado = await emitirDTELibreDTE(config, {
      tipoDte: Number(tipoDte) as any,
      items: itemsParaDte,
      subtotal: totalDte,
      total: totalDte,
      receptor: receptor as ReceptorDTE | undefined,
    });

    // 4. Si hay ventaId, actualizar la venta con el resultado
    if (ventaId) {
      if (resultado.ok) {
        await supabase
          .from("ventas")
          .update({
            dte_tipo: resultado.tipoDte,
            dte_folio: resultado.folio || null,
            dte_pdf_url: resultado.pdfUrl || null,
            dte_estado: "emitido",
            dte_fecha: new Date().toISOString(),
            dte_error: null,
          })
          .eq("id", ventaId);
      } else {
        await supabase
          .from("ventas")
          .update({
            dte_tipo: Number(tipoDte),
            dte_estado: "error",
            dte_error: resultado.error || "Error al emitir en LibreDTE",
          })
          .eq("id", ventaId);
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
