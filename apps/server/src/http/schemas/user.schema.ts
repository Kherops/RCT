import { z } from 'zod';

export const updateProfileSchema = z
  .object({
    bio: z
      .string()
      .max(280)
      .transform((value) => value.trim())
      .optional(),
    avatarUrl: z
      .string()
      .url()
      .or(z.literal(''))
      .optional(),
  })
  .refine((data) => data.bio !== undefined || data.avatarUrl !== undefined, {
    message: 'No profile fields provided',
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
