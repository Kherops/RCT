import { userRepository } from '../repositories/user.repository.js';
import { serverRepository, serverMemberRepository } from '../repositories/server.repository.js';
import { channelRepository } from '../repositories/channel.repository.js';
import type { Role } from '../domain/types.js';

let userSequence = 0;
let serverSequence = 0;

export async function createUser(overrides: Partial<{ username: string; email: string; passwordHash: string }> = {}) {
  userSequence += 1;
  const username = overrides.username ?? `user${userSequence}`;
  const email = overrides.email ?? `user${userSequence}@example.com`;
  const passwordHash = overrides.passwordHash ?? 'hash';
  return userRepository.create({ username, email, passwordHash });
}

export async function createServer(ownerId: string, overrides: Partial<{ name: string; inviteCode: string }> = {}) {
  serverSequence += 1;
  const name = overrides.name ?? `Server ${serverSequence}`;
  const inviteCode = overrides.inviteCode;
  return serverRepository.create({ name, ownerId, ...(inviteCode !== undefined ? { inviteCode } : {}) });
}

export async function addMember(serverId: string, userId: string, role: Role = 'MEMBER') {
  return serverMemberRepository.addMember(serverId, userId, role);
}

export async function createChannel(serverId: string, name = 'general') {
  return channelRepository.create({ serverId, name });
}
