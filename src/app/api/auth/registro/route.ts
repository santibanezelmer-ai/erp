import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { translateAuthError } from "@/lib/auth-errors";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const nombre = typeof body?.nombre === "string" ? body.nombre.trim() : "";
    const negocio = typeof body?.negocio === "string" ? body.negocio.trim() : "";
    const tipo = body?.tipo === "restaurant" ? "restaurant" : "tienda";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!nombre || !negocio || !email || !password) {
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

    // Si no hay service role key configurada en el entorno (ej. desarrollo local),
    // delegar al flujo estándar de signUp en cliente.
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ ok: false, fallbackToClientSignUp: true }, { status: 200 });
    }

    const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nombre,
        negocio_pendiente: negocio,
        tipo_negocio_pendiente: tipo,
      },
    });

    if (error) {
      const code = (error as { code?: string }).code;
      const isDuplicate =
        code === "email_exists" ||
        code === "user_already_exists" ||
        /already.*registered/i.test(error.message || "") ||
        /already exists/i.test(error.message || "");

      return NextResponse.json(
        {
          ok: false,
          code: code || (isDuplicate ? "email_exists" : "auth_error"),
          error: translateAuthError(error.message, code),
        },
        { status: isDuplicate ? 409 : 400 }
      );
    }

    if (!data.user) {
      return NextResponse.json(
        { ok: false, error: "No se pudo crear la cuenta. Inténtalo nuevamente." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      autoConfirmed: true,
      userId: data.user.id,
    });
  } catch (err: any) {
    console.error("[POST /api/auth/registro] Error inesperado:", err);
    return NextResponse.json(
      { ok: false, error: translateAuthError(err?.message) },
      { status: 500 }
    );
  }
}
