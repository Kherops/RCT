import { Router, Request, Response, NextFunction } from 'express';
import { messageService } from '../../services/message.service.js';
import { authMiddleware, type AuthenticatedRequest } from '../../middlewares/auth.middleware.js';
import { validateBody, validateQuery } from '../../middlewares/validation.middleware.js';
import { createMessageSchema, getMessagesQuerySchema } from '../schemas/message.schema.js';
import { getEmitters } from '../../socket/index.js';

const router = Router();

router.post('/channels/:channelId/messages', authMiddleware, validateBody(createMessageSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { message, serverId } = await messageService.sendMessage(
      req.params.channelId,
      userId,
      req.body.content,
      req.body.gifUrl,
    );
    if (!message.author) {
      throw new Error('Message author not found');
    }

    getEmitters().emitMessageNew(serverId, {
      id: message.id,
      channelId: message.channelId,
      content: message.content,
      gifUrl: message.gifUrl ?? null,
      createdAt: message.createdAt.toISOString(),
      author: {
        id: message.author.id,
        username: message.author.username,
      },
    });

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
    const { channelId, serverId } = await messageService.deleteMessage(req.params.id, userId);

    getEmitters().emitMessageDeleted(serverId, channelId, req.params.id);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
