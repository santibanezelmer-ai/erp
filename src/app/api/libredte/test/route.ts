import { NextResponse } from "next/server";
import { probarConexionLibreDTE } from "@/lib/libredte";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { hash } = body;

    if (!hash || typeof hash !== "string") {
      return NextResponse.json(
        { ok: false, mensaje: "Se requiere el Token / Hash de LibreDTE" },
        { status: 400 }
      );
    }

    const resultado = await probarConexionLibreDTE(hash);
    return NextResponse.json(resultado);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, mensaje: err.message || "Error al procesar la prueba de conexión" },
      { status: 500 }
    );
  }
}
