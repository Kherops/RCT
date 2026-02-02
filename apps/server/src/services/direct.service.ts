import { directConversationRepository, directMessageRepository, userRepository } from '../repositories/index.js';
import { NotFoundError, ForbiddenError, ConflictError, BadRequestError } from '../domain/errors.js';

function sanitizeContent(content: string): string {
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, 2000);
}

export const directService = {
  async createOrGetConversation(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new BadRequestError('Cannot create a conversation with yourself');
    }

    const targetUser = await userRepository.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundError('User');
    }

    const participantKey = directConversationRepository.buildParticipantKey([userId, targetUserId]);
    const existing = await directConversationRepository.findByParticipantKey(participantKey);
    if (existing) {
      return existing;
    }

    return directConversationRepository.create([userId, targetUserId]);
  },

  async getUserConversations(userId: string) {
    return directConversationRepository.findUserConversations(userId);
  },

  async getConversationMessages(conversationId: string, userId: string, options: { limit?: number; cursor?: string }) {
    const conversation = await this.requireParticipation(conversationId, userId);

    const limit = Math.min(options.limit || 50, 100);
    const messages = await directMessageRepository.findConversationMessages(conversation.id, {
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

  async sendMessage(conversationId: string, userId: string, content?: string, gifUrl?: string, replyToMessageId?: string | null) {
    const conversation = await this.requireParticipation(conversationId, userId);

    if (replyToMessageId) {
      const replyTarget = await directMessageRepository.findById(replyToMessageId);
      if (!replyTarget || replyTarget.conversationId !== conversation.id) {
        throw new NotFoundError('Message');
      }
    }

    const sanitizedContent = content ? sanitizeContent(content) : '';
    if (!sanitizedContent.trim() && !gifUrl) {
      throw new ConflictError('Message content cannot be empty');
    }

    const message = await directMessageRepository.create({
      conversationId: conversation.id,
      authorId: userId,
      content: sanitizedContent,
      gifUrl,
      replyToMessageId: replyToMessageId ?? null,
    });

    await directConversationRepository.touch(conversation.id);

    return { conversation, message };
  },

  async deleteMessage(messageId: string, userId: string) {
    const message = await directMessageRepository.findByIdWithConversation(messageId);
    if (!message || !message.conversation) {
      throw new NotFoundError('Message');
    }

    const conversation = message.conversation;
    if (!conversation.participantIds.includes(userId)) {
      throw new ForbiddenError('You are not a participant in this conversation');
    }

    if (message.authorId !== userId) {
      throw new ForbiddenError('You can only delete your own direct messages');
    }

    await directMessageRepository.softDelete(messageId);
    await directConversationRepository.touch(conversation.id);

    return { conversationId: conversation.id, participantIds: conversation.participantIds };
  },

  async requireParticipation(conversationId: string, userId: string) {
    const conversation = await directConversationRepository.findById(conversationId);
    if (!conversation) {
      throw new NotFoundError('Conversation');
    }

    if (!conversation.participantIds.includes(userId)) {
      throw new ForbiddenError('You are not a participant in this conversation');
    }

    return conversation;
  },
};
