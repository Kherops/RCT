import { nanoid } from 'nanoid';
import { getCollections } from '../lib/mongo.js';
import { stripMongoId } from '../lib/mongo-utils.js';
import type { User } from '../domain/types.js';

export const userRepository = {
  async findById(id: string): Promise<User | null> {
    const { users } = await getCollections();
    const user = await users.findOne({ id });
    return user ? stripMongoId(user) : null;
  },

  async findByEmail(email: string): Promise<User | null> {
    const { users } = await getCollections();
    const user = await users.findOne({ email });
    return user ? stripMongoId(user) : null;
  },

  async findByUsername(username: string): Promise<User | null> {
    const { users } = await getCollections();
    const user = await users.findOne({ username });
    return user ? stripMongoId(user) : null;
  },

  async create(data: { username: string; email: string; passwordHash: string }): Promise<User> {
    const { users } = await getCollections();
    const now = new Date();
    const user: User = {
      id: nanoid(),
      username: data.username,
      email: data.email,
      passwordHash: data.passwordHash,
      createdAt: now,
      updatedAt: now,
    };

    await users.insertOne(user);
    return user;
  },

  async update(id: string, data: Partial<Pick<User, 'username' | 'email' | 'passwordHash'>>): Promise<User> {
    const { users } = await getCollections();
    const updated = await users.findOneAndUpdate(
      { id },
      { $set: { ...data, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );

    if (!updated) {
      throw new Error('User not found');
    }

    return stripMongoId(updated);
  },
};
