"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Store, UtensilsCrossed, Loader2, CheckCircle2, MailCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { translateAuthError } from "@/lib/auth-errors";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [negocio, setNegocio] = useState("");
  const [tipo, setTipo] = useState<"tienda" | "restaurant">("tienda");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const finalizarCreacionNegocio = async (
    supabase: ReturnType<typeof createClient>,
    nombreNegocio: string,
    tipoNegocio: "tienda" | "restaurant"
  ) => {
    const slug = slugify(nombreNegocio) || `n-${Date.now()}`;
    const { error: rpcErr } = await (supabase.rpc as any)("create_negocio_for_user", {
      _nombre: nombreNegocio,
      _slug: slug,
      _tipo: tipoNegocio,
    });

    if (rpcErr) {
      console.error("Error creating business:", rpcErr);
      router.push("/onboarding");
      router.refresh();
      return;
    }

    // Captura discreta en segundo plano de país y ciudad desde cabeceras de red (Vercel Edge / Cloudflare)
    fetch("/api/geo/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: navigator.language,
      }),
    }).catch(() => {});

    toast.success("¡Cuenta y negocio creados exitosamente!");
    router.push("/dashboard");
    router.refresh();
  };

  const handleResendConfirmation = async () => {
    if (!pendingConfirmationEmail) return;
    setResending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: pendingConfirmationEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        toast.error(translateAuthError(error.message, error.code));
        return;
      }
      toast.success("Correo de verificación reenviado. Revisa tu bandeja de entrada o spam.");
    } catch (err: any) {
      toast.error(translateAuthError(err?.message));
    } finally {
      setResending(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedNombre = nombre.trim();
    const trimmedNegocio = negocio.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!trimmedNombre || !trimmedNegocio || !normalizedEmail || !password) {
      toast.error("Por favor completa todos los campos requeridos");
      return;
    }

    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      // 1. Intentar creación confirmada en servidor (evita bloqueos por email sin confirmar o límites SMTP)
      const apiRes = await fetch("/api/auth/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: trimmedNombre,
          negocio: trimmedNegocio,
          tipo,
          email: normalizedEmail,
          password,
        }),
      });
      const apiData = await apiRes.json().catch(() => null);

      if (apiRes.ok && apiData?.ok && apiData?.autoConfirmed) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (signInErr) {
          toast.error(translateAuthError(signInErr.message, signInErr.code));
          return;
        }

        await finalizarCreacionNegocio(supabase, trimmedNegocio, tipo);
        return;
      }

      if (!apiData?.fallbackToClientSignUp) {
        toast.error(apiData?.error || "Error al crear la cuenta");
        return;
      }

      // 2. Fallback cliente (ej. entorno local sin SUPABASE_SERVICE_ROLE_KEY)
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            nombre: trimmedNombre,
            negocio_pendiente: trimmedNegocio,
            tipo_negocio_pendiente: tipo,
          },
        },
      });

      if (error) {
        toast.error(translateAuthError(error.message, error.code));
        return;
      }

      // Cuando el correo ya existe y la protección de enumeración está activa,
      // Supabase retorna user con identities vacío y sin sesión.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        toast.error(
          "Ya existe una cuenta registrada con este correo electrónico. Intenta iniciar sesión o usa otro correo."
        );
        return;
      }

      if (data.session) {
        await finalizarCreacionNegocio(supabase, trimmedNegocio, tipo);
      } else {
        setPendingConfirmationEmail(normalizedEmail);
        toast.success("Cuenta creada. Revisa tu correo electrónico para confirmar tu cuenta.");
      }
    } catch (err: any) {
      toast.error(translateAuthError(err?.message));
    } finally {
      setLoading(false);
    }
  };

  if (pendingConfirmationEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Logo className="h-10 w-10 shadow-md" />
            <span className="font-bold text-2xl tracking-tight">Operix ERP</span>
          </div>

          <Card className="shadow-lg border-muted/60">
            <CardHeader className="space-y-2 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MailCheck className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl font-bold">Confirma tu correo electrónico</CardTitle>
              <CardDescription>
                Enviamos un enlace de activación a{" "}
                <span className="font-semibold text-foreground">{pendingConfirmationEmail}</span>.
                Debes confirmarlo antes de iniciar sesión.
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex flex-col gap-3">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleResendConfirmation}
                disabled={resending}
              >
                {resending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reenviando...
                  </>
                ) : (
                  "Reenviar correo de confirmación"
                )}
              </Button>
              <Button asChild className="w-full">
                <Link href="/login">Ya confirmé mi correo, ir a Iniciar Sesión</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Logo className="h-10 w-10 shadow-md" />
          <span className="font-bold text-2xl tracking-tight">Operix ERP</span>
        </div>

        <Card className="shadow-lg border-muted/60">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-bold">Crear tu Cuenta</CardTitle>
            <CardDescription>
              Configura tu usuario y el nombre de tu negocio en segundos
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleRegister}>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Tu Nombre</Label>
                  <Input
                    id="nombre"
                    placeholder="Juan Pérez"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="negocio">Nombre del Negocio</Label>
                  <Input
                    id="negocio"
                    placeholder="Mi Tienda / Restaurante"
                    value={negocio}
                    onChange={(e) => setNegocio(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Negocio</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTipo("tienda")}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                      tipo === "tienda"
                        ? "border-primary bg-primary/10 text-primary font-medium ring-1 ring-primary"
                        : "border-border hover:bg-muted/50 text-muted-foreground"
                    )}
                  >
                    <Store className="h-5 w-5 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold">Comercio / Tienda</div>
                      <div className="text-xs opacity-80">Retail, minimarket, ferretería</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTipo("restaurant")}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                      tipo === "restaurant"
                        ? "border-primary bg-primary/10 text-primary font-medium ring-1 ring-primary"
                        : "border-border hover:bg-muted/50 text-muted-foreground"
                    )}
                  >
                    <UtensilsCrossed className="h-5 w-5 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold">Restaurante / Bar</div>
                      <div className="text-xs opacity-80">Mesas, comandas y cocina</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ejemplo@negocio.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña (mínimo 6 caracteres)</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={loading}
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Configurando tu negocio...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Comenzar Gratis
                  </>
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground px-2">
                Al crear tu cuenta, aceptas nuestros{" "}
                <Link href="/terminos" target="_blank" className="text-primary hover:underline underline-offset-2">
                  Términos y Condiciones
                </Link>{" "}
                y{" "}
                <Link href="/privacidad" target="_blank" className="text-primary hover:underline underline-offset-2">
                  Política de Privacidad
                </Link>.
              </p>

              <div className="text-center text-sm text-muted-foreground">
                ¿Ya tienes una cuenta?{" "}
                <Link
                  href="/login"
                  className="font-medium text-primary hover:underline underline-offset-4"
                >
                  Inicia sesión aquí
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
