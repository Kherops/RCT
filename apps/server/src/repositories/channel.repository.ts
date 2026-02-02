import { nanoid } from 'nanoid';
import { getCollections } from '../lib/mongo.js';
import { stripMongoId } from '../lib/mongo-utils.js';
import type { Channel } from '../domain/types.js';

export const channelRepository = {
  async findById(id: string): Promise<Channel | null> {
    const { channels } = await getCollections();
    const channel = await channels.findOne({ id });
    return channel ? stripMongoId(channel) : null;
  },

  async findByIdWithServer(id: string) {
    const { channels, servers } = await getCollections();
    const channel = await channels.findOne({ id });
    if (!channel) {
      return null;
    }

    const server = await servers.findOne({ id: channel.serverId });
    return {
      ...stripMongoId(channel),
      server: server ? stripMongoId(server) : null,
    };
  },

  async findServerChannels(serverId: string): Promise<Channel[]> {
    const { channels } = await getCollections();
    const results = await channels.find({ serverId }).sort({ createdAt: 1 }).toArray();
    return results.map((doc) => stripMongoId(doc));
  },

  async create(data: { serverId: string; name: string; creatorId: string; visibility?: 'PUBLIC' | 'PRIVATE' }): Promise<Channel> {
    const { channels } = await getCollections();
    const now = new Date();
    const channel: Channel = {
      id: nanoid(),
      serverId: data.serverId,
      name: data.name,
      visibility: data.visibility ?? 'PUBLIC',
      creatorId: data.creatorId,
      createdAt: now,
      updatedAt: now,
    };

    await channels.insertOne(channel);
    return channel;
  },

  async update(id: string, data: Partial<Pick<Channel, 'name'>>): Promise<Channel> {
    const { channels } = await getCollections();
    const updated = await channels.findOneAndUpdate(
      { id },
      { $set: { ...data, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!updated) {
      throw new Error('Channel not found');
    }

    return stripMongoId(updated);
  },

  async delete(id: string): Promise<void> {
    const { channels, messages, channelMembers } = await getCollections();
    await Promise.all([
      messages.deleteMany({ channelId: id }),
      channelMembers.deleteMany({ channelId: id }),
      channels.deleteOne({ id }),
    ]);
  },

  async countServerChannels(serverId: string): Promise<number> {
    const { channels } = await getCollections();
    return channels.countDocuments({ serverId });
  },
};
