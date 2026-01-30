import jwt, { type SignOptions } from "jsonwebtoken";
import crypto from "crypto";
import { userRepository, tokenRepository } from "../repositories/index.js";
import {
  UnauthorizedError,
  ConflictError,
  ValidationError,
} from "../domain/errors.js";
import type {
  JwtPayload,
  AuthenticatedUser,
  UserPublic,
} from "../domain/types.js";
import { hashPassword, verifyPassword } from "../lib/password.js";

const JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || "dev-access-secret-change-me";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "dev-refresh-secret-change-me";
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) return 15 * 60 * 1000;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return value * multipliers[unit];
}

/**
 * Convertit un User (contenant le hash) en UserPublic (sans le hash)
 * Utilisé pour tous les retours API afin d'éviter les fuites
 */
function toPublicUser(user: {
  id: string;
  username: string;
  email: string;
  bio?: string | null;
  avatarUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}): UserPublic {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    bio: user.bio ?? "",
    avatarUrl: user.avatarUrl ?? "",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export const authService = {
  async signup(data: { username: string; email: string; password: string }) {
    const existingEmail = await userRepository.findByEmail(data.email);
    if (existingEmail) {
      throw new ConflictError("Email already in use");
    }

    const existingUsername = await userRepository.findByUsername(data.username);
    if (existingUsername) {
      throw new ConflictError("Username already taken");
    }

    if (data.password.length < 8) {
      throw new ValidationError("Password must be at least 8 characters");
    }

    // Hashage du mot de passe : étape critique de sécurité
    // Ne jamais stocker en clair, utiliser hashPassword() qui supporte argon2 et bcrypt
    const passwordHash = await hashPassword(data.password);
    const user = await userRepository.create({
      username: data.username,
      email: data.email,
      passwordHash,
    });

    const tokens = await this.generateTokens(user.id);
    return {
      user: toPublicUser(user),
      ...tokens,
    };
  },

  async login(data: { email: string; password: string }) {
    const user = await userRepository.findByEmail(data.email);
    if (!user) {
      // Message d'erreur générique pour éviter l'énumération d'emails
      throw new UnauthorizedError("Invalid credentials");
    }

    // Vérification du mot de passe : utilise le bon algo selon le hash en BD
    // verifyPassword() détecte automatiquement argon2 vs bcrypt
    const validPassword = await verifyPassword(
      data.password,
      user.passwordHash,
    );
    if (!validPassword) {
      throw new UnauthorizedError("Invalid credentials");
    }

    const tokens = await this.generateTokens(user.id);
    return {
      user: toPublicUser(user),
      ...tokens,
    };
  },

  async logout(refreshToken: string) {
    try {
      const tokenHash = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex");
      const token = await tokenRepository.findByHash(tokenHash);
      if (token && !token.revokedAt) {
        await tokenRepository.revoke(token.id);
      }
    } catch {
      // Silently ignore errors - logout should always succeed
    }
  },

  async refreshTokens(refreshToken: string) {
    const tokenHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");
    const storedToken = await tokenRepository.findByHash(tokenHash);

    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt < new Date()
    ) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    try {
      const payload = jwt.verify(
        refreshToken,
        JWT_REFRESH_SECRET as string,
      ) as JwtPayload;
      if (payload.type !== "refresh") {
        throw new UnauthorizedError("Invalid token type");
      }

      await tokenRepository.revoke(storedToken.id);
      return this.generateTokens(payload.userId);
    } catch {
      throw new UnauthorizedError("Invalid refresh token");
    }
  },

  async generateTokens(userId: string) {
    const accessToken = jwt.sign(
      { userId, type: "access" } as JwtPayload,
      JWT_ACCESS_SECRET as string,
      { expiresIn: JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"] },
    );

    const refreshToken = jwt.sign(
      { userId, type: "refresh" } as JwtPayload,
      JWT_REFRESH_SECRET as string,
      { expiresIn: JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"] },
    );

    const tokenHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");
    const expiresAt = new Date(
      Date.now() + parseExpiresIn(JWT_REFRESH_EXPIRES_IN),
    );

    await tokenRepository.create({ userId, tokenHash, expiresAt });

    return { accessToken, refreshToken };
  },

  verifyAccessToken(token: string): JwtPayload {
    try {
      const payload = jwt.verify(
        token,
        JWT_ACCESS_SECRET as string,
      ) as JwtPayload;
      if (payload.type !== "access") {
        throw new UnauthorizedError("Invalid token type");
      }
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }
      throw new UnauthorizedError("Invalid access token");
    }
  },

  async getMe(userId: string): Promise<AuthenticatedUser> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError("User not found");
    }
    // Retourner seulement les données publiques, jamais le passwordHash
    return { id: user.id, username: user.username, email: user.email, bio: user.bio ?? "", avatarUrl: user.avatarUrl ?? "" };
  },
};
