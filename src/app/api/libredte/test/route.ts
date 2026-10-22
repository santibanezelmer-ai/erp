import { NextResponse } from "next/server";
import { probarConexionAPIGateway } from "@/lib/apigateway";
import { probarConexionLibreDTE } from "@/lib/libredte";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, hash, proveedor = "apigateway" } = body;
    const credencial = token || hash;

    if (!credencial || typeof credencial !== "string") {
      return NextResponse.json(
        { ok: false, mensaje: "Se requiere el Token de API Gateway" },
        { status: 400 }
      );
    }

    if (proveedor === "libredte") {
      const resultado = await probarConexionLibreDTE(credencial);
      return NextResponse.json(resultado);
    }

    // Por defecto probar con API Gateway
    const resultado = await probarConexionAPIGateway(credencial);
    return NextResponse.json(resultado);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, mensaje: err.message || "Error al procesar la prueba de conexión" },
      { status: 500 }
    );
  }
}
