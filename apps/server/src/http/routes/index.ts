import { Router, type Request, type Response, type NextFunction } from 'express';
import authRoutes from './auth.routes.js';
import serverRoutes from './server.routes.js';
import channelRoutes from './channel.routes.js';
import messageRoutes from './message.routes.js';
import dmRoutes from './dm.routes.js';
import gifRoutes from './gif.routes.js';
import userRoutes from './user.routes.js';
import reactionRoutes from './reaction.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/servers', serverRoutes);
router.use('/users', userRoutes);
router.use('/reactions', reactionRoutes);
router.use('/', channelRoutes);
router.use('/', messageRoutes);
router.use('/', dmRoutes);
router.use('/', gifRoutes);

router.get('/server/:id', (req: Request, res: Response, next: NextFunction) => {
  req.url = `/servers/${req.params.id}`;
  return serverRoutes(req, res, next);
});

export default router;
