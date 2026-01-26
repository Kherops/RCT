'use client';

import { useChatStore } from '@/store/chat';
import { cn } from '@/lib/utils';

export function MemberSidebar() {
  const { members, onlineUsers } = useChatStore();

  const owners = members.filter(m => m.role === 'OWNER');
  const admins = members.filter(m => m.role === 'ADMIN');
  const regularMembers = members.filter(m => m.role === 'MEMBER');

  const MemberItem = ({ member }: { member: typeof members[0] }) => {
    const isOnline = onlineUsers.has(member.user.id);
    
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-discord-lighter/50 cursor-pointer">
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
        <span className={cn('text-sm', isOnline ? 'text-gray-200' : 'text-gray-500')}>
          {member.user.username}
        </span>
      </div>
    );
  };

  return (
    <div className="w-60 bg-discord-light overflow-y-auto">
      <div className="p-3">
        {owners.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-gray-400 uppercase px-2 mb-1">
              Owner — {owners.length}
            </h4>
            {owners.map(member => (
              <MemberItem key={member.id} member={member} />
            ))}
          </div>
        )}

        {admins.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-gray-400 uppercase px-2 mb-1">
              Admins — {admins.length}
            </h4>
            {admins.map(member => (
              <MemberItem key={member.id} member={member} />
            ))}
          </div>
        )}

        {regularMembers.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase px-2 mb-1">
              Members — {regularMembers.length}
            </h4>
            {regularMembers.map(member => (
              <MemberItem key={member.id} member={member} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
