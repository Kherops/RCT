'use client';

import { create } from 'zustand';
import { api } from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';

interface User {
  id: string;
  username: string;
  email: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password) => {
    const result = await api.login({ email, password });
    api.setAccessToken(result.accessToken);
    localStorage.setItem('refreshToken', result.refreshToken);
    connectSocket(result.accessToken);
    set({ user: result.user, isAuthenticated: true });
  },

  signup: async (username, email, password) => {
    const result = await api.signup({ username, email, password });
    api.setAccessToken(result.accessToken);
    localStorage.setItem('refreshToken', result.refreshToken);
    connectSocket(result.accessToken);
    set({ user: result.user, isAuthenticated: true });
  },

  logout: async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        await api.logout(refreshToken);
      }
    } catch {
      // Ignore logout errors
    } finally {
      api.setAccessToken(null);
      localStorage.removeItem('refreshToken');
      disconnectSocket();
      set({ user: null, isAuthenticated: false });
    }
  },

  checkAuth: async () => {
    try {
      const token = api.getAccessToken();
      if (!token) {
        set({ isLoading: false });
        return;
      }
      const user = await api.getMe();
      connectSocket(token);
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      api.setAccessToken(null);
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
