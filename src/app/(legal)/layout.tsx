import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { FileText, Shield, RotateCcw, ArrowLeft, Mail } from "lucide-react";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
              <Logo className="h-8 w-8" />
              <span className="font-bold text-lg tracking-tight">Operix ERP</span>
            </Link>
            <span className="hidden sm:inline text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
              Centro Legal
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Volver al</span> Inicio
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="sm" className="text-xs">
                Ingresar
              </Button>
            </Link>
            <Link href="/registro">
              <Button size="sm" className="text-xs">
                Registrarse
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10">
        {/* Navigation Tabs between legal pages */}
        <div className="flex flex-wrap items-center gap-2 mb-8 p-1.5 bg-muted/50 border border-border rounded-xl">
          <Link
            href="/terminos"
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all hover:bg-background/80 hover:text-foreground hover:shadow-xs"
          >
            <FileText className="h-4 w-4 text-primary" />
            <span>Términos y Condiciones</span>
          </Link>
          <Link
            href="/privacidad"
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all hover:bg-background/80 hover:text-foreground hover:shadow-xs"
          >
            <Shield className="h-4 w-4 text-emerald-500" />
            <span>Política de Privacidad</span>
          </Link>
          <Link
            href="/devoluciones"
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all hover:bg-background/80 hover:text-foreground hover:shadow-xs"
          >
            <RotateCcw className="h-4 w-4 text-amber-500" />
            <span>Devoluciones y Cancelación</span>
          </Link>
        </div>

        {children}
      </div>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-muted/20 py-8 px-4 text-xs text-muted-foreground">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo className="h-5 w-5 opacity-80" />
            <span>© {new Date().getFullYear()} Operix ERP — Software de Gestión Comercial. Santiago, Chile.</span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Link href="/terminos" className="hover:underline">
              Términos
            </Link>
            <span>•</span>
            <Link href="/privacidad" className="hover:underline">
              Privacidad
            </Link>
            <span>•</span>
            <Link href="/devoluciones" className="hover:underline">
              Devoluciones
            </Link>
            <span>•</span>
            <a
              href="mailto:soporte@operixerp.cloud"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <Mail className="h-3 w-3" />
              soporte@operixerp.cloud
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
