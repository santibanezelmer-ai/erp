import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ShoppingCart, ShieldCheck, Zap, ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-16 border-b border-border/60 px-6 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <Logo className="h-9 w-9" />
          <span className="font-bold text-xl tracking-tight">Operix ERP</span>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Iniciar Sesión
            </Button>
          </Link>
          <Link href="/registro">
            <Button size="sm">Comenzar Gratis</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/10 text-primary text-xs font-semibold mb-6">
          <Zap className="h-3.5 w-3.5" />
          <span>Sistema POS e Inventario en la Nube</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-foreground max-w-3xl leading-tight">
          Controla tus ventas, stock y clientes <span className="text-primary">en tiempo real</span>
        </h1>

        <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
          Diseñado para tiendas, minimarkets y restaurantes. Facturación rápida, control de fiados, arqueo de caja y comandas de cocina desde cualquier dispositivo.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
          <Link href="/registro">
            <Button size="lg" className="gap-2 text-base px-8 h-12 shadow-lg">
              Crear mi Negocio Gratis
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg" className="h-12 px-6">
              Ya tengo una cuenta
            </Button>
          </Link>
        </div>

        {/* Feature badges */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left w-full max-w-3xl">
          <div className="p-5 rounded-xl border border-border bg-card">
            <ShoppingCart className="h-6 w-6 text-primary mb-3" />
            <h3 className="font-bold text-foreground">POS Rápido y Táctil</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Escaneo de códigos de barra, boletas térmicas y múltiples medios de pago.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-border bg-card">
            <Zap className="h-6 w-6 text-amber-500 mb-3" />
            <h3 className="font-bold text-foreground">Stock Descontado al Instante</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Transacciones atómicas seguras en base de datos. Sin descuadres de inventario.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-border bg-card">
            <ShieldCheck className="h-6 w-6 text-emerald-500 mb-3" />
            <h3 className="font-bold text-foreground">Multi-sucursal y Roles</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Permisos para cajeros, mozos, bodegueros y administradores.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 py-8 px-6 text-xs text-muted-foreground bg-muted/20">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo className="h-5 w-5 opacity-80" />
            <span>© {new Date().getFullYear()} Operix ERP. Todos los derechos reservados. Santiago, Chile.</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/terminos" className="hover:text-foreground transition-colors">
              Términos y Condiciones
            </Link>
            <span>•</span>
            <Link href="/privacidad" className="hover:text-foreground transition-colors">
              Política de Privacidad
            </Link>
            <span>•</span>
            <Link href="/devoluciones" className="hover:text-foreground transition-colors">
              Política de Devoluciones
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
