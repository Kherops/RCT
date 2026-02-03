import {
  directConversationRepository,
  directMessageRepository,
  userBlockRepository,
  userRepository,
} from '../repositories/index.js';
import { NotFoundError, ForbiddenError, ConflictError, BadRequestError } from '../domain/errors.js';

type ReplySummary = {
  id: string;
  content: string | null;
  gifUrl?: string | null;
  createdAt: Date;
  author: { id: string; username: string; avatarUrl?: string | null } | null;
  deletedAt?: Date | null;
  masked?: boolean;
};

function maskReplySummary(replyTo: ReplySummary | null, blockedIds: Set<string>) {
  if (!replyTo?.author?.id) {
    return replyTo;
  }
  if (!blockedIds.has(replyTo.author.id)) {
    return replyTo;
  }
  return {
    ...replyTo,
    content: null,
    gifUrl: null,
    masked: true,
  };
}

function maskDirectMessage<T extends { authorId: string; content: string; gifUrl?: string | null; replyTo?: ReplySummary | null }>(
  message: T,
  blockedIds: Set<string>,
): T & { content: string | null; gifUrl?: string | null; masked?: boolean; replyTo?: ReplySummary | null } {
  const replyTo = maskReplySummary(message.replyTo ?? null, blockedIds);
  if (!blockedIds.has(message.authorId)) {
    return { ...message, replyTo };
  }
  return {
    ...message,
    content: null,
    gifUrl: null,
    masked: true,
    replyTo,
  };
}

function maskConversationPreview(
  convo: {
    lastMessage?: { id: string; content: string; gifUrl?: string | null; createdAt: Date; authorId: string } | null;
  },
  blockedIds: Set<string>,
) {
  if (!convo.lastMessage || !blockedIds.has(convo.lastMessage.authorId)) {
    return convo;
  }
  return {
    ...convo,
    lastMessage: {
      ...convo.lastMessage,
      content: null,
      gifUrl: null,
    },
  };
}

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

  async getUserConversations(userId: string, serverId?: string) {
    const conversations = await directConversationRepository.findUserConversations(userId);
    if (!serverId) {
      return conversations;
    }
    const blockedIds = await userBlockRepository.listBlockedIds(userId, serverId);
    const blockedSet = new Set(blockedIds);
    return conversations.map((convo) => maskConversationPreview(convo, blockedSet));
  },

  async getConversationMessages(
    conversationId: string,
    userId: string,
    options: { limit?: number; cursor?: string; serverId?: string },
  ) {
    const conversation = await this.requireParticipation(conversationId, userId);

    const limit = Math.min(options.limit || 50, 100);
    const messages = await directMessageRepository.findConversationMessages(conversation.id, {
      limit,
      cursor: options.cursor,
    });

    const hasMore = messages.length > limit;
    const data = hasMore ? messages.slice(0, -1) : messages;
    const blockedIds = options.serverId
      ? await userBlockRepository.listBlockedIds(userId, options.serverId)
      : [];
    const blockedSet = new Set(blockedIds);

    return {
      data: data.map((message) => maskDirectMessage(message, blockedSet)),
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
