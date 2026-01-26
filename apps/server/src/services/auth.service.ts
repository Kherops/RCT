import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { userRepository, tokenRepository } from '../repositories/index.js';
import { UnauthorizedError, ConflictError, ValidationError } from '../domain/errors.js';
import type { JwtPayload, AuthenticatedUser } from '../domain/types.js';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me';
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

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

export const authService = {
  async signup(data: { username: string; email: string; password: string }) {
    const existingEmail = await userRepository.findByEmail(data.email);
    if (existingEmail) {
      throw new ConflictError('Email already in use');
    }

    const existingUsername = await userRepository.findByUsername(data.username);
    if (existingUsername) {
      throw new ConflictError('Username already taken');
    }

    if (data.password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters');
    }

    const passwordHash = await argon2.hash(data.password);
    const user = await userRepository.create({
      username: data.username,
      email: data.email,
      passwordHash,
    });

    const tokens = await this.generateTokens(user.id);
    return {
      user: { id: user.id, username: user.username, email: user.email },
      ...tokens,
    };
  },

  async login(data: { email: string; password: string }) {
    const user = await userRepository.findByEmail(data.email);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const validPassword = await argon2.verify(user.passwordHash, data.password);
    if (!validPassword) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id);
    return {
      user: { id: user.id, username: user.username, email: user.email },
      ...tokens,
    };
  },

  async logout(refreshToken: string) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const token = await tokenRepository.findByHash(tokenHash);
    if (token) {
      await tokenRepository.revoke(token.id);
    }
  },

  async refreshTokens(refreshToken: string) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const storedToken = await tokenRepository.findByHash(tokenHash);

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    try {
      const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as JwtPayload;
      if (payload.type !== 'refresh') {
        throw new UnauthorizedError('Invalid token type');
      }

      await tokenRepository.revoke(storedToken.id);
      return this.generateTokens(payload.userId);
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }
  },

  async generateTokens(userId: string) {
    const accessToken = jwt.sign(
      { userId, type: 'access' } as JwtPayload,
      JWT_ACCESS_SECRET,
      { expiresIn: JWT_ACCESS_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      { userId, type: 'refresh' } as JwtPayload,
      JWT_REFRESH_SECRET,
      { expiresIn: JWT_REFRESH_EXPIRES_IN }
    );

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + parseExpiresIn(JWT_REFRESH_EXPIRES_IN));

    await tokenRepository.create({ userId, tokenHash, expiresAt });

    return { accessToken, refreshToken };
  },

  verifyAccessToken(token: string): JwtPayload {
    try {
      const payload = jwt.verify(token, JWT_ACCESS_SECRET) as JwtPayload;
      if (payload.type !== 'access') {
        throw new UnauthorizedError('Invalid token type');
      }
      return payload;
    } catch {
      throw new UnauthorizedError('Invalid access token');
    }
  },

  async getMe(userId: string): Promise<AuthenticatedUser> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }
    return { id: user.id, username: user.username, email: user.email };
  },
};
