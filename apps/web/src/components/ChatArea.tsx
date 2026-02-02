'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
<<<<<<< HEAD
import { Hash, Send, MoreVertical, Trash2, Copy, Loader2, MessageSquare, AtSign, Image as ImageIcon, Pencil } from 'lucide-react';
=======
import { Hash, Send, MoreVertical, Trash2, Copy, Loader2, MessageSquare, AtSign, Image as ImageIcon, X } from 'lucide-react';
>>>>>>> 258cf66d25abee1359d2039a7c692cde55c1a802
import { useChatStore } from '@/store/chat';
import { useAuthStore } from '@/store/auth';
import { startTyping, stopTyping } from '@/lib/socket';
import { formatTime } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import { api, type GifResult } from '@/lib/api';
import { ProfileCard } from '@/components/ProfileCard';
<<<<<<< HEAD

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
=======

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
>>>>>>> 258cf66d25abee1359d2039a7c692cde55c1a802
    deleteMessage,
    loadMoreMessages,
    hasMoreMessages,
    dmHasMoreMessages,
<<<<<<< HEAD
    isLoading,
  } = useChatStore();
  const { user } = useAuthStore();
  const { showToast } = useToast();
=======
    isLoading,
  } = useChatStore();
  const { user } = useAuthStore();
  const { showToast } = useToast();
>>>>>>> 258cf66d25abee1359d2039a7c692cde55c1a802
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [openMenuMessageId, setOpenMenuMessageId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [isGifPickerOpen, setIsGifPickerOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState<GifResult[]>([]);
  const [isGifLoading, setIsGifLoading] = useState(false);
<<<<<<< HEAD
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [updatingMessageId, setUpdatingMessageId] = useState<string | null>(null);
=======
  const [replyTarget, setReplyTarget] = useState<{
    id: string;
    author: { id: string; username: string };
    content: string;
    gifUrl?: string | null;
  } | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout>();
>>>>>>> 258cf66d25abee1359d2039a7c692cde55c1a802
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const suppressAutoScrollRef = useRef(false);
<<<<<<< HEAD

  const isDmMode = mode === 'dm';

  const dmDisplayName = useMemo(() => {
    if (!isDmMode || !currentDmConversation || !user) return 'Direct Message';

    const otherId = currentDmConversation.participantIds.find((id) => id !== user.id);
    if (!otherId) return 'Direct Message';

    const member = members.find((m) => m.user.id === otherId);
    if (member) return member.user.username;

    const participant = currentDmConversation.participants?.find((p) => p.id === otherId);
    return participant?.username || 'Direct Message';
  }, [isDmMode, currentDmConversation, members, user]);

  const renderedMessages = useMemo(() => {
    if (!isDmMode) return messages;

    return dmMessages.map((m) => {
      const member = members.find((mem) => mem.user.id === m.authorId);
=======

  const isDmMode = mode === 'dm';

  const dmDisplayName = useMemo(() => {
    if (!isDmMode || !currentDmConversation || !user) return 'Direct Message';

    const otherId = currentDmConversation.participantIds.find((id) => id !== user.id);
    if (!otherId) return 'Direct Message';

    const member = members.find((m) => m.user.id === otherId);
    if (member) return member.user.username;

    const participant = currentDmConversation.participants?.find((p) => p.id === otherId);
    return participant?.username || 'Direct Message';
  }, [isDmMode, currentDmConversation, members, user]);

  const renderedMessages = useMemo(() => {
    if (!isDmMode) return messages;

    return dmMessages.map((m) => {
      const member = members.find((mem) => mem.user.id === m.authorId);
>>>>>>> 258cf66d25abee1359d2039a7c692cde55c1a802
      return {
        id: m.id,
        content: m.content,
        gifUrl: m.gifUrl ?? null,
        replyToMessageId: m.replyToMessageId ?? null,
        replyTo: m.replyTo ?? null,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt || m.createdAt,
        author: {
          id: m.authorId,
          username: m.author?.username || member?.user.username || 'Unknown',
        },
      };
    });
  }, [isDmMode, messages, dmMessages, members]);

  const canLoadMore = isDmMode ? dmHasMoreMessages : hasMoreMessages;

  useEffect(() => {
    if (suppressAutoScrollRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [renderedMessages]);

  useEffect(() => {
    if (!openMenuMessageId) return;
    const handleClose = () => {
      setOpenMenuMessageId(null);
      setMenuPosition(null);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };
    window.addEventListener('resize', handleClose);
    window.addEventListener('scroll', handleClose, true);
    document.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('resize', handleClose);
      window.removeEventListener('scroll', handleClose, true);
      document.removeEventListener('keydown', handleKey);
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
        console.error('Failed to load GIFs', err);
      } finally {
        setIsGifLoading(false);
      }
    };
    loadFeatured();
  }, [isGifPickerOpen]);

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
      setContent('');
      setReplyTarget(null);
      if (!isDmMode && currentChannel) {
        stopTyping(currentChannel.id);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
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
      setGifQuery('');
      setReplyTarget(null);
    } catch (err) {
      console.error('Failed to send GIF:', err);
    } finally {
      setIsSending(false);
    }
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
      console.error('Failed to search GIFs', err);
    } finally {
      setIsGifLoading(false);
    }
  };
<<<<<<< HEAD

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (container && container.scrollTop === 0 && canLoadMore && !isLoading) {
      loadMoreMessages();
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
=======

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (container && container.scrollTop === 0 && canLoadMore && !isLoading) {
      loadMoreMessages();
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
>>>>>>> 258cf66d25abee1359d2039a7c692cde55c1a802
  const canDeleteMessage = (authorId: string) => {
    if (!user?.id) return false;
    if (authorId === user.id) return true;
    if (isDmMode) return false;
    return myRole === 'OWNER' || myRole === 'ADMIN';
  };

<<<<<<< HEAD
  const canEditMessage = (authorId: string) => {
    if (!user?.id) return false;
    if (isDmMode) return false;
    return authorId === user.id;
  };

=======
>>>>>>> 258cf66d25abee1359d2039a7c692cde55c1a802
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Message copied to clipboard', 'success');
      setOpenMenuMessageId(null);
    } catch {
      showToast('Failed to copy message', 'error');
    }
  };

  const handleDelete = async (messageId: string) => {
    suppressAutoScrollRef.current = true;
    setDeletingMessageId(messageId);
    try {
      await deleteMessage(messageId);
      showToast('Message deleted', 'success');
      setOpenMenuMessageId(null);
    } catch {
      showToast('Failed to delete message', 'error');
    } finally {
      setDeletingMessageId(null);
      requestAnimationFrame(() => {
        suppressAutoScrollRef.current = false;
      });
    }
  };

  const handleEditStart = (messageId: string, content: string) => {
    setEditingMessageId(messageId);
    setEditingContent(content);
    setOpenMenuMessageId(null);
  };

  const handleEditCancel = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const handleEditSave = async (messageId: string) => {
    const nextContent = editingContent.trim();
    if (!nextContent || updatingMessageId) return;
    setUpdatingMessageId(messageId);
    try {
      await updateMessage(messageId, nextContent);
      showToast('Message updated', 'success');
      handleEditCancel();
    } catch {
      showToast('Failed to update message', 'error');
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
    const menuHeight = 120;
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

  const placeholder = isDmMode ? `Message @${dmDisplayName}` : `Message #${currentChannel?.name}`;

  const formatReplyPreview = (content?: string, gifUrl?: string | null, deletedAt?: string | null) => {
    if (deletedAt) return 'Message deleted';
    if (content && content.trim()) return content.trim();
    if (gifUrl) return 'GIF';
    return 'Message';
  };

  const handleScrollToMessage = (messageId: string) => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);
    if (!target) {
      showToast('Original message not loaded', 'error');
      return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageId(messageId);
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedMessageId((current) => (current === messageId ? null : current));
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
          const showAuthor = index === 0 || renderedMessages[index - 1].author.id !== message.author.id;
          const canDelete = canDeleteMessage(message.author.id);
          const isOwnMessage = message.author.id === user?.id;
          const hasText = Boolean(message.content?.trim());

          return (
            <div
              key={message.id}
<<<<<<< HEAD
              className={`${showAuthor ? 'mt-4' : 'mt-0.5'} group flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
=======
              data-message-id={message.id}
              className={`${showAuthor ? 'mt-4' : 'mt-0.5'} group flex ${isOwnMessage ? 'justify-end' : 'justify-start'} rounded-lg transition-colors duration-300 ${highlightedMessageId === message.id ? 'bg-discord-accent/15' : ''}`}
>>>>>>> 258cf66d25abee1359d2039a7c692cde55c1a802
            >
              <div className={`max-w-[min(80%,48rem)] ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col`}>
                {showAuthor && (
                  <div className={`flex items-center gap-2 mb-1 ${isOwnMessage ? 'flex-row-reverse text-right' : ''}`}>
                    <button
                      onClick={() => setProfileUserId(message.author.id)}
                      className="w-8 h-8 rounded-full bg-discord-accent flex items-center justify-center text-white text-sm font-semibold hover:opacity-90"
                      title={`View ${message.author.username}`}
                    >
                      {message.author.username.charAt(0).toUpperCase()}
                    </button>
                    <button
                      onClick={() => setProfileUserId(message.author.id)}
                      className="font-medium text-white hover:underline"
                    >
                      {message.author.username}
                    </button>
                    <span className="text-xs text-gray-500">{formatTime(message.createdAt)}</span>
                    {message.updatedAt && message.updatedAt !== message.createdAt && (
                      <span className="text-[11px] text-gray-500">(edited)</span>
                    )}
                  </div>
                )}
                  <div
                    className={`relative ${showAuthor ? (isOwnMessage ? 'mr-10' : 'ml-10') : isOwnMessage ? 'mr-10' : 'ml-10'}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                  <div
                    className={`absolute -top-2 ${isOwnMessage ? 'left-0' : 'right-0'} opacity-0 group-hover:opacity-100 transition-opacity`}
                  >
                    <div className="flex items-center gap-1">
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
                        onClick={(event) => openMessageMenu(message.id, event.currentTarget)}
                        className="p-1 rounded bg-discord-dark hover:bg-discord-light text-gray-300"
                        title="Actions"
                      >
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </div>

                  <div className={`${isOwnMessage ? 'pl-8 text-right' : 'pr-8'}`}>
                    {message.replyTo && (
                      <div
                        onClick={() => handleScrollToMessage(message.replyTo!.id)}
                        className={`mb-1 rounded border-l-2 border-discord-accent bg-discord-dark/60 px-3 py-1 text-xs text-gray-300 cursor-pointer hover:bg-discord-dark/80 ${isOwnMessage ? 'text-right' : 'text-left'}`}
                        title="Go to original message"
                      >
                        <div className="text-[11px] text-gray-400">
                          Replying to {message.replyTo.author?.username || 'Unknown'}
                        </div>
                        <div className="truncate">
                          {formatReplyPreview(message.replyTo.content, message.replyTo.gifUrl ?? null, message.replyTo.deletedAt ?? null)}
                        </div>
                      </div>
                    )}
                    {message.gifUrl && (
                      <img
                        src={message.gifUrl}
                        alt="GIF"
                        className="max-w-[320px] rounded-lg mb-2"
                        loading="lazy"
                      />
                    )}
                    {editingMessageId === message.id ? (
                      <div className={`flex flex-col gap-2 ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                        <textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
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
                            disabled={!editingContent.trim() || updatingMessageId === message.id}
                            className="px-2 py-1 rounded bg-discord-accent text-white hover:opacity-90 text-xs disabled:opacity-50"
                          >
                            {updatingMessageId === message.id ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      hasText && <p className="text-gray-200 break-words">{message.content}</p>
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
        <ProfileCard userId={profileUserId} onClose={() => setProfileUserId(null)} />
      )}

      {openMenuMessageId && menuPosition &&
        createPortal(
          <div
            className="fixed z-50"
            style={{ top: menuPosition.top, left: menuPosition.left }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="w-40 rounded bg-discord-dark border border-discord-light shadow-lg overflow-hidden">
              <button
                onClick={() => handleCopy(renderedMessages.find((m) => m.id === openMenuMessageId)?.content || '')}
                className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-discord-light flex items-center gap-2"
              >
                <Copy size={16} />
                Copy
              </button>
              {(() => {
                const msg = renderedMessages.find((m) => m.id === openMenuMessageId);
                if (!msg) return null;
                const canDelete = canDeleteMessage(msg.author.id);
                const canEdit = canEditMessage(msg.author.id);
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
                        {deletingMessageId === msg.id ? 'Deleting...' : 'Delete'}
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          </div>,
          document.body
        )}

      {!isDmMode && otherTypingUsers.length > 0 && (
        <div className="px-4 py-1 text-sm text-gray-400">
          <span className="animate-pulse">
            {otherTypingUsers.map((u) => u.username).join(', ')} {otherTypingUsers.length === 1 ? 'is' : 'are'} typing...
          </span>
        </div>
      )}

      <div className="p-4">
        {replyTarget && (
          <div className="mb-2 flex items-center justify-between rounded-lg border border-discord-dark bg-discord-light px-3 py-2 text-sm text-gray-300">
            <div className="flex min-w-0 flex-col">
              <span className="text-[11px] text-gray-400">Replying to {replyTarget.author.username}</span>
              <span className="truncate text-gray-200">
                {formatReplyPreview(replyTarget.content, replyTarget.gifUrl ?? null, null)}
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
        {isGifPickerOpen && (
          <div className="mb-3 rounded-lg border border-discord-dark bg-discord-light p-3">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={gifQuery}
                onChange={(e) => setGifQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
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
                      alt={gif.title || 'GIF'}
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
            onClick={() => setIsGifPickerOpen((prev) => !prev)}
            className="text-gray-400 hover:text-white transition-colors"
            title="Send a GIF"
          >
            <ImageIcon size={20} />
          </button>
          <input
            type="text"
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
            {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}
