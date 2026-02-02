import { Router, Request, Response, NextFunction } from 'express';
import { channelService } from '../../services/channel.service.js';
import { authMiddleware, type AuthenticatedRequest } from '../../middlewares/auth.middleware.js';
import { validateBody } from '../../middlewares/validation.middleware.js';
import { createChannelSchema, updateChannelSchema } from '../schemas/channel.schema.js';
import { getEmitters } from '../../socket/index.js';
import { BadRequestError } from '../../domain/errors.js';

const router = Router();

router.post('/servers/:serverId/channels', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createChannelSchema.safeParse(req.body);
    if (!parsed.success) {
      const issues = parsed.error.issues;
      const visibilityIssue = issues.find((issue) => issue.path[0] === 'visibility');
      if (visibilityIssue) {
        throw new BadRequestError('INVALID_VISIBILITY');
      }
      const nameIssue = issues.find((issue) => issue.path[0] === 'name');
      if (nameIssue) {
        throw new BadRequestError('NAME_REQUIRED');
      }
      throw new BadRequestError('INVALID_CHANNEL');
    }
    req.body = parsed.data;

    const { userId } = req as AuthenticatedRequest;
    const channel = await channelService.createChannel(req.params.serverId, userId, req.body.name);

    getEmitters().emitChannelCreated(req.params.serverId, channel);

    res.status(201).json(channel);
  } catch (error) {
    next(error);
  }
});

router.get('/servers/:serverId/channels', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const channels = await channelService.getServerChannels(req.params.serverId, userId);
    res.json(channels);
  } catch (error) {
    next(error);
  }
});

router.get('/channels/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const channel = await channelService.getChannel(req.params.id, userId);
    res.json(channel);
  } catch (error) {
    next(error);
  }
});

router.put('/channels/:id', authMiddleware, validateBody(updateChannelSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const channel = await channelService.updateChannel(req.params.id, userId, req.body);

    const serverId = await channelService.getChannelServerId(req.params.id);
    getEmitters().emitChannelUpdated(serverId, channel);

    res.json(channel);
  } catch (error) {
    next(error);
  }
});

router.delete('/channels/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const serverId = await channelService.getChannelServerId(req.params.id);
    await channelService.deleteChannel(req.params.id, userId);

    getEmitters().emitChannelDeleted(serverId, req.params.id);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
