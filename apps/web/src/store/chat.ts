"use client";

import { create } from "zustand";
import {
  api,
  type DirectConversation,
  type DirectMessage,
  type DirectMessageReadStatus,
  type ReplySummary,
  type BanStatus,
  type BanType,
  type BanPayload,
} from "@/lib/api";
import {
  getSocket,
  joinServer,
  leaveServer,
  joinDm,
  leaveDm,
  updateStatus,
} from "@/lib/socket";
import { useAuthStore } from "@/store/auth";

interface Server {
  id: string;
  name: string;
  inviteCode: string;
  owner?: { id: string; username: string };
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
  ban?: BanPayload | null;
  user: {
    id: string;
    username: string;
    email?: string;
    avatarUrl?: string | null;
    status?: "online" | "busy" | "dnd" | null;
  };
}

interface Message {
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
  userStatuses: Map<string, "online" | "busy" | "dnd">;
  isLoading: boolean;
  hasMoreMessages: boolean;
  nextCursor: string | null;

  dmConversations: DirectConversation[];
  currentDmConversation: DirectConversation | null;
  dmMessages: DirectMessage[];
  dmHasMoreMessages: boolean;
  dmNextCursor: string | null;

  blockedUserIds: Set<string>;
  currentBan: BanStatus | null;

  fetchServers: () => Promise<void>;
  selectServer: (serverId: string) => Promise<void>;
  selectChannel: (channelId: string) => Promise<void>;
  createServer: (name: string) => Promise<void>;
  joinServerByCode: (inviteCode: string) => Promise<void>;
  leaveCurrentServer: () => Promise<void>;
  createChannel: (name: string) => Promise<void>;
  deleteChannel: (channelId: string) => Promise<void>;
  deleteCurrentServer: () => Promise<void>;

  fetchDmConversations: () => Promise<void>;
  startDmByUsername: (username: string) => Promise<void>;
  selectDmConversation: (conversationId: string) => Promise<void>;
  leaveDmConversation: () => Promise<void>;
  markDmConversationRead: (conversationId: string) => Promise<void>;

  sendMessage: (
    content?: string,
    gifUrl?: string | null,
    replyToMessageId?: string | null,
  ) => Promise<void>;
  updateMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;

  kickMember: (memberId: string) => Promise<void>;
  banMember: (
    userId: string,
    payload: {
      type: BanType;
      durationSeconds?: number;
      durationMinutes?: number;
      expiresAt?: string;
      reason?: string;
    },
  ) => Promise<void>;
  unbanMember: (userId: string) => Promise<void>;
  loadMoreMessages: () => Promise<void>;

  addMessage: (message: Message) => void;
  removeMessage: (messageId: string) => void;
  updateMessageLocal: (
    messageId: string,
    content: string | null,
    updatedAt: string,
  ) => void;
  updateMessageReaction: (messageId: string, reactions: Record<string, string[]>) => void;

  addDmMessage: (message: DirectMessage) => void;
  removeDmMessage: (messageId: string) => void;
  updateDmReaction: (messageId: string, reactions: Record<string, string[]>) => void;

  setTypingUser: (userId: string, username: string) => void;
  removeTypingUser: (userId: string) => void;
  setUserOnline: (userId: string) => void;
  setUserOffline: (userId: string) => void;
  setUserStatus: (userId: string, status: "online" | "busy" | "dnd") => void;
  setUserStatuses: (
    statuses: Record<string, "online" | "busy" | "dnd">,
  ) => void;
  updateMyStatus: (status: "online" | "busy" | "dnd") => Promise<void>;
  addMember: (member: Member) => void;
  removeMember: (userId: string) => void;
  updateMemberRole: (userId: string, role: Member["role"]) => void;
  updateServer: (serverId: string, data: Partial<Server>) => void;
  fetchBlockedUsers: () => Promise<void>;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  reportUser: (
    userId: string,
    payload?: { reason?: string; messageId?: string; channelId?: string },
  ) => Promise<void>;
  setupSocketListeners: () => void;
  restoreSelection: () => Promise<void>;
  forceJoinCurrent: () => Promise<void>;
  resetChat: () => void;
}

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function logSocketError(action: string, error: unknown) {
  console.warn(`[Socket] ${action} failed`, error);
}

function canShowDesktopNotification() {
  return (
    typeof window !== "undefined" &&
    typeof document !== "undefined" &&
    typeof window.rtcDesktop?.notify === "function" &&
    (document.hidden || !document.hasFocus())
  );
}

function notifyIncomingMessage(title: string, body: string) {
  if (!canShowDesktopNotification()) {
    return;
  }

  window.rtcDesktop
    ?.notify({ title, body })
    .catch((error) => console.warn("[Desktop] notify failed", error));
}

function getNotificationBody(content?: string | null, gifUrl?: string | null) {
  const trimmedContent = content?.trim();
  if (trimmedContent) {
    return trimmedContent;
  }

  if (gifUrl) {
    return "Sent a GIF";
  }

  return "New message";
}

const STORAGE_KEYS = {
  serverId: "rtc:lastServerId",
  channelId: "rtc:lastChannelId",
  dmId: "rtc:lastDmId",
};

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // Ignore storage errors
  }
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function maskReplyPreview(
  replyTo: ReplySummary | null,
  blockedIds: Set<string>,
) {
  if (!replyTo?.author?.id) return replyTo;
  if (replyTo.masked) return replyTo;
  if (!blockedIds.has(replyTo.author.id)) return replyTo;
  return {
    ...replyTo,
    content: null,
    gifUrl: null,
    masked: true,
  };
}

function maskChannelMessage(
  message: Message,
  blockedIds: Set<string>,
): Message {
  const replyTo = maskReplyPreview(message.replyTo ?? null, blockedIds);
  if (message.masked || !blockedIds.has(message.author.id)) {
    return { ...message, replyTo };
  }
  return {
    ...message,
    content: null,
    gifUrl: null,
    masked: true,
    replyTo,
  };
}

function maskDirectMessage(
  message: DirectMessage,
  blockedIds: Set<string>,
): DirectMessage {
  const replyTo = maskReplyPreview(message.replyTo ?? null, blockedIds);
  if (message.masked || !blockedIds.has(message.authorId)) {
    return { ...message, replyTo };
  }
  return {
    ...message,
    content: null,
    gifUrl: null,
    masked: true,
    replyTo,
  };
}

function maskConversationPreview<
  T extends {
    lastMessage?: {
      authorId: string;
      content: string | null;
      gifUrl?: string | null;
    } | null;
  },
>(conversation: T, blockedIds: Set<string>): T {
  if (
    !conversation.lastMessage ||
    !blockedIds.has(conversation.lastMessage.authorId)
  ) {
    return conversation;
  }
  return {
    ...conversation,
    lastMessage: {
      ...conversation.lastMessage,
      content: null,
      gifUrl: null,
    },
  };
}

function applyReadStatusToConversation(
  conversation: DirectConversation,
  status: DirectMessageReadStatus,
): DirectConversation {
  if (conversation.id !== status.conversationId) {
    return conversation;
  }

  return {
    ...conversation,
    lastReadMessageIdByUser: {
      ...(conversation.lastReadMessageIdByUser ?? {}),
      [status.userId]: status.lastReadMessageId,
    },
    lastReadAtByUser: {
      ...(conversation.lastReadAtByUser ?? {}),
      [status.userId]: status.lastReadAt,
    },
  };
}

function normalizeBanStatus(status: BanStatus): BanStatus {
  const isBanned =
    typeof status.isBanned === "boolean"
      ? status.isBanned
      : Boolean(status.banned);
  const serverNow = status.serverNow || status.serverTime || new Date().toISOString();
  let ban = status.ban ?? null;
  if (!ban && (status.type || status.expiresAt || status.reason)) {
    const type =
      status.type === "TEMPORARY" ? "temporary" : "permanent";
    ban = {
      type,
      bannedUntil: status.expiresAt ?? null,
      issuedAt: serverNow,
      issuedBy: "",
      reason: status.reason ?? null,
    };
  }
  return {
    ...status,
    isBanned,
    serverNow,
    ban,
  };
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
  userStatuses: new Map(),
  isLoading: false,
  hasMoreMessages: false,
  nextCursor: null,

  dmConversations: [],
  currentDmConversation: null,
  dmMessages: [],
  dmHasMoreMessages: false,
  dmNextCursor: null,
  blockedUserIds: new Set<string>(),
  currentBan: null,

  resetChat: () => {
    writeStorage(STORAGE_KEYS.serverId, null);
    writeStorage(STORAGE_KEYS.channelId, null);
    writeStorage(STORAGE_KEYS.dmId, null);
    set({
      servers: [],
      currentServer: null,
      channels: [],
      currentChannel: null,
      members: [],
      mode: "channel",
      messages: [],
      typingUsers: [],
      onlineUsers: new Set(),
      userStatuses: new Map(),
      isLoading: false,
      hasMoreMessages: false,
      nextCursor: null,
      dmConversations: [],
      currentDmConversation: null,
      dmMessages: [],
      dmHasMoreMessages: false,
      dmNextCursor: null,
      blockedUserIds: new Set<string>(),
      currentBan: null,
    });
  },

  fetchServers: async () => {
    const servers = await api.getServers();
    set({ servers });
  },

  selectServer: async (serverId) => {
    const { currentServer, currentChannel, currentDmConversation } = get();

    if (currentDmConversation) {
      try {
        await leaveDm(currentDmConversation.id);
      } catch (error) {
        logSocketError("leave:dm", error);
      }
    }

    if (currentServer) {
      try {
        await leaveServer(currentServer.id);
      } catch (error) {
        logSocketError("leave:server", error);
      }
    }

    writeStorage(STORAGE_KEYS.serverId, serverId);
    writeStorage(STORAGE_KEYS.channelId, null);
    writeStorage(STORAGE_KEYS.dmId, null);

    set({
      isLoading: true,
      currentChannel: null,
      messages: [],
      typingUsers: [],
      onlineUsers: new Set(),
      userStatuses: new Map(),
      mode: "channel",
      currentDmConversation: null,
      dmMessages: [],
      dmHasMoreMessages: false,
      dmNextCursor: null,
      blockedUserIds: new Set<string>(),
      currentBan: null,
    });

    try {
      const banStatus = normalizeBanStatus(
        await api.getServerBanStatus(serverId),
      );
      if (banStatus.isBanned) {
        const fallbackServer =
          get().servers.find((server) => server.id === serverId) || null;
        set({
          currentServer: fallbackServer || {
            id: serverId,
            name: "Server",
            inviteCode: "",
          },
          channels: [],
          members: [],
          blockedUserIds: new Set<string>(),
          currentBan: banStatus,
          isLoading: false,
        });
        return;
      }

      const [server, channels, members, blocked] = await Promise.all([
        api.getServer(serverId),
        api.getServerChannels(serverId),
        api.getServerMembers(serverId),
        api.getBlockedUsers(serverId),
      ]);

      const { onlineUserIds, statuses } = await joinServer(serverId);

      set({
        currentServer: server,
        channels: uniqueById(channels),
        members,
        blockedUserIds: new Set(blocked.blockedUserIds),
        onlineUsers: new Set(onlineUserIds),
        userStatuses: new Map(Object.entries(statuses)),
        isLoading: false,
        currentBan: null,
      });

      await get().fetchDmConversations();

      if (channels.length > 0) {
        await get().selectChannel(channels[0].id);
      }
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  selectChannel: async (channelId) => {
    const {
      currentChannel,
      currentDmConversation,
      currentServer,
      blockedUserIds,
    } = get();

    if (currentDmConversation) {
      try {
        await leaveDm(currentDmConversation.id);
      } catch (error) {
        logSocketError("leave:dm", error);
      }
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

      writeStorage(STORAGE_KEYS.channelId, channelId);
      writeStorage(STORAGE_KEYS.dmId, null);

      const result = await api.getChannelMessages(channelId);
      const blockedIds = get().blockedUserIds;
      const maskedMessages = result.data.map((message) =>
        maskChannelMessage(message as Message, blockedIds),
      );

      set({
        currentChannel: channel,
        messages: maskedMessages.reverse(),
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
      } catch (error) {
        logSocketError("leave:dm", error);
      }
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
      blockedUserIds: new Set<string>(),
      currentBan: null,
    }));
  },

  deleteCurrentServer: async () => {
    const { currentServer, currentChannel, currentDmConversation } = get();
    if (!currentServer) return;

    if (currentDmConversation) {
      try {
        await leaveDm(currentDmConversation.id);
      } catch (error) {
        logSocketError("leave:dm", error);
      }
    }

    await api.deleteServer(currentServer.id);
    writeStorage(STORAGE_KEYS.serverId, null);
    writeStorage(STORAGE_KEYS.channelId, null);

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
      blockedUserIds: new Set<string>(),
      currentBan: null,
    }));

    await get().fetchServers();
  },

  createChannel: async (name) => {
    const { currentServer } = get();
    if (!currentServer) return;

    const channel = await api.createChannel(currentServer.id, name);
    set((state) => ({ channels: uniqueById([...state.channels, channel]) }));
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
    const { currentServer, blockedUserIds } = get();
    const dmConversations = await api.getDmConversations(currentServer?.id);
    const masked = currentServer
      ? dmConversations.map((convo) =>
          maskConversationPreview(convo, blockedUserIds),
        )
      : dmConversations;
    set({ dmConversations: masked });
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
    const { currentDmConversation, blockedUserIds } = get();
    const serverId = get().currentServer?.id;

    if (currentDmConversation && currentDmConversation.id !== conversationId) {
      try {
        await leaveDm(currentDmConversation.id);
      } catch (error) {
        logSocketError("leave:dm", error);
      }
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
        const all = await api.getDmConversations(serverId);
        conversation = all.find((c) => c.id === conversationId) || null;
        const masked = serverId
          ? all.map((convo) => maskConversationPreview(convo, blockedUserIds))
          : all;
        set({ dmConversations: masked });
      }
      if (!conversation) {
        throw new Error("Conversation not found");
      }

      writeStorage(STORAGE_KEYS.dmId, conversationId);
      writeStorage(STORAGE_KEYS.channelId, null);

      await joinDm(conversationId);
      const result = await api.getDmMessages(
        conversationId,
        undefined,
        serverId,
      );
      const maskedMessages = result.data.map((message) =>
        maskDirectMessage(message, blockedUserIds),
      );

      set({
        currentDmConversation: conversation,
        dmMessages: maskedMessages.reverse(),
        dmHasMoreMessages: result.hasMore,
        dmNextCursor: result.nextCursor,
        isLoading: false,
        mode: "dm",
      });

      get().markDmConversationRead(conversationId).catch((error) => {
        logSocketError("dm:read", error);
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
    } catch (error) {
      logSocketError("leave:dm", error);
    }

    writeStorage(STORAGE_KEYS.dmId, null);

    set({
      mode: "channel",
      currentDmConversation: null,
      dmMessages: [],
      dmHasMoreMessages: false,
      dmNextCursor: null,
    });
  },

  markDmConversationRead: async (conversationId: string) => {
    const status = await api.markDmConversationRead(conversationId);
    set((state) => ({
      dmConversations: state.dmConversations.map((conversation) =>
        applyReadStatusToConversation(conversation, status),
      ),
      currentDmConversation:
        state.currentDmConversation?.id === conversationId
          ? applyReadStatusToConversation(state.currentDmConversation, status)
          : state.currentDmConversation,
    }));
  },

  sendMessage: async (content, gifUrl, replyToMessageId) => {
    const { mode, currentChannel, currentDmConversation } = get();

    if (mode === "dm") {
      if (!currentDmConversation) return;
      const message = await api.sendDmMessage(
        currentDmConversation.id,
        content,
        gifUrl,
        replyToMessageId,
      );
      get().addDmMessage(message);
      await get().fetchDmConversations();
      return;
    }

    if (!currentChannel) return;
    const message = await api.sendMessage(
      currentChannel.id,
      content,
      gifUrl,
      replyToMessageId,
    );
    get().addMessage(message);
  },

  updateMessage: async (messageId, content) => {
    const { mode } = get();
    if (mode === "dm") {
      throw new Error("Editing is not supported for DMs");
    }
    const message = await api.updateMessage(messageId, content);
    get().updateMessageLocal(messageId, message.content, message.updatedAt);
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

  toggleReaction: async (messageId: string, emoji: string) => {
    const { mode } = get();
    if (mode === "dm") {
      await api.toggleDirectMessageReaction(messageId, emoji);
    } else {
      await api.toggleChannelMessageReaction(messageId, emoji);
    }
  },

  kickMember: async (memberId) => {
    const { currentServer } = get();
    if (!currentServer) {
      throw new Error("Select a server first");
    }
    await api.kickMember(currentServer.id, memberId);
    get().removeMember(memberId);
  },

  banMember: async (userId, payload) => {
    const { currentServer } = get();
    if (!currentServer) {
      throw new Error("Select a server first");
    }
    await api.banMember(currentServer.id, userId, payload);
  },

  unbanMember: async (userId) => {
    const { currentServer } = get();
    if (!currentServer) {
      throw new Error("Select a server first");
    }
    await api.unbanMember(currentServer.id, userId);
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
        get().currentServer?.id,
      );
      const blockedIds = get().blockedUserIds;
      const maskedMessages = result.data.map((message) =>
        maskDirectMessage(message, blockedIds),
      );
      set((state) => ({
        dmMessages: [...maskedMessages.reverse(), ...state.dmMessages],
        dmHasMoreMessages: result.hasMore,
        dmNextCursor: result.nextCursor,
      }));
      return;
    }

    if (!currentChannel || !hasMoreMessages || !nextCursor) return;

    const result = await api.getChannelMessages(currentChannel.id, nextCursor);
    const blockedIds = get().blockedUserIds;
    const maskedMessages = result.data.map((message) =>
      maskChannelMessage(message as Message, blockedIds),
    );
    set((state) => ({
      messages: [...maskedMessages.reverse(), ...state.messages],
      hasMoreMessages: result.hasMore,
      nextCursor: result.nextCursor,
    }));
  },

  addMessage: (message) => {
    set((state) => {
      if (state.messages.some((m) => m.id === message.id)) return state;
      const maskedMessage = maskChannelMessage(message, state.blockedUserIds);
      return { messages: [...state.messages, maskedMessage] };
    });
  },

  removeMessage: (messageId) => {
    const deletedAt = new Date().toISOString();
    set((state) => ({
      messages: state.messages
        .filter((m) => m.id !== messageId)
        .map((m) =>
          m.replyTo?.id === messageId
            ? {
                ...m,
                replyTo: {
                  ...m.replyTo,
                  content: "",
                  gifUrl: null,
                  deletedAt,
                },
              }
            : m,
        ),
    }));
  },

  updateMessageLocal: (messageId, content, updatedAt) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, content, updatedAt } : m,
      ),
    }));
  },

  updateMessageReaction: (messageId, reactions) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, reactions } : m
      ),
    }));
  },

  addDmMessage: (message) => {
    set((state) => {
      if (state.dmMessages.some((m) => m.id === message.id)) return state;
      const maskedMessage = maskDirectMessage(message, state.blockedUserIds);
      return { dmMessages: [...state.dmMessages, maskedMessage] };
    });
  },

  removeDmMessage: (messageId) => {
    const deletedAt = new Date().toISOString();
    set((state) => ({
      dmMessages: state.dmMessages
        .filter((m) => m.id !== messageId)
        .map((m) =>
          m.replyTo?.id === messageId
            ? {
                ...m,
                replyTo: {
                  ...m.replyTo,
                  content: "",
                  gifUrl: null,
                  deletedAt,
                },
              }
            : m,
        ),
    }));
  },

  updateDmReaction: (messageId, reactions) => {
    set((state) => ({
      dmMessages: state.dmMessages.map((m) =>
        m.id === messageId ? { ...m, reactions } : m
      ),
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
      const nextStatuses = new Map(state.userStatuses);
      if (!nextStatuses.has(userId)) {
        nextStatuses.set(userId, "online");
      }
      return { onlineUsers: newSet, userStatuses: nextStatuses };
    });
  },

  setUserOffline: (userId) => {
    set((state) => {
      const newSet = new Set(state.onlineUsers);
      newSet.delete(userId);
      const nextStatuses = new Map(state.userStatuses);
      nextStatuses.delete(userId);
      return { onlineUsers: newSet, userStatuses: nextStatuses };
    });
  },

  setUserStatus: (userId, status) => {
    set((state) => {
      const nextStatuses = new Map(state.userStatuses);
      nextStatuses.set(userId, status);
      return { userStatuses: nextStatuses };
    });
  },

  setUserStatuses: (statuses) => {
    set({ userStatuses: new Map(Object.entries(statuses)) });
  },

  updateMyStatus: async (status) => {
    const { currentServer } = get();
    if (!currentServer) return;
    await updateStatus(currentServer.id, status);
    const myId = useAuthStore.getState().user?.id;
    if (myId) {
      get().setUserStatus(myId, status);
    }
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

  fetchBlockedUsers: async () => {
    const { currentServer } = get();
    if (!currentServer) return;
    const response = await api.getBlockedUsers(currentServer.id);
    set({ blockedUserIds: new Set(response.blockedUserIds) });
  },

  blockUser: async (userId) => {
    const { currentServer } = get();
    if (!currentServer) throw new Error("Select a server first");
    await api.blockUser(currentServer.id, userId);
    set((state) => {
      const nextSet = new Set(state.blockedUserIds);
      nextSet.add(userId);
      return {
        blockedUserIds: nextSet,
        messages: state.messages.map((m) => maskChannelMessage(m, nextSet)),
        dmMessages: state.dmMessages.map((m) => maskDirectMessage(m, nextSet)),
        dmConversations: state.dmConversations.map((c) =>
          maskConversationPreview(c, nextSet),
        ),
      };
    });
  },

  unblockUser: async (userId) => {
    const { currentServer, mode, currentChannel, currentDmConversation } =
      get();
    if (!currentServer) throw new Error("Select a server first");
    await api.unblockUser(currentServer.id, userId);
    set((state) => {
      const nextSet = new Set(state.blockedUserIds);
      nextSet.delete(userId);
      return { blockedUserIds: nextSet };
    });

    await get().fetchDmConversations();

    if (mode === "channel" && currentChannel) {
      const result = await api.getChannelMessages(currentChannel.id);
      const blockedIds = get().blockedUserIds;
      const maskedMessages = result.data.map((message) =>
        maskChannelMessage(message as Message, blockedIds),
      );
      set({
        messages: maskedMessages.reverse(),
        hasMoreMessages: result.hasMore,
        nextCursor: result.nextCursor,
      });
    }

    if (mode === "dm" && currentDmConversation) {
      const result = await api.getDmMessages(
        currentDmConversation.id,
        undefined,
        currentServer.id,
      );
      const blockedIds = get().blockedUserIds;
      const maskedMessages = result.data.map((message) =>
        maskDirectMessage(message, blockedIds),
      );
      set({
        dmMessages: maskedMessages.reverse(),
        dmHasMoreMessages: result.hasMore,
        dmNextCursor: result.nextCursor,
      });
    }
  },

  reportUser: async (userId, payload) => {
    const { currentServer } = get();
    if (!currentServer) throw new Error("Select a server first");
    await api.reportUser(currentServer.id, userId, payload);
  },

  setupSocketListeners: () => {
    const attachListeners = () => {
      const socket = getSocket();
      if (!socket) return false;

      socket.off("connect");
      socket.on("connect", () => {
        const {
          currentServer,
          currentChannel,
          currentDmConversation,
          currentBan,
        } = get();
        if (currentServer && !currentBan?.isBanned) {
          joinServer(currentServer.id)
            .then(({ onlineUserIds, statuses }) => {
              set({
                onlineUsers: new Set(onlineUserIds),
                userStatuses: new Map(Object.entries(statuses)),
              });
            })
            .catch((error) => logSocketError("join:server", error));
        }
        if (currentDmConversation) {
          joinDm(currentDmConversation.id).catch((error) =>
            logSocketError("join:dm", error),
          );
        }
      });

      const events = [
        "message:new",
        "message:updated",
        "message:deleted",
        "message:reaction",
        "dm:new",
        "dm:deleted",
        "dm:reaction",
        "dm:read",
        "typing:start",
        "typing:stop",
        "user:online",
        "user:offline",
        "user:status",
        "channel:created",
        "channel:deleted",
        "user:joined",
        "user:left",
        "member:role_updated",
        "server:memberBanned",
        "server:memberUnbanned",
        "server:banUpdated",
        "server:updated",
      ] as const;

      events.forEach((event) => socket.off(event));

      socket.on("message:new", (message) => {
        const currentUserId = useAuthStore.getState().user?.id;

        set((state) => {
          if (state.currentChannel?.id !== message.channelId) return state;
          if (state.messages.some((m) => m.id === message.id)) return state;
          const baseMessage: Message = {
            id: message.id,
            content: message.content,
            gifUrl: message.gifUrl ?? null,
            replyToMessageId: message.replyTo?.id ?? null,
            replyTo: message.replyTo ?? null,
            createdAt: message.createdAt,
            updatedAt: message.updatedAt ?? message.createdAt,
            author: message.author,
          };
          const maskedMessage = maskChannelMessage(
            baseMessage,
            state.blockedUserIds,
          );
          return {
            messages: [...state.messages, maskedMessage],
          };
        });

        if (message.author?.id && message.author.id !== currentUserId) {
          const channelName =
            get().channels.find((channel) => channel.id === message.channelId)?.name ??
            "channel";
          notifyIncomingMessage(
            `${message.author.username} in #${channelName}`,
            getNotificationBody(message.content, message.gifUrl ?? null),
          );
        }
      });

      socket.on("message:updated", (message) => {
        set((state) => {
          if (state.currentChannel?.id !== message.channelId) return state;
          return {
            messages: state.messages.map((m) =>
              m.id === message.id
                ? maskChannelMessage(
                    {
                      ...m,
                      content: message.content,
                      updatedAt: message.updatedAt ?? message.createdAt,
                      author: message.author ?? m.author,
                    },
                    state.blockedUserIds,
                  )
                : m,
            ),
          };
        });
      });

      socket.on("message:deleted", ({ messageId }) => {
        get().removeMessage(messageId);
      });

      socket.on("message:reaction", ({ messageId, channelId, reactions }) => {
        const { currentChannel } = get();
        if (currentChannel?.id === channelId) {
          get().updateMessageReaction(messageId, reactions);
        }
      });

      socket.on("dm:new", (message) => {
        const { currentDmConversation } = get();
        const currentUserId = useAuthStore.getState().user?.id;
        const normalizedMessage: DirectMessage = {
          id: message.id,
          conversationId: message.conversationId,
          authorId: message.author?.id || "",
          content: message.content,
          gifUrl: message.gifUrl ?? null,
          replyToMessageId: message.replyTo?.id ?? null,
          replyTo: message.replyTo ?? null,
          createdAt: message.createdAt,
          author: message.author,
        };
        if (currentDmConversation?.id === message.conversationId) {
          get().addDmMessage(normalizedMessage);
          if (
            currentUserId &&
            normalizedMessage.authorId &&
            normalizedMessage.authorId !== currentUserId
          ) {
            get()
              .markDmConversationRead(message.conversationId)
              .catch((error) => logSocketError("dm:read", error));
          }
        }

        if (
          normalizedMessage.authorId &&
          normalizedMessage.authorId !== currentUserId
        ) {
          notifyIncomingMessage(
            message.author?.username || "New direct message",
            getNotificationBody(message.content, message.gifUrl ?? null),
          );
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

      socket.on("dm:reaction", ({ messageId, conversationId, reactions }) => {
        const { currentDmConversation } = get();
        if (currentDmConversation?.id === conversationId) {
          get().updateDmReaction(messageId, reactions);
        }
      });

      socket.on("dm:read", (status: DirectMessageReadStatus) => {
        set((state) => ({
          dmConversations: state.dmConversations.map((conversation) =>
            applyReadStatusToConversation(conversation, status),
          ),
          currentDmConversation:
            state.currentDmConversation?.id === status.conversationId
              ? applyReadStatusToConversation(state.currentDmConversation, status)
              : state.currentDmConversation,
        }));
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

      socket.on("user:status", ({ userId, status }) => {
        get().setUserStatus(userId, status);
      });

      socket.on("channel:created", (channel) => {
        const { currentServer } = get();
        if (currentServer?.id === channel.serverId) {
          set((state) => ({
            channels: uniqueById([...state.channels, channel]),
          }));
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

      const handleBanEvent = (payload: {
        serverId: string;
        userId: string;
        ban: BanPayload;
        serverNow: string;
      }) => {
        const { currentServer } = get();
        if (!currentServer || currentServer.id !== payload.serverId) {
          return;
        }

        set((state) => ({
          members: state.members.map((member) =>
            member.user.id === payload.userId
              ? { ...member, ban: payload.ban }
              : member,
          ),
        }));

        const currentUserId = useAuthStore.getState().user?.id;
        if (currentUserId && payload.userId === currentUserId) {
          set({
            currentBan: {
              isBanned: true,
              ban: payload.ban,
              serverNow: payload.serverNow,
            },
          });
        }
      };

      socket.on("server:memberBanned", handleBanEvent);
      socket.on("server:banUpdated", handleBanEvent);

      socket.on("server:memberUnbanned", (payload) => {
        const { currentServer } = get();
        if (!currentServer || currentServer.id !== payload.serverId) {
          return;
        }

        set((state) => ({
          members: state.members.map((member) =>
            member.user.id === payload.userId
              ? { ...member, ban: null }
              : member,
          ),
        }));

        const currentUserId = useAuthStore.getState().user?.id;
        if (currentUserId && payload.userId === currentUserId) {
          set({ currentBan: null });
          get()
            .selectServer(payload.serverId)
            .catch(() => {});
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

  forceJoinCurrent: async () => {
    const { currentServer, currentChannel, currentDmConversation, currentBan } =
      get();
    if (currentServer && !currentBan?.isBanned) {
      try {
        const { onlineUserIds, statuses } = await joinServer(currentServer.id);
        set({
          onlineUsers: new Set(onlineUserIds),
          userStatuses: new Map(Object.entries(statuses)),
        });
      } catch (error) {
        logSocketError("join:server", error);
      }
    }
    if (currentDmConversation) {
      try {
        await joinDm(currentDmConversation.id);
      } catch (error) {
        logSocketError("join:dm", error);
      }
    }
  },

  restoreSelection: async () => {
    const serverId = readStorage(STORAGE_KEYS.serverId);
    const channelId = readStorage(STORAGE_KEYS.channelId);
    const dmId = readStorage(STORAGE_KEYS.dmId);

    if (!serverId && !channelId && !dmId) return;

    try {
      if (serverId) {
        await get().selectServer(serverId);
        if (get().currentBan?.isBanned) {
          return;
        }
        if (dmId) {
          await get().selectDmConversation(dmId);
        } else if (channelId) {
          await get().selectChannel(channelId);
        }
      } else if (dmId) {
        await get().selectDmConversation(dmId);
      }
    } catch (error) {
      logSocketError("restore:selection", error);
    }

    await get().forceJoinCurrent();
  },
}));
