import prisma from '../lib/prisma.js';
import type { Invite } from '@prisma/client';

export const inviteRepository = {
  async findByCode(code: string): Promise<Invite | null> {
    return prisma.invite.findUnique({ where: { code } });
  },

  async findByCodeWithServer(code: string) {
    return prisma.invite.findUnique({
      where: { code },
      include: { server: true, createdBy: { select: { id: true, username: true } } },
    });
  },

  async findServerInvites(serverId: string) {
    return prisma.invite.findMany({
      where: { serverId },
      include: { createdBy: { select: { id: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    });
  },

  async create(data: {
    code: string;
    serverId: string;
    createdById: string;
    expiresAt?: Date;
    maxUses?: number;
  }): Promise<Invite> {
    return prisma.invite.create({ data });
  },

  async incrementUses(code: string): Promise<Invite> {
    return prisma.invite.update({
      where: { code },
      data: { uses: { increment: 1 } },
    });
  },

  async delete(id: string): Promise<void> {
    await prisma.invite.delete({ where: { id } });
  },

  async deleteExpired(): Promise<void> {
    await prisma.invite.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
  },
};
