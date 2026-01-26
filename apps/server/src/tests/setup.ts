import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-chars';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-chars';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.message.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.invite.deleteMany();
  await prisma.serverMember.deleteMany();
  await prisma.server.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
});

export { prisma };
