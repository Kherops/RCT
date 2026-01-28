
export type Role = "OWNER" | "ADMIN" | "MEMBER";

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

// Type public sans le passwordHash pour éviter les fuites lors de la sérialisation
export interface UserPublic {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Server {
  id: string;
  name: string;
  ownerId: string;
  inviteCode?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServerMember {
  id: string;
  serverId: string;
  userId: string;
  role: Role;
  joinedAt: Date;
}

export interface Channel {
  id: string;
  serverId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  gifUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface DirectConversation {
  id: string;
  participantIds: string[];
  participantKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  authorId: string;
  content: string;
  gifUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  createdAt: Date;
}

export interface Invite {
  id: string;
  code: string;
  serverId: string;
  createdById: string;
  expiresAt?: Date | null;
  maxUses?: number | null;
  uses: number;
  createdAt: Date;
}

export interface JwtPayload {
  userId: string;
  type: "access" | "refresh";
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
  | "channel:create"
  | "channel:update"
  | "channel:delete"
  | "message:delete_others"
  | "member:update_role"
  | "server:update"
  | "server:delete"
  | "invite:create"
  | "ownership:transfer";
