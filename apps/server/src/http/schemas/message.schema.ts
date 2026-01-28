import { z } from 'zod';

export const createMessageSchema = z.object({
  content: z.string().min(1).max(2000).optional(),
  gifUrl: z.string().url().optional(),
}).refine((data) => Boolean(data.content?.trim() || data.gifUrl), {
  message: 'Content or gifUrl is required',
});

export const getMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type GetMessagesQuery = z.infer<typeof getMessagesQuerySchema>;
