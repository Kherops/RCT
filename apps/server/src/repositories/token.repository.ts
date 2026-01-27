import { nanoid } from 'nanoid';
import { getCollections } from '../lib/mongo.js';
import { stripMongoId } from '../lib/mongo-utils.js';
import type { RefreshToken } from '../domain/types.js';

export const tokenRepository = {
  async create(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    const { refreshTokens } = await getCollections();
    const token: RefreshToken = {
      id: nanoid(),
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      revokedAt: null,
      createdAt: new Date(),
    };

    await refreshTokens.insertOne(token);
    return token;
  },

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    const { refreshTokens } = await getCollections();
    const token = await refreshTokens.findOne({ tokenHash });
    return token ? stripMongoId(token) : null;
  },

  async revoke(id: string): Promise<RefreshToken | null> {
    const { refreshTokens } = await getCollections();
    const result = await refreshTokens.findOneAndUpdate(
      { id },
      { $set: { revokedAt: new Date() } },
      { returnDocument: 'after' }
    );

    return result.value ? stripMongoId(result.value) : null;
  },

  async revokeAllForUser(userId: string): Promise<void> {
    const { refreshTokens } = await getCollections();
    await refreshTokens.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
  },

  async deleteExpired(): Promise<void> {
    const { refreshTokens } = await getCollections();
    await refreshTokens.deleteMany({ expiresAt: { $lt: new Date() } });
  },
};
