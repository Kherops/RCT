const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiError {
  message: string;
  code?: string;
}

class ApiClient {
  private accessToken: string | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
    if (token) {
      localStorage.setItem('accessToken', token);
    } else {
      localStorage.removeItem('accessToken');
    }
  }

  getAccessToken(): string | null {
    if (!this.accessToken && typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('accessToken');
    }
    return this.accessToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.getAccessToken();
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      const error = data.error as ApiError;
      throw new Error(error?.message || 'An error occurred');
    }

    return data as T;
  }

  async signup(data: { username: string; email: string; password: string }) {
    return this.request<{
      user: { id: string; username: string; email: string };
      accessToken: string;
      refreshToken: string;
    }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: { email: string; password: string }) {
    return this.request<{
      user: { id: string; username: string; email: string };
      accessToken: string;
      refreshToken: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async logout(refreshToken: string) {
    return this.request<void>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  async getMe() {
    return this.request<{ id: string; username: string; email: string }>('/auth/me');
  }

  async getServers() {
    return this.request<Array<{
      id: string;
      name: string;
      inviteCode: string;
      _count: { members: number; channels: number };
    }>>('/servers');
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
    return this.request<{ id: string; name: string; inviteCode: string }>('/servers', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async joinServer(inviteCode: string) {
    return this.request<{ id: string; name: string }>(`/servers/join/join`, {
      method: 'POST',
      body: JSON.stringify({ inviteCode }),
    });
  }

  async leaveServer(serverId: string) {
    return this.request<void>(`/servers/${serverId}/leave`, {
      method: 'DELETE',
    });
  }

  async getServerMembers(serverId: string) {
    return this.request<Array<{
      id: string;
      role: 'OWNER' | 'ADMIN' | 'MEMBER';
      user: { id: string; username: string; email: string };
    }>>(`/servers/${serverId}/members`);
  }

  async getServerChannels(serverId: string) {
    return this.request<Array<{
      id: string;
      name: string;
      serverId: string;
    }>>(`/servers/${serverId}/channels`);
  }

  async createChannel(serverId: string, name: string) {
    return this.request<{ id: string; name: string; serverId: string }>(
      `/servers/${serverId}/channels`,
      {
        method: 'POST',
        body: JSON.stringify({ name }),
      }
    );
  }

  async deleteChannel(channelId: string) {
    return this.request<void>(`/channels/${channelId}`, {
      method: 'DELETE',
    });
  }

  async getChannelMessages(channelId: string, cursor?: string) {
    const params = new URLSearchParams({ limit: '50' });
    if (cursor) params.set('cursor', cursor);
    return this.request<{
      data: Array<{
        id: string;
        content: string;
        createdAt: string;
        author: { id: string; username: string };
      }>;
      nextCursor: string | null;
      hasMore: boolean;
    }>(`/channels/${channelId}/messages?${params}`);
  }

  async sendMessage(channelId: string, content: string) {
    return this.request<{
      id: string;
      content: string;
      createdAt: string;
      author: { id: string; username: string };
    }>(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async deleteMessage(messageId: string) {
    return this.request<void>(`/messages/${messageId}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient();
