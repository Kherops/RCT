import { nanoid } from "nanoid";
import { getCollections } from "../lib/mongo.js";
import { stripMongoId } from "../lib/mongo-utils.js";
import type { UserBlock } from "../domain/types.js";

export const userBlockRepository = {
  async findByBlocker(
    blockerId: string,
    blockedId: string,
    serverId: string,
  ): Promise<UserBlock | null> {
    const { userBlocks } = await getCollections();
    const block = await userBlocks.findOne({ blockerId, blockedId, serverId });
    return block ? stripMongoId(block) : null;
  },

  async listBlockedIds(blockerId: string, serverId: string): Promise<string[]> {
    const { userBlocks } = await getCollections();
    const blocks = await userBlocks
      .find({ blockerId, serverId }, { projection: { blockedId: 1 } })
      .toArray();
    return blocks.map((block) => block.blockedId);
  },

  async listBlocks(blockerId: string, serverId: string): Promise<UserBlock[]> {
    const { userBlocks } = await getCollections();
    const blocks = await userBlocks
      .find({ blockerId, serverId })
      .sort({ createdAt: -1 })
      .toArray();
    return blocks.map((block) => stripMongoId(block));
  },

  async createIfMissing(
    blockerId: string,
    blockedId: string,
    serverId: string,
  ): Promise<{ block: UserBlock; created: boolean }> {
    const existing = await this.findByBlocker(blockerId, blockedId, serverId);
    if (existing) {
      return { block: existing, created: false };
    }

    const { userBlocks } = await getCollections();
    const now = new Date();
    const block: UserBlock = {
      id: nanoid(),
      blockerId,
      blockedId,
      serverId,
      createdAt: now,
    };

    await userBlocks.insertOne(block);
    return { block, created: true };
  },

  async delete(blockerId: string, blockedId: string, serverId: string) {
    const { userBlocks } = await getCollections();
    await userBlocks.deleteOne({ blockerId, blockedId, serverId });
  },
};
