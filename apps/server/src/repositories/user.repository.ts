import prisma from '../lib/prisma.js';
import type { User } from '@prisma/client';

export const userRepository = {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  },

  async findByUsername(username: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { username } });
  },

  async create(data: { username: string; email: string; passwordHash: string }): Promise<User> {
    return prisma.user.create({ data });
  },

  async update(id: string, data: Partial<Pick<User, 'username' | 'email' | 'passwordHash'>>): Promise<User> {
    return prisma.user.update({ where: { id }, data });
  },
};
