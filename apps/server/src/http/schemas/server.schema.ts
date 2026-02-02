import { z } from 'zod';

export const createServerSchema = z.object({
  name: z.string().min(1).max(100),
});

export const updateServerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export const joinServerSchema = z.object({
  inviteCode: z.string().min(1),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER']),
});

export const transferOwnershipSchema = z.object({
  newOwnerId: z.string().min(1),
});

export const createInviteSchema = z.object({
  expiresAt: z.string().datetime().optional(),
  maxUses: z.number().int().positive().optional(),
});

export const reportUserSchema = z.object({
  reason: z.string().max(500).optional(),
  messageId: z.string().min(1).optional(),
  channelId: z.string().min(1).optional(),
});

export type CreateServerInput = z.infer<typeof createServerSchema>;
export type UpdateServerInput = z.infer<typeof updateServerSchema>;
export type JoinServerInput = z.infer<typeof joinServerSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type ReportUserInput = z.infer<typeof reportUserSchema>;
