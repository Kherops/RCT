import { channelRepository } from '../repositories/index.js';
import { serverMemberRepository } from '../repositories/server.repository.js';
import { NotFoundError, ForbiddenError } from '../domain/errors.js';
import { hasPermission } from '../domain/policies.js';

export const channelService = {
  async createChannel(serverId: string, userId: string, name: string) {
    const membership = await this.requireServerMembership(serverId, userId);

    if (!hasPermission(membership.role, 'channel:create')) {
      throw new ForbiddenError('You do not have permission to create channels');
    }

    return channelRepository.create({ serverId, name });
  },

  async getServerChannels(serverId: string, userId: string) {
    await this.requireServerMembership(serverId, userId);
    return channelRepository.findServerChannels(serverId);
  },

  async getChannel(channelId: string, userId: string) {
    const channel = await channelRepository.findByIdWithServer(channelId);
    if (!channel) {
      throw new NotFoundError('Channel');
    }

    await this.requireServerMembership(channel.serverId, userId);
    return channel;
  },

  async updateChannel(channelId: string, userId: string, data: { name?: string }) {
    const channel = await channelRepository.findByIdWithServer(channelId);
    if (!channel) {
      throw new NotFoundError('Channel');
    }

    const membership = await this.requireServerMembership(channel.serverId, userId);

    if (!hasPermission(membership.role, 'channel:update')) {
      throw new ForbiddenError('You do not have permission to update channels');
    }

    return channelRepository.update(channelId, data);
  },

  async deleteChannel(channelId: string, userId: string) {
    const channel = await channelRepository.findByIdWithServer(channelId);
    if (!channel) {
      throw new NotFoundError('Channel');
    }

    const membership = await this.requireServerMembership(channel.serverId, userId);

    if (!hasPermission(membership.role, 'channel:delete')) {
      throw new ForbiddenError('You do not have permission to delete channels');
    }

    const channelCount = await channelRepository.countServerChannels(channel.serverId);
    if (channelCount <= 1) {
      throw new ForbiddenError('Cannot delete the last channel in a server');
    }

    await channelRepository.delete(channelId);
  },

  async requireServerMembership(serverId: string, userId: string) {
    const membership = await serverMemberRepository.findMembership(serverId, userId);
    if (!membership) {
      throw new ForbiddenError('You are not a member of this server');
    }
    return membership;
  },

  async getChannelServerId(channelId: string): Promise<string> {
    const channel = await channelRepository.findById(channelId);
    if (!channel) {
      throw new NotFoundError('Channel');
    }
    return channel.serverId;
  },
};
