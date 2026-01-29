import { MongoClient } from "mongodb";
import type { Db } from "mongodb";
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
} from "../domain/types.js";

type Collections = {
  users: CollectionLike<User>;
  servers: CollectionLike<Server>;
  serverMembers: CollectionLike<ServerMember>;
  channels: CollectionLike<Channel>;
  messages: CollectionLike<Message>;
  directConversations: CollectionLike<DirectConversation>;
  directMessages: CollectionLike<DirectMessage>;
  refreshTokens: CollectionLike<RefreshToken>;
  invites: CollectionLike<Invite>;
};

type GlobalMongo = {
  client?: MongoClient;
  db?: Db;
};

const globalForMongo = globalThis as GlobalMongo;
const isTestEnv = process.env.NODE_ENV === "test";

type Projection = Record<string, number>;

type QueryResult<T> = {
  sort(sortSpec: Record<string, 1 | -1>): QueryResult<T>;
  limit(count: number): QueryResult<T>;
  next(): Promise<T | null>;
  toArray(): Promise<T[]>;
};

type UpdateSpec<T> = {
  $set?: Partial<T>;
  $inc?: Partial<Record<keyof T, number>>;
};

type CollectionLike<T extends Record<string, any> = Record<string, any>> = {
  find(filter?: Filter<T>, options?: { projection?: Projection }): QueryResult<T>;
  findOne(filter: Filter<T>, options?: { projection?: Projection }): Promise<T | null>;
  insertOne(doc: T): Promise<any>;
  deleteMany(filter: Filter<T>): Promise<any>;
  deleteOne(filter: Filter<T>): Promise<any>;
  findOneAndUpdate(
    filter: Filter<T>,
    update: any,
    options?: { returnDocument?: "before" | "after" }
  ): Promise<T | null>;
  updateMany(filter: Filter<T>, update: any): Promise<any>;
  updateOne(filter: Filter<T>, update: any): Promise<any>;
  countDocuments(filter: Filter<T>): Promise<number>;
  createIndex?(...args: any[]): Promise<any>;
  reset?(): void;
};

type Filter<T> = Partial<Record<keyof T, any>> & {
  $or?: Filter<T>[];
};

class InMemoryQuery<T extends Record<string, any>> {
  private results: T[];
  private projection?: Projection;
  private index = 0;

  constructor(results: T[], projection?: Projection) {
    this.results = results;
    this.projection = projection;
  }

  sort(sortSpec: Record<string, 1 | -1>) {
    const entries = Object.entries(sortSpec);
    this.results = [...this.results].sort((a, b) => {
      for (const [key, dir] of entries) {
        const av = (a as any)[key];
        const bv = (b as any)[key];
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
      }
      return 0;
    });
    return this;
  }

  limit(count: number) {
    this.results = this.results.slice(0, count);
    return this;
  }

  async next(): Promise<T | null> {
    if (this.index >= this.results.length) {
      return null;
    }
    const value = this.results[this.index++];
    return applyProjection({ ...value }, this.projection);
  }

  async toArray(): Promise<T[]> {
    return this.results.map((doc) => applyProjection({ ...doc }, this.projection));
  }
}

class InMemoryCollection<T extends Record<string, any>> {
  private data: T[] = [];

  find(filter: Filter<T> = {}, options: { projection?: Projection } = {}) {
    const matched = this.data.filter((doc) => matches(doc, filter));
    return new InMemoryQuery<T>(matched, options.projection);
  }

  async findOne(filter: Filter<T>, options: { projection?: Projection } = {}): Promise<T | null> {
    const found = this.data.find((doc) => matches(doc, filter));
    if (!found) return null;
    return applyProjection({ ...found }, options.projection);
  }

  async insertOne(doc: T): Promise<void> {
    this.data.push({ ...doc });
  }

  async deleteMany(filter: Filter<T>): Promise<void> {
    this.data = this.data.filter((doc) => !matches(doc, filter));
  }

  async deleteOne(filter: Filter<T>): Promise<void> {
    const idx = this.data.findIndex((doc) => matches(doc, filter));
    if (idx >= 0) {
      this.data.splice(idx, 1);
    }
  }

  async findOneAndUpdate(
    filter: Filter<T>,
    update: any,
    options: { returnDocument?: "before" | "after" } = {}
  ): Promise<T | null> {
    const idx = this.data.findIndex((doc) => matches(doc, filter));
    if (idx === -1) return null;

    const current = this.data[idx];
    const updated = applyUpdate(current, update as UpdateSpec<T>);
    this.data[idx] = updated;

    const shouldReturnUpdated = options.returnDocument !== "before";
    const result = shouldReturnUpdated ? updated : current;
    return { ...result };
  }

  async updateMany(filter: Filter<T>, update: any): Promise<void> {
    this.data = this.data.map((doc) => (matches(doc, filter) ? applyUpdate(doc, update as UpdateSpec<T>) : doc));
  }

  async updateOne(filter: Filter<T>, update: any): Promise<void> {
    const idx = this.data.findIndex((doc) => matches(doc, filter));
    if (idx >= 0) {
      this.data[idx] = applyUpdate(this.data[idx], update as UpdateSpec<T>);
    }
  }

  async countDocuments(filter: Filter<T>): Promise<number> {
    return this.data.filter((doc) => matches(doc, filter)).length;
  }

  async createIndex(): Promise<void> {
    // No-op for in-memory collections.
  }

  reset() {
    this.data = [];
  }
}

function matches<T extends Record<string, any>>(doc: T, filter: Filter<T>): boolean {
  const entries = Object.entries(filter) as [keyof T | "$or", any][];
  for (const [key, value] of entries) {
    if (key === "$or") {
      if (!Array.isArray(value)) return false;
      if (!value.some((inner) => matches(doc, inner as Filter<T>))) {
        return false;
      }
      continue;
    }

    const docValue = (doc as any)[key];

    if (Array.isArray(docValue) && !Array.isArray(value)) {
      if (!docValue.includes(value)) {
        return false;
      }
      continue;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      if ("$in" in value) {
        if (!value.$in.includes(docValue)) {
          return false;
        }
        continue;
      }
      if ("$lt" in value) {
        if (!(docValue < value.$lt)) {
          return false;
        }
        continue;
      }
    }

    if (docValue !== value) {
      return false;
    }
  }
  return true;
}

function applyProjection<T extends Record<string, any>>(doc: T, projection?: Record<string, number>): T {
  if (!projection) return doc;
  const projected: Record<string, any> = {};
  const keys = Object.keys(projection);
  if (keys.length === 0) return doc;
  for (const key of keys) {
    if (projection[key] === 1 && key in doc) {
      projected[key] = (doc as any)[key];
    }
  }
  return projected as T;
}

function applyUpdate<T extends Record<string, any>>(doc: T, update: UpdateSpec<T>): T {
  const next = { ...doc, ...(update.$set ?? {}) } as Record<string, any>;

  if (update.$inc) {
    for (const [key, value] of Object.entries(update.$inc)) {
      if (typeof value === "number") {
        const current = typeof next[key] === "number" ? (next[key] as number) : 0;
        next[key] = current + value;
      }
    }
  }

  return next as T;
}

const memoryCollections: Collections | null = isTestEnv
  ? {
      users: new InMemoryCollection<User>(),
      servers: new InMemoryCollection<Server>(),
      serverMembers: new InMemoryCollection<ServerMember>(),
      channels: new InMemoryCollection<Channel>(),
      messages: new InMemoryCollection<Message>(),
      directConversations: new InMemoryCollection<DirectConversation>(),
      directMessages: new InMemoryCollection<DirectMessage>(),
      refreshTokens: new InMemoryCollection<RefreshToken>(),
      invites: new InMemoryCollection<Invite>(),
    }
  : null;

function getDatabaseName(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    const path = url.pathname?.replace("/", "");
    if (path) {
      return path;
    }
  } catch {
    // Ignore invalid URL parsing and fall back to defaults.
  }

  return process.env.MONGODB_DB || "rtc";
}

export async function getDb(): Promise<Db> {
  if (isTestEnv) {
    // No real database during tests.
    return {} as Db;
  }

  if (globalForMongo.db && globalForMongo.client) {
    return globalForMongo.db;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
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
  if (isTestEnv && memoryCollections) {
    return memoryCollections;
  }

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
  if (isTestEnv && memoryCollections) {
    Object.values(memoryCollections).forEach((collection) => {
      if (typeof (collection as any).reset === "function") {
        (collection as any).reset();
      }
    });
    return;
  }

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
