import { nanoid } from 'nanoid';
import { getCollections } from '../lib/mongo.js';
import { stripMongoId } from '../lib/mongo-utils.js';
import type { Message } from '../domain/types.js';

type ReplySummary = {
  id: string;
  content: string;
  gifUrl?: string | null;
  createdAt: Date;
  author: { id: string; username: string } | null;
  deletedAt?: Date | null;
};

async function buildReplySummaries(channelId: string, replyIds: string[]): Promise<Map<string, ReplySummary>> {
  if (replyIds.length === 0) {
    return new Map();
  }

  const { messages, users } = await getCollections();
  const replyDocs = await messages
    .find({ id: { $in: replyIds }, channelId })
    .toArray();

  if (replyDocs.length === 0) {
    return new Map();
  }

  const authorIds = [...new Set(replyDocs.map((message) => message.authorId))];
  const authorDocs = await users
    .find({ id: { $in: authorIds } }, { projection: { id: 1, username: 1 } })
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

    const replyIds = [...new Set(messageDocs.map((message) => message.replyToMessageId).filter(Boolean))] as string[];
    const replyMap = await buildReplySummaries(channelId, replyIds);

    return messageDocs.map((message) => ({
      ...stripMongoId(message),
      author: authorMap.get(message.authorId) || null,
      replyTo: message.replyToMessageId ? replyMap.get(message.replyToMessageId) || null : null,
    }));
  },

  async create(data: { channelId: string; authorId: string; content: string; gifUrl?: string; replyToMessageId?: string | null }) {
    const { messages, users } = await getCollections();
    const now = new Date();
    const message: Message = {
      id: nanoid(),
      channelId: data.channelId,
      authorId: data.authorId,
      content: data.content,
      gifUrl: data.gifUrl ?? null,
      replyToMessageId: data.replyToMessageId ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await messages.insertOne(message);
    const author = await users.findOne({ id: data.authorId }, { projection: { id: 1, username: 1 } });
    const replyMap = data.replyToMessageId
      ? await buildReplySummaries(data.channelId, [data.replyToMessageId])
      : new Map<string, ReplySummary>();
    const replyTo = data.replyToMessageId ? replyMap.get(data.replyToMessageId) || null : null;

    return {
      ...message,
      author: author ? stripMongoId(author) : null,
      replyTo,
    };
  },
<<<<<<< HEAD

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

  async updateContent(id: string, content: string): Promise<Message | null> {
    const { messages } = await getCollections();
    const updated = await messages.findOneAndUpdate(
      { id, deletedAt: null },
      { $set: { content, updatedAt: new Date() } },
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
=======

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
>>>>>>> 258cf66d25abee1359d2039a7c692cde55c1a802
