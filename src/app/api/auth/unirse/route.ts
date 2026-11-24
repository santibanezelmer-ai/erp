import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { translateAuthError } from "@/lib/auth-errors";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const invitacionId = typeof body?.invitacionId === "string" ? body.invitacionId.trim() : "";
    const codigo = typeof body?.codigo === "string" ? body.codigo.trim().toUpperCase() : "";
    const nombre = typeof body?.nombre === "string" ? body.nombre.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if ((!invitacionId && !codigo) || !nombre || !email || !password) {
      return NextResponse.json(
        { ok: false, error: "Por favor completa todos los campos requeridos." },
        { status: 400 }
      );
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { ok: false, error: "El correo electrónico ingresado no es válido." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, error: "La contraseña debe tener al menos 6 caracteres." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ ok: false, fallbackToClientSignUp: true }, { status: 200 });
    }

    const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 1. Validar invitación vigente
    const invQuery = adminClient.from("invitaciones").select("*");
    const { data: invData, error: invErr } = invitacionId
      ? await invQuery.eq("id", invitacionId).maybeSingle()
      : await invQuery.eq("codigo", codigo).maybeSingle();

    if (invErr || !invData) {
      return NextResponse.json(
        { ok: false, error: "Código de invitación inválido o no encontrado." },
        { status: 404 }
      );
    }

    if (invData.estado !== "pendiente") {
      return NextResponse.json(
        { ok: false, error: "Esta invitación ya fue utilizada o ha expirado." },
        { status: 409 }
      );
    }

    if (invData.email && invData.email.trim().toLowerCase() !== email) {
      return NextResponse.json(
        {
          ok: false,
          error: `Esta invitación está reservada para el correo ${invData.email}.`,
        },
        { status: 403 }
      );
    }

    // 2. Crear cuenta confirmada
    const { data: userData, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nombre,
      },
    });

    if (createErr) {
      const code = (createErr as { code?: string }).code;
      const isDuplicate =
        code === "email_exists" ||
        code === "user_already_exists" ||
        /already.*registered/i.test(createErr.message || "") ||
        /already exists/i.test(createErr.message || "");

      return NextResponse.json(
        {
          ok: false,
          code: code || (isDuplicate ? "email_exists" : "auth_error"),
          error: isDuplicate
            ? "Ya existe una cuenta con este correo. Selecciona 'Ya tengo cuenta' para iniciar sesión y unirte."
            : translateAuthError(createErr.message, code),
        },
        { status: isDuplicate ? 409 : 400 }
      );
    }

    const userId = userData.user?.id;
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "No se pudo crear la cuenta del colaborador." },
        { status: 500 }
      );
    }

    // 3. Asociar rol en user_roles
    const { error: roleErr } = await adminClient.from("user_roles").insert({
      user_id: userId,
      negocio_id: invData.negocio_id,
      role: invData.role as any,
    });
    if (roleErr) {
      console.error("[POST /api/auth/unirse] Error asignando rol:", roleErr);
    }

    // 4. Actualizar perfil del usuario
    const { error: profileErr } = await adminClient
      .from("profiles")
      .upsert(
        {
          id: userId,
          email,
          nombre,
          negocio_id: invData.negocio_id,
          sucursal_id: invData.sucursal_id,
        } as any,
        { onConflict: "id" }
      );
    if (profileErr) {
      console.error("[POST /api/auth/unirse] Error actualizando perfil:", profileErr);
    }

    // 5. Marcar invitación como usada
    await adminClient
      .from("invitaciones")
      .update({
        estado: "usada",
        usada_por: userId,
        usada_at: new Date().toISOString(),
      })
      .eq("id", invData.id);

    return NextResponse.json({
      ok: true,
      autoConfirmed: true,
      role: invData.role,
      userId,
    });
  } catch (err: any) {
    console.error("[POST /api/auth/unirse] Error inesperado:", err);
    return NextResponse.json(
      { ok: false, error: translateAuthError(err?.message) },
      { status: 500 }
    );
  }
}
