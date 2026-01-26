import { Role } from '@prisma/client';

export { Role };

export interface JwtPayload {
  userId: string;
  type: 'access' | 'refresh';
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
}

export interface ServerMemberWithRole {
  userId: string;
  serverId: string;
  role: Role;
}

export interface PaginationParams {
  limit: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export type PermissionAction =
  | 'channel:create'
  | 'channel:update'
  | 'channel:delete'
  | 'message:delete_others'
  | 'member:update_role'
  | 'server:update'
  | 'server:delete'
  | 'invite:create'
  | 'ownership:transfer';
