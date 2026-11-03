import { NextResponse } from "next/server";
import { emitirDteVentaSimpleAPI } from "@/lib/simpleapi-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ventaId, negocioId, tipoDte = 39, medioPago = "efectivo", receptor } = body;

    if (!ventaId || !negocioId) {
      return NextResponse.json(
        { ok: false, error: "Faltan parámetros requeridos (ventaId o negocioId)." },
        { status: 400 }
      );
    }

    const resultado = await emitirDteVentaSimpleAPI({
      ventaId,
      negocioId,
      tipoDte: Number(tipoDte) === 41 ? 41 : 39,
      medioPago,
      receptor,
    });

    const statusCode = resultado.ok ? 200 : resultado.estado === "pendiente_conciliacion" ? 409 : 400;
    return NextResponse.json(resultado, { status: statusCode });
  } catch (err: any) {
    console.error("Error en /api/tributario/emitir:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error interno al emitir con SimpleAPI" },
      { status: 500 }
    );
  }
}
