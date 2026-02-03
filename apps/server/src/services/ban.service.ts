import {
  serverBanRepository,
  serverMemberRepository,
  serverRepository,
} from "../repositories/index.js";
import {
  AppError,
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../domain/errors.js";
import type { BanType, ServerBan } from "../domain/types.js";

export type BanStatus = {
  isBanned: boolean;
  ban?: ServerBan | null;
  remainingMs?: number | null;
  serverTime: Date;
};

export type SocketBanPayload = {
  type: "permanent" | "temporary";
  bannedUntil: string | null;
  issuedAt: string;
  issuedBy: string;
  reason: string | null;
};

export type ServerBanEventPayload = {
  serverId: string;
  userId: string;
  ban: SocketBanPayload;
  serverNow: string;
};

function isExpired(ban: ServerBan, now: Date) {
  if (ban.type !== "TEMPORARY") return false;
  if (!ban.expiresAt) return false;
  return ban.expiresAt.getTime() <= now.getTime();
}

export function buildBanPayload(
  ban: ServerBan,
  serverNow: Date,
): ServerBanEventPayload {
  return {
    serverId: ban.serverId,
    userId: ban.userId,
    ban: {
      type: ban.type === "TEMPORARY" ? "temporary" : "permanent",
      bannedUntil: ban.expiresAt ? ban.expiresAt.toISOString() : null,
      issuedAt: ban.createdAt.toISOString(),
      issuedBy: ban.createdById,
      reason: ban.reason ?? null,
    },
    serverNow: serverNow.toISOString(),
  };
}

export const banService = {
  async getActiveBan(
    serverId: string,
    userId: string,
  ): Promise<ServerBan | null> {
    const ban = await serverBanRepository.findByServerAndUser(serverId, userId);
    if (!ban) {
      return null;
    }

    const now = new Date();
    if (isExpired(ban, now)) {
      await serverBanRepository.deleteById(ban.id);
      return null;
    }

    return ban;
  },

  async getBanStatus(serverId: string, userId: string): Promise<BanStatus> {
    const server = await serverRepository.findById(serverId);
    if (!server) {
      throw new NotFoundError("Server");
    }

    const now = new Date();
    const ban = await this.getActiveBan(serverId, userId);
    if (ban) {
      const remainingMs = ban.expiresAt
        ? Math.max(0, ban.expiresAt.getTime() - now.getTime())
        : null;
      return {
        isBanned: true,
        ban,
        remainingMs,
        serverTime: now,
      };
    }

    const membership = await serverMemberRepository.findMembership(
      serverId,
      userId,
    );
    if (!membership) {
      throw new ForbiddenError("You are not a member of this server");
    }

    return { isBanned: false, serverTime: now, ban: null };
  },

  async requireNotBanned(serverId: string, userId: string): Promise<void> {
    const ban = await this.getActiveBan(serverId, userId);
    if (!ban) return;

    throw new AppError(
      403,
      "You are banned from this server",
      "BANNED",
    );
  },

  async banMember(
    serverId: string,
    targetUserId: string,
    actorUserId: string,
    options: {
      type: BanType;
      durationSeconds?: number;
      durationMinutes?: number;
      expiresAt?: Date;
      reason?: string | null;
    },
  ) {
    const server = await serverRepository.findById(serverId);
    if (!server) {
      throw new NotFoundError("Server");
    }

    if (server.ownerId !== actorUserId) {
      throw new ForbiddenError("Only the owner can ban members");
    }

    if (actorUserId === targetUserId) {
      throw new ForbiddenError("You cannot ban yourself");
    }

    const targetMembership = await serverMemberRepository.findMembership(
      serverId,
      targetUserId,
    );
    if (!targetMembership) {
      throw new NotFoundError("Member");
    }

    if (targetMembership.role === "OWNER") {
      throw new ForbiddenError("Cannot ban the server owner");
    }

    const now = new Date();
    let expiresAt: Date | null = null;

    if (options.type === "TEMPORARY") {
      if (options.expiresAt) {
        if (Number.isNaN(options.expiresAt.getTime())) {
          throw new BadRequestError("Invalid expiration date");
        }
        if (options.expiresAt.getTime() <= now.getTime()) {
          throw new BadRequestError("Ban expiration must be in the future");
        }
        expiresAt = options.expiresAt;
      } else if (typeof options.durationSeconds === "number") {
        if (options.durationSeconds <= 0) {
          throw new BadRequestError("Ban duration must be positive");
        }
        expiresAt = new Date(
          now.getTime() + options.durationSeconds * 1000,
        );
      } else if (typeof options.durationMinutes === "number") {
        if (options.durationMinutes <= 0) {
          throw new BadRequestError("Ban duration must be positive");
        }
        expiresAt = new Date(
          now.getTime() + options.durationMinutes * 60 * 1000,
        );
      } else {
        throw new BadRequestError(
          "Temporary ban requires a duration or expiration date",
        );
      }
    }

    return serverBanRepository.upsert({
      serverId,
      userId: targetUserId,
      createdById: actorUserId,
      type: options.type,
      reason: options.reason ?? null,
      expiresAt,
    });
  },

  async unbanMember(
    serverId: string,
    targetUserId: string,
    actorUserId: string,
  ) {
    const server = await serverRepository.findById(serverId);
    if (!server) {
      throw new NotFoundError("Server");
    }

    if (server.ownerId !== actorUserId) {
      throw new ForbiddenError("Only the owner can unban members");
    }

    if (actorUserId === targetUserId) {
      throw new ForbiddenError("You cannot unban yourself");
    }

    const targetMembership = await serverMemberRepository.findMembership(
      serverId,
      targetUserId,
    );
    if (!targetMembership) {
      throw new NotFoundError("Member");
    }

    if (targetMembership.role === "OWNER") {
      throw new ForbiddenError("Cannot unban the server owner");
    }

    await serverBanRepository.deleteByServerAndUser(serverId, targetUserId);
  },

  async getActiveBansForServer(serverId: string): Promise<ServerBan[]> {
    const bans = await serverBanRepository.findByServer(serverId);
    if (bans.length === 0) return [];
    const now = new Date();
    const active: ServerBan[] = [];

    for (const ban of bans) {
      if (isExpired(ban, now)) {
        await serverBanRepository.deleteById(ban.id);
      } else {
        active.push(ban);
      }
    }

    return active;
  },
};
