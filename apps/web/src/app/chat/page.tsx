'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useChatStore } from '@/store/chat';
import { ServerSidebar } from '@/components/ServerSidebar';
import { ChannelSidebar } from '@/components/ChannelSidebar';
import { ChatArea } from '@/components/ChatArea';
import { MemberSidebar } from '@/components/MemberSidebar';

export default function ChatPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const { fetchServers, setupSocketListeners, currentServer } = useChatStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchServers();
      setupSocketListeners();
    }
  }, [isAuthenticated, fetchServers, setupSocketListeners]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-discord-dark">
        <div className="animate-pulse text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="h-screen flex bg-discord-dark overflow-hidden">
      <ServerSidebar />
      {currentServer ? (
        <>
          <ChannelSidebar />
          <ChatArea />
          <MemberSidebar />
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Welcome to RTC</h2>
            <p>Select a server or create a new one to get started</p>
          </div>
        </div>
      )}
    </div>
  );
}
