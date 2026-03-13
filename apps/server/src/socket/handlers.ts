import type {
  TypedSocket,
  TypedServer,
  MessagePayload,
  DirectMessagePayload,
  DirectConversationPayload,
  DirectMessageReadPayload,
} from "./types.js";
import { serverMemberRepository } from "../repositories/server.repository.js";
import { channelRepository } from "../repositories/channel.repository.js";
import { messageService } from "../services/message.service.js";
import { directService } from "../services/direct.service.js";
import { banService } from "../services/ban.service.js";

const serverPresenceCounts = new Map<string, number>();
const serverPresenceStatuses = new Map<string, "online" | "busy" | "dnd">();

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
    serverPresenceStatuses.delete(key);
    return 0;
  }
  serverPresenceCounts.set(key, next);
  return next;
}

function listOnlineUsers(io: TypedServer, serverId: string): string[] {
  const room = io.sockets.adapter.rooms.get(`server:${serverId}`);
  if (!room) return [];
  const onlineUsers = new Set<string>();
  for (const socketId of room) {
    const client = io.sockets.sockets.get(socketId);
    if (client?.data.userId) {
      onlineUsers.add(client.data.userId);
    }
  }
  return [...onlineUsers];
}

function getPresenceStatus(serverId: string, userId: string) {
  return serverPresenceStatuses.get(presenceKey(serverId, userId));
}

function setPresenceStatus(
  serverId: string,
  userId: string,
  status: "online" | "busy" | "dnd",
) {
  serverPresenceStatuses.set(presenceKey(serverId, userId), status);
}

function buildStatusMap(serverId: string, userIds: string[]) {
  const statuses: Record<string, "online" | "busy" | "dnd"> = {};
  userIds.forEach((userId) => {
    const status = getPresenceStatus(serverId, userId) ?? "online";
    statuses[userId] = status;
  });
  return statuses;
}

function formatReplySummary(
  replyTo:
    | {
        id: string;
        content: string | null;
        gifUrl?: string | null;
        createdAt: Date;
        author: { id: string; username: string; avatarUrl?: string | null } | null;
        deletedAt?: Date | null;
      }
    | null
    | undefined,
) {
  if (!replyTo) return null;
  return {
    id: replyTo.id,
    content: replyTo.content,
    gifUrl: replyTo.gifUrl ?? null,
    createdAt: replyTo.createdAt.toISOString(),
    author: replyTo.author,
    deletedAt: replyTo.deletedAt ? replyTo.deletedAt.toISOString() : null,
  };
}

export function registerSocketHandlers(io: TypedServer, socket: TypedSocket) {
  const { userId, username, avatarUrl, status: userStatus } = socket.data;

  socket.on("join:server", async (serverId, callback) => {
    try {
      const ban = await banService.getActiveBan(serverId, userId);
      if (ban) {
        return callback?.({
          success: false,
          error: { message: "You are banned from this server", code: "BANNED" },
        });
      }

      const membership = await serverMemberRepository.findMembership(
        serverId,
        userId,
      );
      if (!membership) {
        return callback?.({
          success: false,
          error: { message: "Not a member of this server", code: "FORBIDDEN" },
        });
      }
      if (process.env.NODE_ENV === "test") {
        console.log(
          "[TestDebug] join:server membership found for",
          userId,
          "in",
          serverId,
        );
      }

      await socket.join(`server:${serverId}`);
      socket.data.joinedServers.add(serverId);

      const count = incrementPresence(serverId, userId);
      if (count === 1) {
        setPresenceStatus(serverId, userId, userStatus ?? "online");
        if (process.env.NODE_ENV === "test") {
          const roomSize =
            io.sockets.adapter.rooms.get(`server:${serverId}`)?.size ?? 0;
          console.log("[TestDebug] emit user:online", {
            userId,
            serverId,
            roomSize,
          });
        }
        io.to(`server:${serverId}`).emit("user:online", { userId, serverId });
      }

      const onlineUserIds = listOnlineUsers(io, serverId);
      callback?.({
        success: true,
        data: {
          onlineUserIds,
          statuses: buildStatusMap(serverId, onlineUserIds),
        },
      });
    } catch {
      callback?.({
        success: false,
        error: { message: "Failed to join server", code: "INTERNAL_ERROR" },
      });
    }
  });

  socket.on("leave:server", async (serverId, callback) => {
    try {
      await socket.leave(`server:${serverId}`);
      socket.data.joinedServers.delete(serverId);

      const count = decrementPresence(serverId, userId);
      if (count === 0) {
        if (process.env.NODE_ENV === "test") {
          const roomSize =
            io.sockets.adapter.rooms.get(`server:${serverId}`)?.size ?? 0;
          console.log("[TestDebug] emit user:offline", {
            userId,
            serverId,
            roomSize,
          });
        }
        io.to(`server:${serverId}`).emit("user:offline", { userId, serverId });
      }

      callback?.({ success: true });
    } catch {
      callback?.({
        success: false,
        error: { message: "Failed to leave server", code: "INTERNAL_ERROR" },
      });
    }
  });

  socket.on("status:update", async (serverId, status, callback) => {
    try {
      if (!socket.data.joinedServers.has(serverId)) {
        return callback?.({
          success: false,
          error: { message: "Not joined to this server", code: "FORBIDDEN" },
        });
      }
      const membership = await serverMemberRepository.findMembership(
        serverId,
        userId,
      );
      if (!membership) {
        return callback?.({
          success: false,
          error: { message: "Not a member of this server", code: "FORBIDDEN" },
        });
      }
      setPresenceStatus(serverId, userId, status);
      socket.data.status = status;
      io.to(`server:${serverId}`).emit("user:status", {
        userId,
        serverId,
        status,
      });
      callback?.({ success: true });
    } catch {
      callback?.({
        success: false,
        error: { message: "Failed to update status", code: "INTERNAL_ERROR" },
      });
    }
  });

  socket.on("join:dm", async (conversationId, callback) => {
    try {
      await directService.requireParticipation(conversationId, userId);

      await socket.join(`dm:${conversationId}`);
      socket.data.joinedDms.add(conversationId);

      callback?.({ success: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to join conversation";
      callback?.({ success: false, error: { message, code: "FORBIDDEN" } });
    }
  });

  socket.on("leave:dm", async (conversationId, callback) => {
    try {
      await socket.leave(`dm:${conversationId}`);
      socket.data.joinedDms.delete(conversationId);
      callback?.({ success: true });
    } catch {
      callback?.({
        success: false,
        error: {
          message: "Failed to leave conversation",
          code: "INTERNAL_ERROR",
        },
      });
    }
  });

  socket.on("message:send", async (data, callback) => {
    try {
      const { channelId, content, gifUrl, replyToMessageId } = data;

      const { message, serverId } = await messageService.sendMessage(
        channelId,
        userId,
        content,
        gifUrl,
        replyToMessageId,
      );

      const messagePayload: MessagePayload = {
        id: message.id,
        channelId: message.channelId,
        content: message.content,
        gifUrl: message.gifUrl ?? null,
        createdAt: message.createdAt.toISOString(),
        author: {
          id: userId,
          username,
          avatarUrl: avatarUrl ?? null,
        },
        replyTo: formatReplySummary(message.replyTo ?? null),
      };

      io.to(`server:${serverId}`).emit("message:new", messagePayload);

      callback?.({ success: true, data: messagePayload });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send message";
      callback?.({
        success: false,
        error: { message, code: "INTERNAL_ERROR" },
      });
    }
  });

  socket.on("dm:send", async (data, callback) => {
    try {
      const { conversationId, content, gifUrl, replyToMessageId } = data;
      const { conversation, message } = await directService.sendMessage(
        conversationId,
        userId,
        content,
        gifUrl,
        replyToMessageId,
      );

      const payload: DirectMessagePayload = {
        id: message.id,
        conversationId: conversation.id,
        content: message.content,
        gifUrl: message.gifUrl ?? null,
        createdAt: message.createdAt.toISOString(),
        updatedAt: message.updatedAt.toISOString(),
        author: {
          id: userId,
          username,
          avatarUrl: avatarUrl ?? null,
        },
        replyTo: formatReplySummary(message.replyTo ?? null),
      };

      io.to(`dm:${conversationId}`).emit("dm:new", payload);
      conversation.participantIds.forEach((participantId) => {
        io.to(`user:${participantId}`).emit("dm:new", payload);
      });

      callback?.({ success: true, data: payload });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to send direct message";
      callback?.({
        success: false,
        error: { message, code: "INTERNAL_ERROR" },
      });
    }
  });

  socket.on("typing:start", async (channelId) => {
    try {
      const channel = await channelRepository.findById(channelId);
      if (!channel) return;

      await banService.requireNotBanned(channel.serverId, userId);

      const membership = await serverMemberRepository.findMembership(
        channel.serverId,
        userId,
      );
      if (!membership) return;

      socket
        .to(`server:${channel.serverId}`)
        .emit("typing:start", { userId, username, channelId });
    } catch {
      // Silently ignore typing errors
    }
  });

  socket.on("typing:stop", async (channelId) => {
    try {
      const channel = await channelRepository.findById(channelId);
      if (!channel) return;

      await banService.requireNotBanned(channel.serverId, userId);

      const membership = await serverMemberRepository.findMembership(
        channel.serverId,
        userId,
      );
      if (!membership) return;

      socket
        .to(`server:${channel.serverId}`)
        .emit("typing:stop", { userId, channelId });
    } catch {
      // Silently ignore typing errors
    }
  });

  socket.on("disconnect", () => {
    for (const serverId of socket.data.joinedServers) {
      const count = decrementPresence(serverId, userId);
      if (count === 0) {
        socket
          .to(`server:${serverId}`)
          .emit("user:offline", { userId, serverId });
      }
    }
  });
}

export function createSocketEmitters(io: TypedServer) {
  return {
    emitUserJoined(serverId: string, userId: string, username: string) {
      io.to(`server:${serverId}`).emit("user:joined", {
        userId,
        username,
        serverId,
      });
    },

    emitUserLeft(serverId: string, userId: string, username: string) {
      io.to(`server:${serverId}`).emit("user:left", {
        userId,
        username,
        serverId,
      });
    },

    emitMessageNew(serverId: string, payload: MessagePayload) {
      io.to(`server:${serverId}`).emit("message:new", payload);
    },

    emitMessageUpdated(serverId: string, payload: MessagePayload) {
      io.to(`server:${serverId}`).emit("message:updated", payload);
    },

    emitMessageDeleted(serverId: string, channelId: string, messageId: string) {
      io.to(`server:${serverId}`).emit("message:deleted", {
        messageId,
        channelId,
      });
    },

    emitDmNew(conversationId: string, payload: DirectMessagePayload) {
      io.to(`dm:${conversationId}`).emit("dm:new", payload);
    },

    emitDmNewToUsers(userIds: string[], payload: DirectMessagePayload) {
      userIds.forEach((userId) => {
        io.to(`user:${userId}`).emit("dm:new", payload);
      });
    },

    emitDmDeleted(conversationId: string, messageId: string) {
      io.to(`dm:${conversationId}`).emit("dm:deleted", {
        messageId,
        conversationId,
      });
    },

    emitDmDeletedToUsers(
      userIds: string[],
      messageId: string,
      conversationId: string,
    ) {
      userIds.forEach((userId) => {
        io.to(`user:${userId}`).emit("dm:deleted", {
          messageId,
          conversationId,
        });
      });
    },

    emitDmRead(conversationId: string, payload: DirectMessageReadPayload) {
      io.to(`dm:${conversationId}`).emit("dm:read", payload);
    },

    emitDmReadToUsers(userIds: string[], payload: DirectMessageReadPayload) {
      userIds.forEach((userId) => {
        io.to(`user:${userId}`).emit("dm:read", payload);
      });
    },

    emitDmCreated(
      userId: string,
      conversation: {
        id: string;
        participantIds: string[];
        createdAt: Date;
        updatedAt: Date;
      },
    ) {
      const payload: DirectConversationPayload = {
        id: conversation.id,
        participantIds: conversation.participantIds,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
      };
      io.to(`user:${userId}`).emit("dm:created", payload);
    },

    emitChannelCreated(
      serverId: string,
      channel: {
        id: string;
        serverId: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
      },
    ) {
      io.to(`server:${serverId}`).emit("channel:created", {
        id: channel.id,
        serverId: channel.serverId,
        name: channel.name,
        createdAt: channel.createdAt.toISOString(),
        updatedAt: channel.updatedAt.toISOString(),
      });
    },

    emitChannelUpdated(
      serverId: string,
      channel: {
        id: string;
        serverId: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
      },
    ) {
      io.to(`server:${serverId}`).emit("channel:updated", {
        id: channel.id,
        serverId: channel.serverId,
        name: channel.name,
        createdAt: channel.createdAt.toISOString(),
        updatedAt: channel.updatedAt.toISOString(),
      });
    },

    emitChannelDeleted(serverId: string, channelId: string) {
      io.to(`server:${serverId}`).emit("channel:deleted", {
        channelId,
        serverId,
      });
    },

    emitMemberRoleUpdated(serverId: string, userId: string, role: string) {
      io.to(`server:${serverId}`).emit("member:role_updated", {
        userId,
        serverId,
        role,
      });
    },

    emitMemberBanned(
      serverId: string,
      userId: string,
      payload: {
        serverId: string;
        userId: string;
        ban: {
          type: "permanent" | "temporary";
          bannedUntil: string | null;
          issuedAt: string;
          issuedBy: string;
          reason: string | null;
        };
        serverNow: string;
      },
    ) {
      io.to(`server:${serverId}`).emit("server:memberBanned", payload);
      io.to(`user:${userId}`).emit("server:memberBanned", payload);
    },

    emitMemberUnbanned(
      serverId: string,
      userId: string,
      payload: {
        serverId: string;
        userId: string;
        ban: {
          type: "permanent" | "temporary";
          bannedUntil: string | null;
          issuedAt: string;
          issuedBy: string;
          reason: string | null;
        };
        serverNow: string;
      },
    ) {
      io.to(`server:${serverId}`).emit("server:memberUnbanned", payload);
      io.to(`user:${userId}`).emit("server:memberUnbanned", payload);
    },

    emitBanUpdated(
      serverId: string,
      userId: string,
      payload: {
        serverId: string;
        userId: string;
        ban: {
          type: "permanent" | "temporary";
          bannedUntil: string | null;
          issuedAt: string;
          issuedBy: string;
          reason: string | null;
        };
        serverNow: string;
      },
    ) {
      io.to(`server:${serverId}`).emit("server:banUpdated", payload);
      io.to(`user:${userId}`).emit("server:banUpdated", payload);
    },

    emitServerUpdated(serverId: string, name: string) {
      io.to(`server:${serverId}`).emit("server:updated", { serverId, name });
    },

    emitMessageReaction(
      serverId: string,
      channelId: string,
      messageId: string,
      reactions: Record<string, string[]>,
    ) {
      io.to(`server:${serverId}`).emit("message:reaction", {
        messageId,
        channelId,
        reactions,
      });
    },

    emitDmReaction(
      conversationId: string,
      messageId: string,
      reactions: Record<string, string[]>,
    ) {
      io.to(`dm:${conversationId}`).emit("dm:reaction", {
        messageId,
        conversationId,
        reactions,
      });
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
