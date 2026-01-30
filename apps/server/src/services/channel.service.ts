<<<<<<< HEAD
import { channelRepository } from '../repositories/index.js';
import { serverMemberRepository } from '../repositories/server.repository.js';
import { NotFoundError, ForbiddenError } from '../domain/errors.js';
=======
import { channelRepository, serverRepository, channelMemberRepository } from '../repositories/index.js';
import { serverMemberRepository } from '../repositories/server.repository.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../domain/errors.js';
>>>>>>> FEATURE/47-member-leave-server-or-channel
import { hasPermission } from '../domain/policies.js';
import type { Channel } from '../domain/types.js';

export const channelService = {
  async createChannel(serverId: string, userId: string, name: string, visibility: Channel['visibility'] = 'PUBLIC') {
<<<<<<< HEAD
    const membership = await this.requireServerMembership(serverId, userId);

    if (!hasPermission(membership.role, 'channel:create')) {
      throw new ForbiddenError('You do not have permission to create channels');
    }

    return channelRepository.create({ serverId, name, creatorId: userId, visibility });
=======
    if (!name?.trim()) {
      throw new BadRequestError('NAME_REQUIRED');
    }

    const server = await serverRepository.findById(serverId);
    if (!server) {
      throw new NotFoundError('Server');
    }

    const isOwner = server.ownerId === userId;
    const membership = await serverMemberRepository.findMembership(serverId, userId);
    const isMember = isOwner || !!membership;

    if (!isMember) {
      throw new ForbiddenError('NOT_MEMBER');
    }

    const normalizedVisibility = visibility === 'PRIVATE' ? 'PRIVATE' : visibility === 'PUBLIC' ? 'PUBLIC' : null;
    if (!normalizedVisibility) {
      throw new BadRequestError('INVALID_VISIBILITY');
    }

    if (normalizedVisibility === 'PUBLIC' && !isOwner) {
      throw new ForbiddenError('ONLY_OWNER_CAN_CREATE_PUBLIC');
    }

    // Legacy permission: keep owner/admin ability for public; private allowed for any member
    if (normalizedVisibility === 'PUBLIC' && isOwner) {
      // ok
    } else if (normalizedVisibility === 'PRIVATE') {
      // ok
    } else if (membership && !hasPermission(membership.role, 'channel:create')) {
      throw new ForbiddenError('You do not have permission to create channels');
    }

    const channel = await channelRepository.create({ serverId, name, creatorId: userId, visibility: normalizedVisibility });

    if (normalizedVisibility === 'PRIVATE') {
      await channelMemberRepository.addMember(channel.id, userId);
    }

    return channel;
>>>>>>> FEATURE/47-member-leave-server-or-channel
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
