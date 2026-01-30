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
    content: string;
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
  content: string;
  gifUrl?: string | null;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
  author?: { id: string; username: string } | null;
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
}

class ApiClient {
  private accessToken: string | null = null;

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
  ): Promise<T> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    const token = this.getAccessToken();
    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : null;

    if (!response.ok) {
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

      if (response.status === 404) {
        lastError = new Error("Not found");
        continue;
      }

      const error = (data as { error?: ApiError } | null)?.error;
      throw new Error(error?.message || "An error occurred");
    }

    throw lastError ?? new Error("An error occurred");
  }

  async signup(data: { username: string; email: string; password: string }) {
    return this.request<{
      user: {
        id: string;
        username: string;
        email: string;
        bio?: string | null;
        avatarUrl?: string | null;
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
    }>(["/auth/me", "/users/me"]);
  }

  async getUserProfile(userId: string) {
    return this.request<UserProfile>(`/users/${userId}`);
  }

  async updateMyProfile(data: { bio?: string; avatarUrl?: string }) {
    return this.requestWithFallback<{
      id: string;
      username: string;
      email: string;
      bio?: string | null;
      avatarUrl?: string | null;
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
        user: { id: string; username: string; email: string };
      }>
    >(`/servers/${serverId}/members`);
  }

  async kickMember(serverId: string, memberId: string) {
    return this.request<void>(`/servers/${serverId}/members/${memberId}`, {
      method: "DELETE",
    });
  }

  async getServerChannels(serverId: string) {
    return this.request<
      Array<{
        id: string;
        name: string;
        serverId: string;
        visibility: "PUBLIC" | "PRIVATE";
        creatorId: string;
      }>
    >(`/servers/${serverId}/channels`);
  }

  async createChannel(
    serverId: string,
    name: string,
    visibility: "PUBLIC" | "PRIVATE",
  ) {
    return this.request<{
      id: string;
      name: string;
      serverId: string;
      visibility: "PUBLIC" | "PRIVATE";
      creatorId: string;
    }>(`/servers/${serverId}/channels`, {
      method: "POST",
      body: JSON.stringify({ name, visibility }),
    });
  }

  async deleteChannel(channelId: string) {
    return this.request<void>(`/channels/${channelId}`, {
      method: "DELETE",
    });
  }

  async leaveChannel(channelId: string) {
    return this.request<void>(`/channels/${channelId}/leave`, {
      method: "POST",
    });
  }

  async getChannelMessages(channelId: string, cursor?: string) {
    const params = new URLSearchParams({ limit: "50" });
    if (cursor) params.set("cursor", cursor);
    return this.request<{
      data: Array<{
        id: string;
        content: string;
        gifUrl?: string | null;
        createdAt: string;
        author: { id: string; username: string };
      }>;
      nextCursor: string | null;
      hasMore: boolean;
    }>(`/channels/${channelId}/messages?${params}`);
  }

  async sendMessage(
    channelId: string,
    content?: string,
    gifUrl?: string | null,
  ) {
    return this.request<{
      id: string;
      content: string;
      gifUrl?: string | null;
      createdAt: string;
      author: { id: string; username: string };
    }>(`/channels/${channelId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content, gifUrl }),
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

  async getDmConversations() {
    return this.request<DirectConversation[]>("/dm/conversations");
  }

  async getDmMessages(conversationId: string, cursor?: string) {
    const params = new URLSearchParams({ limit: "50" });
    if (cursor) params.set("cursor", cursor);
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
  ) {
    return this.request<DirectMessage>(
      `/dm/conversations/${conversationId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ content, gifUrl }),
      },
    );
  }

  async deleteDmMessage(messageId: string) {
    return this.request<void>(`/dm/messages/${messageId}`, {
      method: "DELETE",
    });
  }

  async getFeaturedGifs(limit = 24) {
    const params = new URLSearchParams({ limit: String(limit) });
    return this.request<{ data: GifResult[] }>(`/gifs/featured?${params}`);
  }

  async searchGifs(query: string, limit = 24) {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    return this.request<{ data: GifResult[] }>(`/gifs/search?${params}`);
  }
}

export const api = new ApiClient();
