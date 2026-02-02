import {
  MongoClient,
  type ClientSession,
  type OperationOptions,
  type Filter as MongoFilter,
  type UpdateFilter,
  type FindOneAndUpdateOptions,
  type Document,
} from "mongodb";
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

type CollectionLike<T = unknown> = {
  find(
    filter?: MongoFilter<T>,
    options?: { projection?: Projection; session?: ClientSession | null },
  ): QueryResult<T>;
  findOne(
    filter: MongoFilter<T>,
    options?: { projection?: Projection; session?: ClientSession | null },
  ): Promise<T | null>;
  insertOne(doc: T, options?: OperationOptions): Promise<unknown>;
  deleteMany(
    filter?: MongoFilter<T>,
    options?: OperationOptions,
  ): Promise<unknown>;
  deleteOne(
    filter: MongoFilter<T>,
    options?: OperationOptions,
  ): Promise<unknown>;
  findOneAndUpdate(
    filter: MongoFilter<T>,
    update: UpdateFilter<T> | Document[],
    options?: FindOneAndUpdateOptions,
  ): Promise<T | null>;
  updateMany(
    filter: MongoFilter<T>,
    update: UpdateFilter<T>,
    options?: OperationOptions,
  ): Promise<unknown>;
  updateOne(
    filter: MongoFilter<T>,
    update: UpdateFilter<T>,
    options?: OperationOptions,
  ): Promise<unknown>;
  countDocuments(filter: MongoFilter<T>): Promise<number>;
  createIndex?(...args: unknown[]): Promise<unknown>;
  reset?(): void;
};

class InMemoryQuery<T extends object> {
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
        const av = (a as Record<string, unknown>)[key] as string | number;
        const bv = (b as Record<string, unknown>)[key] as string | number;
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
    return this.results.map((doc) =>
      applyProjection({ ...doc }, this.projection),
    );
  }
}

class InMemoryCollection<T extends object> {
  private data: T[] = [];

  find(
    filter: MongoFilter<T> = {},
    options: { projection?: Projection; session?: ClientSession | null } = {},
  ) {
    const matched = this.data.filter((doc) => matches(doc, filter));
    return new InMemoryQuery<T>(matched, options.projection);
  }

  async findOne(
    filter: MongoFilter<T>,
    options: { projection?: Projection; session?: ClientSession | null } = {},
  ): Promise<T | null> {
    const found = this.data.find((doc) => matches(doc, filter));
    if (!found) return null;
    return applyProjection({ ...found }, options.projection);
  }

  async insertOne(doc: T, _options: OperationOptions = {}): Promise<void> {
    void _options;
    this.data.push({ ...doc });
  }

  async deleteMany(
    filter: MongoFilter<T> = {},
    _options: OperationOptions = {},
  ): Promise<void> {
    void _options;
    this.data = this.data.filter((doc) => !matches(doc, filter));
  }

  async deleteOne(
    filter: MongoFilter<T>,
    _options: OperationOptions = {},
  ): Promise<void> {
    void _options;
    const idx = this.data.findIndex((doc) => matches(doc, filter));
    if (idx >= 0) {
      this.data.splice(idx, 1);
    }
  }

  async findOneAndUpdate(
    filter: MongoFilter<T>,
    update: UpdateFilter<T> | Document[],
    options: FindOneAndUpdateOptions = {},
  ): Promise<T | null> {
    const idx = this.data.findIndex((doc) => matches(doc, filter));
    if (idx === -1) return null;

    const current = this.data[idx];
    const updated = applyUpdate(current, update);
    this.data[idx] = updated;

    const shouldReturnUpdated = options.returnDocument !== "before";
    const result = shouldReturnUpdated ? updated : current;
    return { ...result };
  }

  async updateMany(
    filter: MongoFilter<T>,
    update: UpdateFilter<T>,
  ): Promise<void> {
    this.data = this.data.map((doc) =>
      matches(doc, filter) ? applyUpdate(doc, update) : doc,
    );
  }

  async updateOne(
    filter: MongoFilter<T>,
    update: UpdateFilter<T>,
  ): Promise<void> {
    const idx = this.data.findIndex((doc) => matches(doc, filter));
    if (idx >= 0) {
      this.data[idx] = applyUpdate(this.data[idx], update);
    }
  }

  async countDocuments(filter: MongoFilter<T>): Promise<number> {
    return this.data.filter((doc) => matches(doc, filter)).length;
  }

  async createIndex(): Promise<void> {
    // No-op for in-memory collections.
  }

  reset() {
    this.data = [];
  }
}

function matches<T extends object>(doc: T, filter: MongoFilter<T>): boolean {
  const entries = Object.entries(filter) as [keyof T | "$or", unknown][];
  for (const [key, value] of entries) {
    if (key === "$or") {
      if (!Array.isArray(value)) return false;
      if (!value.some((inner) => matches(doc, inner as MongoFilter<T>))) {
        return false;
      }
      continue;
    }

    const docValue = (doc as Record<string, unknown>)[key as string];

    if (Array.isArray(docValue) && !Array.isArray(value)) {
      if (!docValue.includes(value)) {
        return false;
      }
      continue;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      const valueObj = value as { $in?: unknown[]; $lt?: number };
      if (Array.isArray(valueObj.$in)) {
        if (!valueObj.$in.includes(docValue)) {
          return false;
        }
        continue;
      }
      if (typeof valueObj.$lt === "number") {
        if (typeof docValue !== "number" || !(docValue < valueObj.$lt)) {
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

function applyProjection<T extends object>(
  doc: T,
  projection?: Record<string, number>,
): T {
  if (!projection) return doc;
  const projected: Record<string, unknown> = {};
  const keys = Object.keys(projection);
  if (keys.length === 0) return doc;
  for (const key of keys) {
    if (projection[key] === 1 && key in doc) {
      projected[key] = (doc as Record<string, unknown>)[key];
    }
  }
  return projected as T;
}

function applyUpdate<T extends object>(
  doc: T,
  update: UpdateFilter<T> | Document[],
): T {
  if (Array.isArray(update)) {
    return { ...doc };
  }

  const typedUpdate = update as UpdateSpec<T>;
  const next = { ...doc, ...(typedUpdate.$set ?? {}) } as Record<
    string,
    unknown
  >;

  if (typedUpdate.$inc) {
    for (const [key, value] of Object.entries(typedUpdate.$inc)) {
      if (typeof value === "number") {
        const current =
          typeof next[key] === "number" ? (next[key] as number) : 0;
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
    users: db.collection<User>("users"),
    servers: db.collection<Server>("servers"),
    serverMembers: db.collection<ServerMember>("server_members"),
    channels: db.collection<Channel>("channels"),
    messages: db.collection<Message>("messages"),
    directConversations: db.collection<DirectConversation>(
      "direct_conversations",
    ),
    directMessages: db.collection<DirectMessage>("direct_messages"),
    refreshTokens: db.collection<RefreshToken>("refresh_tokens"),
    invites: db.collection<Invite>("invites"),
  };
}

export async function disconnectMongo(): Promise<void> {
  if (isTestEnv && memoryCollections) {
    Object.values(memoryCollections).forEach((collection) => {
      if (typeof collection.reset === "function") {
        collection.reset();
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

type MemorySnapshot = {
  [K in keyof Collections]: unknown[];
};

function deepClone<T>(value: T): T {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

type InMemoryCollectionSnapshot = { data: unknown[] };

function isInMemoryCollection(
  collection: CollectionLike<unknown>,
): collection is CollectionLike<unknown> & InMemoryCollectionSnapshot {
  return "data" in collection;
}

function readSnapshotData(collection: CollectionLike<unknown>): unknown[] {
  return isInMemoryCollection(collection) ? collection.data : [];
}

function snapshotMemory(collections: Collections): MemorySnapshot {
  return {
    users: deepClone(readSnapshotData(collections.users)),
    servers: deepClone(readSnapshotData(collections.servers)),
    serverMembers: deepClone(readSnapshotData(collections.serverMembers)),
    channels: deepClone(readSnapshotData(collections.channels)),
    messages: deepClone(readSnapshotData(collections.messages)),
    directConversations: deepClone(
      readSnapshotData(collections.directConversations),
    ),
    directMessages: deepClone(readSnapshotData(collections.directMessages)),
    refreshTokens: deepClone(readSnapshotData(collections.refreshTokens)),
    invites: deepClone(readSnapshotData(collections.invites)),
  };
}

async function restoreMemory(
  collections: Collections,
  snapshot: MemorySnapshot,
) {
  const entries = Object.entries(snapshot) as [keyof Collections, unknown[]][];
  for (const [key, docs] of entries) {
    const collection = collections[key] as unknown as CollectionLike<
      Record<string, unknown>
    >;
    if (typeof collection.reset === "function") {
      collection.reset();
    }
    for (const doc of docs) {
      await collection.insertOne(deepClone(doc) as never);
    }
  }
}

export type TransactionSession = ClientSession | undefined;

export async function runInTransaction<T>(
  operation: (session: TransactionSession) => Promise<T>,
): Promise<T> {
  if (isTestEnv && memoryCollections) {
    const snapshot = snapshotMemory(memoryCollections);
    try {
      return await operation(undefined);
    } catch (error) {
      await restoreMemory(memoryCollections, snapshot);
      throw error;
    }
  }

  await getDb();
  const client = globalForMongo.client;
  if (!client) {
    throw new Error("Mongo client not initialized");
  }

  const session = client.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await operation(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}

async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection<User>("users").createIndex({ email: 1 }, { unique: true }),
    db.collection<User>("users").createIndex({ username: 1 }, { unique: true }),
    db
      .collection<Server>("servers")
      .createIndex({ inviteCode: 1 }, { unique: true, sparse: true }),
    db
      .collection<ServerMember>("server_members")
      .createIndex({ serverId: 1, userId: 1 }, { unique: true }),
    db
      .collection<Message>("messages")
      .createIndex({ channelId: 1, createdAt: -1, id: -1 }),
    db
      .collection<DirectConversation>("direct_conversations")
      .createIndex({ participantKey: 1 }, { unique: true }),
    db
      .collection<DirectConversation>("direct_conversations")
      .createIndex({ participantIds: 1 }),
    db
      .collection<DirectMessage>("direct_messages")
      .createIndex({ conversationId: 1, createdAt: -1, id: -1 }),
    db
      .collection<RefreshToken>("refresh_tokens")
      .createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection<Invite>("invites").createIndex({ code: 1 }, { unique: true }),
  ]);
}
