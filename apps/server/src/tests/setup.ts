import { jest } from '@jest/globals';
import { getCollections, disconnectMongo } from '../lib/mongo.js';
import iconv from 'iconv-lite';
// @ts-ignore
import encodings from 'iconv-lite/encodings/index.js';

// Ensure test-friendly defaults before any app modules load.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'mongodb://127.0.0.1:27017/rtc_test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-at-least-32-chars';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-at-least-32-chars';
process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';

// Mock socket emitters before any module that uses them is imported
jest.mock('../socket/index.js', () => ({
  getEmitters: () => ({
    emitUserLeft: jest.fn(),
    emitUserJoined: jest.fn(),
    emitServerUpdated: jest.fn(),
    emitMemberRoleUpdated: jest.fn(),
  }),
  getIO: () => ({}),
}));

// Manually load encodings to prevent lazy loading during teardown
(iconv as any).encodings = encodings;

afterAll(async () => {
  await disconnectMongo();
});

beforeEach(async () => {
  const collections = await getCollections();
  await collections.directMessages.deleteMany({});
  await collections.directConversations.deleteMany({});
  await collections.messages.deleteMany({});
  await collections.channels.deleteMany({});
  await collections.channelMembers.deleteMany({});
  await collections.invites.deleteMany({});
  await collections.serverMembers.deleteMany({});
  await collections.servers.deleteMany({});
  await collections.refreshTokens.deleteMany({});
  await collections.users.deleteMany({});
});
