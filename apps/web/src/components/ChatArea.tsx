'use client';

import { useState, useRef, useEffect } from 'react';
import { Hash, Send } from 'lucide-react';
import { useChatStore } from '@/store/chat';
import { useAuthStore } from '@/store/auth';
import { startTyping, stopTyping } from '@/lib/socket';
import { formatTime } from '@/lib/utils';

export function ChatArea() {
  const { currentChannel, messages, typingUsers, sendMessage, loadMoreMessages, hasMoreMessages, isLoading } = useChatStore();
  const { user } = useAuthStore();
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleTyping = () => {
    if (!currentChannel) return;
    startTyping(currentChannel.id);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      if (currentChannel) {
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
      if (currentChannel) {
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
    if (container && container.scrollTop === 0 && hasMoreMessages && !isLoading) {
      loadMoreMessages();
    }
  };

  if (!currentChannel) {
    return (
      <div className="flex-1 flex items-center justify-center bg-discord-lighter text-gray-400">
        <p>Select a channel to start chatting</p>
      </div>
    );
  }

  const otherTypingUsers = typingUsers.filter(u => u.userId !== user?.id);

  return (
    <div className="flex-1 flex flex-col bg-discord-lighter">
      <div className="h-12 px-4 flex items-center border-b border-discord-dark shadow-sm">
        <Hash size={20} className="text-gray-400 mr-2" />
        <h3 className="font-semibold text-white">{currentChannel.name}</h3>
      </div>

      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {hasMoreMessages && (
          <button
            onClick={loadMoreMessages}
            className="w-full text-center text-sm text-discord-accent hover:underline"
          >
            Load more messages
          </button>
        )}

        {messages.map((message, index) => {
          const showAuthor = index === 0 || messages[index - 1].author.id !== message.author.id;
          
          return (
            <div key={message.id} className={showAuthor ? 'mt-4' : 'mt-0.5'}>
              {showAuthor && (
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-full bg-discord-accent flex items-center justify-center text-white text-sm font-semibold">
                    {message.author.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-white hover:underline cursor-pointer">
                    {message.author.username}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTime(message.createdAt)}
                  </span>
                </div>
              )}
              <div className={showAuthor ? 'ml-10' : 'ml-10'}>
                <p className="text-gray-200 break-words">{message.content}</p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {otherTypingUsers.length > 0 && (
        <div className="px-4 py-1 text-sm text-gray-400">
          <span className="animate-pulse">
            {otherTypingUsers.map(u => u.username).join(', ')}{' '}
            {otherTypingUsers.length === 1 ? 'is' : 'are'} typing...
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
            placeholder={`Message #${currentChannel.name}`}
            className="flex-1 bg-transparent text-white placeholder-gray-500 focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!content.trim() || isSending}
            className="text-gray-400 hover:text-white disabled:opacity-50"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
