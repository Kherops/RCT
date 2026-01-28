import { nanoid } from 'nanoid';
import { getCollections } from '../lib/mongo.js';
import { stripMongoId } from '../lib/mongo-utils.js';
import type { Invite } from '../domain/types.js';

export const inviteRepository = {
  async findByCode(code: string): Promise<Invite | null> {
    const { invites } = await getCollections();
    const invite = await invites.findOne({ code });
    return invite ? stripMongoId(invite) : null;
  },

  async findByCodeWithServer(code: string) {
    const { invites, servers, users } = await getCollections();
    const invite = await invites.findOne({ code });
    if (!invite) {
      return null;
    }

    const [server, createdBy] = await Promise.all([
      servers.findOne({ id: invite.serverId }),
      users.findOne({ id: invite.createdById }, { projection: { id: 1, username: 1 } }),
    ]);

    return {
      ...stripMongoId(invite),
      server: server ? stripMongoId(server) : null,
      createdBy: createdBy ? stripMongoId(createdBy) : null,
    };
  },

  async findServerInvites(serverId: string) {
    const { invites, users } = await getCollections();
    const inviteDocs = await invites.find({ serverId }).sort({ createdAt: -1 }).toArray();
    const userIds = [...new Set(inviteDocs.map((invite) => invite.createdById))];
    const userDocs = await users
      .find({ id: { $in: userIds } }, { projection: { id: 1, username: 1 } })
      .toArray();
    const userMap = new Map(userDocs.map((user) => [user.id, stripMongoId(user)]));

    return inviteDocs.map((invite) => ({
      ...stripMongoId(invite),
      createdBy: userMap.get(invite.createdById) || null,
    }));
  },

  async create(data: {
    code: string;
    serverId: string;
    createdById: string;
    expiresAt?: Date;
    maxUses?: number;
  }): Promise<Invite> {
    const { invites } = await getCollections();
    const invite: Invite = {
      id: nanoid(),
      code: data.code,
      serverId: data.serverId,
      createdById: data.createdById,
      expiresAt: data.expiresAt ?? null,
      maxUses: data.maxUses ?? null,
      uses: 0,
      createdAt: new Date(),
    };

    await invites.insertOne(invite);
    return invite;
  },

  async incrementUses(code: string): Promise<Invite> {
    const { invites } = await getCollections();
    const updated = await invites.findOneAndUpdate(
      { code },
      { $inc: { uses: 1 } },
      { returnDocument: 'after' }
    );

    if (!updated) {
      throw new Error('Invite not found');
    }

    return stripMongoId(updated);
  },

  async delete(id: string): Promise<void> {
    const { invites } = await getCollections();
    await invites.deleteOne({ id });
  },

  async deleteExpired(): Promise<void> {
    const { invites } = await getCollections();
    await invites.deleteMany({ expiresAt: { $lt: new Date() } });
  },
};
