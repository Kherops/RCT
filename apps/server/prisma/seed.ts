import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { nanoid } from 'nanoid';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const passwordHash = await argon2.hash('password123');

  const alice = await prisma.user.create({
    data: {
      username: 'alice',
      email: 'alice@example.com',
      passwordHash,
    },
  });

  const bob = await prisma.user.create({
    data: {
      username: 'bob',
      email: 'bob@example.com',
      passwordHash,
    },
  });

  const charlie = await prisma.user.create({
    data: {
      username: 'charlie',
      email: 'charlie@example.com',
      passwordHash,
    },
  });

  const server1 = await prisma.server.create({
    data: {
      name: 'General Chat',
      ownerId: alice.id,
      inviteCode: nanoid(8),
      members: {
        create: [
          { userId: alice.id, role: 'OWNER' },
          { userId: bob.id, role: 'ADMIN' },
          { userId: charlie.id, role: 'MEMBER' },
        ],
      },
      channels: {
        create: [
          { name: 'general' },
          { name: 'random' },
          { name: 'announcements' },
        ],
      },
    },
    include: {
      channels: true,
    },
  });

  const server2 = await prisma.server.create({
    data: {
      name: 'Dev Team',
      ownerId: bob.id,
      inviteCode: nanoid(8),
      members: {
        create: [
          { userId: bob.id, role: 'OWNER' },
          { userId: alice.id, role: 'MEMBER' },
        ],
      },
      channels: {
        create: [
          { name: 'general' },
          { name: 'code-review' },
        ],
      },
    },
    include: {
      channels: true,
    },
  });

  const generalChannel = server1.channels.find(c => c.name === 'general')!;

  await prisma.message.createMany({
    data: [
      { channelId: generalChannel.id, authorId: alice.id, content: 'Welcome to the server!' },
      { channelId: generalChannel.id, authorId: bob.id, content: 'Hey everyone!' },
      { channelId: generalChannel.id, authorId: charlie.id, content: 'Hello! 👋' },
      { channelId: generalChannel.id, authorId: alice.id, content: 'Feel free to chat here.' },
      { channelId: generalChannel.id, authorId: bob.id, content: 'This is a great place to hang out.' },
    ],
  });

  console.log('✅ Seed completed!');
  console.log(`
📊 Created:
  - 3 users (alice, bob, charlie) - password: password123
  - 2 servers (General Chat, Dev Team)
  - 5 channels total
  - 5 messages in general channel

🔗 Server invite codes:
  - General Chat: ${server1.inviteCode}
  - Dev Team: ${server2.inviteCode}
  `);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
