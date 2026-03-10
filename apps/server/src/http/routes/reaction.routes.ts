import { Router } from "express";
import { reactionService } from "../../services/reaction.service.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = Router();

router.post("/channel/:messageId/toggle", authMiddleware, async (req, res, next) => {
  try {
    const { emoji } = req.body;
    const { messageId } = req.params;
    const userId = (req as any).userId;

    if (!emoji) {
      return res.status(400).json({ error: { message: "Emoji is required" } });
    }

    const result = await reactionService.toggleChannelMessageReaction(
      messageId,
      userId,
      emoji
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/dm/:messageId/toggle", authMiddleware, async (req, res, next) => {
  try {
    const { emoji } = req.body;
    const { messageId } = req.params;
    const userId = (req as any).userId;

    if (!emoji) {
      return res.status(400).json({ error: { message: "Emoji is required" } });
    }

    const result = await reactionService.toggleDirectMessageReaction(
      messageId,
      userId,
      emoji
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
