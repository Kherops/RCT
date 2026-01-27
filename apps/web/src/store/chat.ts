"use client";

import { create } from "zustand";
import { api, type DirectConversation, type DirectMessage } from "@/lib/api";
import {
  getSocket,
  joinServer,
  leaveServer,
  joinChannel,
  leaveChannel,
  joinDm,
  leaveDm,
} from "@/lib/socket";
import { useAuthStore } from "@/store/auth";

interface Server {
  id: string;
  name: string;
  inviteCode: string;
  _count?: { members: number; channels: number };
}

interface Channel {
  id: string;
  name: string;
  serverId: string;
}

interface Member {
  id: string;
  visibleId?: string;
  visibleUserId?: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  user: { id: string; username: string; email?: string };
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; username: string };
}

interface TypingUser {
  userId: string;
  username: string;
}

type Mode = "channel" | "dm";

interface ChatState {
  servers: Server[];
  currentServer: Server | null;
  channels: Channel[];
  currentChannel: Channel | null;
  members: Member[];

  mode: Mode;

  messages: Message[];
  typingUsers: TypingUser[];
  onlineUsers: Set<string>;
  isLoading: boolean;
  hasMoreMessages: boolean;
  nextCursor: string | null;

  dmConversations: DirectConversation[];
  currentDmConversation: DirectConversation | null;
  dmMessages: DirectMessage[];
  dmHasMoreMessages: boolean;
  dmNextCursor: string | null;

  fetchServers: () => Promise<void>;
  selectServer: (serverId: string) => Promise<void>;
  selectChannel: (channelId: string) => Promise<void>;
  createServer: (name: string) => Promise<void>;
  joinServerByCode: (inviteCode: string) => Promise<void>;
  leaveCurrentServer: () => Promise<void>;
  createChannel: (name: string) => Promise<void>;
  deleteChannel: (channelId: string) => Promise<void>;

  fetchDmConversations: () => Promise<void>;
  startDmByUsername: (username: string) => Promise<void>;
  selectDmConversation: (conversationId: string) => Promise<void>;
  leaveDmConversation: () => Promise<void>;

  sendMessage: (content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  loadMoreMessages: () => Promise<void>;

  addMessage: (message: Message) => void;
  removeMessage: (messageId: string) => void;

  addDmMessage: (message: DirectMessage) => void;
  removeDmMessage: (messageId: string) => void;

  setTypingUser: (userId: string, username: string) => void;
  removeTypingUser: (userId: string) => void;
  setUserOnline: (userId: string) => void;
  setUserOffline: (userId: string) => void;
  addMember: (member: Member) => void;
  removeMember: (userId: string) => void;
  updateMemberRole: (userId: string, role: Member["role"]) => void;
  updateServer: (serverId: string, data: Partial<Server>) => void;
  setupSocketListeners: () => void;
}

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export const useChatStore = create<ChatState>((set, get) => ({
  servers: [],
  currentServer: null,
  channels: [],
  currentChannel: null,
  members: [],

  mode: "channel",

  messages: [],
  typingUsers: [],
  onlineUsers: new Set(),
  isLoading: false,
  hasMoreMessages: false,
  nextCursor: null,

  dmConversations: [],
  currentDmConversation: null,
  dmMessages: [],
  dmHasMoreMessages: false,
  dmNextCursor: null,

  fetchServers: async () => {
    const servers = await api.getServers();
    set({ servers });
  },

  selectServer: async (serverId) => {
    const { currentServer, currentChannel, currentDmConversation } = get();

    if (currentDmConversation) {
      try {
        await leaveDm(currentDmConversation.id);
      } catch {}
    }

    if (currentChannel) {
      try {
        await leaveChannel(currentChannel.id);
      } catch {}
    }
    if (currentServer) {
      try {
        await leaveServer(currentServer.id);
      } catch {}
    }

    set({
      isLoading: true,
      currentChannel: null,
      messages: [],
      typingUsers: [],
      mode: "channel",
      currentDmConversation: null,
      dmMessages: [],
      dmHasMoreMessages: false,
      dmNextCursor: null,
    });

    try {
      const [server, channels, members] = await Promise.all([
        api.getServer(serverId),
        api.getServerChannels(serverId),
        api.getServerMembers(serverId),
      ]);

      await joinServer(serverId);
      await get().fetchDmConversations();

      set({
        currentServer: server,
        channels,
        members,
        isLoading: false,
      });

      if (channels.length > 0) {
        await get().selectChannel(channels[0].id);
      }
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  selectChannel: async (channelId) => {
    const { currentChannel, currentDmConversation } = get();

    if (currentDmConversation) {
      try {
        await leaveDm(currentDmConversation.id);
      } catch {}
    }

    if (currentChannel) {
      try {
        await leaveChannel(currentChannel.id);
      } catch {}
    }

    set({
      isLoading: true,
      messages: [],
      typingUsers: [],
      mode: "channel",
      currentDmConversation: null,
      dmMessages: [],
      dmHasMoreMessages: false,
      dmNextCursor: null,
    });

    try {
      const channel = get().channels.find((c) => c.id === channelId);
      if (!channel) throw new Error("Channel not found");

      await joinChannel(channelId);
      const result = await api.getChannelMessages(channelId);

      set({
        currentChannel: channel,
        messages: result.data.reverse(),
        hasMoreMessages: result.hasMore,
        nextCursor: result.nextCursor,
        isLoading: false,
        mode: "channel",
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  createServer: async (name) => {
    const server = await api.createServer(name);
    set((state) => ({ servers: [...state.servers, server] }));
    await get().selectServer(server.id);
  },

  joinServerByCode: async (inviteCode) => {
    const server = await api.joinServer(inviteCode);
    await get().fetchServers();
    await get().selectServer(server.id);
  },

  leaveCurrentServer: async () => {
    const { currentServer, currentChannel, currentDmConversation } = get();
    if (!currentServer) return;

    if (currentDmConversation) {
      try {
        await leaveDm(currentDmConversation.id);
      } catch {}
    }

    if (currentChannel) {
      try {
        await leaveChannel(currentChannel.id);
      } catch {}
    }

    await api.leaveServer(currentServer.id);
    set((state) => ({
      servers: state.servers.filter((s) => s.id !== currentServer.id),
      currentServer: null,
      channels: [],
      currentChannel: null,
      messages: [],
      members: [],
      mode: "channel",
      dmConversations: [],
      currentDmConversation: null,
      dmMessages: [],
      dmHasMoreMessages: false,
      dmNextCursor: null,
    }));
  },

  createChannel: async (name) => {
    const { currentServer } = get();
    if (!currentServer) return;

    const channel = await api.createChannel(currentServer.id, name);
    set((state) => ({ channels: [...state.channels, channel] }));
  },

  deleteChannel: async (channelId) => {
    await api.deleteChannel(channelId);
    set((state) => ({
      channels: state.channels.filter((c) => c.id !== channelId),
      currentChannel:
        state.currentChannel?.id === channelId ? null : state.currentChannel,
    }));
  },

  fetchDmConversations: async () => {
    const dmConversations = await api.getDmConversations();
    set({ dmConversations });
  },

  startDmByUsername: async (username: string) => {
    const { currentServer, members } = get();
    const me = useAuthStore.getState().user;

    if (!currentServer) {
      throw new Error("Select a server first");
    }

    const normalized = normalizeUsername(username);
    if (!normalized) {
      throw new Error("Enter a username");
    }

    const target = members.find(
      (m) => normalizeUsername(m.user.username) === normalized,
    );

    if (!target) {
      throw new Error("User not found in this server");
    }

    if (me && target.user.id === me.id) {
      throw new Error("You cannot DM yourself");
    }

    const conversation = await api.createDmConversation(target.user.id);
    await get().fetchDmConversations();
    await get().selectDmConversation(conversation.id);
  },

  selectDmConversation: async (conversationId: string) => {
    const { currentChannel, currentDmConversation } = get();

    if (currentChannel) {
      try {
        await leaveChannel(currentChannel.id);
      } catch {}
    }

    if (currentDmConversation && currentDmConversation.id !== conversationId) {
      try {
        await leaveDm(currentDmConversation.id);
      } catch {}
    }

    set({
      isLoading: true,
      mode: "dm",
      currentChannel: null,
      messages: [],
      typingUsers: [],
      dmMessages: [],
      dmHasMoreMessages: false,
      dmNextCursor: null,
    });

    try {
      let conversation =
        get().dmConversations.find((c) => c.id === conversationId) || null;
      if (!conversation) {
        const all = await api.getDmConversations();
        conversation = all.find((c) => c.id === conversationId) || null;
        set({ dmConversations: all });
      }
      if (!conversation) {
        throw new Error("Conversation not found");
      }

      await joinDm(conversationId);
      const result = await api.getDmMessages(conversationId);

      set({
        currentDmConversation: conversation,
        dmMessages: result.data.reverse(),
        dmHasMoreMessages: result.hasMore,
        dmNextCursor: result.nextCursor,
        isLoading: false,
        mode: "dm",
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  leaveDmConversation: async () => {
    const { currentDmConversation } = get();
    if (!currentDmConversation) return;

    try {
      await leaveDm(currentDmConversation.id);
    } catch {}

    set({
      mode: "channel",
      currentDmConversation: null,
      dmMessages: [],
      dmHasMoreMessages: false,
      dmNextCursor: null,
    });
  },

  sendMessage: async (content) => {
    const { mode, currentChannel, currentDmConversation } = get();

    if (mode === "dm") {
      if (!currentDmConversation) return;
      const message = await api.sendDmMessage(
        currentDmConversation.id,
        content,
      );
      get().addDmMessage(message);
      await get().fetchDmConversations();
      return;
    }

    if (!currentChannel) return;
    const message = await api.sendMessage(currentChannel.id, content);
    get().addMessage(message);
  },

  deleteMessage: async (messageId) => {
    const { mode } = get();

    if (mode === "dm") {
      await api.deleteDmMessage(messageId);
      get().removeDmMessage(messageId);
      await get().fetchDmConversations();
      return;
    }

    await api.deleteMessage(messageId);
    get().removeMessage(messageId);
  },

  loadMoreMessages: async () => {
    const {
      mode,
      currentChannel,
      nextCursor,
      hasMoreMessages,
      currentDmConversation,
      dmNextCursor,
      dmHasMoreMessages,
    } = get();

    if (mode === "dm") {
      if (!currentDmConversation || !dmHasMoreMessages || !dmNextCursor) return;
      const result = await api.getDmMessages(
        currentDmConversation.id,
        dmNextCursor,
      );
      set((state) => ({
        dmMessages: [...result.data.reverse(), ...state.dmMessages],
        dmHasMoreMessages: result.hasMore,
        dmNextCursor: result.nextCursor,
      }));
      return;
    }

    if (!currentChannel || !hasMoreMessages || !nextCursor) return;

    const result = await api.getChannelMessages(currentChannel.id, nextCursor);
    set((state) => ({
      messages: [...result.data.reverse(), ...state.messages],
      hasMoreMessages: result.hasMore,
      nextCursor: result.nextCursor,
    }));
  },

  addMessage: (message) => {
    set((state) => {
      if (state.messages.some((m) => m.id === message.id)) return state;
      return { messages: [...state.messages, message] };
    });
  },

  removeMessage: (messageId) => {
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== messageId),
    }));
  },

  addDmMessage: (message) => {
    set((state) => {
      if (state.dmMessages.some((m) => m.id === message.id)) return state;
      return { dmMessages: [...state.dmMessages, message] };
    });
  },

  removeDmMessage: (messageId) => {
    set((state) => ({
      dmMessages: state.dmMessages.filter((m) => m.id !== messageId),
    }));
  },

  setTypingUser: (userId, username) => {
    set((state) => {
      if (state.typingUsers.some((u) => u.userId === userId)) return state;
      return { typingUsers: [...state.typingUsers, { userId, username }] };
    });
  },

  removeTypingUser: (userId) => {
    set((state) => ({
      typingUsers: state.typingUsers.filter((u) => u.userId !== userId),
    }));
  },

  setUserOnline: (userId) => {
    set((state) => {
      const newSet = new Set(state.onlineUsers);
      newSet.add(userId);
      return { onlineUsers: newSet };
    });
  },

  setUserOffline: (userId) => {
    set((state) => {
      const newSet = new Set(state.onlineUsers);
      newSet.delete(userId);
      return { onlineUsers: newSet };
    });
  },

  addMember: (member) => {
    set((state) => {
      if (state.members.some((m) => m.user.id === member.user.id)) return state;
      return { members: [...state.members, member] };
    });
  },

  removeMember: (userId) => {
    set((state) => ({
      members: state.members.filter((m) => m.user.id !== userId),
    }));
  },

  updateMemberRole: (userId, role) => {
    set((state) => ({
      members: state.members.map((m) =>
        m.user.id === userId ? { ...m, role } : m,
      ),
    }));
  },

  updateServer: (serverId, data) => {
    set((state) => ({
      servers: state.servers.map((s) =>
        s.id === serverId ? { ...s, ...data } : s,
      ),
      currentServer:
        state.currentServer?.id === serverId
          ? { ...state.currentServer, ...data }
          : state.currentServer,
    }));
  },

  setupSocketListeners: () => {
    const attachListeners = () => {
      const socket = getSocket();
      if (!socket) return false;

      socket.off("connect");
      socket.on("connect", () => {
        const { currentServer, currentChannel, currentDmConversation } = get();
        if (currentServer) {
          joinServer(currentServer.id).catch(() => {});
        }
        if (currentChannel) {
          joinChannel(currentChannel.id).catch(() => {});
        }
        if (currentDmConversation) {
          joinDm(currentDmConversation.id).catch(() => {});
        }
      });

      const events = [
        "message:new",
        "message:deleted",
        "dm:new",
        "dm:deleted",
        "typing:start",
        "typing:stop",
        "user:online",
        "user:offline",
        "channel:created",
        "channel:deleted",
        "user:joined",
        "user:left",
        "member:role_updated",
        "server:updated",
      ] as const;

      events.forEach((event) => socket.off(event));

      socket.on("message:new", (message) => {
        const { currentChannel } = get();
        if (currentChannel?.id === message.channelId) {
          get().addMessage({
            id: message.id,
            content: message.content,
            createdAt: message.createdAt,
            author: message.author,
          });
        }
      });

      socket.on("message:deleted", ({ messageId }) => {
        get().removeMessage(messageId);
      });

      socket.on("dm:new", (message) => {
        const { currentDmConversation } = get();
        const normalizedMessage: DirectMessage = {
          id: message.id,
          conversationId: message.conversationId,
          authorId: message.author?.id || "",
          content: message.content,
          createdAt: message.createdAt,
          author: message.author,
        };
        if (currentDmConversation?.id === message.conversationId) {
          get().addDmMessage(normalizedMessage);
        }
        get()
          .fetchDmConversations()
          .catch(() => {});
      });

      socket.on("dm:deleted", ({ messageId, conversationId }) => {
        const { currentDmConversation } = get();
        if (currentDmConversation?.id === conversationId) {
          get().removeDmMessage(messageId);
        }
        get()
          .fetchDmConversations()
          .catch(() => {});
      });

      socket.on("typing:start", ({ userId, username, channelId }) => {
        const { currentChannel } = get();
        if (currentChannel?.id === channelId) {
          get().setTypingUser(userId, username);
        }
      });

      socket.on("typing:stop", ({ userId }) => {
        get().removeTypingUser(userId);
      });

      socket.on("user:online", ({ userId }) => {
        get().setUserOnline(userId);
      });

      socket.on("user:offline", ({ userId }) => {
        get().setUserOffline(userId);
      });

      socket.on("channel:created", (channel) => {
        const { currentServer } = get();
        if (currentServer?.id === channel.serverId) {
          set((state) => ({ channels: [...state.channels, channel] }));
        }
      });

      socket.on("channel:deleted", ({ channelId }) => {
        set((state) => ({
          channels: state.channels.filter((c) => c.id !== channelId),
          currentChannel:
            state.currentChannel?.id === channelId
              ? null
              : state.currentChannel,
        }));
      });

      socket.on("user:joined", ({ serverId, userId, username, role }) => {
        const { currentServer } = get();
        if (currentServer?.id === serverId) {
          get().addMember({
            id: `${serverId}-${userId}`,
            role: role || "MEMBER",
            user: { id: userId, username },
          });
        }
      });

      socket.on("user:left", ({ serverId, userId }) => {
        const { currentServer } = get();
        if (currentServer?.id === serverId) {
          get().removeMember(userId);
        }
      });

      socket.on("member:role_updated", ({ serverId, userId, role }) => {
        const { currentServer } = get();
        if (currentServer?.id === serverId) {
          get().updateMemberRole(userId, role);
        }
      });

      socket.on("server:updated", ({ serverId, name }) => {
        get().updateServer(serverId, { name });
      });

      return true;
    };

    if (!attachListeners()) {
      const interval = setInterval(() => {
        if (attachListeners()) {
          clearInterval(interval);
        }
      }, 200);
    }
  },
}));
