"use client";

import { create } from "zustand";
import { api } from "@/lib/api";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { useChatStore } from "./chat";

interface User {
  id: string;
  username: string;
  email: string;
  bio?: string | null;
  avatarUrl?: string | null;
  status?: "online" | "busy" | "dnd" | null;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateProfile: (data: { bio?: string; avatarUrl?: string; status?: "online" | "busy" | "dnd" }) => Promise<User>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password) => {
    const result = await api.login({ email, password });
    api.setAccessToken(result.accessToken);
    localStorage.setItem("refreshToken", result.refreshToken);
    connectSocket(result.accessToken);
    set({ user: result.user, isAuthenticated: true });
  },

  signup: async (username, email, password) => {
    const result = await api.signup({ username, email, password });
    api.setAccessToken(result.accessToken);
    localStorage.setItem("refreshToken", result.refreshToken);
    connectSocket(result.accessToken);
    // Reset chat state on signup to avoid showing last selected server
    useChatStore.getState().resetChat();
    set({ user: result.user, isAuthenticated: true });
  },

  logout: async () => {
    try {
      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        await api.logout(refreshToken);
      }
    } catch {
      // Ignore logout errors
    } finally {
      api.setAccessToken(null);
      localStorage.removeItem("refreshToken");
      disconnectSocket();
      // Reset chat state and auth state so redirects react immediately
      useChatStore.getState().resetChat();
      set({ user: null, isAuthenticated: false, isLoading: false });
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
      // Reset chat store on auth failure
      useChatStore.getState().resetChat();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  updateProfile: async (data) => {
    const currentUser = get().user;
    if (!currentUser) {
      throw new Error("Not authenticated");
    }
    const updated = await api.updateMyProfile(data);
    const nextUser = { ...currentUser, ...updated };
    set({ user: nextUser });
    return nextUser;
  },
}));
