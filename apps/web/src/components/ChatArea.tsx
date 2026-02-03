"use client";

import { useState, useRef, useEffect, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Hash,
  Send,
  MoreVertical,
  Trash2,
  Copy,
  Loader2,
  MessageSquare,
  AtSign,
  Image as ImageIcon,
  Smile,
  Pencil,
  X,
} from "lucide-react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import emojiRegex from "emoji-regex";
import { useChatStore } from "@/store/chat";
import { useAuthStore } from "@/store/auth";
import { startTyping, stopTyping } from "@/lib/socket";
import { formatTime } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { api, type GifResult, type ReplySummary } from "@/lib/api";
import { ProfileCard } from "@/components/ProfileCard";

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const URL_TOKEN_REGEX = /^https?:\/\/[^\s]+$/;
const EMOJI_REGEX = emojiRegex();
function getFirstUrl(text: string): string | null {
  const match = text.match(URL_REGEX);
  return match && match.length > 0 ? match[0] : null;
}

function getYouTubeId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.hostname === "youtu.be") {
      return url.pathname.replace("/", "") || null;
    }
    if (url.hostname.endsWith("youtube.com")) {
      if (url.pathname === "/watch") {
        return url.searchParams.get("v");
      }
      if (url.pathname.startsWith("/shorts/")) {
        return url.pathname.split("/")[2] || null;
      }
      if (url.pathname.startsWith("/embed/")) {
        return url.pathname.split("/")[2] || null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function renderMessageContent(text: string) {
  const parts = text.split(URL_REGEX);
  return parts.map((part, index) => {
    if (URL_TOKEN_REGEX.test(part)) {
      return (
        <a
          key={`link-${index}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-discord-accent underline break-words"
        >
          {part}
        </a>
      );
    }
    const nodes: ReactNode[] = [];
    let lastIndex = 0;
    let matchIndex = 0;
    for (const match of part.matchAll(EMOJI_REGEX)) {
      const startIndex = match.index ?? 0;
      if (startIndex > lastIndex) {
        nodes.push(
          <span key={`text-${index}-${matchIndex}`}>
            {part.slice(lastIndex, startIndex)}
          </span>,
        );
      }
      const nativeEmoji = match[0];
      nodes.push(
        <span
          key={`emoji-${index}-${matchIndex}`}
          className="inline-block align-text-bottom text-[18px] leading-none"
        >
          {nativeEmoji}
        </span>,
      );
      lastIndex = startIndex + nativeEmoji.length;
      matchIndex += 1;
    }
    if (lastIndex < part.length) {
      nodes.push(
        <span key={`text-${index}-${matchIndex}`}>
          {part.slice(lastIndex)}
        </span>,
      );
    }
    return <span key={`text-${index}`}>{nodes}</span>;
  });
}

export function ChatArea() {
  const {
    mode,
    currentChannel,
    currentDmConversation,
    messages,
    dmMessages,
    typingUsers,
    members,
    sendMessage,
    updateMessage,
    deleteMessage,
    loadMoreMessages,
    hasMoreMessages,
    dmHasMoreMessages,
    isLoading,
    blockedUserIds,
    blockUser,
    unblockUser,
    reportUser,
  } = useChatStore();
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(
    null,
  );
  const [openMenuMessageId, setOpenMenuMessageId] = useState<string | null>(
    null,
  );
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [isGifPickerOpen, setIsGifPickerOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState("");
  const [gifResults, setGifResults] = useState<GifResult[]>([]);
  const [isGifLoading, setIsGifLoading] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [updatingMessageId, setUpdatingMessageId] = useState<string | null>(
    null,
  );
  const [replyTarget, setReplyTarget] = useState<{
    id: string;
    author: { id: string; username: string };
    content: string | null;
    gifUrl?: string | null;
  } | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const [blockTarget, setBlockTarget] = useState<{
    id: string;
    username: string;
  } | null>(null);
  const [reportTarget, setReportTarget] = useState<{
    id: string;
    username: string;
  } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [isBlocking, setIsBlocking] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const suppressAutoScrollRef = useRef(false);
  const canLoadMoreRef = useRef(false);
  const loadingMoreRef = useRef(false);

  const isDmMode = mode === "dm";

  const dmDisplayName = useMemo(() => {
    if (!isDmMode || !currentDmConversation || !user) return "Direct Message";

    const otherId = currentDmConversation.participantIds.find(
      (id) => id !== user.id,
    );
    if (!otherId) return "Direct Message";

    const member = members.find((m) => m.user.id === otherId);
    if (member) return member.user.username;

    const participant = currentDmConversation.participants?.find(
      (p) => p.id === otherId,
    );
    return participant?.username || "Direct Message";
  }, [isDmMode, currentDmConversation, members, user]);

  type RenderedMessage = {
    id: string;
    content: string | null;
    gifUrl?: string | null;
    replyToMessageId?: string | null;
    replyTo?: ReplySummary | null;
    createdAt: string;
    updatedAt: string;
    author: { id: string; username: string; avatarUrl?: string | null };
    deletedAt?: string | null;
    masked?: boolean;
  };

  const renderedMessages = useMemo<RenderedMessage[]>(() => {
    if (!isDmMode) {
      return messages.map((m) => ({
        id: m.id,
        content: m.content,
        gifUrl: m.gifUrl ?? null,
        replyToMessageId: m.replyToMessageId ?? null,
        replyTo: m.replyTo ?? null,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        author: m.author,
        masked: m.masked ?? false,
      }));
    }

    return dmMessages.map((m) => {
      const member = members.find((mem) => mem.user.id === m.authorId);
      return {
        id: m.id,
        content: m.content,
        gifUrl: m.gifUrl ?? null,
        replyToMessageId: m.replyToMessageId ?? null,
        replyTo: m.replyTo ?? null,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt || m.createdAt,
        deletedAt: m.deletedAt ?? null,
        author: {
          id: m.authorId,
          username: m.author?.username || member?.user.username || "Unknown",
          avatarUrl: m.author?.avatarUrl ?? member?.user.avatarUrl ?? null,
        },
        masked: m.masked ?? false,
      };
    });
  }, [isDmMode, messages, dmMessages, members]);

  const messageById = useMemo(() => {
    return new Map(renderedMessages.map((message) => [message.id, message]));
  }, [renderedMessages]);

  const avatarByUserId = useMemo(() => {
    const map = new Map<string, string | null>();
    members.forEach((member) => {
      map.set(member.user.id, member.user.avatarUrl ?? null);
    });
    return map;
  }, [members]);

  const canLoadMore = isDmMode ? dmHasMoreMessages : hasMoreMessages;

  useEffect(() => {
    canLoadMoreRef.current = canLoadMore;
  }, [canLoadMore]);

  useEffect(() => {
    if (suppressAutoScrollRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [renderedMessages]);

  useEffect(() => {
    if (!openMenuMessageId) return;
    const handleClose = () => {
      setOpenMenuMessageId(null);
      setMenuPosition(null);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("resize", handleClose);
    window.addEventListener("scroll", handleClose, true);
    document.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("resize", handleClose);
      window.removeEventListener("scroll", handleClose, true);
      document.removeEventListener("keydown", handleKey);
    };
  }, [openMenuMessageId]);

  useEffect(() => {
    if (!isGifPickerOpen) return;
    const loadFeatured = async () => {
      setIsGifLoading(true);
      try {
        const response = await api.getFeaturedGifs();
        setGifResults(response.data);
      } catch (err) {
        console.error("Failed to load GIFs", err);
      } finally {
        setIsGifLoading(false);
      }
    };
    loadFeatured();
  }, [isGifPickerOpen]);

  useEffect(() => {
    if (!isEmojiPickerOpen) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (emojiPickerRef.current?.contains(target)) return;
      if (emojiButtonRef.current?.contains(target)) return;
      setIsEmojiPickerOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isEmojiPickerOpen]);

  const handleTyping = () => {
    if (isDmMode || !currentChannel) return;
    startTyping(currentChannel.id);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (!isDmMode && currentChannel) {
        stopTyping(currentChannel.id);
      }
    }, 2000);
  };

  const handleSend = async () => {
    if (!content.trim() || isSending) return;

    setIsSending(true);
    try {
      await sendMessage(content, undefined, replyTarget?.id);
      setContent("");
      setReplyTarget(null);
      if (!isDmMode && currentChannel) {
        stopTyping(currentChannel.id);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendGif = async (gifUrl: string) => {
    if (isSending) return;
    setIsSending(true);
    try {
      await sendMessage(undefined, gifUrl, replyTarget?.id);
      setIsGifPickerOpen(false);
      setGifQuery("");
      setReplyTarget(null);
    } catch (err) {
      console.error("Failed to send GIF:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleEmojiSelect = (emoji: { native?: string }) => {
    const nativeEmoji = emoji.native;
    if (!nativeEmoji) return;
    const input = inputRef.current;
    const start = input?.selectionStart ?? content.length;
    const end = input?.selectionEnd ?? content.length;
    const nextContent = `${content.slice(0, start)}${nativeEmoji}${content.slice(
      end,
    )}`;
    setContent(nextContent);
    handleTyping();
    requestAnimationFrame(() => {
      input?.focus();
      const nextPosition = start + nativeEmoji.length;
      input?.setSelectionRange(nextPosition, nextPosition);
    });
  };

  const handleGifSearch = async () => {
    const query = gifQuery.trim();
    setIsGifLoading(true);
    try {
      if (!query) {
        const response = await api.getFeaturedGifs();
        setGifResults(response.data);
      } else {
        const response = await api.searchGifs(query);
        setGifResults(response.data);
      }
    } catch (err) {
      console.error("Failed to search GIFs", err);
    } finally {
      setIsGifLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const loadMoreWithScrollLock = async () => {
    if (loadingMoreRef.current) return;
    const container = messagesContainerRef.current;
    if (!container) return;
    const prevScrollHeight = container.scrollHeight;
    const prevScrollTop = container.scrollTop;
    loadingMoreRef.current = true;
    suppressAutoScrollRef.current = true;
    try {
      await loadMoreMessages();
      await new Promise((resolve) =>
        requestAnimationFrame(() => resolve(null)),
      );
      const nextScrollHeight = container.scrollHeight;
      container.scrollTop = nextScrollHeight - prevScrollHeight + prevScrollTop;
    } finally {
      loadingMoreRef.current = false;
      requestAnimationFrame(() => {
        suppressAutoScrollRef.current = false;
      });
    }
  };

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (container && container.scrollTop === 0 && canLoadMore && !isLoading) {
      void loadMoreWithScrollLock();
    }
  };

  if (!isDmMode && !currentChannel) {
    return (
      <div className="flex-1 flex items-center justify-center bg-discord-lighter text-gray-400">
        <p>Select a channel to start chatting</p>
      </div>
    );
  }

  if (isDmMode && !currentDmConversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-discord-lighter text-gray-400">
        <p>Select a direct message to start chatting</p>
      </div>
    );
  }

  const otherTypingUsers = typingUsers.filter((u) => u.userId !== user?.id);

  const myRole = members.find((m) => m.user.id === user?.id)?.role;
  const canDeleteMessage = (authorId: string) => {
    if (!user?.id) return false;
    if (authorId === user.id) return true;
    if (isDmMode) return false;
    return myRole === "OWNER" || myRole === "ADMIN";
  };

  const canEditMessage = (authorId: string) => {
    if (!user?.id) return false;
    if (isDmMode) return false;
    return authorId === user.id;
  };
  const handleCopy = async (text: string | null) => {
    if (!text) {
      showToast("Message not available", "error");
      setOpenMenuMessageId(null);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast("Message copied to clipboard", "success");
      setOpenMenuMessageId(null);
    } catch {
      showToast("Failed to copy message", "error");
    }
  };

  const handleDelete = async (messageId: string) => {
    suppressAutoScrollRef.current = true;
    setDeletingMessageId(messageId);
    try {
      await deleteMessage(messageId);
      showToast("Message deleted", "success");
      setOpenMenuMessageId(null);
    } catch {
      showToast("Failed to delete message", "error");
    } finally {
      setDeletingMessageId(null);
      requestAnimationFrame(() => {
        suppressAutoScrollRef.current = false;
      });
    }
  };

  const handleBlockConfirm = async () => {
    if (!blockTarget) return;
    setIsBlocking(true);
    try {
      await blockUser(blockTarget.id);
      showToast(`${blockTarget.username} blocked`, "success");
      setBlockTarget(null);
    } catch {
      showToast("Failed to block user", "error");
    } finally {
      setIsBlocking(false);
    }
  };

  const handleReportConfirm = async () => {
    if (!reportTarget) return;
    setIsReporting(true);
    try {
      await reportUser(reportTarget.id, {
        reason: reportReason.trim() || undefined,
      });
      showToast("Report sent to the server owner", "success");
      setReportTarget(null);
      setReportReason("");
    } catch {
      showToast("Failed to report user", "error");
    } finally {
      setIsReporting(false);
    }
  };

  const handleUnblock = async (userId: string, username: string) => {
    setUnblockingUserId(userId);
    try {
      await unblockUser(userId);
      showToast(`${username} unblocked`, "success");
    } catch {
      showToast("Failed to unblock user", "error");
    } finally {
      setUnblockingUserId(null);
    }
  };

  const handleEditStart = (messageId: string, content: string | null) => {
    setEditingMessageId(messageId);
    setEditingContent(content ?? "");
    setOpenMenuMessageId(null);
  };

  const handleEditCancel = () => {
    setEditingMessageId(null);
    setEditingContent("");
  };

  const handleEditSave = async (messageId: string) => {
    const nextContent = editingContent.trim();
    if (!nextContent || updatingMessageId) return;
    setUpdatingMessageId(messageId);
    try {
      await updateMessage(messageId, nextContent);
      showToast("Message updated", "success");
      handleEditCancel();
    } catch {
      showToast("Failed to update message", "error");
    } finally {
      setUpdatingMessageId(null);
    }
  };

  const openMessageMenu = (messageId: string, target: HTMLElement) => {
    if (openMenuMessageId === messageId) {
      setOpenMenuMessageId(null);
      setMenuPosition(null);
      return;
    }
    const rect = target.getBoundingClientRect();
    const menuWidth = 160;
    const menuHeight = 200;
    const spacing = 6;
    let left = rect.left + rect.width - menuWidth;
    if (left < 8) left = 8;
    if (left + menuWidth > window.innerWidth - 8) {
      left = window.innerWidth - menuWidth - 8;
    }
    let top = rect.bottom + spacing;
    if (top + menuHeight > window.innerHeight - 8) {
      top = rect.top - menuHeight - spacing;
    }
    if (top < 8) top = 8;
    setOpenMenuMessageId(messageId);
    setMenuPosition({ top, left });
  };

  const headerIcon = isDmMode ? (
    <AtSign size={20} className="text-gray-400 mr-2" />
  ) : (
    <Hash size={20} className="text-gray-400 mr-2" />
  );

  const headerTitle = isDmMode ? dmDisplayName : currentChannel?.name;

  const placeholder = isDmMode
    ? `Message @${dmDisplayName}`
    : `Message #${currentChannel?.name}`;

  const formatReplyPreview = (
    content?: string | null,
    gifUrl?: string | null,
    deletedAt?: string | null,
    masked?: boolean,
  ) => {
    if (masked) return "Utilisateur bloqué";
    if (deletedAt) return "Message deleted";
    if (content && content.trim()) return content.trim();
    if (gifUrl) return "GIF";
    return "Message";
  };

  const resolveReplySummary = (message: RenderedMessage) => {
    if (message.replyTo) return message.replyTo;
    if (!message.replyToMessageId) return null;
    const target = messageById.get(message.replyToMessageId);
    if (!target) return null;
    return {
      id: target.id,
      content: target.content,
      gifUrl: target.gifUrl ?? null,
      createdAt: target.createdAt,
      author: target.author,
      deletedAt: target.deletedAt ?? null,
    } satisfies ReplySummary;
  };

  const handleScrollToMessage = async (messageId: string) => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const findTarget = () =>
      container.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);

    let target = findTarget();
    let attempts = 0;
    const maxAttempts = 8;

    while (!target && canLoadMoreRef.current && attempts < maxAttempts) {
      await loadMoreWithScrollLock();
      await new Promise((resolve) =>
        requestAnimationFrame(() => resolve(null)),
      );
      target = findTarget();
      attempts += 1;
    }

    if (!target) {
      showToast("Original message not loaded", "error");
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMessageId(messageId);
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedMessageId((current) =>
        current === messageId ? null : current,
      );
    }, 1800);
  };

  return (
    <div className="flex-1 flex flex-col bg-discord-lighter">
      <div className="h-12 px-4 flex items-center border-b border-discord-dark shadow-sm">
        {headerIcon}
        <h3 className="font-semibold text-white">{headerTitle}</h3>
      </div>

      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        onClick={() => setOpenMenuMessageId(null)}
      >
        {isLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 text-discord-accent animate-spin" />
          </div>
        )}

        {canLoadMore && !isLoading && (
          <button
            onClick={loadMoreMessages}
            className="w-full text-center text-sm text-discord-accent hover:underline py-2"
          >
            Load more messages
          </button>
        )}

        {!isLoading && renderedMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <MessageSquare size={48} className="mb-4 opacity-50" />
            <p className="text-lg font-medium">No messages yet</p>
            <p className="text-sm">Be the first to send a message!</p>
          </div>
        )}

        {renderedMessages.map((message, index) => {
          const showAuthor =
            index === 0 ||
            renderedMessages[index - 1].author.id !== message.author.id;
          const canDelete = canDeleteMessage(message.author.id);
          const isOwnMessage = message.author.id === user?.id;
          const hasText = Boolean(message.content?.trim());
          const firstUrl = hasText ? getFirstUrl(message.content) : null;
          const youtubeId = firstUrl ? getYouTubeId(firstUrl) : null;
          const isMasked = message.masked === true;
          const replySummary = message.replyTo ?? null;
          const replyTargetId = replySummary?.id ?? message.replyToMessageId ?? null;
          const showReplyPreview = Boolean(replySummary || replyTargetId);

          return (
            <div
              key={message.id}
              data-message-id={message.id}
              className={`${showAuthor ? "mt-4" : "mt-0.5"} group flex ${isOwnMessage ? "justify-end" : "justify-start"} rounded-lg transition-colors duration-300 ${highlightedMessageId === message.id ? "bg-discord-accent/15" : ""}`}
            >
              <div
                className={`max-w-[min(80%,48rem)] p-3 ${isOwnMessage ? "items-end" : "items-start"} flex flex-col`}
              >
                {showAuthor && (
                  <div
                    className={`flex items-center gap-2 mb-1 ${isOwnMessage ? "flex-row-reverse text-right" : ""}`}
                  >
                    <button
                      onClick={() => setProfileUserId(message.author.id)}
                      className="w-8 h-8 rounded-full bg-discord-accent flex items-center justify-center text-white text-sm font-semibold hover:opacity-90 overflow-hidden"
                      title={`View ${message.author.username}`}
                    >
                      {message.author.avatarUrl ||
                      avatarByUserId.get(message.author.id) ? (
                        <img
                          src={
                            (message.author.avatarUrl ||
                              avatarByUserId.get(message.author.id)) as string
                          }
                          alt={message.author.username}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        message.author.username.charAt(0).toUpperCase()
                      )}
                    </button>
                    <button
                      onClick={() => setProfileUserId(message.author.id)}
                      className="font-medium text-white hover:underline"
                    >
                      {message.author.username}
                    </button>
                    <span className="text-xs text-gray-500">
                      {formatTime(message.createdAt)}
                    </span>
                    {message.updatedAt &&
                      message.updatedAt !== message.createdAt && (
                        <span className="text-[11px] text-gray-500">
                          (edited)
                        </span>
                      )}
                  </div>
                )}
                <div
                  className={`relative ${showAuthor ? (isOwnMessage ? "mr-10" : "ml-10") : isOwnMessage ? "mr-10" : "ml-10"}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className={`absolute -top-2 ${isOwnMessage ? "left-0" : "right-0"} opacity-0 group-hover:opacity-100 transition-opacity`}
                  >
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setReplyTarget({
                            id: message.id,
                            author: {
                              id: message.author.id,
                              username: message.author.username,
                            },
                            content: message.content,
                            gifUrl: message.gifUrl ?? null,
                          });
                          setOpenMenuMessageId(null);
                        }}
                        className="p-1 rounded bg-discord-dark hover:bg-discord-light text-gray-300"
                        title="Reply"
                      >
                        <MessageSquare size={16} />
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(message.id)}
                          disabled={deletingMessageId === message.id}
                          className="p-1 rounded bg-discord-dark hover:bg-discord-light text-discord-red disabled:opacity-50"
                          title="Delete"
                        >
                          {deletingMessageId === message.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      )}
                      <button
                        onClick={(event) =>
                          openMessageMenu(message.id, event.currentTarget)
                        }
                        className="p-1 rounded bg-discord-dark hover:bg-discord-light text-gray-300"
                        title="Actions"
                      >
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </div>

                  <div
                    className={`${isOwnMessage ? "pl-8 text-right" : "pr-8"}`}
                  >
                    {showReplyPreview && (
                      <div
                        onClick={() =>
                          replyTargetId
                            ? handleScrollToMessage(replyTargetId)
                            : undefined
                        }
                        className={`mb-1 rounded border-l-2 border-discord-accent bg-discord-dark/60 px-3 py-1 text-xs text-gray-300 cursor-pointer hover:bg-discord-dark/80 ${isOwnMessage ? "text-right" : "text-left"}`}
                        title="Go to original message"
                      >
                        <div className="text-[11px] text-gray-400">
                          Replying to{" "}
                          {replySummary?.author?.username || "Message"}
                        </div>
                        <div className="truncate">
                          {formatReplyPreview(
                            replySummary?.content,
                            replySummary?.gifUrl ?? null,
                            replySummary?.deletedAt ?? null,
                            replySummary?.masked ?? false,
                          )}
                        </div>
                        {replySummary?.gifUrl && !replySummary?.deletedAt && (
                          <img
                            src={replySummary.gifUrl}
                            alt="GIF preview"
                            className={`mt-1 h-10 w-16 rounded object-cover ${isOwnMessage ? "ml-auto" : ""}`}
                            loading="lazy"
                          />
                        )}
                      </div>
                    )}
                    {isMasked ? (
                      <div className="rounded border border-discord-dark bg-discord-dark/60 px-3 py-2 text-sm text-gray-300">
                        Utilisateur bloqué —{" "}
                        <button
                          onClick={() =>
                            handleUnblock(
                              message.author.id,
                              message.author.username,
                            )
                          }
                          disabled={unblockingUserId === message.author.id}
                          className="text-discord-accent hover:underline disabled:opacity-50"
                        >
                          {unblockingUserId === message.author.id
                            ? "Déblocage..."
                            : "Débloquer"}
                        </button>{" "}
                        pour voir le message
                      </div>
                    ) : (
                      <>
                        {message.gifUrl && (
                          <img
                            src={message.gifUrl}
                            alt="GIF"
                            className="max-w-[320px] rounded-lg mb-2"
                            loading="lazy"
                          />
                        )}
                        {editingMessageId === message.id ? (
                          <div
                            className={`flex flex-col gap-2 ${isOwnMessage ? "items-end" : "items-start"}`}
                          >
                            <textarea
                              value={editingContent}
                              onChange={(e) =>
                                setEditingContent(e.target.value)
                              }
                              rows={3}
                              className="w-full min-w-[220px] bg-discord-dark text-white rounded px-3 py-2 focus:outline-none"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEditCancel()}
                                className="px-2 py-1 rounded bg-discord-dark text-gray-200 hover:bg-discord-light text-xs"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleEditSave(message.id)}
                                disabled={
                                  !editingContent.trim() ||
                                  updatingMessageId === message.id
                                }
                                className="px-2 py-1 rounded bg-discord-accent text-white hover:opacity-90 text-xs disabled:opacity-50"
                              >
                                {updatingMessageId === message.id
                                  ? "Saving..."
                                  : "Save"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          hasText && (
                            <div className="text-gray-200 break-words">
                              {renderMessageContent(message.content)}
                            </div>
                          )
                        )}
                        {youtubeId && (
                          <a
                            href={`https://www.youtube.com/watch?v=${youtubeId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 block"
                          >
                            <img
                              src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`}
                              alt="YouTube preview"
                              className="max-w-[320px] rounded-lg border border-discord-dark"
                              loading="lazy"
                            />
                          </a>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {profileUserId && (
        <ProfileCard
          userId={profileUserId}
          onClose={() => setProfileUserId(null)}
        />
      )}

      {blockTarget &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
            onClick={() => setBlockTarget(null)}
          >
            <div
              className="w-full max-w-sm rounded-lg border border-discord-dark bg-discord-lighter shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-discord-dark px-4 py-3">
                <h3 className="text-white font-semibold">Block user</h3>
              </div>
              <div className="px-4 py-4 text-sm text-gray-300 space-y-2">
                <p>
                  You are about to block{" "}
                  <span className="font-semibold text-white">
                    {blockTarget.username}
                  </span>
                  .
                </p>
                <p>You will no longer see their messages in this server.</p>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-discord-dark px-4 py-3">
                <button
                  onClick={() => setBlockTarget(null)}
                  className="px-3 py-1.5 rounded bg-discord-dark text-gray-200 hover:bg-discord-light text-sm"
                  disabled={isBlocking}
                >
                  Cancel
                </button>
                <button
                  onClick={handleBlockConfirm}
                  className="px-3 py-1.5 rounded bg-discord-red text-white text-sm disabled:opacity-50"
                  disabled={isBlocking}
                >
                  {isBlocking ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    "Block"
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {reportTarget &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
            onClick={() => {
              setReportTarget(null);
              setReportReason("");
            }}
          >
            <div
              className="w-full max-w-sm rounded-lg border border-discord-dark bg-discord-lighter shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-discord-dark px-4 py-3">
                <h3 className="text-white font-semibold">Report user</h3>
              </div>
              <div className="px-4 py-4 text-sm text-gray-300 space-y-2">
                <p>
                  You are about to report{" "}
                  <span className="font-semibold text-white">
                    {reportTarget.username}
                  </span>{" "}
                  to the server owner.
                </p>
                <label className="block text-xs uppercase tracking-wide text-gray-400 mt-3">
                  Reason (optional)
                </label>
                <textarea
                  value={reportReason}
                  onChange={(event) => setReportReason(event.target.value)}
                  rows={3}
                  className="w-full rounded bg-discord-dark text-white text-sm p-2 border border-discord-light focus:outline-none focus:border-discord-accent"
                  placeholder="Explain why you are reporting this user..."
                  maxLength={500}
                />
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-discord-dark px-4 py-3">
                <button
                  onClick={() => {
                    setReportTarget(null);
                    setReportReason("");
                  }}
                  className="px-3 py-1.5 rounded bg-discord-dark text-gray-200 hover:bg-discord-light text-sm"
                  disabled={isReporting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleReportConfirm}
                  className="px-3 py-1.5 rounded bg-discord-red text-white text-sm disabled:opacity-50"
                  disabled={isReporting}
                >
                  {isReporting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    "Report"
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {openMenuMessageId &&
        menuPosition &&
        createPortal(
          <div
            className="fixed z-50"
            style={{ top: menuPosition.top, left: menuPosition.left }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="w-40 rounded bg-discord-dark border border-discord-light shadow-lg overflow-hidden">
              <button
                onClick={() =>
                  handleCopy(
                    renderedMessages.find((m) => m.id === openMenuMessageId)
                      ?.content ?? null,
                  )
                }
                className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-discord-light flex items-center gap-2"
              >
                <Copy size={16} />
                Copy
              </button>
              <button
                onClick={() => {
                  const msg = renderedMessages.find(
                    (m) => m.id === openMenuMessageId,
                  );
                  if (!msg) return;
                  setReplyTarget({
                    id: msg.id,
                    author: {
                      id: msg.author.id,
                      username: msg.author.username,
                    },
                    content: msg.content,
                    gifUrl: msg.gifUrl ?? null,
                  });
                  setOpenMenuMessageId(null);
                }}
                className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-discord-light flex items-center gap-2"
              >
                <MessageSquare size={16} />
                Reply
              </button>
              {(() => {
                const msg = renderedMessages.find(
                  (m) => m.id === openMenuMessageId,
                );
                if (!msg) return null;
                const canDelete = canDeleteMessage(msg.author.id);
                const canEdit = canEditMessage(msg.author.id);
                const isSelf = msg.author.id === user?.id;
                const isBlocked = blockedUserIds.has(msg.author.id);
                return (
                  <>
                    {canEdit && (
                      <button
                        onClick={() => handleEditStart(msg.id, msg.content)}
                        className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-discord-light flex items-center gap-2"
                      >
                        <Pencil size={16} />
                        Edit
                      </button>
                    )}
                    {!isSelf && !isBlocked && (
                      <button
                        onClick={() => {
                          setBlockTarget({
                            id: msg.author.id,
                            username: msg.author.username,
                          });
                          setOpenMenuMessageId(null);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-discord-light flex items-center gap-2"
                      >
                        <X size={16} />
                        Block user
                      </button>
                    )}
                    {!isSelf && (
                      <button
                        onClick={() => {
                          setReportTarget({
                            id: msg.author.id,
                            username: msg.author.username,
                          });
                          setOpenMenuMessageId(null);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-discord-light flex items-center gap-2"
                      >
                        <MessageSquare size={16} />
                        Report user
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(msg.id)}
                        disabled={deletingMessageId === msg.id}
                        className="w-full px-3 py-2 text-left text-sm text-discord-red hover:bg-discord-light flex items-center gap-2 disabled:opacity-50"
                      >
                        {deletingMessageId === msg.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                        {deletingMessageId === msg.id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          </div>,
          document.body,
        )}

      {!isDmMode && otherTypingUsers.length > 0 && (
        <div className="px-4 py-1 text-sm text-gray-400">
          <span className="animate-pulse">
            {otherTypingUsers.map((u) => u.username).join(", ")}{" "}
            {otherTypingUsers.length === 1 ? "is" : "are"} typing...
          </span>
        </div>
      )}

      <div className="p-4 relative">
        {replyTarget && (
          <div className="mb-2 flex items-center justify-between rounded-lg border border-discord-dark bg-discord-light px-3 py-2 text-sm text-gray-300">
            <div className="flex min-w-0 flex-col">
              <span className="text-[11px] text-gray-400">
                Replying to {replyTarget.author.username}
              </span>
              <span className="truncate text-gray-200">
                {formatReplyPreview(
                  replyTarget.content,
                  replyTarget.gifUrl ?? null,
                  null,
                )}
              </span>
            </div>
            <button
              onClick={() => setReplyTarget(null)}
              className="ml-3 text-gray-400 hover:text-white transition-colors"
              title="Cancel reply"
            >
              <X size={16} />
            </button>
          </div>
        )}
        {isEmojiPickerOpen && (
          <div
            ref={emojiPickerRef}
            className="fixed bottom-20 z-50 bg-transparent"
          >
            <Picker
              data={data}
              set="native"
              theme="dark"
              previewPosition="none"
              onEmojiSelect={handleEmojiSelect}
            />
          </div>
        )}
        {isGifPickerOpen && (
          <div className="mb-3 rounded-lg border border-discord-dark bg-discord-light p-3">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={gifQuery}
                onChange={(e) => setGifQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleGifSearch();
                  }
                }}
                placeholder="Search GIFs..."
                className="flex-1 bg-discord-dark text-white placeholder-gray-500 rounded px-3 py-2 focus:outline-none"
              />
              <button
                onClick={handleGifSearch}
                className="px-3 py-2 rounded bg-discord-accent text-white hover:opacity-90"
              >
                Search
              </button>
              <button
                onClick={() => setIsGifPickerOpen(false)}
                className="px-3 py-2 rounded bg-discord-dark text-gray-200 hover:bg-discord-light"
              >
                Close
              </button>
            </div>

            {isGifLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-6 h-6 text-discord-accent animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                {gifResults.map((gif) => (
                  <button
                    key={gif.id}
                    onClick={() => handleSendGif(gif.url)}
                    className="rounded overflow-hidden hover:ring-2 hover:ring-discord-accent"
                    title={gif.title}
                  >
                    <img
                      src={gif.previewUrl || gif.url}
                      alt={gif.title || "GIF"}
                      className="w-full h-24 object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
                {gifResults.length === 0 && (
                  <div className="col-span-3 text-center text-gray-400 py-6">
                    No GIFs found.
                  </div>
                )}
              </div>
            )}
            <div className="mt-2 text-[11px] text-gray-500 text-right">
              Powered by Klipy
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 px-4 py-2 bg-discord-light rounded-lg">
          <button
            ref={emojiButtonRef}
            onClick={() => {
              setIsEmojiPickerOpen((prev) => !prev);
              setIsGifPickerOpen(false);
            }}
            className="text-gray-400 hover:text-white transition-colors"
            title="Add emoji"
          >
            <Smile size={20} />
          </button>
          <button
            onClick={() => {
              setIsGifPickerOpen((prev) => !prev);
              setIsEmojiPickerOpen(false);
            }}
            className="text-gray-400 hover:text-white transition-colors"
            title="Send a GIF"
          >
            <ImageIcon size={20} />
          </button>
          <input
            type="text"
            ref={inputRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              handleTyping();
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-white placeholder-gray-500 focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!content.trim() || isSending}
            className="text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
          >
            {isSending ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
