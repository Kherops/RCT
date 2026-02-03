import { describe, it, expect } from '@jest/globals';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { authService } from '../services/auth.service.js';
import { tokenRepository } from '../repositories/token.repository.js';
import { getCollections } from '../lib/mongo.js';

describe('Auth service', () => {
  it('Given refresh token revoked When refreshTokens Then throws Unauthorized', async () => {
    const { refreshToken } = await authService.generateTokens('auth-user-1');
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const stored = await tokenRepository.findByHash(tokenHash);
    if (!stored) {
      throw new Error('Expected refresh token to be stored');
    }
    await tokenRepository.revoke(stored.id);

    await expect(authService.refreshTokens(refreshToken)).rejects.toThrow('Invalid refresh token');
  });

  it('Given expired stored token When refreshTokens Then throws Unauthorized', async () => {
    const { refreshToken } = await authService.generateTokens('auth-user-2');
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const stored = await tokenRepository.findByHash(tokenHash);
    if (!stored) {
      throw new Error('Expected refresh token to be stored');
    }
    const collections = await getCollections();
    await collections.refreshTokens.updateOne(
      { id: stored.id },
      { $set: { expiresAt: new Date(0) } }
    );

    await expect(authService.refreshTokens(refreshToken)).rejects.toThrow('Invalid refresh token');
  });

  it('Given access token When refreshTokens Then throws Invalid refresh token', async () => {
    const { accessToken } = await authService.generateTokens('auth-user-3');

    await expect(authService.refreshTokens(accessToken)).rejects.toThrow('Invalid refresh token');
  });

  it('Given wrong token type When verifyAccessToken Then throws Invalid token type', () => {
    const accessSecret =
      process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me';
    const wrongTypeToken = jwt.sign(
      { userId: 'auth-user-4', type: 'refresh' },
      accessSecret,
      { expiresIn: '1h' }
    );
    expect(() => authService.verifyAccessToken(wrongTypeToken)).toThrow('Invalid token type');
  });

  it('Given invalid token When verifyAccessToken Then throws Unauthorized', () => {
    expect(() => authService.verifyAccessToken('invalid-token')).toThrow('Invalid access token');
  });
});
