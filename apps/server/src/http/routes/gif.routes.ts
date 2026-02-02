import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { config } from '../../config/index.js';

const router = Router();

const searchQuerySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(24),
});

const featuredQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(24),
});

type TenorGifResult = {
  id: string;
  title: string;
  media_formats: {
    gif?: { url: string };
    tinygif?: { url: string };
  };
};

async function fetchKlipy(endpoint: string, params: URLSearchParams) {
  const apiKey = config.KLIPY_API_KEY;
  if (!apiKey) {
    throw new Error('KLIPY_API_KEY is not set');
  }

  params.set('key', apiKey);
  params.set('client_key', config.KLIPY_CLIENT_KEY);
  params.set('media_filter', 'gif,tinygif');

  const baseUrl = config.KLIPY_BASE_URL.replace(/\/+$/, '');
  const url = `${baseUrl}/v2/${endpoint}?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch GIFs');
  }

  return response.json() as Promise<{ results: TenorGifResult[] }>;
}

router.get('/gifs/featured', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit } = featuredQuerySchema.parse(req.query);
    const params = new URLSearchParams({ limit: String(limit) });
    const data = await fetchKlipy('featured', params);

    const results = data.results.map((gif) => ({
      id: gif.id,
      title: gif.title,
      url: gif.media_formats.gif?.url || gif.media_formats.tinygif?.url || '',
      previewUrl: gif.media_formats.tinygif?.url || gif.media_formats.gif?.url || '',
    })).filter((gif) => gif.url);

    res.json({ data: results });
  } catch (error) {
    next(error);
  }
});

router.get('/gifs/search', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q, limit } = searchQuerySchema.parse(req.query);
    const params = new URLSearchParams({ q, limit: String(limit) });
    const data = await fetchKlipy('search', params);

    const results = data.results.map((gif) => ({
      id: gif.id,
      title: gif.title,
      url: gif.media_formats.gif?.url || gif.media_formats.tinygif?.url || '',
      previewUrl: gif.media_formats.tinygif?.url || gif.media_formats.gif?.url || '',
    })).filter((gif) => gif.url);

    res.json({ data: results });
  } catch (error) {
    next(error);
  }
});

export default router;
