import { NextResponse, type NextRequest } from "next/server";
import { loadPublicCatalog } from "@/lib/catalog-public.server";

// Datos de catálogo siempre frescos (stock y precios cambian).
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!slug || slug.length > 120) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const includeDraft = request.nextUrl.searchParams.get("preview") === "true";
  const result = await loadPublicCatalog(slug, { includeDraft });

  switch (result.status) {
    case "ok":
      return NextResponse.json(result.data, {
        headers: { "Cache-Control": "no-store" },
      });
    case "not_found":
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    case "inactive":
      return NextResponse.json({ error: "inactive" }, { status: 403 });
    default:
      return NextResponse.json({ error: "error" }, { status: 500 });
  }
}
