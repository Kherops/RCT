import { z } from 'zod';

export const createConversationSchema = z.object({
  targetUserId: z.string().min(1),
});

export const conversationParamsSchema = z.object({
  id: z.string().min(1),
});

export const createDirectMessageSchema = z.object({
  content: z.string().min(1).max(2000).optional(),
  gifUrl: z.string().url().optional(),
}).refine((data) => Boolean(data.content?.trim() || data.gifUrl), {
  message: 'Content or gifUrl is required',
});

export const getDirectMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export const directMessageParamsSchema = z.object({
  id: z.string().min(1),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type CreateDirectMessageInput = z.infer<typeof createDirectMessageSchema>;
export type GetDirectMessagesQuery = z.infer<typeof getDirectMessagesQuerySchema>;
