import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { LandingHeroMockup } from "@/components/landing/LandingHeroMockup";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { LandingFaq } from "@/components/landing/LandingFaq";
import {
  ShoppingCart,
  ShieldCheck,
  Zap,
  ArrowRight,
  Store,
  UtensilsCrossed,
  Shirt,
  BarChart3,
  Users,
  Smartphone,
  Printer,
  Barcode,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Lock,
} from "lucide-react";

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
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Navbar Superior */}
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
              <Logo className="h-9 w-9" />
              <div className="flex flex-col">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight leading-none">
                  Operix ERP
                </span>
                <span className="text-[10px] text-muted-foreground font-medium hidden sm:inline">
                  POS & Inventario en la Nube
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-xs sm:text-sm font-medium text-muted-foreground">
              <a href="#soluciones" className="hover:text-foreground transition-colors">
                Soluciones
              </a>
              <a href="#modulos" className="hover:text-foreground transition-colors">
                Módulos
              </a>
              <a href="#precios" className="hover:text-foreground transition-colors">
                Precios
              </a>
              <a href="#faq" className="hover:text-foreground transition-colors">
                Preguntas Frecuentes
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-xs sm:text-sm">
                Iniciar Sesión
              </Button>
            </Link>
            <Link href="/registro">
              <Button size="sm" className="text-xs sm:text-sm font-semibold shadow-xs">
                Comenzar Gratis
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 sm:pt-24 pb-16 px-4 sm:px-6 max-w-7xl mx-auto text-center overflow-hidden w-full">
        <div className="max-w-4xl mx-auto flex flex-col items-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/25 bg-primary/10 text-primary text-xs font-semibold mb-6 shadow-xs animate-in fade-in">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span>Sistema POS, Inventario y Catálogos en la Nube 🇨🇱</span>
          </div>

          {/* Título Principal */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-foreground leading-[1.1] max-w-4xl">
            El sistema de ventas y gestión que hace{" "}
            <span className="text-primary bg-clip-text">crecer tu negocio</span>
          </h1>

          {/* Subtítulo */}
          <p className="mt-6 text-base sm:text-xl text-muted-foreground max-w-2xl leading-relaxed">
            Dile adiós a los cuadernos y descuadres de stock. Controla tus ventas de punto de venta, inventario multi-sucursal, cobro de fiados con WhatsApp y catálogo online en una sola plataforma.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full justify-center">
            <Link href="/registro" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto gap-2 text-sm sm:text-base px-8 h-12 shadow-lg font-bold">
                Crear Mi Negocio Gratis
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#precios" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto h-12 px-6 text-sm sm:text-base font-semibold">
                Ver Planes y Precios
              </Button>
            </a>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Sin tarjeta de crédito
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Listo en 2 minutos
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Cancelación 100% libre
            </span>
          </div>
        </div>

        {/* Hero Visual Mockup */}
        <div className="mt-14 w-full">
          <LandingHeroMockup />
        </div>
      </section>

      {/* Trust & Hardware Compatibility Banner */}
      <section className="border-y border-border/60 bg-muted/30 py-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          <div className="flex flex-col items-center justify-center gap-1">
            <Barcode className="h-6 w-6 text-primary mb-1" />
            <span className="text-sm font-bold text-foreground">Lectores de Códigos</span>
            <span className="text-xs text-muted-foreground">Compatible con USB y Bluetooth</span>
          </div>
          <div className="flex flex-col items-center justify-center gap-1">
            <Printer className="h-6 w-6 text-primary mb-1" />
            <span className="text-sm font-bold text-foreground">Impresoras Térmicas</span>
            <span className="text-xs text-muted-foreground">Formato estándar 58mm y 80mm</span>
          </div>
          <div className="flex flex-col items-center justify-center gap-1">
            <Smartphone className="h-6 w-6 text-primary mb-1" />
            <span className="text-sm font-bold text-foreground">Multi-Dispositivo</span>
            <span className="text-xs text-muted-foreground">PC, Notebook, Tablet o Celular</span>
          </div>
          <div className="flex flex-col items-center justify-center gap-1">
            <ShieldCheck className="h-6 w-6 text-emerald-500 mb-1" />
            <span className="text-sm font-bold text-foreground">99.9% Uptime Nube</span>
            <span className="text-xs text-muted-foreground">Tus datos seguros y respaldados</span>
          </div>
        </div>
      </section>

      {/* Soluciones por Rubro */}
      <section id="soluciones" className="py-20 px-4 sm:px-6 max-w-7xl mx-auto w-full scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Especializado para tu rubro</span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground mt-2">
            Hecho a la medida de tu tipo de negocio
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">
            No importa si vendes abarrotes, atiendes mesas en un café o despachas pedidos por WhatsApp: Operix se adapta a tu flujo diario.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Minimarkets y Almacenes */}
          <div className="p-6 rounded-2xl border border-border bg-card shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
            <div>
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Store className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Minimarkets y Almacenes</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">
                Agiliza la fila con lectura instantánea de códigos de barra, boletas térmicas al instante, registro de deudas (fiados) con envío de resumen por WhatsApp y alertas de reposición de stock.
              </p>
            </div>
            <ul className="mt-5 space-y-2 text-xs text-muted-foreground border-t border-border/60 pt-4">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Control de fiados con detalle de productos</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Arqueo de caja rápido al cambio de turno</span>
              </li>
            </ul>
          </div>

          {/* Card 2: Restaurantes y Gastronomía */}
          <div className="p-6 rounded-2xl border border-border bg-card shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
            <div>
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4">
                <UtensilsCrossed className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Restaurantes, Cafés y Dark Kitchens</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">
                Control de comandas de cocina en pantalla digital (KDS), mapa de mesas en tiempo real, división de cuentas y despacho expedito sin notas en papel que se extravíen.
              </p>
            </div>
            <ul className="mt-5 space-y-2 text-xs text-muted-foreground border-t border-border/60 pt-4">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Pantalla KDS interactiva para cocineros</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Gestión de mesas y pedidos para llevar</span>
              </li>
            </ul>
          </div>

          {/* Card 3: Retail y Tiendas */}
          <div className="p-6 rounded-2xl border border-border bg-card shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between">
            <div>
              <div className="h-12 w-12 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-4">
                <Shirt className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Retail, Ropa y Variedades</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">
                Manejo de variantes (talla, color, modelo), catálogo digital público con tu logo propio para recibir pedidos directos en WhatsApp y sincronización entre sucursales.
              </p>
            </div>
            <ul className="mt-5 space-y-2 text-xs text-muted-foreground border-t border-border/60 pt-4">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Tienda web con subdominio propio</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Traspasos y control de stock multi-sucursal</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Módulos Principales */}
      <section id="modulos" className="py-20 px-4 sm:px-6 bg-muted/20 border-y border-border/60 scroll-mt-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Herramientas Todo en Uno</span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground mt-2">
              Todo lo que necesitas para operar sin fricción
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground mt-2">
              Un conjunto completo de módulos diseñados para eliminar errores humanos y ahorrar horas de trabajo semanal.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-5 rounded-xl border border-border bg-card">
              <ShoppingCart className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-bold text-foreground">Punto de Venta (POS) Táctil</h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Venta rápida por código de barras o búsqueda inteligente. Múltiples medios de pago (efectivo, débito, transferencia) y boleta térmica inmediata.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-border bg-card">
              <Zap className="h-6 w-6 text-amber-500 mb-3" />
              <h3 className="font-bold text-foreground">Stock Descontado al Instante</h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Transacciones atómicas en base de datos. Sin descuadres de inventario aunque tengas varias cajas cobrando en simultáneo.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-border bg-card">
              <Users className="h-6 w-6 text-emerald-500 mb-3" />
              <h3 className="font-bold text-foreground">Fiados y Créditos a Clientes</h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Historial de saldos con desglose exacto de productos fiados, abonos parciales y recordatorios de cobro a WhatsApp en un clic.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-border bg-card">
              <Store className="h-6 w-6 text-blue-500 mb-3" />
              <h3 className="font-bold text-foreground">Catálogo Online con Tu Marca</h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Comparte el enlace de tu tienda con tu logotipo oficial visible en las vistas previas de WhatsApp. Recibe pedidos organizados en tiempo real.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-border bg-card">
              <UtensilsCrossed className="h-6 w-6 text-rose-500 mb-3" />
              <h3 className="font-bold text-foreground">Comandas Digitales (KDS)</h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Pantalla táctil para cocineros con tiempos de preparación, alertas visuales y comunicación directa con los mozos de sala.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-border bg-card">
              <BarChart3 className="h-6 w-6 text-teal-500 mb-3" />
              <h3 className="font-bold text-foreground">Caja Ciega y Reportes</h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Arqueos de apertura y cierre con validación ciega de efectivo para prevenir fugas. Reportes de rentabilidad exportables a Excel.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Comparativa: Métodos Tradicionales vs Operix */}
      <section className="py-20 px-4 sm:px-6 max-w-5xl mx-auto w-full">
        <div className="text-center mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">¿Por qué cambiarte?</span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground mt-2">
            La diferencia entre perder tiempo y escalar tu negocio
          </h2>
        </div>

        <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-xs">
          <div className="grid grid-cols-12 bg-muted/60 p-4 border-b border-border text-xs sm:text-sm font-bold text-foreground">
            <div className="col-span-6 sm:col-span-6">Aspecto Operacional</div>
            <div className="col-span-3 sm:col-span-3 text-center text-muted-foreground">Planillas / Cuadernos</div>
            <div className="col-span-3 sm:col-span-3 text-center text-primary">Operix ERP</div>
          </div>

          <div className="divide-y divide-border/60 text-xs sm:text-sm">
            <div className="grid grid-cols-12 p-4 items-center">
              <div className="col-span-6 font-medium text-foreground">Descuento de inventario en ventas</div>
              <div className="col-span-3 text-center text-muted-foreground flex justify-center">
                <XCircle className="h-4 w-4 text-rose-500" />
              </div>
              <div className="col-span-3 text-center text-foreground font-semibold flex justify-center">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
            </div>

            <div className="grid grid-cols-12 p-4 items-center bg-muted/20">
              <div className="col-span-6 font-medium text-foreground">Control de fiados con detalle de productos</div>
              <div className="col-span-3 text-center text-muted-foreground flex justify-center">
                <XCircle className="h-4 w-4 text-rose-500" />
              </div>
              <div className="col-span-3 text-center text-foreground font-semibold flex justify-center">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
            </div>

            <div className="grid grid-cols-12 p-4 items-center">
              <div className="col-span-6 font-medium text-foreground">Catálogo web con pedidos directos a WhatsApp</div>
              <div className="col-span-3 text-center text-muted-foreground flex justify-center">
                <XCircle className="h-4 w-4 text-rose-500" />
              </div>
              <div className="col-span-3 text-center text-foreground font-semibold flex justify-center">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
            </div>

            <div className="grid grid-cols-12 p-4 items-center bg-muted/20">
              <div className="col-span-6 font-medium text-foreground">Cierre y arqueo ciego contra descuadres</div>
              <div className="col-span-3 text-center text-muted-foreground flex justify-center">
                <XCircle className="h-4 w-4 text-rose-500" />
              </div>
              <div className="col-span-3 text-center text-foreground font-semibold flex justify-center">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
            </div>

            <div className="grid grid-cols-12 p-4 items-center">
              <div className="col-span-6 font-medium text-foreground">Acceso desde cualquier celular o notebook</div>
              <div className="col-span-3 text-center text-muted-foreground flex justify-center">
                <XCircle className="h-4 w-4 text-rose-500" />
              </div>
              <div className="col-span-3 text-center text-foreground font-semibold flex justify-center">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Panel de Precios Interactivo */}
      <LandingPricing />

      {/* Preguntas Frecuentes (FAQ) */}
      <LandingFaq />

      {/* Banner Final de Conversión (Bottom CTA) */}
      <section className="py-20 px-4 sm:px-6 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Comienza a vender de forma más rápida e inteligente hoy
          </h2>
          <p className="text-base sm:text-lg text-primary-foreground/80 max-w-2xl mx-auto">
            Configura tu negocio en menos de 2 minutos. Únete a los emprendedores y comerciantes que ya tienen control total de su inventario y ventas.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/registro" className="w-full sm:w-auto">
              <Button
                size="lg"
                variant="secondary"
                className="w-full sm:w-auto h-12 px-8 font-black text-foreground shadow-xl gap-2"
              >
                Crear Mi Cuenta Gratis
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login" className="w-full sm:w-auto">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto h-12 px-6 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              >
                Acceder a mi Negocio
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer Enriquecido */}
      <footer className="border-t border-border/60 py-12 px-4 sm:px-6 bg-card text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-8 text-left">
          {/* Columna 1: Marca */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2">
              <Logo className="h-7 w-7" />
              <span className="font-extrabold text-base text-foreground tracking-tight">Operix ERP</span>
            </div>
            <p className="leading-relaxed">
              Software de punto de venta, control de inventario y catálogos en la nube para comercios y pymes en Chile.
            </p>
            <div className="pt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>🇨🇱 Hecho en Chile</span> • <span>Santiago</span>
            </div>
          </div>

          {/* Columna 2: Módulos */}
          <div className="space-y-2">
            <div className="font-bold text-foreground text-xs uppercase tracking-wider mb-2">
              Módulos
            </div>
            <div className="flex flex-col space-y-1.5">
              <a href="#modulos" className="hover:text-foreground transition-colors">Punto de Venta (POS)</a>
              <a href="#modulos" className="hover:text-foreground transition-colors">Inventario y Stock</a>
              <a href="#modulos" className="hover:text-foreground transition-colors">Fiados y Créditos</a>
              <a href="#modulos" className="hover:text-foreground transition-colors">Catálogo Online</a>
              <a href="#modulos" className="hover:text-foreground transition-colors">Comandas de Cocina (KDS)</a>
              <a href="#modulos" className="hover:text-foreground transition-colors">Arqueo y Cierre de Caja</a>
            </div>
          </div>

          {/* Columna 3: Precios y Planes */}
          <div className="space-y-2">
            <div className="font-bold text-foreground text-xs uppercase tracking-wider mb-2">
              Suscripciones
            </div>
            <div className="flex flex-col space-y-1.5">
              <a href="#precios" className="hover:text-foreground transition-colors">Plan Emprendedor (Gratis)</a>
              <a href="#precios" className="hover:text-foreground transition-colors">Plan Básico ($3.990 CLP)</a>
              <a href="#precios" className="hover:text-foreground transition-colors">Plan Pro ($9.990 CLP)</a>
              <a href="#precios" className="hover:text-foreground transition-colors">Planes Anuales (2 meses gratis)</a>
              <Link href="/devoluciones" className="hover:text-foreground transition-colors text-amber-600 dark:text-amber-400 font-medium">
                Garantía de Satisfacción 7 Días
              </Link>
            </div>
          </div>

          {/* Columna 4: Legal y Soporte */}
          <div className="space-y-2">
            <div className="font-bold text-foreground text-xs uppercase tracking-wider mb-2">
              Legal y Soporte
            </div>
            <div className="flex flex-col space-y-1.5">
              <Link href="/terminos" className="hover:text-foreground transition-colors">
                Términos y Condiciones
              </Link>
              <Link href="/privacidad" className="hover:text-foreground transition-colors">
                Política de Privacidad
              </Link>
              <Link href="/devoluciones" className="hover:text-foreground transition-colors">
                Política de Devoluciones
              </Link>
              <a
                href="mailto:soporte@operixerp.cloud"
                className="text-primary hover:underline pt-1 inline-block"
              >
                soporte@operixerp.cloud
              </a>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto border-t border-border/60 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            © {new Date().getFullYear()} Operix ERP. Todos los derechos reservados.
          </div>
          <div className="flex items-center gap-3">
            <span>Pagos procesados de forma segura con Mercado Pago</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
