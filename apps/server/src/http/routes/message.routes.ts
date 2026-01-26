import { Router, Request, Response, NextFunction } from 'express';
import { messageService } from '../../services/message.service.js';
import { authMiddleware, type AuthenticatedRequest } from '../../middlewares/auth.middleware.js';
import { validateBody, validateQuery } from '../../middlewares/validation.middleware.js';
import { createMessageSchema, getMessagesQuerySchema } from '../schemas/message.schema.js';

const router = Router();

router.post('/channels/:channelId/messages', authMiddleware, validateBody(createMessageSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const message = await messageService.sendMessage(req.params.channelId, userId, req.body.content);
    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
});

router.get('/channels/:channelId/messages', authMiddleware, validateQuery(getMessagesQuerySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { limit, cursor } = req.query as { limit?: number; cursor?: string };
    const result = await messageService.getChannelMessages(req.params.channelId, userId, { limit, cursor });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.delete('/messages/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    await messageService.deleteMessage(req.params.id, userId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
