import { MongoClient } from 'mongodb';
import type { Db, Collection } from 'mongodb';
import type {
  User,
  Server,
  ServerMember,
  Channel,
  Message,
  DirectConversation,
  DirectMessage,
  RefreshToken,
  Invite,
} from '../domain/types.js';

type Collections = {
  users: Collection<User>;
  servers: Collection<Server>;
  serverMembers: Collection<ServerMember>;
  channels: Collection<Channel>;
  messages: Collection<Message>;
  directConversations: Collection<DirectConversation>;
  directMessages: Collection<DirectMessage>;
  refreshTokens: Collection<RefreshToken>;
  invites: Collection<Invite>;
};

type GlobalMongo = {
  client?: MongoClient;
  db?: Db;
};

const globalForMongo = globalThis as GlobalMongo;

function getDatabaseName(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    const path = url.pathname?.replace('/', '');
    if (path) {
      return path;
    }
  } catch {
    // Ignore invalid URL parsing and fall back to defaults.
  }

  return process.env.MONGODB_DB || 'rtc';
}

export async function getDb(): Promise<Db> {
  if (globalForMongo.db && globalForMongo.client) {
    return globalForMongo.db;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const client = new MongoClient(connectionString);
  await client.connect();

  const dbName = getDatabaseName(connectionString);
  const db = client.db(dbName);
  await ensureIndexes(db);

  globalForMongo.client = client;
  globalForMongo.db = db;

  return db;
}

export async function getCollections(): Promise<Collections> {
  const db = await getDb();
  return {
    users: db.collection<User>('users'),
    servers: db.collection<Server>('servers'),
    serverMembers: db.collection<ServerMember>('server_members'),
    channels: db.collection<Channel>('channels'),
    messages: db.collection<Message>('messages'),
    directConversations: db.collection<DirectConversation>('direct_conversations'),
    directMessages: db.collection<DirectMessage>('direct_messages'),
    refreshTokens: db.collection<RefreshToken>('refresh_tokens'),
    invites: db.collection<Invite>('invites'),
  };
}

export async function disconnectMongo(): Promise<void> {
  if (globalForMongo.client) {
    await globalForMongo.client.close();
    globalForMongo.client = undefined;
    globalForMongo.db = undefined;
  }
}

async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection<User>('users').createIndex({ email: 1 }, { unique: true }),
    db.collection<User>('users').createIndex({ username: 1 }, { unique: true }),
    db.collection<Server>('servers').createIndex({ inviteCode: 1 }, { unique: true, sparse: true }),
    db.collection<ServerMember>('server_members').createIndex({ serverId: 1, userId: 1 }, { unique: true }),
    db.collection<Message>('messages').createIndex({ channelId: 1, createdAt: -1, id: -1 }),
    db.collection<DirectConversation>('direct_conversations').createIndex({ participantKey: 1 }, { unique: true }),
    db.collection<DirectConversation>('direct_conversations').createIndex({ participantIds: 1 }),
    db.collection<DirectMessage>('direct_messages').createIndex({ conversationId: 1, createdAt: -1, id: -1 }),
    db.collection<RefreshToken>('refresh_tokens').createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection<Invite>('invites').createIndex({ code: 1 }, { unique: true }),
  ]);
}
