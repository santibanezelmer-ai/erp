import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits recomendado para GCM

/**
 * Obtiene la clave de cifrado de 32 bytes a partir de la variable de entorno obligatoria TRIBUTARIO_ENCRYPTION_KEY.
 * No utiliza fallbacks automáticos a otras credenciales (como SUPABASE_SERVICE_ROLE_KEY) para aislar
 * la seguridad criptográfica tributaria del motor de base de datos.
 */
function getMasterKey(): Buffer {
  const secret = process.env.TRIBUTARIO_ENCRYPTION_KEY;

  if (!secret || secret.trim().length === 0) {
    throw new Error(
      "ERROR DE SEGURIDAD CRÍTICO: Falta la variable de entorno 'TRIBUTARIO_ENCRYPTION_KEY'. Debe ser configurada como un secreto independiente en el servidor."
    );
  }

  // Derivar clave de exactamente 32 bytes (256 bits) mediante SHA-256
  return crypto.createHash("sha256").update(secret.trim()).digest();
}

/**
 * Cifra un texto plano usando AES-256-GCM con autenticación de integridad (AEAD).
 * Retorna string formateado como: `enc:gcm:<iv_hex>:<tag_hex>:<ciphertext_hex>`
 */
export function cifrarDato(textoPlano: string | null | undefined): string | null {
  if (!textoPlano || typeof textoPlano !== "string" || textoPlano.trim().length === 0) {
    return null;
  }

  // Si ya viene cifrado, no volver a cifrar
  if (textoPlano.startsWith("enc:gcm:")) {
    return textoPlano;
  }

  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(textoPlano, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `enc:gcm:${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Descifra un dato cifrado con AES-256-GCM.
 * Si el dato no tiene el prefijo de cifrado (datos previos o plano), lo retorna tal cual de forma retrocompatible.
 */
export function descifrarDato(textoCifrado: string | null | undefined): string {
  if (!textoCifrado || typeof textoCifrado !== "string") {
    return "";
  }

  // Compatibilidad hacia atrás si no está cifrado con este esquema
  if (!textoCifrado.startsWith("enc:gcm:")) {
    return textoCifrado;
  }

  try {
    const parts = textoCifrado.split(":");
    // Formato: enc:gcm:<iv>:<tag>:<ciphertext>
    if (parts.length !== 5) {
      throw new Error("Formato de dato cifrado inválido");
    }

    const iv = Buffer.from(parts[2], "hex");
    const authTag = Buffer.from(parts[3], "hex");
    const encryptedText = parts[4];

    const key = getMasterKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err: any) {
    console.error("Error al descifrar dato tributario:", err.message);
    throw new Error("No se pudo descifrar el secreto tributario. Clave maestra no coincide.");
  }
}
