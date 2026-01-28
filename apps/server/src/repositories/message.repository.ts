import { nanoid } from 'nanoid';
import { getCollections } from '../lib/mongo.js';
import { stripMongoId } from '../lib/mongo-utils.js';
import type { Message } from '../domain/types.js';

export const messageRepository = {
  async findById(id: string): Promise<Message | null> {
    const { messages } = await getCollections();
    const message = await messages.findOne({ id });
    return message ? stripMongoId(message) : null;
  },

  async findByIdWithAuthor(id: string) {
    const { messages, users, channels } = await getCollections();
    const message = await messages.findOne({ id });
    if (!message) {
      return null;
    }

    const [author, channel] = await Promise.all([
      users.findOne({ id: message.authorId }, { projection: { id: 1, username: 1 } }),
      channels.findOne({ id: message.channelId }, { projection: { id: 1, serverId: 1 } }),
    ]);

    return {
      ...stripMongoId(message),
      author: author ? stripMongoId(author) : null,
      channel: channel ? stripMongoId(channel) : null,
    };
  },

  async findChannelMessages(
    channelId: string,
    options: { limit: number; cursor?: string }
  ) {
    const { limit, cursor } = options;
    const { messages, users } = await getCollections();

    const filter: Record<string, unknown> = {
      channelId,
      deletedAt: null,
    };

    if (cursor) {
      const cursorMessage = await messages.findOne({ id: cursor });
      if (cursorMessage) {
        filter.$or = [
          { createdAt: { $lt: cursorMessage.createdAt } },
          { createdAt: cursorMessage.createdAt, id: { $lt: cursorMessage.id } },
        ];
      }
    }

    const messageDocs = await messages
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

  async create(data: { channelId: string; authorId: string; content: string }) {
    const { messages, users } = await getCollections();
    const now = new Date();
    const message: Message = {
      id: nanoid(),
      channelId: data.channelId,
      authorId: data.authorId,
      content: data.content,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await messages.insertOne(message);
    const author = await users.findOne({ id: data.authorId }, { projection: { id: 1, username: 1 } });

    return {
      ...message,
      author: author ? stripMongoId(author) : null,
    };
  },

  async softDelete(id: string): Promise<Message | null> {
    const { messages } = await getCollections();
    const updated = await messages.findOneAndUpdate(
      { id },
      { $set: { deletedAt: new Date(), updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!updated) {
      return null;
    }

    return stripMongoId(updated);
  },

  async hardDelete(id: string): Promise<void> {
    const { messages } = await getCollections();
    await messages.deleteOne({ id });
  },
};
