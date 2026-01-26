import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';
import { UnauthorizedError } from '../domain/errors.js';

export interface AuthenticatedRequest extends Request {
  userId: string;
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.slice(7);
    const payload = authService.verifyAccessToken(token);
    (req as AuthenticatedRequest).userId = payload.userId;
    next();
  } catch (error) {
    next(error);
  }
}

export function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const payload = authService.verifyAccessToken(token);
      (req as AuthenticatedRequest).userId = payload.userId;
    }
    next();
  } catch {
    next();
  }
}
