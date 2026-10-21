import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "admin",
  "api",
  "auth",
  "mail",
  "ftp",
  "cpanel",
  "staging",
  "preview",
]);

function getSubdomain(hostname: string): string | null {
  const host = hostname.split(":")[0].toLowerCase();

  // Localhost con subdominio (ej: donde-el-oso.localhost)
  if (host.endsWith(".localhost")) {
    const sub = host.replace(".localhost", "");
    return sub || null;
  }

  // Evitar IPs o localhost simple
  if (host === "localhost" || /^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
    return null;
  }

  // Despliegues Vercel (*.vercel.app)
  if (host.endsWith(".vercel.app")) {
    const parts = host.split(".");
    // sub.mi-proyecto.vercel.app -> parts.length > 3
    if (parts.length > 3) {
      return parts[0];
    }
    return null;
  }

  const parts = host.split(".");
  // Si tiene al menos 3 partes (ej: sub.dominio.com o sub.dominio.cl)
  if (parts.length >= 3) {
    return parts[0];
  }

  return null;
}

export async function middleware(request: NextRequest) {
  try {
    const host = request.headers.get("host") || "";
    const subdomain = getSubdomain(host);
    const pathname = request.nextUrl.pathname;

    // Si hay un subdominio no reservado (ej: donde-el-oso.operix.cl o tienda.operix.cl)
    if (subdomain && !RESERVED_SUBDOMAINS.has(subdomain)) {
      // Caso 1: Subdominio genérico "tienda" (ej: tienda.operix.cl/donde-el-oso)
      if (subdomain === "tienda") {
        const parts = pathname.split("/").filter(Boolean);
        if (parts.length > 0 && parts[0] !== "c" && parts[0] !== "api") {
          const url = request.nextUrl.clone();
          url.pathname = `/c/${parts.join("/")}`;
          return NextResponse.rewrite(url);
        }
      } else {
        // Caso 2: Subdominio directo del negocio (ej: donde-el-oso.operix.cl)
        if (!pathname.startsWith("/c/") && !pathname.startsWith("/api/")) {
          const url = request.nextUrl.clone();
          url.pathname = `/c/${subdomain}${pathname === "/" ? "" : pathname}`;
          return NextResponse.rewrite(url);
        }
      }
    }

    return await updateSession(request);
  } catch (error) {
    console.error("Middleware unhandled error:", error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
