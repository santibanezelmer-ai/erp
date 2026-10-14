"use client";

import { createContext, useContext, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";

type Negocio = Database["public"]["Tables"]["negocios"]["Row"];
type Sucursal = Database["public"]["Tables"]["sucursales"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface TenantContextType {
  user: any | null;
  profile: Profile | null;
  negocio: Negocio | null;
  sucursales: Sucursal[];
  sucursalActiva: Sucursal | null;
  setSucursalActiva: (s: Sucursal) => void;
  rol: string;
  loading: boolean;
  logout: () => Promise<void>;
  reloadTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursalActiva, setSucursalActivaState] = useState<Sucursal | null>(null);
  const [rol, setRol] = useState<string>("admin");
  const [loading, setLoading] = useState(true);

  const loadTenant = async () => {
    const supabase = createClient();
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        setUser(null);
        setProfile(null);
        setNegocio(null);
        setSucursales([]);
        setLoading(false);
        return;
      }

      setUser(authUser);

      // Cargar profile
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();

      setProfile(prof);

      if (!prof?.negocio_id) {
        setNegocio(null);
        setSucursales([]);
        setLoading(false);
        router.push("/onboarding");
        return;
      }

      // Cargar negocio
      const { data: neg } = await supabase
        .from("negocios")
        .select("*")
        .eq("id", prof.negocio_id)
        .maybeSingle();

      setNegocio(neg);

      // Cargar sucursales del negocio
      const { data: sucs } = await supabase
        .from("sucursales")
        .select("*")
        .eq("negocio_id", prof.negocio_id)
        .order("created_at", { ascending: true });

      const sucursalList = sucs || [];
      setSucursales(sucursalList);

      // Determinar sucursal activa (preferida o primera)
      const savedSucId = typeof window !== "undefined" ? localStorage.getItem("operix_sucursal_id") : null;
      const initialSuc =
        sucursalList.find((s) => s.id === savedSucId) ||
        sucursalList.find((s) => s.id === (prof as any).sucursal_id) ||
        sucursalList[0] ||
        null;

      setSucursalActivaState(initialSuc);

      // Cargar rol del usuario en este negocio
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authUser.id)
        .eq("negocio_id", prof.negocio_id)
        .maybeSingle();

      if (roleRow?.role) {
        setRol(roleRow.role);
      }
    } catch (err) {
      console.error("Error loading tenant:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenant();
  }, []);

  const setSucursalActiva = (s: Sucursal) => {
    setSucursalActivaState(s);
    if (typeof window !== "undefined") {
      localStorage.setItem("operix_sucursal_id", s.id);
    }
  };

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setNegocio(null);
    router.push("/login");
    router.refresh();
  };

  return (
    <TenantContext.Provider
      value={{
        user,
        profile,
        negocio,
        sucursales,
        sucursalActiva,
        setSucursalActiva,
        rol,
        loading,
        logout,
        reloadTenant: loadTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}
