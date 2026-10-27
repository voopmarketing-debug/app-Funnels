/**
 * The rule for a NEW password (sign-up, reset, change, an invited teammate).
 * Existing passwords keep working until their owner changes them.
 *  - at least 10 characters;
 *  - at most 72 bytes: bcrypt ignores everything after that, so a longer one
 *    would be silently weaker than it looks;
 *  - not an obvious one (a short list of the most used, or one repeated character).
 */
export const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_BYTES = 72;

const COMMON = new Set([
  "1234567890", "12345678910", "0123456789", "0987654321", "qwertyuiop", "qwerty12345", "asdfghjkl1", "password12", "password123", "password1234", "contrasena1", "contrasena12",
  "contrasena123", "contraseña123", "1q2w3e4r5t", "abcdefghij", "abc1234567", "iloveyou12", "colombia123", "funnelslabs", "funnelslabs1",
]);

/** The message to show when the password is not acceptable, or null when it is. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`;
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) return "La contraseña es demasiado larga (máximo 72 caracteres)";
  if (/^(.)\1+$/.test(password) || COMMON.has(password.toLowerCase())) return "Esa contraseña es muy fácil de adivinar. Elige otra.";
  return null;
}
