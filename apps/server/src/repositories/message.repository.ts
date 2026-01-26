import prisma from '../lib/prisma.js';
import type { Message } from '@prisma/client';

export const messageRepository = {
  async findById(id: string): Promise<Message | null> {
    return prisma.message.findUnique({ where: { id } });
  },

  async findByIdWithAuthor(id: string) {
    return prisma.message.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, username: true } },
        channel: { select: { id: true, serverId: true } },
      },
    });
  },

  async findChannelMessages(
    channelId: string,
    options: { limit: number; cursor?: string }
  ) {
    const { limit, cursor } = options;

    return prisma.message.findMany({
      where: {
        channelId,
        deletedAt: null,
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      include: {
        author: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });
  },

  async create(data: { channelId: string; authorId: string; content: string }): Promise<Message> {
    return prisma.message.create({
      data,
      include: {
        author: { select: { id: true, username: true } },
      },
    });
  },

  async softDelete(id: string): Promise<Message> {
    return prisma.message.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },

  async hardDelete(id: string): Promise<void> {
    await prisma.message.delete({ where: { id } });
  },
};
