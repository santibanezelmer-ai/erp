"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Users, CheckCircle2, ArrowRight, Loader2, Sparkles, Building2, Shield } from "lucide-react";

function UnirseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codigoParam = searchParams.get("codigo") || "";

  const [codigo, setCodigo] = useState(codigoParam);
  const [loading, setLoading] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [invitacionValida, setInvitacionValida] = useState<{
    id: string;
    role: string;
    negocioNombre: string;
    sucursalNombre?: string;
  } | null>(null);

  // Datos de usuario para registrarse si no está autenticado
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tieneCuenta, setTieneCuenta] = useState(false);

  // Verificar código automáticamente si viene por URL
  useEffect(() => {
    if (codigoParam) {
      verificarCodigo(codigoParam);
    }
  }, [codigoParam]);

  const verificarCodigo = async (cod: string) => {
    if (!cod.trim()) return;
    setVerificando(true);
    const supabase = createClient();

    try {
      const { data: inv, error } = await supabase
        .from("invitaciones")
        .select("id, role, estado, negocio_id, sucursal_id, email")
        .eq("codigo", cod.trim().toUpperCase())
        .maybeSingle();

      if (error || !inv) {
        toast.error("Código de invitación inválido");
        setInvitacionValida(null);
        return;
      }

      if (inv.estado !== "pendiente") {
        toast.error("Esta invitación ya fue utilizada o ha expirado");
        setInvitacionValida(null);
        return;
      }

      // Obtener nombre del negocio
      const { data: neg } = await supabase
        .from("negocios")
        .select("nombre")
        .eq("id", inv.negocio_id)
        .single();

      // Obtener nombre de sucursal si aplica
      let sucursalNombre = undefined;
      if (inv.sucursal_id) {
        const { data: suc } = await supabase
          .from("sucursales")
          .select("nombre")
          .eq("id", inv.sucursal_id)
          .maybeSingle();
        sucursalNombre = suc?.nombre;
      }

      if (inv.email) {
        setEmail(inv.email);
      }

      setInvitacionValida({
        id: inv.id,
        role: inv.role,
        negocioNombre: neg?.nombre || "Negocio",
        sucursalNombre,
      });

      toast.success(`¡Invitación válida para ${neg?.nombre}!`);
    } catch (err: any) {
      toast.error(err.message || "Error al verificar la invitación");
    } finally {
      setVerificando(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitacionValida) {
      toast.error("Debes validar un código de invitación primero");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      let userId: string;

      if (tieneCuenta) {
        // Iniciar sesión
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (authError) throw authError;
        userId = authData.user.id;
      } else {
        // Crear cuenta nueva
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              nombre: nombre.trim(),
            },
          },
        });
        if (authError) throw authError;
        if (!authData.user) throw new Error("No se pudo crear la cuenta");
        userId = authData.user.id;
      }

      // 1. Obtener la invitación completa
      const { data: invData } = await supabase
        .from("invitaciones")
        .select("*")
        .eq("id", invitacionValida.id)
        .single();

      if (!invData) throw new Error("Invitación no encontrada");

      // 2. Asociar rol en user_roles
      await supabase.from("user_roles").insert({
        user_id: userId,
        negocio_id: invData.negocio_id,
        role: invData.role as any,
      });

      // 3. Actualizar perfil del usuario
      await supabase
        .from("profiles")
        .update({
          negocio_id: invData.negocio_id,
          sucursal_id: invData.sucursal_id,
          nombre: nombre.trim() || undefined,
        })
        .eq("id", userId);

      // 4. Marcar invitación como usada
      await supabase
        .from("invitaciones")
        .update({
          estado: "usada",
          usada_por: userId,
          usada_at: new Date().toISOString(),
        })
        .eq("id", invData.id);

      toast.success("¡Bienvenido al equipo!");

      // Redirigir según el rol
      if (invData.role === "cajero") {
        router.push("/pos");
      } else if (invData.role === "vendedor") {
        router.push("/comandas");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      toast.error(err.message || "Error al unirse al negocio");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <Users className="h-3.5 w-3.5" />
            Invitación a Equipo
          </div>
          <h1 className="text-2xl font-black tracking-tight">Únete a un Negocio</h1>
          <p className="text-xs text-muted-foreground">
            Ingresa tu código de invitación para unirte como colaborador en Operix
          </p>
        </div>

        <Card className="shadow-lg border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold">Código de Acceso</CardTitle>
            <CardDescription className="text-xs">
              El administrador del negocio te proporcionó un código de 8 caracteres
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Ej: K89J21AX"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                className="font-mono uppercase font-bold tracking-wider"
                maxLength={10}
                disabled={verificando || !!invitacionValida}
              />
              {!invitacionValida ? (
                <Button
                  type="button"
                  onClick={() => verificarCodigo(codigo)}
                  disabled={verificando || !codigo.trim()}
                  className="font-bold text-xs"
                >
                  {verificando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verificar"}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setInvitacionValida(null);
                    setCodigo("");
                  }}
                  className="text-xs"
                >
                  Cambiar
                </Button>
              )}
            </div>

            {invitacionValida && (
              <div className="p-3 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-primary">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Invitación Confirmada
                </div>
                <div className="text-xs space-y-1 text-foreground">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Negocio:</span>
                    <span className="font-bold">{invitacionValida.negocioNombre}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rol Asignado:</span>
                    <span className="font-bold capitalize bg-primary/10 px-2 py-0.5 rounded text-primary">
                      {invitacionValida.role}
                    </span>
                  </div>
                  {invitacionValida.sucursalNombre && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sucursal:</span>
                      <span className="font-medium">{invitacionValida.sucursalNombre}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {invitacionValida && (
              <form onSubmit={handleSubmit} className="space-y-3 pt-2 border-t border-border">
                <div className="flex justify-between items-center text-xs pb-1">
                  <span className="font-semibold text-foreground">
                    {tieneCuenta ? "Inicia sesión con tu cuenta" : "Crea tu cuenta de acceso"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTieneCuenta(!tieneCuenta)}
                    className="text-primary hover:underline font-bold"
                  >
                    {tieneCuenta ? "Crear cuenta nueva" : "Ya tengo cuenta"}
                  </button>
                </div>

                {!tieneCuenta && (
                  <div className="space-y-1.5">
                    <Label htmlFor="u-nombre" className="text-xs">Tu Nombre Completo *</Label>
                    <Input
                      id="u-nombre"
                      placeholder="Ej: Carlos Gómez"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="u-email" className="text-xs">Correo Electrónico *</Label>
                  <Input
                    id="u-email"
                    type="email"
                    placeholder="carlos@correo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="u-pass" className="text-xs">Contraseña *</Label>
                  <Input
                    id="u-pass"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={loading}
                  />
                </div>

                <Button type="submit" disabled={loading} className="w-full font-bold gap-2 mt-2">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uniendo al equipo...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      {tieneCuenta ? "Aceptar e Iniciar Turno" : "Crear Cuenta y Unirme"}
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>

          <CardFooter className="pt-0 justify-center">
            <Link href="/login" className="text-xs text-muted-foreground hover:underline">
              ¿Eres el dueño del negocio? Inicia sesión aquí
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default function UnirsePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <UnirseContent />
    </Suspense>
  );
}
