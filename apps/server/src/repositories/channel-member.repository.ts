import { nanoid } from 'nanoid';
import { getCollections } from '../lib/mongo.js';
import { stripMongoId } from '../lib/mongo-utils.js';
import type { ChannelMember } from '../domain/types.js';

export const channelMemberRepository = {
  async addMember(channelId: string, userId: string): Promise<ChannelMember> {
    const { channelMembers } = await getCollections();
    const member: ChannelMember = {
      id: nanoid(),
      channelId,
      userId,
      createdAt: new Date(),
    };
    await channelMembers.insertOne(member);
    return member;
  },

  async findMember(channelId: string, userId: string): Promise<ChannelMember | null> {
    const { channelMembers } = await getCollections();
    const member = await channelMembers.findOne({ channelId, userId });
    return member ? stripMongoId(member) : null;
  },

  async removeMember(channelId: string, userId: string): Promise<void> {
    const { channelMembers } = await getCollections();
    await channelMembers.deleteOne({ channelId, userId });
  },

  async removeMembersByServer(serverId: string): Promise<void> {
    const { channelMembers, channels } = await getCollections();
    const channelIds = (await channels.find({ serverId }).toArray()).map((c) => c.id);
    if (channelIds.length === 0) return;
    await channelMembers.deleteMany({ channelId: { $in: channelIds } });
  },

  async findChannelMembers(channelId: string) {
    const { channelMembers } = await getCollections();
    const members = await channelMembers.find({ channelId }).toArray();
    return members.map(stripMongoId);
  },
};
