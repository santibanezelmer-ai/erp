"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TenantProvider, useTenant } from "@/contexts/tenant-context";
import { Button } from "@/components/ui/button";
import {
  Store,
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Package,
  Truck,
  Users,
  Wallet,
  UtensilsCrossed,
  Layers,
  ChefHat,
  BarChart3,
  Settings,
  LogOut,
  Building2,
  Menu,
  X,
  ChevronDown,
  Loader2,
  ExternalLink,
  CreditCard,
  BadgeDollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { negocio, sucursales, sucursalActiva, setSucursalActiva, profile, rol, loading, logout } = useTenant();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-muted/20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">Cargando Operix ERP...</p>
      </div>
    );
  }

  const isRestaurant =
    !negocio?.tipo_negocio ||
    negocio?.tipo_negocio === "restaurant" ||
    negocio?.tipo_negocio === "gastronomia";

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Punto de Venta (POS)", href: "/pos", icon: ShoppingCart },
    { name: "Ventas", href: "/ventas", icon: Receipt },
    { name: "Productos & Stock", href: "/productos", icon: Package },
    { name: "Compras", href: "/compras", icon: Truck },
    { name: "Clientes", href: "/clientes", icon: Users },
    { name: "Fiados y Créditos", href: "/fiados", icon: BadgeDollarSign },
    { name: "Mi Tienda Web", href: "/tienda-online", icon: Store },
    ...(isRestaurant
      ? [
          { name: "Mesas", href: "/mesas", icon: UtensilsCrossed },
          { name: "Comandas", href: "/comandas", icon: Layers },
          { name: "Cocina (KDS)", href: "/cocina", icon: ChefHat },
        ]
      : []),
    { name: "Caja / Turno", href: "/caja", icon: Wallet },
    { name: "Reportes", href: "/reportes", icon: BarChart3 },
    { name: "Planes y Suscripción", href: "/planes", icon: CreditCard },
    { name: "Configuración", href: "/configuracion", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Desktop & Mobile */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-sidebar flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand header */}
        <div className="h-16 px-5 border-b border-sidebar-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo className="h-9 w-9" />
            <div>
              <span className="font-bold text-lg leading-tight block">Operix ERP</span>
              <span className="text-[11px] text-muted-foreground block truncate max-w-[130px]">
                {negocio?.nombre || "Cargando..."}
              </span>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 rounded-md text-muted-foreground hover:bg-sidebar-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User profile / Logout bottom */}
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center justify-between p-2 rounded-lg bg-sidebar-accent/50 text-xs">
            <div className="truncate mr-2">
              <div className="font-medium text-sidebar-foreground truncate">
                {profile?.nombre || profile?.email || "Usuario"}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Rol: {rol}
              </div>
            </div>
            <button
              onClick={logout}
              title="Cerrar sesión"
              className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-16 border-b border-border bg-card/60 backdrop-blur-sm px-4 lg:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-lg border border-border lg:hidden hover:bg-muted"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Selector de Sucursal */}
            <div className="relative">
              <button
                onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted/50 text-xs font-medium transition-colors"
              >
                <Building2 className="h-3.5 w-3.5 text-primary" />
                <span>Sucursal: {sucursalActiva?.nombre || "Principal"}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>

              {branchDropdownOpen && (
                <div className="absolute left-0 mt-1 w-48 rounded-lg border border-border bg-popover p-1 shadow-lg z-50">
                  <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                    Cambiar Sucursal
                  </div>
                  {sucursales.map((suc) => (
                    <button
                      key={suc.id}
                      onClick={() => {
                        setSucursalActiva(suc);
                        setBranchDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-2 py-1.5 rounded text-xs transition-colors flex items-center justify-between",
                        suc.id === sucursalActiva?.id
                          ? "bg-primary text-primary-foreground font-medium"
                          : "hover:bg-muted text-popover-foreground"
                      )}
                    >
                      <span>{suc.nombre}</span>
                      {suc.id === sucursalActiva?.id && <span className="text-[10px]">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {negocio?.slug && (
              <a
                href={`/c/${negocio.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir Tienda Online / Catálogo Digital en nueva pestaña"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-foreground transition-colors shadow-2xs"
              >
                <Store className="h-3.5 w-3.5 text-primary" />
                <span className="hidden sm:inline">Ver Mi Tienda</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </a>
            )}

            <Link
              href="/pos"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow hover:bg-primary/90 transition-colors"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              <span>Abrir POS</span>
            </Link>
          </div>
        </header>

        {/* Page body */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-muted/20">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <DashboardContent>{children}</DashboardContent>
    </TenantProvider>
  );
}
