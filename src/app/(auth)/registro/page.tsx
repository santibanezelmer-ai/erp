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
import { Store, UtensilsCrossed, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [nombre, setNombre] = useState("");
  const [negocio, setNegocio] = useState("");
  const [tipo, setTipo] = useState<"tienda" | "restaurant">("tienda");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !negocio || !email || !password) {
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
      // 1. Crear el usuario en Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nombre,
          },
        },
      });

      if (error) {
        toast.error(error.message || "Error al crear la cuenta");
        return;
      }

      if (data.session) {
        // 2. Crear negocio para el usuario automáticamente
        const slug = slugify(negocio) || `n-${Date.now()}`;
        const { error: rpcErr } = await (supabase.rpc as any)("create_negocio_for_user", {
          _nombre: negocio,
          _slug: slug,
          _tipo: tipo,
        });

        if (rpcErr) {
          console.error("Error creating business:", rpcErr);
          // Redirigir a onboarding para completar manualmente
          router.push("/onboarding");
          return;
        }

        toast.success("¡Cuenta y negocio creados exitosamente!");
        router.push("/dashboard");
        router.refresh();
      } else {
        toast.success("Cuenta creada. Por favor revisa tu correo electrónico para verificar tu cuenta.");
        router.push("/login");
      }
    } catch (err: any) {
      toast.error(err.message || "Ocurrió un error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-md">
            <Store className="h-5 w-5" />
          </div>
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
