import { Router, Request, Response, NextFunction } from 'express';
import { serverService } from '../../services/server.service.js';
import { authMiddleware, type AuthenticatedRequest } from '../../middlewares/auth.middleware.js';
import { validateBody } from '../../middlewares/validation.middleware.js';
import {
  createServerSchema,
  updateServerSchema,
  joinServerSchema,
  updateMemberRoleSchema,
  transferOwnershipSchema,
  createInviteSchema,
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
    res.json(server);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/leave', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    await serverService.leaveServer(req.params.id, userId);
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

router.put('/:id/members/:memberId', authMiddleware, validateBody(updateMemberRoleSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const member = await serverService.updateMemberRole(
      req.params.id,
      req.params.memberId,
      req.body.role,
      userId
    );
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
