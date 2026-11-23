"use client";

import { createContext, useContext, useEffect, useState } from "react";
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
  isSuperAdmin: boolean;
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
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
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
        setIsSuperAdmin(false);
        setLoading(false);
        return;
      }

      setUser(authUser);

      // Consultar perfil y estado super_admin en paralelo
      const [{ data: prof }, { data: superRoleRow }, { data: isSaRpc }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", authUser.id)
          .eq("role", "super_admin")
          .maybeSingle(),
        supabase.rpc("is_super_admin", { _uid: authUser.id }),
      ]);

      setProfile(prof);

      const superAdminDetected =
        Boolean(superRoleRow) ||
        Boolean(isSaRpc) ||
        authUser.email?.toLowerCase() === "santibanez.elmer@gmail.com";

      setIsSuperAdmin(superAdminDetected);

      // Si es super_admin y no tiene un comercio propio asignado, NO enviarlo a /onboarding
      if (!prof?.negocio_id) {
        setNegocio(null);
        setSucursales([]);
        if (superAdminDetected) {
          setRol("super_admin");
          setLoading(false);
          return;
        }
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

      // Registrar ubicación de referencia de forma pasiva y silenciosa una vez por sesión
      if (typeof window !== "undefined" && !sessionStorage.getItem("operix_geo_synced")) {
        sessionStorage.setItem("operix_geo_synced", "1");
        fetch("/api/geo/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            negocioId: prof.negocio_id,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            locale: navigator.language,
          }),
        }).catch(() => {});
      }

      // Cargar sucursales del negocio
      const { data: sucs } = await supabase
        .from("sucursales")
        .select("*")
        .eq("negocio_id", prof.negocio_id)
        .order("created_at", { ascending: true });

      const sucursalList = sucs || [];
      setSucursales(sucursalList);

      // Determinar sucursal activa (preferida o primera)
      const savedSucId =
        typeof window !== "undefined" ? localStorage.getItem("operix_sucursal_id") : null;
      const initialSuc =
        sucursalList.find((s) => s.id === savedSucId) ||
        sucursalList.find((s) => s.id === (prof as any).sucursal_id) ||
        sucursalList[0] ||
        null;

      setSucursalActivaState(initialSuc);

      if (superAdminDetected) {
        setRol("super_admin");
      } else {
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
    setIsSuperAdmin(false);
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
        isSuperAdmin,
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
