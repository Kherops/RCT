import type { TypedSocket, TypedServer, SocketResponse, MessagePayload } from './types.js';
import { serverMemberRepository } from '../repositories/server.repository.js';
import { channelRepository } from '../repositories/channel.repository.js';
import { messageService } from '../services/message.service.js';
import { channelService } from '../services/channel.service.js';

const serverPresenceCounts = new Map<string, number>();

function presenceKey(serverId: string, userId: string) {
  return `${serverId}:${userId}`;
}

function incrementPresence(serverId: string, userId: string) {
  const key = presenceKey(serverId, userId);
  const next = (serverPresenceCounts.get(key) ?? 0) + 1;
  serverPresenceCounts.set(key, next);
  return next;
}

function decrementPresence(serverId: string, userId: string) {
  const key = presenceKey(serverId, userId);
  const next = (serverPresenceCounts.get(key) ?? 0) - 1;
  if (next <= 0) {
    serverPresenceCounts.delete(key);
    return 0;
  }
  serverPresenceCounts.set(key, next);
  return next;
}

export function registerSocketHandlers(io: TypedServer, socket: TypedSocket) {
  const { userId, username } = socket.data;

  socket.on('join:server', async (serverId, callback) => {
    try {
      const membership = await serverMemberRepository.findMembership(serverId, userId);
      if (!membership) {
        return callback?.({ success: false, error: { message: 'Not a member of this server', code: 'FORBIDDEN' } });
      }

      await socket.join(`server:${serverId}`);
      socket.data.joinedServers.add(serverId);

      const count = incrementPresence(serverId, userId);
      if (count === 1) {
        socket.to(`server:${serverId}`).emit('user:online', { userId, serverId });
      }

      callback?.({ success: true });
    } catch (error) {
      callback?.({ success: false, error: { message: 'Failed to join server', code: 'INTERNAL_ERROR' } });
    }
  });

  socket.on('leave:server', async (serverId, callback) => {
    try {
      await socket.leave(`server:${serverId}`);
      socket.data.joinedServers.delete(serverId);

      const count = decrementPresence(serverId, userId);
      if (count === 0) {
        socket.to(`server:${serverId}`).emit('user:offline', { userId, serverId });
      }

      callback?.({ success: true });
    } catch (error) {
      callback?.({ success: false, error: { message: 'Failed to leave server', code: 'INTERNAL_ERROR' } });
    }
  });

  socket.on('join:channel', async (channelId, callback) => {
    try {
      const channel = await channelRepository.findById(channelId);
      if (!channel) {
        return callback?.({ success: false, error: { message: 'Channel not found', code: 'NOT_FOUND' } });
      }

      const membership = await serverMemberRepository.findMembership(channel.serverId, userId);
      if (!membership) {
        return callback?.({ success: false, error: { message: 'Not a member of this server', code: 'FORBIDDEN' } });
      }

      await socket.join(`channel:${channelId}`);
      socket.data.joinedChannels.add(channelId);

      callback?.({ success: true });
    } catch (error) {
      callback?.({ success: false, error: { message: 'Failed to join channel', code: 'INTERNAL_ERROR' } });
    }
  });

  socket.on('leave:channel', async (channelId, callback) => {
    try {
      await socket.leave(`channel:${channelId}`);
      socket.data.joinedChannels.delete(channelId);

      callback?.({ success: true });
    } catch (error) {
      callback?.({ success: false, error: { message: 'Failed to leave channel', code: 'INTERNAL_ERROR' } });
    }
  });

  socket.on('message:send', async (data, callback) => {
    try {
      const { channelId, content } = data;

      const message = await messageService.sendMessage(channelId, userId, content);
      const serverId = await channelService.getChannelServerId(channelId);

      const messagePayload: MessagePayload = {
        id: message.id,
        channelId: message.channelId,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        author: {
          id: userId,
          username,
        },
      };

      io.to(`channel:${channelId}`).emit('message:new', messagePayload);

      callback?.({ success: true, data: messagePayload });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send message';
      callback?.({ success: false, error: { message, code: 'INTERNAL_ERROR' } });
    }
  });

  socket.on('typing:start', async (channelId) => {
    try {
      const channel = await channelRepository.findById(channelId);
      if (!channel) return;

      const membership = await serverMemberRepository.findMembership(channel.serverId, userId);
      if (!membership) return;

      socket.to(`channel:${channelId}`).emit('typing:start', { userId, username, channelId });
    } catch {
      // Silently ignore typing errors
    }
  });

  socket.on('typing:stop', async (channelId) => {
    try {
      const channel = await channelRepository.findById(channelId);
      if (!channel) return;

      const membership = await serverMemberRepository.findMembership(channel.serverId, userId);
      if (!membership) return;

      socket.to(`channel:${channelId}`).emit('typing:stop', { userId, channelId });
    } catch {
      // Silently ignore typing errors
    }
  });

  socket.on('disconnect', () => {
    for (const serverId of socket.data.joinedServers) {
      const count = decrementPresence(serverId, userId);
      if (count === 0) {
        socket.to(`server:${serverId}`).emit('user:offline', { userId, serverId });
      }
    }
  });
}

export function createSocketEmitters(io: TypedServer) {
  return {
    emitToServer(serverId: string, event: keyof typeof io.to, data: unknown) {
      io.to(`server:${serverId}`).emit(event as never, data as never);
    },

    emitToChannel(channelId: string, event: keyof typeof io.to, data: unknown) {
      io.to(`channel:${channelId}`).emit(event as never, data as never);
    },

    emitUserJoined(serverId: string, userId: string, username: string) {
      io.to(`server:${serverId}`).emit('user:joined', { userId, username, serverId });
    },

    emitUserLeft(serverId: string, userId: string, username: string) {
      io.to(`server:${serverId}`).emit('user:left', { userId, username, serverId });
    },

    emitMessageNew(channelId: string, payload: MessagePayload) {
      io.to(`channel:${channelId}`).emit('message:new', payload);
    },

    emitMessageDeleted(channelId: string, messageId: string) {
      io.to(`channel:${channelId}`).emit('message:deleted', { messageId, channelId });
    },

    emitChannelCreated(serverId: string, channel: { id: string; serverId: string; name: string; createdAt: Date; updatedAt: Date }) {
      io.to(`server:${serverId}`).emit('channel:created', {
        id: channel.id,
        serverId: channel.serverId,
        name: channel.name,
        createdAt: channel.createdAt.toISOString(),
        updatedAt: channel.updatedAt.toISOString(),
      });
    },

    emitChannelUpdated(serverId: string, channel: { id: string; serverId: string; name: string; createdAt: Date; updatedAt: Date }) {
      io.to(`server:${serverId}`).emit('channel:updated', {
        id: channel.id,
        serverId: channel.serverId,
        name: channel.name,
        createdAt: channel.createdAt.toISOString(),
        updatedAt: channel.updatedAt.toISOString(),
      });
    },

    emitChannelDeleted(serverId: string, channelId: string) {
      io.to(`server:${serverId}`).emit('channel:deleted', { channelId, serverId });
    },

    emitMemberRoleUpdated(serverId: string, userId: string, role: string) {
      io.to(`server:${serverId}`).emit('member:role_updated', { userId, serverId, role });
    },

    emitServerUpdated(serverId: string, name: string) {
      io.to(`server:${serverId}`).emit('server:updated', { serverId, name });
    },

    getOnlineUsers(serverId: string): string[] {
      const room = io.sockets.adapter.rooms.get(`server:${serverId}`);
      if (!room) return [];

      const onlineUsers: string[] = [];
      for (const socketId of room) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket?.data.userId) {
          onlineUsers.push(socket.data.userId);
        }
      }
      return [...new Set(onlineUsers)];
    },
  };
}
