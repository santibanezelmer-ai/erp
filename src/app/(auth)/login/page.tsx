"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { translateAuthError } from "@/lib/auth-errors";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleResendConfirmation = async () => {
    if (!unconfirmedEmail) return;
    setResending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: unconfirmedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        toast.error(translateAuthError(error.message, error.code));
        return;
      }
      toast.success("Correo de confirmación reenviado. Revisa tu bandeja de entrada o spam.");
    } catch (err: any) {
      toast.error(translateAuthError(err?.message));
    } finally {
      setResending(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    setLoading(true);
    setUnconfirmedEmail(null);
    const supabase = createClient();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        if (
          error.code === "email_not_confirmed" ||
          (error.message || "").toLowerCase().includes("email not confirmed")
        ) {
          setUnconfirmedEmail(normalizedEmail);
        }
        toast.error(translateAuthError(error.message, error.code));
        return;
      }

      if (data.user) {
        // Verificar primero si el usuario es Super Admin global
        const [{ data: superRole }, { data: isSaRpc }, { data: profile }] = await Promise.all([
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", data.user.id)
            .eq("role", "super_admin")
            .maybeSingle(),
          supabase.rpc("is_super_admin", { _uid: data.user.id }),
          supabase
            .from("profiles")
            .select("negocio_id")
            .eq("id", data.user.id)
            .maybeSingle(),
        ]);

        const isSuperAdmin =
          Boolean(superRole) ||
          Boolean(isSaRpc) ||
          data.user.email?.toLowerCase() === "santibanez.elmer@gmail.com";

        toast.success("¡Bienvenido de vuelta!");

        if (isSuperAdmin) {
          router.push("/super-admin");
        } else if (!profile?.negocio_id) {
          router.push("/onboarding");
        } else {
          router.push("/dashboard");
        }
        router.refresh();
      }
    } catch (err: any) {
      toast.error(translateAuthError(err?.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Logo className="h-10 w-10 shadow-md" />
          <span className="font-bold text-2xl tracking-tight">Operix ERP</span>
        </div>

        <Card className="shadow-lg border-muted/60">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-bold">Iniciar Sesión</CardTitle>
            <CardDescription>
              Ingresa tus credenciales para acceder a tu negocio
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              {unconfirmedEmail && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs space-y-2">
                  <p className="font-medium text-foreground">
                    Tu correo <span className="font-semibold">{unconfirmedEmail}</span> aún no está confirmado.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResendConfirmation}
                    disabled={resending}
                    className="h-7 text-xs"
                  >
                    {resending ? "Reenviando..." : "Reenviar correo de confirmación"}
                  </Button>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Contraseña</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ingresando...
                  </>
                ) : (
                  <>
                    Iniciar Sesión
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                ¿No tienes una cuenta?{" "}
                <Link
                  href="/registro"
                  className="font-medium text-primary hover:underline underline-offset-4"
                >
                  Regístrate aquí
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
