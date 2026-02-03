import { nanoid } from "nanoid";
import { getCollections } from "../lib/mongo.js";
import { stripMongoId } from "../lib/mongo-utils.js";
import type { BanType, ServerBan } from "../domain/types.js";

export const serverBanRepository = {
  async findByServerAndUser(
    serverId: string,
    userId: string,
  ): Promise<ServerBan | null> {
    const { serverBans } = await getCollections();
    const ban = await serverBans.findOne({ serverId, userId });
    return ban ? stripMongoId(ban) : null;
  },

  async upsert(data: {
    serverId: string;
    userId: string;
    createdById: string;
    type: BanType;
    reason?: string | null;
    expiresAt?: Date | null;
  }): Promise<ServerBan> {
    const { serverBans } = await getCollections();
    const existing = await serverBans.findOne({
      serverId: data.serverId,
      userId: data.userId,
    });
    const now = new Date();
    const ban: ServerBan = {
      id: existing?.id ?? nanoid(),
      serverId: data.serverId,
      userId: data.userId,
      createdById: data.createdById,
      type: data.type,
      reason: data.reason ?? null,
      createdAt: now,
      expiresAt: data.expiresAt ?? null,
    };

    if (existing) {
      await serverBans.updateOne({ id: existing.id }, { $set: ban });
      return ban;
    }

    await serverBans.insertOne(ban);
    return ban;
  },

  async deleteByServerAndUser(serverId: string, userId: string): Promise<void> {
    const { serverBans } = await getCollections();
    await serverBans.deleteOne({ serverId, userId });
  },

  async deleteById(id: string): Promise<void> {
    const { serverBans } = await getCollections();
    await serverBans.deleteOne({ id });
  },
};
