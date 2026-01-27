import { Router, Request, Response, NextFunction } from 'express';
import { directService } from '../../services/direct.service.js';
import { authMiddleware, type AuthenticatedRequest } from '../../middlewares/auth.middleware.js';
import { validateBody, validateParams, validateQuery } from '../../middlewares/validation.middleware.js';
import {
  createConversationSchema,
  conversationParamsSchema,
  createDirectMessageSchema,
  getDirectMessagesQuerySchema,
  directMessageParamsSchema,
} from '../schemas/dm.schema.js';
import { getEmitters } from '../../socket/index.js';

const router = Router();

router.post(
  '/dm/conversations',
  authMiddleware,
  validateBody(createConversationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req as AuthenticatedRequest;
      const conversation = await directService.createOrGetConversation(userId, req.body.targetUserId);
      res.status(201).json(conversation);
    } catch (error) {
      next(error);
    }
  }
);

router.get('/dm/conversations', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const conversations = await directService.getUserConversations(userId);
    res.json(conversations);
  } catch (error) {
    next(error);
  }
});

router.get(
  '/dm/conversations/:id/messages',
  authMiddleware,
  validateParams(conversationParamsSchema),
  validateQuery(getDirectMessagesQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { limit, cursor } = req.query as { limit?: number; cursor?: string };
      const result = await directService.getConversationMessages(req.params.id, userId, { limit, cursor });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/dm/conversations/:id/messages',
  authMiddleware,
  validateParams(conversationParamsSchema),
  validateBody(createDirectMessageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { conversation, message } = await directService.sendMessage(req.params.id, userId, req.body.content);

      const payload = {
        id: message.id,
        conversationId: conversation.id,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        author: {
          id: userId,
          username: message.author?.username || 'Unknown',
        },
      };

      getEmitters().emitDmNew(conversation.id, payload);

      res.status(201).json({
        ...message,
        conversationId: conversation.id,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/dm/messages/:id',
  authMiddleware,
  validateParams(directMessageParamsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { conversationId } = await directService.deleteMessage(req.params.id, userId);

      getEmitters().emitDmDeleted(conversationId, req.params.id);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
