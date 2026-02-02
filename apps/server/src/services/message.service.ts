import { messageRepository, channelRepository } from '../repositories/index.js';
import { serverMemberRepository } from '../repositories/server.repository.js';
import { NotFoundError, ForbiddenError } from '../domain/errors.js';
import { hasPermission } from '../domain/policies.js';

export const messageService = {
  async sendMessage(channelId: string, userId: string, content?: string, gifUrl?: string) {
    const channel = await channelRepository.findByIdWithServer(channelId);
    if (!channel) {
      throw new NotFoundError('Channel');
    }

    await this.requireServerMembership(channel.serverId, userId);

    const sanitizedContent = content ? this.sanitizeContent(content) : '';
    if (!sanitizedContent.trim() && !gifUrl) {
      throw new ForbiddenError('Message content cannot be empty');
    }

    return messageRepository.create({
      channelId,
      authorId: userId,
      content: sanitizedContent,
      gifUrl,
    });
  },

  async getChannelMessages(channelId: string, userId: string, options: { limit?: number; cursor?: string }) {
    const channel = await channelRepository.findByIdWithServer(channelId);
    if (!channel) {
      throw new NotFoundError('Channel');
    }

    await this.requireServerMembership(channel.serverId, userId);

    const limit = Math.min(options.limit || 50, 100);
    const messages = await messageRepository.findChannelMessages(channelId, {
      limit,
      cursor: options.cursor,
    });

    const hasMore = messages.length > limit;
    const data = hasMore ? messages.slice(0, -1) : messages;

    return {
      data,
      nextCursor: hasMore ? data[data.length - 1]?.id : null,
      hasMore,
    };
  },

  async deleteMessage(messageId: string, userId: string) {
    const message = await messageRepository.findByIdWithAuthor(messageId);
    if (!message) {
      throw new NotFoundError('Message');
    }
    if (!message.channel) {
      throw new NotFoundError('Channel');
    }

    const membership = await this.requireServerMembership(message.channel.serverId, userId);

    const isAuthor = message.authorId === userId;
    const canDeleteOthers = hasPermission(membership.role, 'message:delete_others');

    if (!isAuthor && !canDeleteOthers) {
      throw new ForbiddenError('You do not have permission to delete this message');
    }

    const deleted = await messageRepository.softDelete(messageId);
    if (!deleted) {
      return { channelId: message.channelId, serverId: message.channel.serverId };
    }
    return { channelId: message.channelId, serverId: message.channel.serverId };
  },

  async updateMessage(messageId: string, userId: string, content: string) {
    const message = await messageRepository.findByIdWithAuthor(messageId);
    if (!message) {
      throw new NotFoundError('Message');
    }
    if (!message.channel) {
      throw new NotFoundError('Channel');
    }
    if (message.deletedAt) {
      throw new ForbiddenError('Cannot edit a deleted message');
    }

    await this.requireServerMembership(message.channel.serverId, userId);

    if (message.authorId !== userId) {
      throw new ForbiddenError('You can only edit your own messages');
    }

    const sanitizedContent = this.sanitizeContent(content);
    if (!sanitizedContent.trim()) {
      throw new ForbiddenError('Message content cannot be empty');
    }

    const updated = await messageRepository.updateContent(messageId, sanitizedContent);
    if (!updated) {
      throw new NotFoundError('Message');
    }

    return {
      message: {
        ...updated,
        author: message.author ?? null,
      },
      channelId: message.channelId,
    };
  },

  async requireServerMembership(serverId: string, userId: string) {
    const membership = await serverMemberRepository.findMembership(serverId, userId);
    if (!membership) {
      throw new ForbiddenError('You are not a member of this server');
    }
    return membership;
  },

  sanitizeContent(content: string): string {
    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim()
      .slice(0, 2000);
  },
};
