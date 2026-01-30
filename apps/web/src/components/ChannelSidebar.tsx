'use client';

import { useState } from 'react';
import { Hash, Plus, Copy, Check, Loader2, MessageSquare, Trash, X, LogOut } from 'lucide-react';
import { useChatStore } from '@/store/chat';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import { ServerDangerZone } from '@/components/ServerDangerZone';
import { ApiHttpError } from '@/lib/api';

type ChannelItem = { id: string; name: string; serverId: string; visibility: 'PUBLIC' | 'PRIVATE'; creatorId: string };

function isProtectedChannel(channel: ChannelItem) {
  const slug = channel.name.trim().toLowerCase();
  return slug === 'general';
}

function canCreatePublicChannel(serverOwnerId?: string, userId?: string) {
  if (!userId || !serverOwnerId) return false;
  return serverOwnerId === userId;
}

function canCreatePrivateChannel(isServerMember: boolean) {
  return isServerMember;
}

function canDeleteChannel(channel: ChannelItem, serverOwnerId?: string, userId?: string) {
  if (!userId) return false;
  if (isProtectedChannel(channel)) return false;
  // delete already restricted by backend; UI: server owner only
  if (serverOwnerId) return serverOwnerId === userId;
  return false;
}

function canLeaveChannel(channel: ChannelItem, serverOwnerId?: string, userId?: string) {
  if (!userId) return false;
  if (isProtectedChannel(channel)) return false;
  if (channel.visibility !== 'PRIVATE') return false;
  if (channel.creatorId === userId) return false;
  return true;
}

export function ChannelSidebar() {
  const {
    currentServer,
    channels,
    currentChannel,
    selectChannel,
    createChannel,
    deleteChannel,
    leaveChannel,
    isLoading,
    members,
  } = useChatStore();
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [channelToDelete, setChannelToDelete] = useState<ChannelItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [channelToLeave, setChannelToLeave] = useState<ChannelItem | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  const isServerOwner = currentServer?.owner?.id === user?.id;
  const isServerMember = !!members.find((m) => m.user.id === user?.id);
  const allowCreatePublic = canCreatePublicChannel(currentServer?.owner?.id, user?.id);
  const allowCreatePrivate = canCreatePrivateChannel(isServerMember);

  const handleCreateChannel = async () => {
    if (!allowCreatePrivate) {
      showToast('Only server members can create channels', 'error');
      return;
    }
    if (!channelName.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const desiredVisibility =
        allowCreatePublic ? visibility : 'PRIVATE';
      await createChannel(channelName.toLowerCase().replace(/\s+/g, '-'), desiredVisibility);
      showToast('Channel created successfully', 'success');
      setShowCreateModal(false);
      setChannelName('');
      setVisibility(allowCreatePublic ? 'PUBLIC' : 'PRIVATE');
    } catch (err) {
      showToast('Failed to create channel', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!channelToDelete || isDeleting) return;
    if (isProtectedChannel(channelToDelete)) {
      showToast('The default channel cannot be deleted.', 'error');
      setChannelToDelete(null);
      return;
    }
    if (channels.length <= 1) {
      showToast('At least one channel must remain in the server', 'error');
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteChannel(channelToDelete.id);

      const { channels: updated, currentChannel: updatedCurrent, selectChannel: select } = useChatStore.getState();
      if (!updatedCurrent || !updated.find((c) => c.id === updatedCurrent.id)) {
        const fallback = updated[0];
        if (fallback) {
          await select(fallback.id);
        }
      }

      showToast('Channel deleted', 'success');
      setChannelToDelete(null);
    } catch (err) {
      let message = 'Failed to delete channel';
      if (err instanceof ApiHttpError) {
        if (err.status === 403) {
          message = 'Only the owner (or admin) can delete this channel';
        } else if (err.status === 404) {
          message = 'Channel not found';
          const fetchServers = useChatStore.getState().fetchServers;
          if (fetchServers) {
            try {
              await fetchServers();
            } catch {
              // ignore refetch errors
            }
          }
        } else {
          message = err.message;
        }
      }
      setDeleteError(message);
      showToast(message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const copyInviteCode = async () => {
    if (currentServer?.inviteCode) {
      try {
        await navigator.clipboard.writeText(currentServer.inviteCode);
        setCopied(true);
        showToast('Invite code copied!', 'success');
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        showToast('Failed to copy invite code', 'error');
      }
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

        <div className="flex-1 overflow-y-auto p-2 flex flex-col">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-semibold text-gray-400 uppercase">Text Channels</span>
            <button
              onClick={() => {
                if (!allowCreatePrivate) {
                  showToast('Only server members can create channels', 'error');
                  return;
                }
                setVisibility(allowCreatePublic ? 'PUBLIC' : 'PRIVATE');
                setShowCreateModal(true);
                setDeleteError(null);
              }}
              className="text-gray-400 hover:text-white"
              title="Create Channel"
            >
              <Plus size={16} />
            </button>
          </div>

          {channels.length === 0 && !isLoading && (
            <div className="flex flex-col items-center py-8 text-gray-500">
              <MessageSquare size={32} className="mb-2 opacity-50" />
              <p className="text-sm">No channels yet</p>
            </div>
          )}

          {channels.map((channel) => {
            const isActive = currentChannel?.id === channel.id;
            const deletable = canDeleteChannel(channel, currentServer?.owner?.id, user?.id);
            const leaveable = canLeaveChannel(channel, currentServer?.owner?.id, user?.id);
            return (
              <div
                key={channel.id}
                role="button"
                tabIndex={0}
                onClick={() => selectChannel(channel.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectChannel(channel.id);
                  }
                }}
                className={cn(
                  'group w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors cursor-pointer',
                  isActive
                    ? 'bg-discord-lighter text-white'
                    : 'text-gray-400 hover:bg-discord-lighter/50 hover:text-gray-200'
                )}
              >
                <Hash size={18} />
                <span className="truncate">{channel.name}</span>
                {deletable && (
                  <button
                    aria-label={`Delete channel ${channel.name}`}
                    className="ml-auto p-1 text-gray-500 hover:text-discord-red opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setChannelToDelete(channel);
                      setDeleteError(null);
                    }}
                  >
                    <Trash size={14} />
                  </button>
                )}
                {!deletable && leaveable && (
                  <button
                    aria-label={`Leave channel ${channel.name}`}
                    className="ml-auto p-1 text-gray-500 hover:text-discord-accent opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setChannelToLeave(channel);
                    }}
                  >
                    <LogOut size={14} />
                  </button>
                )}
              </div>
            );
          })}

          <div className="mt-auto pt-4">
            {!isServerOwner && currentServer && (
              <div className="border border-discord-dark rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white">Leave server</div>
                    <p className="text-xs text-gray-400">You will lose access to all channels.</p>
                  </div>
                  <button
                    className="px-3 py-1.5 text-sm rounded bg-discord-red text-white hover:bg-discord-red/80"
                    onClick={() => {
                      const confirmed = window.confirm('Leave this server? You will need an invite to rejoin.');
                      if (!confirmed) return;
                      useChatStore.getState().leaveCurrentServer().then(() => {
                        showToast('Left server', 'success');
                      }).catch((err) => {
                        const message = err instanceof Error ? err.message : 'Failed to leave server';
                        showToast(message, 'error');
                      });
                    }}
                  >
                    Leave
                  </button>
                </div>
              </div>
            )}
            <ServerDangerZone />
          </div>
        </div>
      </div>

      {channelToDelete && canDeleteChannel(channelToDelete, currentServer?.owner?.id, user?.id) && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-discord-lighter rounded-lg p-6 w-full max-w-md border border-discord-dark">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-bold text-white">Delete channel</h3>
              <button
                onClick={() => setChannelToDelete(null)}
                className="text-gray-400 hover:text-white"
                disabled={isDeleting}
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-300 mb-4">
              Are you sure you want to delete <span className="font-semibold text-white">#{channelToDelete.name}</span>?
              Messages in this channel will be removed. This action cannot be undone.
            </p>

            {deleteError && (
              <div className="mb-3 text-sm text-discord-red bg-discord-red/10 border border-discord-red/30 rounded px-3 py-2">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setChannelToDelete(null)}
                className="px-4 py-2 text-gray-400 hover:text-white"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded bg-discord-red hover:bg-discord-red/90 text-white font-semibold disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting && <Loader2 size={16} className="animate-spin" />}
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {channelToLeave && canLeaveChannel(channelToLeave, currentServer?.owner?.id, user?.id) && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-discord-lighter rounded-lg p-6 w-full max-w-md border border-discord-dark">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-bold text-white">Leave channel</h3>
              <button
                onClick={() => setChannelToLeave(null)}
                className="text-gray-400 hover:text-white"
                disabled={isLeaving}
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-300 mb-4">
              Are you sure you want to leave <span className="font-semibold text-white">#{channelToLeave.name}</span>? You will lose access to this private channel until re-invited.
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setChannelToLeave(null)}
                className="px-4 py-2 text-gray-400 hover:text-white"
                disabled={isLeaving}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!channelToLeave) return;
                  setIsLeaving(true);
                  try {
                    await leaveChannel(channelToLeave.id);
                    // fallback handled in store
                    showToast('Left channel', 'success');
                    setChannelToLeave(null);
                  } catch (err) {
                    const message = err instanceof Error ? err.message : 'Failed to leave channel';
                    showToast(message, 'error');
                  } finally {
                    setIsLeaving(false);
                  }
                }}
                disabled={isLeaving}
                className="px-4 py-2 rounded bg-discord-accent hover:bg-discord-accent/90 text-white font-semibold disabled:opacity-50 flex items-center gap-2"
              >
                {isLeaving && <Loader2 size={16} className="animate-spin" />}
                {isLeaving ? 'Leaving...' : 'Leave'}
              </button>
            </div>
          </div>
        </div>
      )}

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

            <div className="mt-4">
              <label className="block text-xs font-semibold text-gray-300 uppercase mb-2">
                Visibility
              </label>
              <div className="flex gap-3">
                {allowCreatePublic && (
                  <label className="flex items-center gap-2 text-sm text-gray-200">
                    <input
                      type="radio"
                      name="visibility"
                      value="PUBLIC"
                      checked={visibility === 'PUBLIC'}
                      onChange={() => setVisibility('PUBLIC')}
                      className="accent-discord-accent"
                    />
                    Public
                  </label>
                )}
                <label className="flex items-center gap-2 text-sm text-gray-200">
                  <input
                    type="radio"
                    name="visibility"
                    value="PRIVATE"
                    checked={!allowCreatePublic || visibility === 'PRIVATE'}
                    onChange={() => setVisibility('PRIVATE')}
                    className="accent-discord-accent"
                    disabled={!allowCreatePrivate}
                  />
                  Private
                  {!allowCreatePublic && (
                    <span className="text-xs text-gray-400">(Only the server owner can create public channels.)</span>
                  )}
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setChannelName('');
                  setVisibility(allowCreatePublic ? 'PUBLIC' : 'PRIVATE');
                }}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateChannel}
                disabled={isCreating || !channelName.trim()}
                className="px-4 py-2 bg-discord-accent hover:bg-discord-accent/80 text-white rounded disabled:opacity-50 flex items-center gap-2"
              >
                {isCreating && <Loader2 size={16} className="animate-spin" />}
                {isCreating ? 'Creating...' : 'Create Channel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
