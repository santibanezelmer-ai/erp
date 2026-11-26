import { NextResponse, type NextRequest } from "next/server";
import { loadPublicProductImages } from "@/lib/catalog-public.server";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Galería pública de un producto. Se resuelve en el servidor para que el
// resultado no dependa de la sesión del navegador (un vendedor logueado en
// otra tienda sólo vería las imágenes de su propio negocio).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ productoId: string }> }
) {
  const { productoId } = await params;
  if (!productoId || !UUID_RE.test(productoId)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const result = await loadPublicProductImages(productoId);
  if (result.status !== "ok") {
    const code = result.status === "error" ? 500 : 404;
    return NextResponse.json({ error: result.status }, { status: code });
  }

  return NextResponse.json(result.data, { headers: { "Cache-Control": "no-store" } });
}
