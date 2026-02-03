
export type Role = "OWNER" | "ADMIN" | "MEMBER";
export type BanType = "PERMANENT" | "TEMPORARY";

export interface User {
  id: string;
  username: string;
  email: string;
  bio?: string | null;
  avatarUrl?: string | null;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

// Type public sans le passwordHash pour éviter les fuites lors de la sérialisation
export interface UserPublic {
  id: string;
  username: string;
  email: string;
  bio?: string | null;
  avatarUrl?: string | null;
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

export interface ServerBan {
  id: string;
  serverId: string;
  userId: string;
  createdById: string;
  type: BanType;
  reason?: string | null;
  createdAt: Date;
  expiresAt?: Date | null;
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
  replyToMessageId?: string | null;
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
  replyToMessageId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface UserBlock {
  id: string;
  blockerId: string;
  blockedId: string;
  serverId: string;
  createdAt: Date;
}

export interface UserReport {
  id: string;
  reporterId: string;
  reportedId: string;
  serverId: string;
  reason?: string | null;
  messageId?: string | null;
  channelId?: string | null;
  createdAt: Date;
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
  bio?: string | null;
  avatarUrl?: string | null;
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
  | "member:delete"
  | "server:update"
  | "server:delete"
  | "invite:create"
  | "ownership:transfer";
