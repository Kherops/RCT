import { Router, Request, Response, NextFunction } from 'express';
import { serverService } from '../../services/server.service.js';
import { moderationService } from '../../services/moderation.service.js';
import { banService, buildBanPayload } from '../../services/ban.service.js';
import { authMiddleware, type AuthenticatedRequest } from '../../middlewares/auth.middleware.js';
import { validateBody } from '../../middlewares/validation.middleware.js';
import { userRepository } from '../../repositories/user.repository.js';
import { getEmitters } from '../../socket/index.js';
import {
  createServerSchema,
  updateServerSchema,
  joinServerSchema,
  updateMemberRoleSchema,
  transferOwnershipSchema,
  createInviteSchema,
  reportUserSchema,
  banUserSchema,
} from '../schemas/server.schema.js';

const router = Router();

router.post('/', authMiddleware, validateBody(createServerSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const server = await serverService.createServer(userId, req.body.name);
    res.status(201).json(server);
  } catch (error) {
    next(error);
  }
});

router.get('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const servers = await serverService.getUserServers(userId);
    res.json(servers);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const server = await serverService.getServer(req.params.id, userId);
    res.json(server);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authMiddleware, validateBody(updateServerSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const server = await serverService.updateServer(req.params.id, userId, req.body);

    try {
      getEmitters().emitServerUpdated(req.params.id, server.name);
    } catch (e) {
      // Socket not initialized (test environment)
    }

    res.json(server);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    await serverService.deleteServer(req.params.id, userId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post('/:id/join', authMiddleware, validateBody(joinServerSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const server = await serverService.joinServer(userId, req.body.inviteCode);

    const user = await userRepository.findById(userId);
    if (user) {
      try {
        getEmitters().emitUserJoined(server.id, user.id, user.username);
      } catch (e) {
        // Socket not initialized (test environment)
      }
    }

    res.json(server);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/leave', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    await serverService.leaveServer(req.params.id, userId);

    const user = await userRepository.findById(userId);
    if (user) {
      try {
        getEmitters().emitUserLeft(req.params.id, user.id, user.username);
      } catch (e) {
        // Socket not initialized (test environment)
      }
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get('/:id/members', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const members = await serverService.getMembers(req.params.id, userId);
    res.json(members);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/ban-status', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const status = await banService.getBanStatus(req.params.id, userId);
    const serverNow = status.serverTime;
    const banPayload = status.ban ? buildBanPayload(status.ban, serverNow) : null;
    res.json({
      isBanned: status.isBanned,
      ban: banPayload ? banPayload.ban : null,
      serverNow: serverNow.toISOString(),
      banned: status.isBanned,
      type: status.ban?.type ?? null,
      expiresAt: status.ban?.expiresAt ? status.ban.expiresAt.toISOString() : null,
      remainingMs: status.remainingMs ?? null,
      reason: status.ban?.reason ?? null,
      serverTime: serverNow.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/blocks', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const blockedUserIds = await moderationService.listBlockedIds(req.params.id, userId);
    res.json({ blockedUserIds });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/users/:userId/block', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId: actorId } = req as AuthenticatedRequest;
    await moderationService.blockUser(actorId, req.params.userId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/users/:userId/block', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId: actorId } = req as AuthenticatedRequest;
    await moderationService.unblockUser(actorId, req.params.userId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post(
  '/:id/users/:userId/report',
  authMiddleware,
  validateBody(reportUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId: actorId } = req as AuthenticatedRequest;
      const report = await moderationService.reportUser(
        actorId,
        req.params.userId,
        req.params.id,
        {
          reason: req.body.reason,
          messageId: req.body.messageId,
          channelId: req.body.channelId,
        }
      );
      res.status(201).json(report);
    } catch (error) {
      next(error);
    }
  }
);

async function handleBanMember(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { userId: actorId } = req as AuthenticatedRequest;
    const serverId = req.params.id;
    const targetUserId = req.params.userId;
    const existing = await banService.getActiveBan(serverId, targetUserId);

    const ban = await banService.banMember(serverId, targetUserId, actorId, {
      type: req.body.type,
      durationSeconds: req.body.durationSeconds,
      durationMinutes: req.body.durationMinutes,
      expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
      reason: req.body.reason ?? null,
    });

    const serverNow = new Date();
    const payload = buildBanPayload(ban, serverNow);

    try {
      const emitters = getEmitters();
      if (existing) {
        emitters.emitBanUpdated(serverId, targetUserId, payload);
      } else {
        emitters.emitMemberBanned(serverId, targetUserId, payload);
      }
    } catch {
      // Socket not initialized (test environment)
    }

    res.status(201).json({
      id: ban.id,
      serverId: ban.serverId,
      userId: ban.userId,
      type: ban.type,
      reason: ban.reason ?? null,
      createdAt: ban.createdAt.toISOString(),
      expiresAt: ban.expiresAt ? ban.expiresAt.toISOString() : null,
    });
  } catch (error) {
    next(error);
  }
}

router.post(
  '/:id/users/:userId/ban',
  authMiddleware,
  validateBody(banUserSchema),
  handleBanMember,
);

router.post(
  '/:id/members/:userId/ban',
  authMiddleware,
  validateBody(banUserSchema),
  handleBanMember,
);

async function handleUnbanMember(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { userId: actorId } = req as AuthenticatedRequest;
    const serverId = req.params.id;
    const targetUserId = req.params.userId;

    const existing = await banService.getActiveBan(serverId, targetUserId);
    await banService.unbanMember(serverId, targetUserId, actorId);

    if (existing) {
      const serverNow = new Date();
      const payload = buildBanPayload(existing, serverNow);
      try {
        getEmitters().emitMemberUnbanned(serverId, targetUserId, payload);
      } catch {
        // Socket not initialized (test environment)
      }
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

router.post(
  '/:id/users/:userId/unban',
  authMiddleware,
  handleUnbanMember,
);

router.post(
  '/:id/members/:userId/unban',
  authMiddleware,
  handleUnbanMember,
);

router.put('/:id/members/:memberId', authMiddleware, validateBody(updateMemberRoleSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const member = await serverService.updateMemberRole(
      req.params.id,
      req.params.memberId,
      req.body.role,
      userId
    );

    try {
      getEmitters().emitMemberRoleUpdated(req.params.id, req.params.memberId, member.role);
    } catch (e) {
      // Socket not initialized (test environment)
    }

    res.json(member);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/transfer-ownership', authMiddleware, validateBody(transferOwnershipSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const server = await serverService.transferOwnership(req.params.id, req.body.newOwnerId, userId);
    res.json(server);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/members/:memberId', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    await serverService.kickMember(req.params.id, req.params.memberId, userId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post('/:id/invites', authMiddleware, validateBody(createInviteSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const invite = await serverService.createInvite(req.params.id, userId, {
      expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
      maxUses: req.body.maxUses,
    });
    res.status(201).json(invite);
  } catch (error) {
    next(error);
  }
});

export default router;
