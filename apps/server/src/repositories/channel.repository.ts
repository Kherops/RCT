import prisma from '../lib/prisma.js';
import type { Channel } from '@prisma/client';

export const channelRepository = {
  async findById(id: string): Promise<Channel | null> {
    return prisma.channel.findUnique({ where: { id } });
  },

  async findByIdWithServer(id: string) {
    return prisma.channel.findUnique({
      where: { id },
      include: { server: true },
    });
  },

  async findServerChannels(serverId: string): Promise<Channel[]> {
    return prisma.channel.findMany({
      where: { serverId },
      orderBy: { createdAt: 'asc' },
    });
  },

  async create(data: { serverId: string; name: string }): Promise<Channel> {
    return prisma.channel.create({ data });
  },

  async update(id: string, data: Partial<Pick<Channel, 'name'>>): Promise<Channel> {
    return prisma.channel.update({ where: { id }, data });
  },

  async delete(id: string): Promise<void> {
    await prisma.channel.delete({ where: { id } });
  },

  async countServerChannels(serverId: string): Promise<number> {
    return prisma.channel.count({ where: { serverId } });
  },
};
