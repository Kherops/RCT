import { nanoid } from 'nanoid';
import { getCollections } from '../lib/mongo.js';
import { stripMongoId } from '../lib/mongo-utils.js';
import type { DirectMessage } from '../domain/types.js';

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
      users.findOne({ id: message.authorId }, { projection: { id: 1, username: 1 } }),
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
      .find({ id: { $in: authorIds } }, { projection: { id: 1, username: 1 } })
      .toArray();
    const authorMap = new Map(authorDocs.map((author) => [author.id, stripMongoId(author)]));

    return messageDocs.map((message) => ({
      ...stripMongoId(message),
      author: authorMap.get(message.authorId) || null,
    }));
  },

  async create(data: { conversationId: string; authorId: string; content: string; gifUrl?: string }) {
    const { directMessages, users } = await getCollections();
    const now = new Date();

    const message: DirectMessage = {
      id: nanoid(),
      conversationId: data.conversationId,
      authorId: data.authorId,
      content: data.content,
      gifUrl: data.gifUrl ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await directMessages.insertOne(message);

    const author = await users.findOne({ id: data.authorId }, { projection: { id: 1, username: 1 } });

    return {
      ...message,
      author: author ? stripMongoId(author) : null,
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
};
