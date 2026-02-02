import {
  directConversationRepository,
  directMessageRepository,
  serverMemberRepository,
  serverRepository,
  userBlockRepository,
  userReportRepository,
  userRepository,
} from "../repositories/index.js";
import { AppError, BadRequestError } from "../domain/errors.js";
import { getCollections } from "../lib/mongo.js";
import { stripMongoId } from "../lib/mongo-utils.js";
import type { Server, User } from "../domain/types.js";

const SYSTEM_ADMIN_USER_ID = "system-admin";
const SYSTEM_ADMIN_USERNAME = "Admin Bot";
const SYSTEM_ADMIN_EMAIL = "system-admin@rtc.local";
const SYSTEM_ADMIN_PASSWORD_HASH = "SYSTEM_USER";

type AdminAction = "blocked" | "reported";

async function ensureSystemUser(): Promise<User> {
  const { users } = await getCollections();
  const existing = await users.findOne({ id: SYSTEM_ADMIN_USER_ID });
  if (existing) {
    return stripMongoId(existing);
  }

  const now = new Date();
  const systemUser: User = {
    id: SYSTEM_ADMIN_USER_ID,
    username: SYSTEM_ADMIN_USERNAME,
    email: SYSTEM_ADMIN_EMAIL,
    bio: "System notifications",
    avatarUrl: "",
    passwordHash: SYSTEM_ADMIN_PASSWORD_HASH,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await users.insertOne(systemUser);
    return systemUser;
  } catch {
    const retry = await users.findOne({ id: SYSTEM_ADMIN_USER_ID });
    if (retry) {
      return stripMongoId(retry);
    }
    throw new Error("Failed to create system user");
  }
}

function formatAdminMessage(input: {
  action: AdminAction;
  reporter: User | null;
  reported: User | null;
  server: Server;
  reason?: string | null;
  messageId?: string | null;
  channelId?: string | null;
  timestamp: string;
}) {
  const reporterLabel = input.reporter?.username || input.reporter?.id || "Unknown";
  const reportedLabel = input.reported?.username || input.reported?.id || "Unknown";
  const verb = input.action === "reported" ? "a signalé" : "a bloqué";

  const lines = [
    `${reporterLabel} ${verb} ${reportedLabel}`,
    `Server: ${input.server.name} (${input.server.id})`,
    `ReporterId: ${input.reporter?.id || "unknown"}`,
    `ReportedId: ${input.reported?.id || "unknown"}`,
    `Timestamp: ${input.timestamp}`,
  ];

  if (input.reason) {
    lines.push(`Reason: ${input.reason}`);
  }
  if (input.messageId) {
    lines.push(`MessageId: ${input.messageId}`);
  }
  if (input.channelId) {
    lines.push(`ChannelId: ${input.channelId}`);
  }

  return lines.join("\n");
}

async function sendAdminDm(options: {
  server: Server;
  reporterId: string;
  reportedId: string;
  action: AdminAction;
  reason?: string | null;
  messageId?: string | null;
  channelId?: string | null;
}) {
  const attemptSend = async () => {
    const [systemUser, reporter, reported] = await Promise.all([
      ensureSystemUser(),
      userRepository.findById(options.reporterId),
      userRepository.findById(options.reportedId),
    ]);

    const conversation = await directConversationRepository.create([
      systemUser.id,
      options.server.ownerId,
    ]);

    const timestamp = new Date().toISOString();
    const content = formatAdminMessage({
      action: options.action,
      reporter,
      reported,
      server: options.server,
      reason: options.reason,
      messageId: options.messageId,
      channelId: options.channelId,
      timestamp,
    });

    await directMessageRepository.create({
      conversationId: conversation.id,
      authorId: systemUser.id,
      content,
    });
    await directConversationRepository.touch(conversation.id);
  };

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await attemptSend();
      return;
    } catch (error) {
      if (attempt === 2) {
        console.warn("[Admin DM] Failed to send notification", error);
      }
    }
  }
}

export const moderationService = {
  async listBlockedIds(serverId: string, blockerId: string) {
    const server = await serverRepository.findById(serverId);
    if (!server) {
      throw new AppError(404, "Server not found", "SERVER_NOT_FOUND");
    }

    const membership = await serverMemberRepository.findMembership(
      serverId,
      blockerId,
    );
    if (!membership) {
      throw new AppError(403, "You are not a member of this server", "NOT_MEMBER");
    }

    return userBlockRepository.listBlockedIds(blockerId, serverId);
  },

  async blockUser(blockerId: string, blockedId: string, serverId: string) {
    if (blockerId === blockedId) {
      throw new BadRequestError("You cannot block yourself");
    }

    const server = await serverRepository.findById(serverId);
    if (!server) {
      throw new AppError(404, "Server not found", "SERVER_NOT_FOUND");
    }

    const blockerMembership = await serverMemberRepository.findMembership(
      serverId,
      blockerId,
    );
    if (!blockerMembership) {
      throw new AppError(403, "You are not a member of this server", "NOT_MEMBER");
    }

    const blockedMembership = await serverMemberRepository.findMembership(
      serverId,
      blockedId,
    );
    if (!blockedMembership) {
      throw new AppError(403, "User is not a member of this server", "NOT_MEMBER");
    }

    const { created } = await userBlockRepository.createIfMissing(
      blockerId,
      blockedId,
      serverId,
    );

    if (created) {
      await sendAdminDm({
        server,
        reporterId: blockerId,
        reportedId: blockedId,
        action: "blocked",
      });
    }
  },

  async unblockUser(blockerId: string, blockedId: string, serverId: string) {
    const server = await serverRepository.findById(serverId);
    if (!server) {
      throw new AppError(404, "Server not found", "SERVER_NOT_FOUND");
    }

    const membership = await serverMemberRepository.findMembership(
      serverId,
      blockerId,
    );
    if (!membership) {
      throw new AppError(403, "You are not a member of this server", "NOT_MEMBER");
    }

    await userBlockRepository.delete(blockerId, blockedId, serverId);
  },

  async reportUser(
    reporterId: string,
    reportedId: string,
    serverId: string,
    payload?: { reason?: string | null; messageId?: string | null; channelId?: string | null },
  ) {
    if (reporterId === reportedId) {
      throw new BadRequestError("You cannot report yourself");
    }

    const server = await serverRepository.findById(serverId);
    if (!server) {
      throw new AppError(404, "Server not found", "SERVER_NOT_FOUND");
    }

    const reporterMembership = await serverMemberRepository.findMembership(
      serverId,
      reporterId,
    );
    if (!reporterMembership) {
      throw new AppError(403, "You are not a member of this server", "NOT_MEMBER");
    }

    const reportedMembership = await serverMemberRepository.findMembership(
      serverId,
      reportedId,
    );
    if (!reportedMembership) {
      throw new AppError(403, "User is not a member of this server", "NOT_MEMBER");
    }

    const report = await userReportRepository.create({
      reporterId,
      reportedId,
      serverId,
      reason: payload?.reason ?? null,
      messageId: payload?.messageId ?? null,
      channelId: payload?.channelId ?? null,
    });

    await sendAdminDm({
      server,
      reporterId,
      reportedId,
      action: "reported",
      reason: payload?.reason ?? null,
      messageId: payload?.messageId ?? null,
      channelId: payload?.channelId ?? null,
    });

    return report;
  },
};
