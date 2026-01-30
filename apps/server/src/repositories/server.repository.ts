import { nanoid } from 'nanoid';
import { getCollections, type TransactionSession } from '../lib/mongo.js';
import { stripMongoId } from '../lib/mongo-utils.js';
import type { Server, ServerMember, Role } from '../domain/types.js';

export const serverRepository = {
  async findById(id: string): Promise<Server | null> {
    const { servers } = await getCollections();
    const server = await servers.findOne({ id });
    return server ? stripMongoId(server) : null;
  },

  async findByIdWithOwner(id: string) {
    const { servers, users } = await getCollections();
    const server = await servers.findOne({ id });
    if (!server) {
      return null;
    }

    const owner = await users.findOne({ id: server.ownerId }, { projection: { id: 1, username: 1 } });
    return {
      ...stripMongoId(server),
      owner: owner ? stripMongoId(owner) : null,
    };
  },

  async findByInviteCode(inviteCode: string): Promise<Server | null> {
    const { servers } = await getCollections();
    const server = await servers.findOne({ inviteCode });
    return server ? stripMongoId(server) : null;
  },

  async findUserServers(userId: string) {
    const { servers, serverMembers, channels } = await getCollections();
    const memberships = await serverMembers.find({ userId }).toArray();
    if (memberships.length === 0) {
      return [];
    }

    const serverIds = memberships.map((membership) => membership.serverId);
    const serverDocs = await servers
      .find({ id: { $in: serverIds } })
      .sort({ createdAt: -1 })
      .toArray();

    const serversWithCounts = await Promise.all(
      serverDocs.map(async (server) => {
        const [memberCount, channelCount] = await Promise.all([
          serverMembers.countDocuments({ serverId: server.id }),
          channels.countDocuments({ serverId: server.id }),
        ]);

        return {
          ...stripMongoId(server),
          _count: { members: memberCount, channels: channelCount },
        };
      })
    );

    return serversWithCounts;
  },

  async create(data: { name: string; ownerId: string; inviteCode?: string }): Promise<Server> {
    const { servers } = await getCollections();
    const now = new Date();
    const server: Server = {
      id: nanoid(),
      name: data.name,
      ownerId: data.ownerId,
      inviteCode: data.inviteCode ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await servers.insertOne(server);
    return server;
  },

  async update(id: string, data: Partial<Pick<Server, 'name' | 'inviteCode'>>): Promise<Server> {
    const { servers } = await getCollections();
    const updated = await servers.findOneAndUpdate(
      { id },
      { $set: { ...data, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!updated) {
      throw new Error('Server not found');
    }

    return stripMongoId(updated);
  },

  async delete(id: string, session?: TransactionSession): Promise<void> {
    const { servers, serverMembers, channels, messages, invites, channelMembers } = await getCollections();
    const channelDocs = await channels.find({ serverId: id }, { projection: { id: 1 }, session }).toArray();
    const channelIds = channelDocs.map((channel) => channel.id);

    if (channelIds.length > 0) {
      await messages.deleteMany({ channelId: { $in: channelIds } }, { session });
      await channelMembers.deleteMany({ channelId: { $in: channelIds } }, { session });
    }

    await Promise.all([
      channels.deleteMany({ serverId: id }, { session }),
      serverMembers.deleteMany({ serverId: id }, { session }),
      invites.deleteMany({ serverId: id }, { session }),
      servers.deleteOne({ id }, { session }),
    ]);
  },

  async transferOwnership(serverId: string, newOwnerId: string): Promise<Server> {
    const { servers } = await getCollections();
    const updated = await servers.findOneAndUpdate(
      { id: serverId },
      { $set: { ownerId: newOwnerId, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!updated) {
      throw new Error('Server not found');
    }

    return stripMongoId(updated);
  },
};

export const serverMemberRepository = {
  async findMembership(serverId: string, userId: string): Promise<ServerMember | null> {
    const { serverMembers } = await getCollections();
    const member = await serverMembers.findOne({ serverId, userId });
    return member ? stripMongoId(member) : null;
  },

  async findServerMembers(serverId: string) {
    const { serverMembers, users } = await getCollections();
    const members = await serverMembers.find({ serverId }).toArray();
    const roleOrder: Record<Role, number> = { OWNER: 0, ADMIN: 1, MEMBER: 2 };

    members.sort((a, b) => {
      const roleCompare = roleOrder[a.role] - roleOrder[b.role];
      if (roleCompare !== 0) {
        return roleCompare;
      }
      return a.joinedAt.getTime() - b.joinedAt.getTime();
    });

    const userIds = [...new Set(members.map((member) => member.userId))];
    const userDocs = await users
      .find({ id: { $in: userIds } }, { projection: { id: 1, username: 1, email: 1 } })
      .toArray();
    const userMap = new Map(userDocs.map((user) => [user.id, stripMongoId(user)]));

    return members.map((member) => ({
      ...stripMongoId(member),
      user: userMap.get(member.userId) || null,
    }));
  },

  async addMember(serverId: string, userId: string, role: Role = 'MEMBER'): Promise<ServerMember> {
    const { serverMembers } = await getCollections();
    const member: ServerMember = {
      id: nanoid(),
      serverId,
      userId,
      role,
      joinedAt: new Date(),
    };

    await serverMembers.insertOne(member);
    return member;
  },

  async updateRole(serverId: string, userId: string, role: Role): Promise<ServerMember> {
    const { serverMembers } = await getCollections();
    const updated = await serverMembers.findOneAndUpdate(
      { serverId, userId },
      { $set: { role } },
      { returnDocument: 'after' }
    );

    if (!updated) {
      throw new Error('Server member not found');
    }

    return stripMongoId(updated);
  },

  async removeMember(serverId: string, userId: string): Promise<void> {
    const { serverMembers } = await getCollections();
    await serverMembers.deleteOne({ serverId, userId });
  },

  async countMembers(serverId: string): Promise<number> {
    const { serverMembers } = await getCollections();
    return serverMembers.countDocuments({ serverId });
  },
};
