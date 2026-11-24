export function translateAuthError(message?: string | null, code?: string | null): string {
  const msg = (message || "").toLowerCase();
  const errCode = (code || "").toLowerCase();

  if (
    errCode === "invalid_credentials" ||
    msg.includes("invalid login credentials") ||
    msg.includes("invalid credentials")
  ) {
    return "Correo o contraseña incorrectos. Verifica tus datos o crea una cuenta nueva.";
  }

  if (errCode === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return "Tu correo electrónico aún no ha sido confirmado. Revisa tu bandeja de entrada o carpeta de spam.";
  }

  if (
    errCode === "user_already_exists" ||
    errCode === "email_exists" ||
    msg.includes("already been registered") ||
    msg.includes("already registered") ||
    msg.includes("user already exists")
  ) {
    return "Ya existe una cuenta registrada con este correo electrónico. Intenta iniciar sesión o usa otro correo.";
  }

  if (
    errCode === "weak_password" ||
    msg.includes("at least 6 characters") ||
    msg.includes("password should be")
  ) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }

  if (
    errCode === "email_address_invalid" ||
    msg.includes("unable to validate email") ||
    msg.includes("invalid format") ||
    (msg.includes("email") && msg.includes("invalid"))
  ) {
    return "El correo electrónico ingresado no es válido.";
  }

  if (
    errCode === "over_email_send_rate_limit" ||
    errCode === "over_request_rate_limit" ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("for security purposes")
  ) {
    return "Has realizado demasiados intentos. Espera unos minutos e inténtalo nuevamente.";
  }

  if (errCode === "signup_disabled" || msg.includes("signups not allowed")) {
    return "El registro de nuevas cuentas está deshabilitado temporalmente.";
  }

  return message || "Ocurrió un error de autenticación. Inténtalo nuevamente.";
}
