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
  banned: boolean;
  type?: BanType;
  expiresAt?: Date | null;
  remainingMs?: number | null;
  reason?: string | null;
  serverTime: Date;
};

function isExpired(ban: ServerBan, now: Date) {
  if (ban.type !== "TEMPORARY") return false;
  if (!ban.expiresAt) return false;
  return ban.expiresAt.getTime() <= now.getTime();
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
        banned: true,
        type: ban.type,
        expiresAt: ban.expiresAt ?? null,
        remainingMs,
        reason: ban.reason ?? null,
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

    return { banned: false, serverTime: now };
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
};
