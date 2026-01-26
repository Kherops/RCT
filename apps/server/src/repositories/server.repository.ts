import prisma from '../lib/prisma.js';
import type { Server, ServerMember, Role } from '@prisma/client';

export const serverRepository = {
  async findById(id: string): Promise<Server | null> {
    return prisma.server.findUnique({ where: { id } });
  },

  async findByIdWithOwner(id: string) {
    return prisma.server.findUnique({
      where: { id },
      include: { owner: { select: { id: true, username: true } } },
    });
  },

  async findByInviteCode(inviteCode: string): Promise<Server | null> {
    return prisma.server.findUnique({ where: { inviteCode } });
  },

  async findUserServers(userId: string) {
    return prisma.server.findMany({
      where: { members: { some: { userId } } },
      include: {
        _count: { select: { members: true, channels: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async create(data: { name: string; ownerId: string; inviteCode?: string }): Promise<Server> {
    return prisma.server.create({ data });
  },

  async update(id: string, data: Partial<Pick<Server, 'name' | 'inviteCode'>>): Promise<Server> {
    return prisma.server.update({ where: { id }, data });
  },

  async delete(id: string): Promise<void> {
    await prisma.server.delete({ where: { id } });
  },

  async transferOwnership(serverId: string, newOwnerId: string): Promise<Server> {
    return prisma.server.update({
      where: { id: serverId },
      data: { ownerId: newOwnerId },
    });
  },
};

export const serverMemberRepository = {
  async findMembership(serverId: string, userId: string): Promise<ServerMember | null> {
    return prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId } },
    });
  },

  async findServerMembers(serverId: string) {
    return prisma.serverMember.findMany({
      where: { serverId },
      include: { user: { select: { id: true, username: true, email: true } } },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
  },

  async addMember(serverId: string, userId: string, role: Role = 'MEMBER'): Promise<ServerMember> {
    return prisma.serverMember.create({
      data: { serverId, userId, role },
    });
  },

  async updateRole(serverId: string, userId: string, role: Role): Promise<ServerMember> {
    return prisma.serverMember.update({
      where: { serverId_userId: { serverId, userId } },
      data: { role },
    });
  },

  async removeMember(serverId: string, userId: string): Promise<void> {
    await prisma.serverMember.delete({
      where: { serverId_userId: { serverId, userId } },
    });
  },

  async countMembers(serverId: string): Promise<number> {
    return prisma.serverMember.count({ where: { serverId } });
  },
};
