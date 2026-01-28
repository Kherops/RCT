import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import routes from './http/routes/index.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import { initializeSocket } from './socket/index.js';
import { config } from './config/index.js';

const PORT = config.PORT;
const CORS_ORIGIN = config.CORS_ORIGIN;

const app = express();
const httpServer = createServer(app);

function resolveCorsOrigin(originValue: string): string[] | boolean {
  if (originValue.trim() === '*') {
    return true;
  }
  const origins = originValue
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : ['http://localhost:3000'];
}

const corsOrigin = resolveCorsOrigin(CORS_ORIGIN);

app.use(helmet());
app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));
app.use(express.json());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: { message: 'Too many login attempts, please try again later', code: 'RATE_LIMITED' } },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/auth/login', loginLimiter);
app.use('/auth/signup', loginLimiter);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/', routes);

app.use(notFoundHandler);
app.use(errorHandler);

initializeSocket(httpServer, corsOrigin);

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket available at ws://localhost:${PORT}/ws`);
});

export { app, httpServer };
