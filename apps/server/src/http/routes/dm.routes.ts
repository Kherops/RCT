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

      const emitters = getEmitters();
      conversation.participantIds.forEach((participantId) => {
        emitters.emitDmCreated(participantId, conversation);
      });

      res.status(201).json(conversation);
    } catch (error) {
      next(error);
    }
  }
);

router.get('/dm/conversations', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { serverId } = req.query as { serverId?: string };
    const conversations = await directService.getUserConversations(userId, serverId);
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
      const { limit, cursor, serverId } = req.query as { limit?: number; cursor?: string; serverId?: string };
      const result = await directService.getConversationMessages(req.params.id, userId, { limit, cursor, serverId });
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
      const { conversation, message } = await directService.sendMessage(
        req.params.id,
        userId,
        req.body.content,
        req.body.gifUrl,
        req.body.replyToMessageId,
      );

      const replyTo = message.replyTo
        ? {
            ...message.replyTo,
            createdAt: message.replyTo.createdAt.toISOString(),
            deletedAt: message.replyTo.deletedAt ? message.replyTo.deletedAt.toISOString() : null,
          }
        : null;

      const author = message.author as { id: string; username: string } | null;
      const payload = {
        id: message.id,
        conversationId: conversation.id,
        content: message.content,
        gifUrl: message.gifUrl ?? null,
        createdAt: message.createdAt.toISOString(),
        updatedAt: message.updatedAt.toISOString(),
        author: {
          id: author?.id ?? userId,
          username: author?.username || 'Unknown',
        },
        replyTo,
      };

      const emitters = getEmitters();
      emitters.emitDmNew(conversation.id, payload);
      emitters.emitDmNewToUsers(conversation.participantIds, payload);

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
      const { conversationId, participantIds } = await directService.deleteMessage(req.params.id, userId);

      const emitters = getEmitters();
      emitters.emitDmDeleted(conversationId, req.params.id);
      emitters.emitDmDeletedToUsers(participantIds, req.params.id, conversationId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export default router;
