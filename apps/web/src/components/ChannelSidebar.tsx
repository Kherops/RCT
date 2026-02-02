"use client";

import { useState } from "react";
import {
  Hash,
  Plus,
  Copy,
  Check,
  Loader2,
  MessageSquare,
  Trash,
  X,
  LogOut,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useChatStore } from "@/store/chat";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { ServerDangerZone } from "@/components/ServerDangerZone";
import { ApiHttpError } from "@/lib/api";

type ChannelItem = {
  id: string;
  name: string;
  serverId: string;
  ownerId?: string;
};

function isProtectedChannel(channel: ChannelItem) {
  const slug = channel.name.trim().toLowerCase();
  return slug === "general";
}

function canCreateChannel(serverOwnerId?: string, userId?: string) {
  if (!userId || !serverOwnerId) return false;
  return serverOwnerId === userId;
}

function canDeleteChannel(
  channel: ChannelItem & { ownerId?: string },
  serverOwnerId?: string,
  userId?: string,
) {
  if (!userId) return false;
  if (isProtectedChannel(channel)) return false;
  if (channel.ownerId) return channel.ownerId === userId;
  return !!serverOwnerId && serverOwnerId === userId;
}

export function ChannelSidebar() {
  const {
    currentServer,
    channels,
    currentChannel,
    selectChannel,
    createChannel,
    deleteChannel,
    members,
    leaveCurrentServer,
    fetchServers,
    isLoading,
  } = useChatStore();
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [channelName, setChannelName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [channelToDelete, setChannelToDelete] = useState<ChannelItem | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const allowCreate = canCreateChannel(currentServer?.owner?.id, user?.id);
  const isMember = !!user && members.some((m) => m.user.id === user.id);
  const isOwner =
    !!user &&
    (currentServer?.owner?.id === user.id ||
      members.some((m) => m.user.id === user.id && m.role === "OWNER"));
  const canLeave = isMember && !isOwner;

  const handleCreateChannel = async () => {
    if (!allowCreate) {
      showToast("Only the server owner can create channels", "error");
      return;
    }
    if (!channelName.trim() || isCreating) return;
    setIsCreating(true);
    try {
      await createChannel(channelName.toLowerCase().replace(/\s+/g, "-"));
      showToast("Channel created successfully", "success");
      setShowCreateModal(false);
      setChannelName("");
    } catch (err) {
      showToast("Failed to create channel", "error");
    } finally {
      setIsCreating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!channelToDelete || isDeleting) return;
    if (isProtectedChannel(channelToDelete)) {
      showToast("The default channel cannot be deleted.", "error");
      setChannelToDelete(null);
      return;
    }
    if (channels.length <= 1) {
      showToast("At least one channel must remain in the server", "error");
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteChannel(channelToDelete.id);

      const {
        channels: updated,
        currentChannel: updatedCurrent,
        selectChannel: select,
      } = useChatStore.getState();
      if (!updatedCurrent || !updated.find((c) => c.id === updatedCurrent.id)) {
        const fallback = updated[0];
        if (fallback) {
          await select(fallback.id);
        }
      }

      showToast("Channel deleted", "success");
      setChannelToDelete(null);
    } catch (err) {
      let message = "Failed to delete channel";
      if (err instanceof ApiHttpError) {
        if (err.status === 403) {
          message = "Only the owner (or admin) can delete this channel";
        } else if (err.status === 404) {
          message = "Channel not found";
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
      showToast(message, "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const copyInviteCode = async () => {
    if (currentServer?.inviteCode) {
      try {
        await navigator.clipboard.writeText(currentServer.inviteCode);
        setCopied(true);
        showToast("Invite code copied!", "success");
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        showToast("Failed to copy invite code", "error");
      }
    }
  };

  const handleLeaveServer = async () => {
    if (!currentServer || isLeaving) return;
    setIsLeaving(true);
    setLeaveError(null);

    try {
      await leaveCurrentServer();
      await fetchServers();
      showToast("You left the server", "success");
      setShowLeaveModal(false);
      router.push("/chat");
    } catch (err) {
      let message = "Failed to leave server";
      if (err instanceof ApiHttpError && err.code === "OWNER_CANNOT_LEAVE") {
        message = "Server owners cannot leave. Transfer ownership first.";
      }
      setLeaveError(message);
      showToast(message, "error");
    } finally {
      setIsLeaving(false);
    }
  };

  if (!currentServer) return null;

  return (
    <>
      <div className="w-60 bg-discord-light flex flex-col">
        <div className="h-12 px-4 flex items-center justify-between border-b border-discord-darker shadow-sm">
          <h2 className="font-semibold text-white truncate">
            {currentServer.name}
          </h2>
          <button
            onClick={copyInviteCode}
            className="text-gray-400 hover:text-white"
            title="Copy invite code"
          >
            {copied ? (
              <Check size={18} className="text-discord-green" />
            ) : (
              <Copy size={18} />
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 flex flex-col">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-semibold text-gray-400 uppercase">
              Text Channels
            </span>
            {allowCreate && (
              <button
                onClick={() => {
                  setShowCreateModal(true);
                  setDeleteError(null);
                }}
                className="text-gray-400 hover:text-white"
                title="Create Channel"
              >
                <Plus size={16} />
              </button>
            )}
          </div>

          {channels.length === 0 && !isLoading && (
            <div className="flex flex-col items-center py-8 text-gray-500">
              <MessageSquare size={32} className="mb-2 opacity-50" />
              <p className="text-sm">No channels yet</p>
            </div>
          )}

          {channels.map((channel) => {
            const isActive = currentChannel?.id === channel.id;
            const deletable = canDeleteChannel(
              channel,
              currentServer?.owner?.id,
              user?.id,
            );
            return (
              <div
                key={channel.id}
                role="button"
                tabIndex={0}
                onClick={() => selectChannel(channel.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    selectChannel(channel.id);
                  }
                }}
                className={cn(
                  "group w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors cursor-pointer",
                  isActive
                    ? "bg-discord-lighter text-white"
                    : "text-gray-400 hover:bg-discord-lighter/50 hover:text-gray-200",
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
              </div>
            );
          })}

          <div className="mt-auto pt-4">
            <ServerDangerZone />
            {canLeave && (
              <div className="mt-4 border-t border-discord-dark pt-4">
                <div className="flex items-start justify-between bg-discord-dark rounded-lg p-3 border border-discord-red/30">
                  <div>
                    <div className="flex items-center gap-2 text-red-200 font-semibold">
                      Leave server
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowLeaveModal(true);
                      setLeaveError(null);
                    }}
                    className="px-3 py-1.5 rounded bg-discord-red/80 text-white text-sm font-semibold hover:bg-discord-red"
                  >
                    <LogOut size={16} className="text-discord-white" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {channelToDelete &&
        canDeleteChannel(
          channelToDelete,
          currentServer?.owner?.id,
          user?.id,
        ) && (
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
                Are you sure you want to delete{" "}
                <span className="font-semibold text-white">
                  #{channelToDelete.name}
                </span>
                ? Messages in this channel will be removed. This action cannot
                be undone.
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
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

      {showLeaveModal && currentServer && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-discord-lighter rounded-lg p-6 w-full max-w-md border border-discord-dark">
            <h3 className="text-xl font-bold text-white mb-2">Leave server</h3>
            <p className="text-sm text-gray-300 mb-4">
              You are about to leave{" "}
              <span className="font-semibold text-white">
                {currentServer.name}
              </span>
              . You will need an invite to rejoin.
            </p>

            {leaveError && (
              <div className="mb-3 text-sm text-discord-red bg-discord-red/10 border border-discord-red/30 rounded px-3 py-2">
                {leaveError}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowLeaveModal(false);
                  setLeaveError(null);
                }}
                className="px-4 py-2 text-gray-400 hover:text-white"
                disabled={isLeaving}
              >
                Cancel
              </button>
              <button
                onClick={handleLeaveServer}
                disabled={isLeaving}
                className="px-4 py-2 rounded bg-discord-red hover:bg-discord-red/90 text-white font-semibold disabled:opacity-50 flex items-center gap-2"
              >
                {isLeaving && <Loader2 size={16} className="animate-spin" />}
                {isLeaving ? "Leaving..." : "Leave"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-discord-lighter rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">
              Create Channel
            </h2>

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
                disabled={isCreating || !channelName.trim()}
                className="px-4 py-2 bg-discord-accent hover:bg-discord-accent/80 text-white rounded disabled:opacity-50 flex items-center gap-2"
              >
                {isCreating && <Loader2 size={16} className="animate-spin" />}
                {isCreating ? "Creating..." : "Create Channel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
