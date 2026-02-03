'use client';

import { useMemo, useState } from 'react';
import { MessageCircle, Search, UserMinus, Loader2 } from 'lucide-react';
import { useChatStore } from '@/store/chat';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import { ProfileCard } from '@/components/ProfileCard';

export function MemberSidebar() {
  const {
    members,
    onlineUsers,
    dmConversations,
    currentDmConversation,
    mode,
    startDmByUsername,
    selectDmConversation,
    kickMember,
  } = useChatStore();
  const { user } = useAuthStore();
  const { showToast } = useToast();

  const [dmUsername, setDmUsername] = useState('');
  const [isStartingDm, setIsStartingDm] = useState(false);
  const [kickingMemberId, setKickingMemberId] = useState<string | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  const owners = members.filter((m) => m.role === 'OWNER');
  const admins = members.filter((m) => m.role === 'ADMIN');
  const regularMembers = members.filter((m) => m.role === 'MEMBER');

  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => map.set(m.user.id, m.user.username));
    return map;
  }, [members]);

  const dmItems = useMemo(() => {
    if (!user) return [];

    return dmConversations.map((conversation) => {
      const otherId = conversation.participantIds.find((id) => id !== user.id) || null;
      const otherNameFromMembers = otherId ? memberNameById.get(otherId) : null;
      const otherNameFromParticipants = otherId
        ? conversation.participants?.find((p) => p.id === otherId)?.username
        : null;
      const otherName = otherNameFromMembers || otherNameFromParticipants || 'Direct Message';
      const lastMessageText = conversation.lastMessage?.content?.trim()
        ? conversation.lastMessage.content
        : conversation.lastMessage?.gifUrl
          ? 'GIF'
          : null;

      return {
        id: conversation.id,
        otherName,
        lastMessage: lastMessageText,
      };
    });
  }, [dmConversations, memberNameById, user]);

  const handleStartDm = async () => {
    if (!dmUsername.trim() || isStartingDm) return;
    setIsStartingDm(true);
    try {
      await startDmByUsername(dmUsername);
      setDmUsername('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to start DM', 'error');
    } finally {
      setIsStartingDm(false);
    }
  };

  const MemberItem = ({ member }: { member: typeof members[0] }) => {
    const isOnline = onlineUsers.has(member.user.id);
    const myRole = members.find((m) => m.user.id === user?.id)?.role;
    const isSelf = member.user.id === user?.id;
    const canKick =
      !isSelf &&
      (myRole === 'OWNER'
        ? member.role !== 'OWNER'
        : myRole === 'ADMIN'
          ? member.role === 'MEMBER'
          : false);

    const handleKick = async () => {
      if (!canKick || kickingMemberId) return;
      setKickingMemberId(member.user.id);
      try {
        await kickMember(member.user.id);
        showToast(`Kicked ${member.user.username}`, 'success');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to kick member', 'error');
      } finally {
        setKickingMemberId(null);
      }
    };

    return (
      <div
        className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-discord-lighter/50 cursor-pointer"
        onClick={() => setProfileUserId(member.user.id)}
      >
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-discord-accent flex items-center justify-center text-white text-sm font-semibold">
            {member.user.username.charAt(0).toUpperCase()}
          </div>
          <div
            className={cn(
              'absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-discord-light',
              isOnline ? 'bg-discord-green' : 'bg-gray-500'
            )}
          />
        </div>
        <span className={cn('text-sm flex-1', isOnline ? 'text-gray-200' : 'text-gray-500')}>
          {member.user.username}
        </span>
        {canKick && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              handleKick();
            }}
            disabled={kickingMemberId === member.user.id}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-discord-red hover:bg-discord-dark disabled:opacity-50"
            title="Kick member"
          >
            {kickingMemberId === member.user.id ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <UserMinus size={14} />
            )}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="w-60 bg-discord-light overflow-y-auto border-l border-discord-dark/50">
      <div className="p-3 space-y-4">
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase px-1 mb-2 flex items-center gap-2">
            <MessageCircle size={14} />
            Direct Messages
          </h4>

          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded bg-discord-lighter border border-discord-dark">
              <Search size={14} className="text-gray-400" />
              <input
                value={dmUsername}
                onChange={(e) => setDmUsername(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleStartDm();
                  }
                }}
                placeholder="Type a username..."
                className="w-full bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
              />
            </div>
            <button
              onClick={handleStartDm}
              disabled={!dmUsername.trim() || isStartingDm}
              className="px-2.5 py-1.5 rounded bg-discord-accent text-white text-xs font-medium disabled:opacity-50 hover:brightness-110 transition"
            >
              DM
            </button>
          </div>

          <div className="space-y-1">
            {dmItems.length === 0 && (
              <p className="text-xs text-gray-500 px-1">No DMs yet</p>
            )}
            {dmItems.map((item) => {
              const isActive = mode === 'dm' && currentDmConversation?.id === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => selectDmConversation(item.id)}
                  className={cn(
                    'w-full text-left px-2 py-1.5 rounded transition-colors',
                    isActive ? 'bg-discord-accent/20 text-white' : 'hover:bg-discord-lighter/50 text-gray-200'
                  )}
                  title={item.lastMessage || undefined}
                >
                  <div className="text-sm font-medium truncate">@{item.otherName}</div>
                  {item.lastMessage && (
                    <div className="text-xs text-gray-400 truncate">{item.lastMessage}</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {owners.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase px-2 mb-1">Owner — {owners.length}</h4>
            {owners.map((member) => (
              <MemberItem key={member.id} member={member} />
            ))}
          </div>
        )}

        {admins.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase px-2 mb-1">Admins — {admins.length}</h4>
            {admins.map((member) => (
              <MemberItem key={member.id} member={member} />
            ))}
          </div>
        )}

        {regularMembers.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase px-2 mb-1">Members — {regularMembers.length}</h4>
            {regularMembers.map((member) => (
              <MemberItem key={member.id} member={member} />
            ))}
          </div>
        )}
      </div>

      {profileUserId && (
        <ProfileCard userId={profileUserId} onClose={() => setProfileUserId(null)} />
      )}
    </div>
  );
}
