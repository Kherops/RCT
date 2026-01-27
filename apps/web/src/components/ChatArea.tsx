'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Hash, Send, MoreVertical, Trash2, Copy, Loader2, MessageSquare, AtSign } from 'lucide-react';
import { useChatStore } from '@/store/chat';
import { useAuthStore } from '@/store/auth';
import { startTyping, stopTyping } from '@/lib/socket';
import { formatTime } from '@/lib/utils';
import { useToast } from '@/components/Toast';

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
    deleteMessage,
    loadMoreMessages,
    hasMoreMessages,
    dmHasMoreMessages,
    isLoading,
  } = useChatStore();
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [openMenuMessageId, setOpenMenuMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

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
      return {
        id: m.id,
        content: m.content,
        createdAt: m.createdAt,
        author: {
          id: m.authorId,
          username: m.author?.username || member?.user.username || 'Unknown',
        },
      };
    });
  }, [isDmMode, messages, dmMessages, members]);

  const canLoadMore = isDmMode ? dmHasMoreMessages : hasMoreMessages;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [renderedMessages]);

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
      await sendMessage(content);
      setContent('');
      if (!isDmMode && currentChannel) {
        stopTyping(currentChannel.id);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

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
  const canDeleteMessage = (authorId: string) => {
    if (!user?.id) return false;
    if (authorId === user.id) return true;
    if (isDmMode) return false;
    return myRole === 'OWNER' || myRole === 'ADMIN';
  };

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
    setDeletingMessageId(messageId);
    try {
      await deleteMessage(messageId);
      showToast('Message deleted', 'success');
      setOpenMenuMessageId(null);
    } catch {
      showToast('Failed to delete message', 'error');
    } finally {
      setDeletingMessageId(null);
    }
  };

  const headerIcon = isDmMode ? (
    <AtSign size={20} className="text-gray-400 mr-2" />
  ) : (
    <Hash size={20} className="text-gray-400 mr-2" />
  );

  const headerTitle = isDmMode ? dmDisplayName : currentChannel?.name;

  const placeholder = isDmMode ? `Message @${dmDisplayName}` : `Message #${currentChannel?.name}`;

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

          return (
            <div
              key={message.id}
              className={`${showAuthor ? 'mt-4' : 'mt-0.5'} group flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[min(80%,48rem)] ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col`}>
                {showAuthor && (
                  <div className={`flex items-center gap-2 mb-1 ${isOwnMessage ? 'flex-row-reverse text-right' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-discord-accent flex items-center justify-center text-white text-sm font-semibold">
                      {message.author.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-white hover:underline cursor-pointer">{message.author.username}</span>
                    <span className="text-xs text-gray-500">{formatTime(message.createdAt)}</span>
                  </div>
                )}
                <div
                  className={`relative ${showAuthor ? (isOwnMessage ? 'mr-10' : 'ml-10') : isOwnMessage ? 'mr-10' : 'ml-10'}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className={`absolute -top-2 ${isOwnMessage ? 'left-0' : 'right-0'} opacity-0 group-hover:opacity-100 transition-opacity`}
                  >
                    <button
                      onClick={() => setOpenMenuMessageId((prev) => (prev === message.id ? null : message.id))}
                      className="p-1 rounded bg-discord-dark hover:bg-discord-light text-gray-300"
                      title="Actions"
                    >
                      <MoreVertical size={16} />
                    </button>

                    {openMenuMessageId === message.id && (
                      <div className="mt-1 w-40 rounded bg-discord-dark border border-discord-light shadow-lg overflow-hidden">
                        <button
                          onClick={() => handleCopy(message.content)}
                          className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-discord-light flex items-center gap-2"
                        >
                          <Copy size={16} />
                          Copy
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(message.id)}
                            disabled={deletingMessageId === message.id}
                            className="w-full px-3 py-2 text-left text-sm text-discord-red hover:bg-discord-light flex items-center gap-2 disabled:opacity-50"
                          >
                            {deletingMessageId === message.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                            {deletingMessageId === message.id ? 'Deleting...' : 'Delete'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <p className={`text-gray-200 break-words ${isOwnMessage ? 'pl-8 text-right' : 'pr-8'}`}>
                    {message.content}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {!isDmMode && otherTypingUsers.length > 0 && (
        <div className="px-4 py-1 text-sm text-gray-400">
          <span className="animate-pulse">
            {otherTypingUsers.map((u) => u.username).join(', ')} {otherTypingUsers.length === 1 ? 'is' : 'are'} typing...
          </span>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center gap-2 px-4 py-2 bg-discord-light rounded-lg">
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