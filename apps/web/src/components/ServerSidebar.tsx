'use client';

import { useState } from 'react';
import { Plus, LogOut, Loader2 } from 'lucide-react';
import { useChatStore } from '@/store/chat';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/Toast';

export function ServerSidebar() {
  const { servers, currentServer, selectServer, createServer, joinServerByCode } = useChatStore();
  const { user, logout } = useAuthStore();
  const { showToast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'join'>('create');
  const [serverName, setServerName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateServer = async () => {
    if (!serverName.trim() || isLoading) return;
    setIsLoading(true);
    setError('');
    try {
      await createServer(serverName);
      showToast('Server created successfully!', 'success');
      setShowModal(false);
      setServerName('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create server';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinServer = async () => {
    if (!inviteCode.trim() || isLoading) return;
    setIsLoading(true);
    setError('');
    try {
      await joinServerByCode(inviteCode);
      showToast('Joined server successfully!', 'success');
      setShowModal(false);
      setInviteCode('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to join server';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="w-[72px] bg-discord-darker flex flex-col items-center py-3 gap-2">
        {servers.map((server) => (
          <button
            key={server.id}
            onClick={() => selectServer(server.id)}
            className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold transition-all hover:rounded-2xl',
              currentServer?.id === server.id
                ? 'bg-discord-accent rounded-2xl'
                : 'bg-discord-light hover:bg-discord-accent'
            )}
            title={server.name}
          >
            {server.name.charAt(0).toUpperCase()}
          </button>
        ))}

        <div className="w-8 h-[2px] bg-discord-light rounded-full my-1" />

        <button
          onClick={() => {
            setShowModal(true);
            setModalMode('create');
            setError('');
          }}
          className="w-12 h-12 rounded-full bg-discord-light hover:bg-discord-green hover:rounded-2xl flex items-center justify-center text-discord-green hover:text-white transition-all"
          title="Add a Server"
        >
          <Plus size={24} />
        </button>

        <div className="flex-1" />

        <div className="flex flex-col items-center gap-2">
          <div
            className="w-10 h-10 rounded-full bg-discord-accent flex items-center justify-center text-white text-sm font-semibold"
            title={user?.username}
          >
            {user?.username?.charAt(0).toUpperCase()}
          </div>
          <button
            onClick={logout}
            className="w-10 h-10 rounded-full bg-discord-light hover:bg-discord-red flex items-center justify-center text-gray-400 hover:text-white transition-all"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-discord-lighter rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">
              {modalMode === 'create' ? 'Create a Server' : 'Join a Server'}
            </h2>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setModalMode('create')}
                className={cn(
                  'flex-1 py-2 rounded',
                  modalMode === 'create'
                    ? 'bg-discord-accent text-white'
                    : 'bg-discord-dark text-gray-400'
                )}
              >
                Create
              </button>
              <button
                onClick={() => setModalMode('join')}
                className={cn(
                  'flex-1 py-2 rounded',
                  modalMode === 'join'
                    ? 'bg-discord-accent text-white'
                    : 'bg-discord-dark text-gray-400'
                )}
              >
                Join
              </button>
            </div>

            {error && (
              <div className="bg-discord-red/20 border border-discord-red text-discord-red px-3 py-2 rounded mb-4 text-sm">
                {error}
              </div>
            )}

            {modalMode === 'create' ? (
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-2">
                  Server Name
                </label>
                <input
                  type="text"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="My Awesome Server"
                  className="w-full px-3 py-2 bg-discord-dark text-white rounded border border-gray-700 focus:border-discord-accent focus:outline-none"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase mb-2">
                  Invite Code
                </label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Enter invite code"
                  className="w-full px-3 py-2 bg-discord-dark text-white rounded border border-gray-700 focus:border-discord-accent focus:outline-none"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={modalMode === 'create' ? handleCreateServer : handleJoinServer}
                disabled={isLoading || (modalMode === 'create' ? !serverName.trim() : !inviteCode.trim())}
                className="px-4 py-2 bg-discord-accent hover:bg-discord-accent/80 text-white rounded disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading && <Loader2 size={16} className="animate-spin" />}
                {isLoading ? 'Loading...' : (modalMode === 'create' ? 'Create' : 'Join')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
