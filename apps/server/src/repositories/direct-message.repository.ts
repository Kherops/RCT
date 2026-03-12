import { nanoid } from 'nanoid';
import { getCollections } from '../lib/mongo.js';
import { stripMongoId } from '../lib/mongo-utils.js';
import type { DirectMessage } from '../domain/types.js';

type ReplySummary = {
  id: string;
  content: string | null;
  gifUrl?: string | null;
  createdAt: Date;
  author: { id: string; username: string; avatarUrl?: string | null } | null;
  deletedAt?: Date | null;
};

async function buildReplySummaries(conversationId: string, replyIds: string[]): Promise<Map<string, ReplySummary>> {
  if (replyIds.length === 0) {
    return new Map();
  }

  const { directMessages, users } = await getCollections();
  const replyDocs = await directMessages
    .find({ id: { $in: replyIds }, conversationId })
    .toArray();

  if (replyDocs.length === 0) {
    return new Map();
  }

  const authorIds = [...new Set(replyDocs.map((message) => message.authorId))];
  const authorDocs = await users
    .find(
      { id: { $in: authorIds } },
      { projection: { id: 1, username: 1, avatarUrl: 1 } }
    )
    .toArray();
  const authorMap = new Map(authorDocs.map((author) => [author.id, stripMongoId(author)]));

  return new Map(
    replyDocs.map((message) => {
      const deletedAt = message.deletedAt ?? null;
      return [
        message.id,
        {
          id: message.id,
          content: deletedAt ? '' : message.content,
          gifUrl: deletedAt ? null : message.gifUrl ?? null,
          createdAt: message.createdAt,
          author: authorMap.get(message.authorId) || null,
          deletedAt,
        },
      ];
    })
  );
}

export const directMessageRepository = {
  async findById(id: string): Promise<DirectMessage | null> {
    const { directMessages } = await getCollections();
    const message = await directMessages.findOne({ id });
    return message ? stripMongoId(message) : null;
  },

  async findByIdWithConversation(id: string) {
    const { directMessages, directConversations, users } = await getCollections();
    const message = await directMessages.findOne({ id });
    if (!message) {
      return null;
    }

    const [conversation, author] = await Promise.all([
      directConversations.findOne({ id: message.conversationId }),
      users.findOne(
        { id: message.authorId },
        { projection: { id: 1, username: 1, avatarUrl: 1 } }
      ),
    ]);

    return {
      ...stripMongoId(message),
      conversation: conversation ? stripMongoId(conversation) : null,
      author: author ? stripMongoId(author) : null,
    };
  },

  async findConversationMessages(conversationId: string, options: { limit: number; cursor?: string }) {
    const { limit, cursor } = options;
    const { directMessages, users } = await getCollections();

    const filter: Record<string, unknown> = {
      conversationId,
      deletedAt: null,
    };

    if (cursor) {
      const cursorMessage = await directMessages.findOne({ id: cursor });
      if (cursorMessage) {
        filter.$or = [
          { createdAt: { $lt: cursorMessage.createdAt } },
          { createdAt: cursorMessage.createdAt, id: { $lt: cursorMessage.id } },
        ];
      }
    }

    const messageDocs = await directMessages
      .find(filter)
      .sort({ createdAt: -1, id: -1 })
      .limit(limit + 1)
      .toArray();

    const authorIds = [...new Set(messageDocs.map((message) => message.authorId))];
    const authorDocs = await users
      .find(
        { id: { $in: authorIds } },
        { projection: { id: 1, username: 1, avatarUrl: 1 } }
      )
      .toArray();
    const authorMap = new Map(authorDocs.map((author) => [author.id, stripMongoId(author)]));

    const replyIds = [...new Set(messageDocs.map((message) => message.replyToMessageId).filter(Boolean))] as string[];
    const replyMap = await buildReplySummaries(conversationId, replyIds);

    return messageDocs.map((message) => ({
      ...stripMongoId(message),
      author: authorMap.get(message.authorId) || null,
      replyTo: message.replyToMessageId ? replyMap.get(message.replyToMessageId) || null : null,
    }));
  },

  async findLatestVisibleMessage(conversationId: string): Promise<{ id: string; createdAt: Date } | null> {
    const { directMessages } = await getCollections();
    const latestMessage = await directMessages
      .find({ conversationId, deletedAt: null })
      .sort({ createdAt: -1, id: -1 })
      .limit(1)
      .next();

    if (!latestMessage) {
      return null;
    }

    return {
      id: latestMessage.id,
      createdAt: latestMessage.createdAt,
    };
  },

  async create(data: { conversationId: string; authorId: string; content: string; gifUrl?: string; replyToMessageId?: string | null }) {
    const { directMessages, users } = await getCollections();
    const now = new Date();

    const message: DirectMessage = {
      id: nanoid(),
      conversationId: data.conversationId,
      authorId: data.authorId,
      content: data.content,
      gifUrl: data.gifUrl ?? null,
      replyToMessageId: data.replyToMessageId ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await directMessages.insertOne(message);

    const author = await users.findOne(
      { id: data.authorId },
      { projection: { id: 1, username: 1, avatarUrl: 1 } }
    );
    const replyMap = data.replyToMessageId
      ? await buildReplySummaries(data.conversationId, [data.replyToMessageId])
      : new Map<string, ReplySummary>();
    const replyTo = data.replyToMessageId ? replyMap.get(data.replyToMessageId) || null : null;

    return {
      ...message,
      author: author ? stripMongoId(author) : null,
      replyTo,
    };
  },

  async softDelete(id: string): Promise<DirectMessage | null> {
    const { directMessages } = await getCollections();
    const updated = await directMessages.findOneAndUpdate(
      { id },
      { $set: { deletedAt: new Date(), updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!updated) {
      return null;
    }

    return stripMongoId(updated);
  },

  async toggleReaction(messageId: string, userId: string, emoji: string): Promise<DirectMessage | null> {
    const { directMessages } = await getCollections();
    const message = await directMessages.findOne({ id: messageId });
    if (!message) return null;

    const currentReactions = message.reactions || {};
    const userIds = currentReactions[emoji] || [];
    const hasReacted = userIds.includes(userId);

    let update;
    if (hasReacted) {
      const nextUserIds = userIds.filter((id: string) => id !== userId);
      if (nextUserIds.length === 0) {
        update = { $unset: { [`reactions.${emoji}`]: "" as any } };
      } else {
        update = { $set: { [`reactions.${emoji}`]: nextUserIds } };
      }
    } else {
      update = { $addToSet: { [`reactions.${emoji}`]: userId } };
    }

    const updated = await directMessages.findOneAndUpdate(
      { id: messageId },
      update,
      { returnDocument: 'after' }
    );

    return updated ? stripMongoId(updated) : null;
  },
};
