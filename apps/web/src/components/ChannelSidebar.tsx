'use client';

import { useState } from 'react';
import { Hash, Plus, Settings, Copy, Check } from 'lucide-react';
import { useChatStore } from '@/store/chat';
import { cn } from '@/lib/utils';

export function ChannelSidebar() {
  const { currentServer, channels, currentChannel, selectChannel, createChannel } = useChatStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCreateChannel = async () => {
    if (!channelName.trim()) return;
    try {
      await createChannel(channelName.toLowerCase().replace(/\s+/g, '-'));
      setShowCreateModal(false);
      setChannelName('');
    } catch (err) {
      console.error('Failed to create channel:', err);
    }
  };

  const copyInviteCode = () => {
    if (currentServer?.inviteCode) {
      navigator.clipboard.writeText(currentServer.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!currentServer) return null;

  return (
    <>
      <div className="w-60 bg-discord-light flex flex-col">
        <div className="h-12 px-4 flex items-center justify-between border-b border-discord-darker shadow-sm">
          <h2 className="font-semibold text-white truncate">{currentServer.name}</h2>
          <button
            onClick={copyInviteCode}
            className="text-gray-400 hover:text-white"
            title="Copy invite code"
          >
            {copied ? <Check size={18} className="text-discord-green" /> : <Copy size={18} />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-semibold text-gray-400 uppercase">Text Channels</span>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-gray-400 hover:text-white"
              title="Create Channel"
            >
              <Plus size={16} />
            </button>
          </div>

          {channels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => selectChannel(channel.id)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded text-left',
                currentChannel?.id === channel.id
                  ? 'bg-discord-lighter text-white'
                  : 'text-gray-400 hover:bg-discord-lighter/50 hover:text-gray-200'
              )}
            >
              <Hash size={18} />
              <span className="truncate">{channel.name}</span>
            </button>
          ))}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-discord-lighter rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Create Channel</h2>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-2">
                Channel Name
              </label>
              <div className="flex items-center gap-2 px-3 py-2 bg-discord-dark rounded border border-gray-700 focus-within:border-discord-accent">
                <Hash size={18} className="text-gray-400" />
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="new-channel"
                  className="flex-1 bg-transparent text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateChannel}
                className="px-4 py-2 bg-discord-accent hover:bg-discord-accent/80 text-white rounded"
              >
                Create Channel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
