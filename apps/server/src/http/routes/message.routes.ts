import { Router, Request, Response, NextFunction } from "express";
import { messageService } from "../../services/message.service.js";
import {
  authMiddleware,
  type AuthenticatedRequest,
} from "../../middlewares/auth.middleware.js";
import {
  validateBody,
  validateQuery,
} from "../../middlewares/validation.middleware.js";
import {
  createMessageSchema,
  getMessagesQuerySchema,
  updateMessageSchema,
} from "../schemas/message.schema.js";
import { getEmitters } from "../../socket/index.js";

const router = Router();

router.post(
  "/channels/:channelId/messages",
  authMiddleware,
  validateBody(createMessageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req as AuthenticatedRequest;
      const message = await messageService.sendMessage(
        req.params.channelId,
        userId,
        req.body.content,
        req.body.gifUrl,
        req.body.replyToMessageId,
      );
      if (!message.author) {
        throw new Error("Message author not found");
      }

      const replyTo = message.replyTo
        ? {
            ...message.replyTo,
            createdAt: message.replyTo.createdAt.toISOString(),
            deletedAt: message.replyTo.deletedAt
              ? message.replyTo.deletedAt.toISOString()
              : null,
          }
        : null;

      getEmitters().emitMessageNew(req.params.channelId, {
        id: message.id,
        channelId: message.channelId,
        content: message.content,
        gifUrl: message.gifUrl ?? null,
        createdAt: message.createdAt.toISOString(),
        updatedAt: message.updatedAt.toISOString(),
        author: {
          id: message.author.id,
          username: message.author.username,
        },
        replyTo,
      });

      res.status(201).json(message);
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/channels/:channelId/messages",
  authMiddleware,
  validateQuery(getMessagesQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { limit, cursor } = req.query as {
        limit?: number;
        cursor?: string;
      };
      const result = await messageService.getChannelMessages(
        req.params.channelId,
        userId,
        { limit, cursor },
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  "/messages/:id",
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { channelId } = await messageService.deleteMessage(
        req.params.id,
        userId,
      );

      getEmitters().emitMessageDeleted(channelId, req.params.id);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/messages/:id",
  authMiddleware,
  validateBody(updateMessageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req as AuthenticatedRequest;
      const result = await messageService.updateMessage(
        req.params.id,
        userId,
        req.body.content,
      );

      getEmitters().emitMessageUpdated(result.channelId, {
        id: result.message.id,
        channelId: result.message.channelId,
        content: result.message.content,
        gifUrl: result.message.gifUrl ?? null,
        createdAt: result.message.createdAt.toISOString(),
        updatedAt: result.message.updatedAt.toISOString(),
        author: result.message.author
          ? {
              id: result.message.author.id,
              username: result.message.author.username,
            }
          : {
              id: userId,
              username: "Unknown",
            },
      });

      res.json(result.message);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
