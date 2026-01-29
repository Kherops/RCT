import { nanoid } from 'nanoid';
import { serverRepository, serverMemberRepository } from '../repositories/index.js';
import { userRepository } from '../repositories/user.repository.js';
import { inviteRepository } from '../repositories/invite.repository.js';
import { channelRepository } from '../repositories/channel.repository.js';
import { NotFoundError, ForbiddenError, ConflictError, BadRequestError } from '../domain/errors.js';
import { hasPermission } from '../domain/policies.js';
import type { Role, Server } from '../domain/types.js';
import { getEmitters } from '../socket/index.js';

export const serverService = {
  async createServer(userId: string, name: string) {
    const server = await serverRepository.create({
      name,
      ownerId: userId,
      inviteCode: nanoid(8),
    });

    await serverMemberRepository.addMember(server.id, userId, 'OWNER');
    await channelRepository.create({ serverId: server.id, name: 'general' });

    return server;
  },

  async getUserServers(userId: string) {
    return serverRepository.findUserServers(userId);
  },

  async getServer(serverId: string, userId: string) {
    const server = await serverRepository.findByIdWithOwner(serverId);
    if (!server) {
      throw new NotFoundError('Server');
    }

    const membership = await serverMemberRepository.findMembership(serverId, userId);
    if (!membership) {
      throw new ForbiddenError('You are not a member of this server');
    }

    return server;
  },

  async updateServer(serverId: string, userId: string, data: { name?: string }) {
    const membership = await this.requireMembership(serverId, userId);

    if (!hasPermission(membership.role, 'server:update')) {
      throw new ForbiddenError('You do not have permission to update this server');
    }

    return serverRepository.update(serverId, data);
  },

  async deleteServer(serverId: string, userId: string) {
    const membership = await this.requireMembership(serverId, userId);

    if (!hasPermission(membership.role, 'server:delete')) {
      throw new ForbiddenError('You do not have permission to delete this server');
    }

    await serverRepository.delete(serverId);
  },

  async joinServer(userId: string, inviteCode: string) {
    const invite = await inviteRepository.findByCodeWithServer(inviteCode);

    let server: Server;
    if (invite) {
      if (invite.expiresAt && invite.expiresAt < new Date()) {
        throw new BadRequestError('Invite has expired');
      }
      if (invite.maxUses && invite.uses >= invite.maxUses) {
        throw new BadRequestError('Invite has reached maximum uses');
      }
      const inviteServer = invite.server;
      if (!inviteServer) {
        throw new NotFoundError('Server');
      }
      server = inviteServer;
    } else {
      const found = await serverRepository.findByInviteCode(inviteCode);
      if (!found) {
        throw new NotFoundError('Invalid invite code');
      }
      server = found;
    }

    const existingMembership = await serverMemberRepository.findMembership(server.id, userId);
    if (existingMembership) {
      throw new ConflictError('You are already a member of this server');
    }

    await serverMemberRepository.addMember(server.id, userId, 'MEMBER');
    
    if (invite) {
      await inviteRepository.incrementUses(inviteCode);
    }

    return server;
  },

  async leaveServer(serverId: string, userId: string) {
    const server = await serverRepository.findById(serverId);
    if (!server) {
      throw new NotFoundError('Server');
    }

    const membership = await serverMemberRepository.findMembership(serverId, userId);
    if (!membership) {
      throw new ForbiddenError('You are not a member of this server');
    }

    if (membership.role === 'OWNER') {
      throw new ForbiddenError('Owner cannot leave the server. Transfer ownership first.');
    }

    await serverMemberRepository.removeMember(serverId, userId);
  },

  async getMembers(serverId: string, userId: string) {
    await this.requireMembership(serverId, userId);
    return serverMemberRepository.findServerMembers(serverId);
  },

  async updateMemberRole(serverId: string, targetUserId: string, newRole: Role, actorUserId: string) {
    const actorMembership = await this.requireMembership(serverId, actorUserId);

    if (!hasPermission(actorMembership.role, 'member:update_role')) {
      throw new ForbiddenError('You do not have permission to update roles');
    }

    const targetMembership = await serverMemberRepository.findMembership(serverId, targetUserId);
    if (!targetMembership) {
      throw new NotFoundError('Member');
    }

    if (targetMembership.role === 'OWNER') {
      throw new ForbiddenError('Cannot change owner role directly. Use transfer ownership.');
    }

    if (newRole === 'OWNER') {
      throw new ForbiddenError('Cannot assign owner role. Use transfer ownership.');
    }

    return serverMemberRepository.updateRole(serverId, targetUserId, newRole);
  },

  async kickMember(serverId: string, targetUserId: string, actorUserId: string) {
    const actorMembership = await this.requireMembership(serverId, actorUserId);

    if (!hasPermission(actorMembership.role, 'member:delete')) {
      throw new ForbiddenError('You do not have permission to kick members');
    }

    const targetMembership = await serverMemberRepository.findMembership(serverId, targetUserId);
    if (!targetMembership) {
      throw new NotFoundError('Member');
    }

    if (targetMembership.role === 'OWNER') {
      throw new ForbiddenError('Cannot kick the server owner');
    }

    if (actorMembership.role === 'ADMIN' && targetMembership.role !== 'MEMBER') {
       throw new ForbiddenError('Admins can only kick members');
    }

    await serverMemberRepository.removeMember(serverId, targetUserId);
    
    const user = await userRepository.findById(targetUserId);
    if (user) {
        try {
            getEmitters().emitUserLeft(serverId, user.id, user.username);
        } catch (e) {
            // Socket not initialized (test environment)
        }
    }
  },

  async transferOwnership(serverId: string, newOwnerId: string, currentOwnerId: string) {
    const currentMembership = await this.requireMembership(serverId, currentOwnerId);

    if (!hasPermission(currentMembership.role, 'ownership:transfer')) {
      throw new ForbiddenError('Only the owner can transfer ownership');
    }

    const newOwnerMembership = await serverMemberRepository.findMembership(serverId, newOwnerId);
    if (!newOwnerMembership) {
      throw new NotFoundError('New owner must be a member of the server');
    }

    await serverMemberRepository.updateRole(serverId, newOwnerId, 'OWNER');
    await serverMemberRepository.updateRole(serverId, currentOwnerId, 'ADMIN');
    await serverRepository.transferOwnership(serverId, newOwnerId);

    const server = await serverRepository.findById(serverId);
    if (!server) {
      throw new NotFoundError('Server');
    }
    return server;
  },

  async createInvite(serverId: string, userId: string, options?: { expiresAt?: Date; maxUses?: number }) {
    const membership = await this.requireMembership(serverId, userId);

    if (!hasPermission(membership.role, 'invite:create')) {
      throw new ForbiddenError('You do not have permission to create invites');
    }

    const code = nanoid(8);
    return inviteRepository.create({
      code,
      serverId,
      createdById: userId,
      expiresAt: options?.expiresAt,
      maxUses: options?.maxUses,
    });
  },

  async requireMembership(serverId: string, userId: string) {
    const server = await serverRepository.findById(serverId);
    if (!server) {
      throw new NotFoundError('Server');
    }

    const membership = await serverMemberRepository.findMembership(serverId, userId);
    if (!membership) {
      throw new ForbiddenError('You are not a member of this server');
    }

    return membership;
  },
};
