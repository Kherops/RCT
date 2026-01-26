'use client';

import { create } from 'zustand';
import { api } from '@/lib/api';
import { getSocket, joinServer, leaveServer, joinChannel, leaveChannel } from '@/lib/socket';

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
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  user: { id: string; username: string; email: string };
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

interface ChatState {
  servers: Server[];
  currentServer: Server | null;
  channels: Channel[];
  currentChannel: Channel | null;
  members: Member[];
  messages: Message[];
  typingUsers: TypingUser[];
  onlineUsers: Set<string>;
  isLoading: boolean;
  hasMoreMessages: boolean;
  nextCursor: string | null;

  fetchServers: () => Promise<void>;
  selectServer: (serverId: string) => Promise<void>;
  selectChannel: (channelId: string) => Promise<void>;
  createServer: (name: string) => Promise<void>;
  joinServerByCode: (inviteCode: string) => Promise<void>;
  leaveCurrentServer: () => Promise<void>;
  createChannel: (name: string) => Promise<void>;
  deleteChannel: (channelId: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  addMessage: (message: Message) => void;
  removeMessage: (messageId: string) => void;
  setTypingUser: (userId: string, username: string) => void;
  removeTypingUser: (userId: string) => void;
  setUserOnline: (userId: string) => void;
  setUserOffline: (userId: string) => void;
  setupSocketListeners: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  servers: [],
  currentServer: null,
  channels: [],
  currentChannel: null,
  members: [],
  messages: [],
  typingUsers: [],
  onlineUsers: new Set(),
  isLoading: false,
  hasMoreMessages: false,
  nextCursor: null,

  fetchServers: async () => {
    const servers = await api.getServers();
    set({ servers });
  },

  selectServer: async (serverId) => {
    const { currentServer, currentChannel } = get();
    
    if (currentChannel) {
      try { await leaveChannel(currentChannel.id); } catch {}
    }
    if (currentServer) {
      try { await leaveServer(currentServer.id); } catch {}
    }

    set({ isLoading: true, currentChannel: null, messages: [], typingUsers: [] });

    try {
      const [server, channels, members] = await Promise.all([
        api.getServer(serverId),
        api.getServerChannels(serverId),
        api.getServerMembers(serverId),
      ]);

      await joinServer(serverId);

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
    const { currentChannel } = get();
    
    if (currentChannel) {
      try { await leaveChannel(currentChannel.id); } catch {}
    }

    set({ isLoading: true, messages: [], typingUsers: [] });

    try {
      const channel = get().channels.find(c => c.id === channelId);
      if (!channel) throw new Error('Channel not found');

      await joinChannel(channelId);
      const result = await api.getChannelMessages(channelId);

      set({
        currentChannel: channel,
        messages: result.data.reverse(),
        hasMoreMessages: result.hasMore,
        nextCursor: result.nextCursor,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  createServer: async (name) => {
    const server = await api.createServer(name);
    set(state => ({ servers: [...state.servers, server] }));
    await get().selectServer(server.id);
  },

  joinServerByCode: async (inviteCode) => {
    const server = await api.joinServer(inviteCode);
    await get().fetchServers();
    await get().selectServer(server.id);
  },

  leaveCurrentServer: async () => {
    const { currentServer } = get();
    if (!currentServer) return;

    await api.leaveServer(currentServer.id);
    set(state => ({
      servers: state.servers.filter(s => s.id !== currentServer.id),
      currentServer: null,
      channels: [],
      currentChannel: null,
      messages: [],
      members: [],
    }));
  },

  createChannel: async (name) => {
    const { currentServer } = get();
    if (!currentServer) return;

    const channel = await api.createChannel(currentServer.id, name);
    set(state => ({ channels: [...state.channels, channel] }));
  },

  deleteChannel: async (channelId) => {
    await api.deleteChannel(channelId);
    set(state => ({
      channels: state.channels.filter(c => c.id !== channelId),
      currentChannel: state.currentChannel?.id === channelId ? null : state.currentChannel,
    }));
  },

  sendMessage: async (content) => {
    const { currentChannel } = get();
    if (!currentChannel) return;
    await api.sendMessage(currentChannel.id, content);
  },

  deleteMessage: async (messageId) => {
    await api.deleteMessage(messageId);
  },

  loadMoreMessages: async () => {
    const { currentChannel, nextCursor, hasMoreMessages } = get();
    if (!currentChannel || !hasMoreMessages || !nextCursor) return;

    const result = await api.getChannelMessages(currentChannel.id, nextCursor);
    set(state => ({
      messages: [...result.data.reverse(), ...state.messages],
      hasMoreMessages: result.hasMore,
      nextCursor: result.nextCursor,
    }));
  },

  addMessage: (message) => {
    set(state => ({ messages: [...state.messages, message] }));
  },

  removeMessage: (messageId) => {
    set(state => ({ messages: state.messages.filter(m => m.id !== messageId) }));
  },

  setTypingUser: (userId, username) => {
    set(state => {
      if (state.typingUsers.some(u => u.userId === userId)) return state;
      return { typingUsers: [...state.typingUsers, { userId, username }] };
    });
  },

  removeTypingUser: (userId) => {
    set(state => ({ typingUsers: state.typingUsers.filter(u => u.userId !== userId) }));
  },

  setUserOnline: (userId) => {
    set(state => {
      const newSet = new Set(state.onlineUsers);
      newSet.add(userId);
      return { onlineUsers: newSet };
    });
  },

  setUserOffline: (userId) => {
    set(state => {
      const newSet = new Set(state.onlineUsers);
      newSet.delete(userId);
      return { onlineUsers: newSet };
    });
  },

  setupSocketListeners: () => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('message:new', (message) => {
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

    socket.on('message:deleted', ({ messageId }) => {
      get().removeMessage(messageId);
    });

    socket.on('typing:start', ({ userId, username, channelId }) => {
      const { currentChannel } = get();
      if (currentChannel?.id === channelId) {
        get().setTypingUser(userId, username);
      }
    });

    socket.on('typing:stop', ({ userId }) => {
      get().removeTypingUser(userId);
    });

    socket.on('user:online', ({ userId }) => {
      get().setUserOnline(userId);
    });

    socket.on('user:offline', ({ userId }) => {
      get().setUserOffline(userId);
    });

    socket.on('channel:created', (channel) => {
      const { currentServer } = get();
      if (currentServer?.id === channel.serverId) {
        set(state => ({ channels: [...state.channels, channel] }));
      }
    });

    socket.on('channel:deleted', ({ channelId }) => {
      set(state => ({
        channels: state.channels.filter(c => c.id !== channelId),
        currentChannel: state.currentChannel?.id === channelId ? null : state.currentChannel,
      }));
    });
  },
}));
