import type { Server as SocketIOServer, Socket } from 'socket.io';

export interface ServerToClientEvents {
  'message:new': (data: MessagePayload) => void;
  'message:updated': (data: MessagePayload) => void;
  'message:deleted': (data: { messageId: string; channelId: string }) => void;
  'dm:new': (data: DirectMessagePayload) => void;
  'dm:deleted': (data: { messageId: string; conversationId: string }) => void;
  'dm:created': (data: DirectConversationPayload) => void;
  'user:joined': (data: { userId: string; username: string; serverId: string }) => void;
  'user:left': (data: { userId: string; username: string; serverId: string }) => void;
  'user:online': (data: { userId: string; serverId: string }) => void;
  'user:offline': (data: { userId: string; serverId: string }) => void;
  'typing:start': (data: { userId: string; username: string; channelId: string }) => void;
  'typing:stop': (data: { userId: string; channelId: string }) => void;
  'channel:created': (data: ChannelPayload) => void;
  'channel:updated': (data: ChannelPayload) => void;
  'channel:deleted': (data: { channelId: string; serverId: string }) => void;
  'member:role_updated': (data: { userId: string; serverId: string; role: string }) => void;
  'server:updated': (data: { serverId: string; name: string }) => void;
  'error': (data: { message: string; code?: string }) => void;
}

export interface ClientToServerEvents {
  'join:server': (serverId: string, callback?: (response: SocketResponse) => void) => void;
  'leave:server': (serverId: string, callback?: (response: SocketResponse) => void) => void;
  'join:dm': (conversationId: string, callback?: (response: SocketResponse) => void) => void;
  'leave:dm': (conversationId: string, callback?: (response: SocketResponse) => void) => void;
  'message:send': (data: { channelId: string; content?: string; gifUrl?: string; replyToMessageId?: string }, callback?: (response: SocketResponse<MessagePayload>) => void) => void;
  'dm:send': (data: { conversationId: string; content?: string; gifUrl?: string; replyToMessageId?: string }, callback?: (response: SocketResponse<DirectMessagePayload>) => void) => void;
  'typing:start': (channelId: string) => void;
  'typing:stop': (channelId: string) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: string;
  username: string;
  joinedServers: Set<string>;
  joinedDms: Set<string>;
}

export interface ReplySummaryPayload {
  id: string;
  content: string;
  gifUrl?: string | null;
  createdAt: string;
  author: {
    id: string;
    username: string;
  } | null;
  deletedAt?: string | null;
}

export interface MessagePayload {
  id: string;
  channelId: string;
  content: string;
  gifUrl?: string | null;
  replyTo?: ReplySummaryPayload | null;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    username: string;
  };
}

export interface DirectMessagePayload {
  id: string;
  conversationId: string;
  content: string;
  gifUrl?: string | null;
  replyTo?: ReplySummaryPayload | null;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    username: string;
  };
}

export interface DirectConversationPayload {
  id: string;
  participantIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ChannelPayload {
  id: string;
  serverId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface SocketResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

export type TypedServer = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
