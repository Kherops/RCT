import { z } from 'zod';

export const createChannelSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'Channel name can only contain letters, numbers, underscores, and hyphens'),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
});

export const updateChannelSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'Channel name can only contain letters, numbers, underscores, and hyphens').optional(),
});

export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;
