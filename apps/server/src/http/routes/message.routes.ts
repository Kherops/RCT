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
      const { message, serverId } = await messageService.sendMessage(
        req.params.channelId,
        userId,
        req.body.content,
        req.body.gifUrl,
        req.body.replyToMessageId,
      );
      const author = message.author as { id: string; username: string; avatarUrl?: string | null } | null;
      if (!author) {
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

      getEmitters().emitMessageNew(serverId, {
        id: message.id,
        channelId: message.channelId,
        content: message.content,
        gifUrl: message.gifUrl ?? null,
        createdAt: message.createdAt.toISOString(),
        author: {
          id: author.id,
          username: author.username,
          avatarUrl: author.avatarUrl ?? null,
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
      const { channelId, serverId } = await messageService.deleteMessage(
        req.params.id,
        userId,
      );

      getEmitters().emitMessageDeleted(serverId, channelId, req.params.id);

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

      const updatedAuthor = result.message.author as
        | { id: string; username: string; avatarUrl?: string | null }
        | null;

      getEmitters().emitMessageUpdated(result.serverId, {
        id: result.message.id,
        channelId: result.message.channelId,
        content: result.message.content,
        gifUrl: result.message.gifUrl ?? null,
        createdAt: result.message.createdAt.toISOString(),
        updatedAt: result.message.updatedAt.toISOString(),
        author: updatedAuthor
          ? {
              id: updatedAuthor.id,
              username: updatedAuthor.username,
              avatarUrl: updatedAuthor.avatarUrl ?? null,
            }
          : {
              id: userId,
              username: "Unknown",
              avatarUrl: null,
            },
      });

      res.json(result.message);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
