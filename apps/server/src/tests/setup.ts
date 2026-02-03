import { getCollections, disconnectMongo } from '../lib/mongo.js';
import iconv from 'iconv-lite';
// @ts-expect-error -- iconv-lite encodings module has no TS types in this project.
import encodings from 'iconv-lite/encodings/index.js';

// Ensure test-friendly defaults before any app modules load.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'mongodb://127.0.0.1:27017/rtc_test';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-at-least-32-chars';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-at-least-32-chars';
process.env.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';

// Manually load encodings to prevent lazy loading during teardown
(iconv as typeof iconv & { encodings: unknown }).encodings = encodings as unknown;

afterAll(async () => {
  await disconnectMongo();
});

beforeEach(async () => {
  const collections = await getCollections();
  await collections.directMessages.deleteMany({});
  await collections.directConversations.deleteMany({});
  await collections.messages.deleteMany({});
  await collections.channels.deleteMany({});
  await collections.invites.deleteMany({});
  await collections.serverMembers.deleteMany({});
  await collections.servers.deleteMany({});
  await collections.userBlocks.deleteMany({});
  await collections.userReports.deleteMany({});
  await collections.refreshTokens.deleteMany({});
  await collections.serverBans.deleteMany({});
  await collections.users.deleteMany({});
});
