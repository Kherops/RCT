import { Router, Request, Response, NextFunction } from 'express';
import { authService } from '../../services/auth.service.js';
import { authMiddleware, type AuthenticatedRequest } from '../../middlewares/auth.middleware.js';
import { validateBody } from '../../middlewares/validation.middleware.js';
import { signupSchema, loginSchema, refreshSchema } from '../schemas/auth.schema.js';
import { updateProfileSchema } from '../schemas/user.schema.js';
import { userRepository } from '../../repositories/user.repository.js';

const router = Router();

router.post('/signup', validateBody(signupSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.signup(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/login', validateBody(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/logout', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', validateBody(refreshSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.refreshTokens(req.body.refreshToken);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/me', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const user = await authService.getMe(userId);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.patch('/me', authMiddleware, validateBody(updateProfileSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const updates: { bio?: string; avatarUrl?: string } = {};
    if (req.body.bio !== undefined) updates.bio = req.body.bio;
    if (req.body.avatarUrl !== undefined) updates.avatarUrl = req.body.avatarUrl;
    await userRepository.update(userId, updates);
    const user = await authService.getMe(userId);
    res.json(user);
  } catch (error) {
    next(error);
  }
});

export default router;
