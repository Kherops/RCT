import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

let socket: Socket | null = null;
let lastServerId: string | null = null;
let lastChannelId: string | null = null;
let lastDmId: string | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(token: string): Socket {
  if (socket?.connected) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    path: '/ws',
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected');
    if (lastServerId) {
      joinServer(lastServerId).catch(() => {});
    }
    if (lastChannelId) {
      joinChannel(lastChannelId).catch(() => {});
    }
    if (lastDmId) {
      joinDm(lastDmId).catch(() => {});
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error.message);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

function emitWithAck(event: string, data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!socket) return reject(new Error('Socket not connected'));
    const emit = () => {
      socket?.emit(event, data, (response: { success: boolean; error?: { message: string } }) => {
        if (response.success) resolve();
        else reject(new Error(response.error?.message || `Failed to ${event}`));
      });
    };
    if (socket.connected) emit();
    else socket.once('connect', emit);
  });
}

export function joinServer(serverId: string): Promise<void> {
  lastServerId = serverId;
  return emitWithAck('join:server', serverId);
}

export function leaveServer(serverId: string): Promise<void> {
  lastServerId = lastServerId === serverId ? null : lastServerId;
  return emitWithAck('leave:server', serverId);
}

export function joinChannel(channelId: string): Promise<void> {
  lastChannelId = channelId;
  return emitWithAck('join:channel', channelId);
}

export function leaveChannel(channelId: string): Promise<void> {
  lastChannelId = lastChannelId === channelId ? null : lastChannelId;
  return emitWithAck('leave:channel', channelId);
}

export function joinDm(conversationId: string): Promise<void> {
  lastDmId = conversationId;
  return emitWithAck('join:dm', conversationId);
}

export function leaveDm(conversationId: string): Promise<void> {
  lastDmId = lastDmId === conversationId ? null : lastDmId;
  return emitWithAck('leave:dm', conversationId);
}

export function startTyping(channelId: string) {
  socket?.emit('typing:start', channelId);
}

export function stopTyping(channelId: string) {
  socket?.emit('typing:stop', channelId);
}
