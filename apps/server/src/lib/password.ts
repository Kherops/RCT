import * as argon2 from "argon2";

/**
 * Hache un mot de passe avec argon2
 * Argon2 est le standard moderne et le plus sécurisé pour le hashage de mots de passe
 * Résistant aux GPU/ASIC attacks et bien éprouvé (utilisé par OWASP, AWS, etc.)
 * Le hashage est l'étape critique lors de l'inscription
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

/**
 * Vérifie un mot de passe contre son hash argon2
 * Utilisé au login pour valider les credentials
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  try {
    return argon2.verify(hash, password);
  } catch {
    // En cas d'erreur de vérification, rejeter (ne jamais loguer l'erreur)
    // Évite les timing attacks et les fuites d'info
    return false;
  }
}
