import { connectSocket, disconnectSocket } from "@/lib/socket";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export class ApiHttpError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface ApiError {
  message: string;
  code?: string;
}

export interface ConversationParticipant {
  id: string;
  username: string;
  email?: string;
}

export interface DirectConversation {
  id: string;
  participantIds: string[];
  participants?: ConversationParticipant[];
  lastMessage?: {
    id: string;
    content: string | null;
    gifUrl?: string | null;
    createdAt: string;
    authorId: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  authorId: string;
  content: string | null;
  gifUrl?: string | null;
  replyToMessageId?: string | null;
  replyTo?: ReplySummary | null;
  reactions?: Record<string, string[]>;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
  masked?: boolean;
  author?: { id: string; username: string; avatarUrl?: string | null } | null;
}

export interface Message {
  id: string;
  content: string | null;
  gifUrl?: string | null;
  replyToMessageId?: string | null;
  replyTo?: ReplySummary | null;
  reactions?: Record<string, string[]>;
  createdAt: string;
  updatedAt: string;
  author: { id: string; username: string; avatarUrl?: string | null };
  masked?: boolean;
}

export interface ReplySummary {
  id: string;
  content: string | null;
  gifUrl?: string | null;
  createdAt: string;
  author: { id: string; username: string; avatarUrl?: string | null } | null;
  deletedAt?: string | null;
  masked?: boolean;
}

export interface GifResult {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
}

export interface UserProfile {
  id: string;
  username: string;
  bio?: string | null;
  avatarUrl?: string | null;
  status?: "online" | "busy" | "dnd" | null;
}

export type BanType = "PERMANENT" | "TEMPORARY";
export type SocketBanType = "permanent" | "temporary";

export interface BanPayload {
  type: SocketBanType;
  bannedUntil: string | null;
  issuedAt: string;
  issuedBy: string;
  reason?: string | null;
}

export interface BanStatus {
  isBanned: boolean;
  ban?: BanPayload | null;
  serverNow: string;
  banned?: boolean;
  type?: BanType | null;
  expiresAt?: string | null;
  remainingMs?: number | null;
  reason?: string | null;
  serverTime?: string;
}

export interface ServerBan {
  id: string;
  serverId: string;
  userId: string;
  type: BanType;
  reason?: string | null;
  createdAt: string;
  expiresAt?: string | null;
}

class ApiClient {
  private accessToken: string | null = null;
  private refreshPromise: Promise<{
    accessToken: string;
    refreshToken: string;
  }> | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
    if (token) {
      localStorage.setItem("accessToken", token);
    } else {
      localStorage.removeItem("accessToken");
    }
  }

  getAccessToken(): string | null {
    if (!this.accessToken && typeof window !== "undefined") {
      this.accessToken = localStorage.getItem("accessToken");
    }
    return this.accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retry = true,
  ): Promise<T> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    const token = this.getAccessToken();
    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }

    let bodyToSend = options.body;
    if (
      bodyToSend &&
      typeof bodyToSend === "object" &&
      !(bodyToSend instanceof FormData)
    ) {
      bodyToSend = JSON.stringify(bodyToSend);
    }

    const url = `${API_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: options.credentials ?? "include",
      body: bodyToSend,
    });

    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : null;

    if (!response.ok) {
      if (response.status === 401 && retry) {
        try {
          const refreshed = await this.refreshTokens();
          this.setAccessToken(refreshed.accessToken);
          localStorage.setItem("refreshToken", refreshed.refreshToken);
          disconnectSocket();
          connectSocket(refreshed.accessToken);
          return this.request<T>(endpoint, options, false);
        } catch {
          this.setAccessToken(null);
          localStorage.removeItem("refreshToken");
          disconnectSocket();
        }
      }
      if (process.env.NODE_ENV !== "production") {
        console.warn("[api]", options.method || "GET", url, {
          status: response.status,
          body: options.body,
          hasAuth: Boolean(token),
          credentials: options.credentials ?? "include",
        });
      }
      const error = (data as { error?: ApiError } | null)?.error;
      throw new ApiHttpError(
        error?.message || "An error occurred",
        response.status,
        error?.code,
      );
    }

    return data as T;
  }

  private async requestWithFallback<T>(
    endpoints: string[],
    options: RequestInit = {},
    retry = true,
  ): Promise<T> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    const token = this.getAccessToken();
    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }

    let lastError: Error | null = null;
    for (const endpoint of endpoints) {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const raw = await response.text();
      const data = raw ? JSON.parse(raw) : null;

      if (response.ok) {
        return data as T;
      }

      if (response.status === 401 && retry) {
        try {
          const refreshed = await this.refreshTokens();
          this.setAccessToken(refreshed.accessToken);
          localStorage.setItem("refreshToken", refreshed.refreshToken);
          disconnectSocket();
          connectSocket(refreshed.accessToken);
          return this.requestWithFallback<T>(endpoints, options, false);
        } catch {
          this.setAccessToken(null);
          localStorage.removeItem("refreshToken");
          disconnectSocket();
        }
      }

      if (response.status === 404) {
        lastError = new Error("Not found");
        continue;
      }

      const error = (data as { error?: ApiError } | null)?.error;
      throw new Error(error?.message || "An error occurred");
    }

    throw lastError ?? new Error("An error occurred");
  }

  private async refreshTokens(): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    if (this.refreshPromise) return this.refreshPromise;

    const refreshToken =
      typeof window !== "undefined"
        ? localStorage.getItem("refreshToken")
        : null;
    if (!refreshToken) {
      throw new Error("No refresh token");
    }

    this.refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (response) => {
        const raw = await response.text();
        const data = raw ? JSON.parse(raw) : null;
        if (!response.ok) {
          const error = (data as { error?: ApiError } | null)?.error;
          throw new Error(error?.message || "Failed to refresh token");
        }
        return data as { accessToken: string; refreshToken: string };
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  async signup(data: { username: string; email: string; password: string }) {
    return this.request<{
      user: {
        id: string;
        username: string;
        email: string;
        bio?: string | null;
        avatarUrl?: string | null;
        status?: "online" | "busy" | "dnd" | null;
      };
      accessToken: string;
      refreshToken: string;
    }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async login(data: { email: string; password: string }) {
    return this.request<{
      user: {
        id: string;
        username: string;
        email: string;
        bio?: string | null;
        avatarUrl?: string | null;
        status?: "online" | "busy" | "dnd" | null;
      };
      accessToken: string;
      refreshToken: string;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async logout(refreshToken: string) {
    return this.request<void>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  }

  async getMe() {
    return this.requestWithFallback<{
      id: string;
      username: string;
      email: string;
      bio?: string | null;
      avatarUrl?: string | null;
      status?: "online" | "busy" | "dnd" | null;
    }>(["/auth/me", "/users/me"]);
  }

  async getUserProfile(userId: string) {
    return this.request<UserProfile>(`/users/${userId}`);
  }

  async updateMyProfile(data: {
    bio?: string;
    avatarUrl?: string;
    status?: "online" | "busy" | "dnd";
  }) {
    return this.requestWithFallback<{
      id: string;
      username: string;
      email: string;
      bio?: string | null;
      avatarUrl?: string | null;
      status?: "online" | "busy" | "dnd" | null;
    }>(["/auth/me", "/users/me"], {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async getServers() {
    return this.request<
      Array<{
        id: string;
        name: string;
        inviteCode: string;
        _count: { members: number; channels: number };
      }>
    >("/servers");
  }

  async getServer(id: string) {
    return this.request<{
      id: string;
      name: string;
      inviteCode: string;
      owner: { id: string; username: string };
    }>(`/servers/${id}`);
  }

  async createServer(name: string) {
    return this.request<{ id: string; name: string; inviteCode: string }>(
      "/servers",
      {
        method: "POST",
        body: JSON.stringify({ name }),
      },
    );
  }

  async joinServer(inviteCode: string) {
    return this.request<{ id: string; name: string }>(`/servers/join/join`, {
      method: "POST",
      body: JSON.stringify({ inviteCode }),
    });
  }

  async leaveServer(serverId: string) {
    return this.request<void>(`/servers/${serverId}/leave`, {
      method: "DELETE",
    });
  }

  async deleteServer(serverId: string) {
    return this.request<void>(`/servers/${serverId}`, {
      method: "DELETE",
    });
  }

  async getServerMembers(serverId: string) {
    return this.request<
      Array<{
        id: string;
        role: "OWNER" | "ADMIN" | "MEMBER";
        ban?: BanPayload | null;
        user: {
          id: string;
          username: string;
          email: string;
          avatarUrl?: string | null;
          status?: "online" | "busy" | "dnd" | null;
        };
      }>
    >(`/servers/${serverId}/members`);
  }

  async getServerBanStatus(serverId: string) {
    return this.request<BanStatus>(`/servers/${serverId}/ban-status`);
  }

  async kickMember(serverId: string, memberId: string) {
    return this.request<void>(`/servers/${serverId}/members/${memberId}`, {
      method: "DELETE",
    });
  }

  async banMember(
    serverId: string,
    userId: string,
    payload: {
      type: BanType;
      durationSeconds?: number;
      durationMinutes?: number;
      expiresAt?: string;
      reason?: string;
    },
  ) {
    return this.request<ServerBan>(`/servers/${serverId}/members/${userId}/ban`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async unbanMember(serverId: string, userId: string) {
    return this.request<void>(`/servers/${serverId}/members/${userId}/unban`, {
      method: "POST",
    });
  }

  async getServerChannels(serverId: string) {
    return this.request<
      Array<{
        id: string;
        name: string;
        serverId: string;
      }>
    >(`/servers/${serverId}/channels`);
  }

  async createChannel(serverId: string, name: string) {
    return this.request<{
      id: string;
      name: string;
      serverId: string;
    }>(`/servers/${serverId}/channels`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  async deleteChannel(channelId: string) {
    return this.request<void>(`/channels/${channelId}`, {
      method: "DELETE",
    });
  }

  async getChannelMessages(channelId: string, cursor?: string) {
    const params = new URLSearchParams({ limit: "50" });
    if (cursor) params.set("cursor", cursor);
    return this.request<{
      data: Message[];
      nextCursor: string | null;
      hasMore: boolean;
    }>(`/channels/${channelId}/messages?${params}`);
  }

  async sendMessage(
    channelId: string,
    content?: string,
    gifUrl?: string | null,
    replyToMessageId?: string | null,
  ) {
    const body: Record<string, unknown> = { content, gifUrl };
    if (replyToMessageId) {
      body.replyToMessageId = replyToMessageId;
    }
    return this.request<Message>(`/channels/${channelId}/messages`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async updateMessage(messageId: string, content: string) {
    return this.request<Message>(`/messages/${messageId}`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
    });
  }

  async deleteMessage(messageId: string) {
    return this.request<void>(`/messages/${messageId}`, {
      method: "DELETE",
    });
  }

  async createDmConversation(targetUserId: string) {
    return this.request<DirectConversation>("/dm/conversations", {
      method: "POST",
      body: JSON.stringify({ targetUserId }),
    });
  }

  async getDmConversations(serverId?: string) {
    const params = new URLSearchParams();
    if (serverId) params.set("serverId", serverId);
    const suffix = params.toString();
    return this.request<DirectConversation[]>(
      suffix ? `/dm/conversations?${suffix}` : "/dm/conversations",
    );
  }

  async getDmMessages(
    conversationId: string,
    cursor?: string,
    serverId?: string,
  ) {
    const params = new URLSearchParams({ limit: "50" });
    if (cursor) params.set("cursor", cursor);
    if (serverId) params.set("serverId", serverId);
    return this.request<{
      data: DirectMessage[];
      nextCursor: string | null;
      hasMore: boolean;
    }>(`/dm/conversations/${conversationId}/messages?${params}`);
  }

  async sendDmMessage(
    conversationId: string,
    content?: string,
    gifUrl?: string | null,
    replyToMessageId?: string | null,
  ) {
    const body: Record<string, unknown> = { content, gifUrl };
    if (replyToMessageId) {
      body.replyToMessageId = replyToMessageId;
    }
    return this.request<DirectMessage>(
      `/dm/conversations/${conversationId}/messages`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  }

  async deleteDmMessage(messageId: string) {
    return this.request<void>(`/dm/messages/${messageId}`, {
      method: "DELETE",
    });
  }

  async getBlockedUsers(serverId: string) {
    return this.request<{ blockedUserIds: string[] }>(
      `/servers/${serverId}/blocks`,
    );
  }

  async blockUser(serverId: string, userId: string) {
    return this.request<void>(`/servers/${serverId}/users/${userId}/block`, {
      method: "POST",
    });
  }

  async unblockUser(serverId: string, userId: string) {
    return this.request<void>(`/servers/${serverId}/users/${userId}/block`, {
      method: "DELETE",
    });
  }

  async reportUser(
    serverId: string,
    userId: string,
    payload?: { reason?: string; messageId?: string; channelId?: string },
  ) {
    return this.request<{ id: string }>(
      `/servers/${serverId}/users/${userId}/report`,
      {
        method: "POST",
        body: JSON.stringify(payload ?? {}),
      },
    );
  }

  async getFeaturedGifs(limit = 24) {
    const params = new URLSearchParams({ limit: String(limit) });
    return this.request<{ data: GifResult[] }>(`/gifs/featured?${params}`);
  }

  async searchGifs(query: string, limit = 24) {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    return this.request<{ data: GifResult[] }>(`/gifs/search?${params}`);
  }

  async toggleChannelMessageReaction(messageId: string, emoji: string) {
    return this.request<{ message: Message; channelId: string }>(
      `/reactions/channel/${messageId}/toggle`,
      {
        method: "POST",
        body: JSON.stringify({ emoji }),
      },
    );
  }

  async toggleDirectMessageReaction(messageId: string, emoji: string) {
    return this.request<{ message: DirectMessage; conversationId: string }>(
      `/reactions/dm/${messageId}/toggle`,
      {
        method: "POST",
        body: JSON.stringify({ emoji }),
      },
    );
  }
}

export const api = new ApiClient();
