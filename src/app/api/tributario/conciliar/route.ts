import { NextResponse } from "next/server";
import { conciliarDteVentaSimpleAPI } from "@/lib/simpleapi-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { negocioId, ventaId } = body;

    if (!negocioId || !ventaId) {
      return NextResponse.json(
        { ok: false, glosa: "Faltan parámetros negocioId o ventaId" },
        { status: 400 }
      );
    }

    const res = await conciliarDteVentaSimpleAPI(negocioId, ventaId);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, glosa: err.message || "Error al conciliar venta" },
      { status: 500 }
    );
  }
}
