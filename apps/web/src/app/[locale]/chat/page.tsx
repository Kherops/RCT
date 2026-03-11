'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from '@/i18n/routing';
import { ServerSidebar } from '@/components/ServerSidebar';
import { ChannelSidebar } from '@/components/ChannelSidebar';
import { MemberSidebar } from '@/components/MemberSidebar';
import { ChatArea } from '@/components/ChatArea';
import { useAuthStore } from '@/store/auth';
import { useChatStore } from '@/store/chat';
import { useTranslations } from 'next-intl';

export default function ChatPage() {
  const t = useTranslations('Chat');
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    servers,
    currentServer,
    currentChannel,
    currentDmConversation,
    fetchServers,
    setupSocketListeners,
    restoreSelection,
    forceJoinCurrent,
  } = useChatStore();
  const initialized = useRef(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (initialized.current) return;
    initialized.current = true;

    setupSocketListeners();

    const hasChatState =
      servers.length > 0 || !!currentServer || !!currentChannel || !!currentDmConversation;
    if (hasChatState) {
      void forceJoinCurrent();
      return;
    }

    const init = async () => {
      await fetchServers();
      await restoreSelection();
    };

    void init();
  }, [
    user,
    router,
    servers.length,
    currentServer,
    currentChannel,
    currentDmConversation,
    fetchServers,
    setupSocketListeners,
    restoreSelection,
    forceJoinCurrent,
  ]);

  useEffect(() => {
    if (!user) return;
    if (!currentServer && !currentDmConversation) return;
    void forceJoinCurrent();
  }, [user, currentServer?.id, currentDmConversation?.id, forceJoinCurrent]);

  if (!user) {
    return (
      <div className="min-h-screen bg-discord-dark flex items-center justify-center">
        <div className="text-discord-blue animate-pulse">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-discord-dark font-sans">
      <ServerSidebar />
      {currentServer && <ChannelSidebar />}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {!currentChannel && !currentDmConversation ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-[#2b2d31]">
            <h3 className="text-2xl font-bold text-white mb-2">
              {t('welcome')}
            </h3>
            <p className="text-discord-text-muted max-w-sm">
              {t('selectServer')}
            </p>
          </div>
        ) : (
          <ChatArea />
        )}
      </main>
      {currentServer && <MemberSidebar />}
    </div>
  );
}
