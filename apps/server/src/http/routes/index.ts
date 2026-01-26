import { Router } from 'express';
import authRoutes from './auth.routes.js';
import serverRoutes from './server.routes.js';
import channelRoutes from './channel.routes.js';
import messageRoutes from './message.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/servers', serverRoutes);
router.use('/', channelRoutes);
router.use('/', messageRoutes);

router.get('/server/:id', (req, res, next) => {
  req.url = `/servers/${req.params.id}`;
  router.handle(req, res, next);
});

export default router;
