"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Store, UtensilsCrossed, Loader2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<"tienda" | "restaurant">("tienda");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre) {
      toast.error("Ingresa el nombre de tu negocio");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      const slug = slugify(nombre) || `negocio-${Date.now()}`;
      const { data, error } = await (supabase.rpc as any)("create_negocio_for_user", {
        _nombre: nombre,
        _slug: slug,
        _tipo: tipo,
      });

      if (error) {
        toast.error(error.message || "Error al configurar el negocio");
        return;
      }

      toast.success("¡Tu negocio está listo!");
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Ocurrió un error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-md">
            <Store className="h-5 w-5" />
          </div>
          <span className="font-bold text-2xl tracking-tight">Operix ERP</span>
        </div>

        <Card className="shadow-lg border-muted/60">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Configura tu Negocio</CardTitle>
            <CardDescription>
              Solo un paso más para empezar a vender y controlar tu inventario.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre de tu Empresa / Local</Label>
                <Input
                  id="nombre"
                  placeholder="Ej: Distribuidora Central o Café París"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label>Modalidad</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTipo("tienda")}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-lg border text-center transition-all",
                      tipo === "tienda"
                        ? "border-primary bg-primary/10 text-primary font-medium ring-1 ring-primary"
                        : "border-border hover:bg-muted/50 text-muted-foreground"
                    )}
                  >
                    <Store className="h-6 w-6" />
                    <span className="text-sm font-semibold">Comercio / Tienda</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTipo("restaurant")}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-lg border text-center transition-all",
                      tipo === "restaurant"
                        ? "border-primary bg-primary/10 text-primary font-medium ring-1 ring-primary"
                        : "border-border hover:bg-muted/50 text-muted-foreground"
                    )}
                  >
                    <UtensilsCrossed className="h-6 w-6" />
                    <span className="text-sm font-semibold">Restaurante / Bar</span>
                  </button>
                </div>
              </div>
            </CardContent>

            <CardFooter>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando negocio...
                  </>
                ) : (
                  <>
                    Comenzar ahora
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
