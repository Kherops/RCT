import { Router, Request, Response, NextFunction } from 'express';
import { userRepository } from '../../repositories/user.repository.js';
import { authMiddleware, type AuthenticatedRequest } from '../../middlewares/auth.middleware.js';
import { validateBody } from '../../middlewares/validation.middleware.js';
import { updateProfileSchema } from '../schemas/user.schema.js';
import { NotFoundError } from '../../domain/errors.js';
import { authService } from '../../services/auth.service.js';

const router = Router();

router.patch('/me', authMiddleware, validateBody(updateProfileSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const updates: { bio?: string; avatarUrl?: string; status?: "online" | "busy" | "dnd" } = {};
    if (req.body.bio !== undefined) updates.bio = req.body.bio;
    if (req.body.avatarUrl !== undefined) updates.avatarUrl = req.body.avatarUrl;
    if (req.body.status !== undefined) updates.status = req.body.status;
    await userRepository.update(userId, updates);
    const user = await authService.getMe(userId);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await userRepository.findById(req.params.id);
    if (!user) {
      throw new NotFoundError('User');
    }
    res.json({
      id: user.id,
      username: user.username,
      bio: user.bio ?? '',
      avatarUrl: user.avatarUrl ?? '',
      status: user.status ?? 'online',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
