import { nanoid } from 'nanoid';
import { getCollections } from '../lib/mongo.js';
import { stripMongoId } from '../lib/mongo-utils.js';
import { ConflictError, NotFoundError } from '../domain/errors.js';
import { userRepository } from './user.repository.js';
import type { DirectConversation } from '../domain/types.js';

function buildParticipantKey(participantIds: string[]): string {
  return [...participantIds].sort().join(':');
}

export const directConversationRepository = {
  buildParticipantKey,

  async findById(id: string): Promise<DirectConversation | null> {
    const { directConversations } = await getCollections();
    const convo = await directConversations.findOne({ id });
    return convo ? stripMongoId(convo) : null;
  },

  async findByParticipantKey(participantKey: string): Promise<DirectConversation | null> {
    const { directConversations } = await getCollections();
    const convo = await directConversations.findOne({ participantKey });
    return convo ? stripMongoId(convo) : null;
  },

  async findUserConversations(userId: string) {
    const { directConversations, directMessages } = await getCollections();

    const convos = await directConversations
      .find({ participantIds: userId })
      .sort({ updatedAt: -1 })
      .toArray();

    if (convos.length === 0) {
      return [];
    }

    const lastMessageByConversation = new Map<string, { id: string; content: string; gifUrl?: string | null; createdAt: Date; authorId: string }>();

    await Promise.all(
      convos.map(async (convo) => {
        const lastMessage = await directMessages
          .find({ conversationId: convo.id, deletedAt: null })
          .sort({ createdAt: -1, id: -1 })
          .limit(1)
          .next();

        if (lastMessage) {
          lastMessageByConversation.set(convo.id, {
            id: lastMessage.id,
            content: lastMessage.content,
            gifUrl: lastMessage.gifUrl ?? null,
            createdAt: lastMessage.createdAt,
            authorId: lastMessage.authorId,
          });
        }
      })
    );

    const allParticipantIds = [...new Set(convos.flatMap((c) => c.participantIds))];
    const users = await Promise.all(allParticipantIds.map((id) => userRepository.findById(id)));
    const userMap = new Map(users.filter(Boolean).map((u) => [u!.id, { id: u!.id, username: u!.username, email: u!.email }]));

    return convos.map((convo) => {
      const participants = convo.participantIds.map((id) => userMap.get(id) || { id, username: 'Unknown', email: '' });
      const lastMessage = lastMessageByConversation.get(convo.id) || null;

      return {
        ...stripMongoId(convo),
        participants,
        lastMessage,
      };
    });
  },

  async create(participantIds: string[]): Promise<DirectConversation> {
    if (participantIds.length < 2) {
      throw new ConflictError('A conversation requires at least two participants');
    }

    const uniqueIds = [...new Set(participantIds)];
    const participantKey = buildParticipantKey(uniqueIds);

    const existing = await this.findByParticipantKey(participantKey);
    if (existing) {
      return existing;
    }

    const { directConversations } = await getCollections();
    const now = new Date();

    const convo: DirectConversation = {
      id: nanoid(),
      participantIds: uniqueIds,
      participantKey,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await directConversations.insertOne(convo);
      return convo;
    } catch {
      const retry = await this.findByParticipantKey(participantKey);
      if (retry) {
        return retry;
      }
      throw new NotFoundError('Conversation');
    }
  },

  async touch(conversationId: string): Promise<void> {
    const { directConversations } = await getCollections();
    await directConversations.updateOne({ id: conversationId }, { $set: { updatedAt: new Date() } });
  },
};
