import { io, Socket } from 'socket.io-client';
import { getApiBaseUrl } from '@/lib/runtime-config';

const SOCKET_URL = getApiBaseUrl();

let socket: Socket | null = null;
let lastServerId: string | null = null;
let lastDmId: string | null = null;

function logJoinError(action: string, error: unknown) {
  console.warn(`[Socket] ${action} failed`, error);
}

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
      joinServer(lastServerId).catch((err) => logJoinError('join:server', err));
    }
    if (lastDmId) {
      joinDm(lastDmId).catch((err) => logJoinError('join:dm', err));
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    logJoinError('connect', error);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

function emitWithAck<T = void>(event: string, data: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!socket) return reject(new Error('Socket not connected'));
    const emit = () => {
      socket?.emit(event, data, (response: { success: boolean; data?: T; error?: { message: string } }) => {
        if (response.success) resolve(response.data as T);
        else reject(new Error(response.error?.message || `Failed to ${event}`));
      });
    };
    if (socket.connected) emit();
    else socket.once('connect', emit);
  });
}

export function joinServer(serverId: string): Promise<{ onlineUserIds: string[]; statuses: Record<string, "online" | "busy" | "dnd"> }> {
  lastServerId = serverId;
  return emitWithAck<{ onlineUserIds: string[]; statuses?: Record<string, "online" | "busy" | "dnd"> }>('join:server', serverId)
    .then((data) => ({
      onlineUserIds: data?.onlineUserIds ?? [],
      statuses: data?.statuses ?? {},
    }));
}

export function leaveServer(serverId: string): Promise<void> {
  lastServerId = lastServerId === serverId ? null : lastServerId;
  return emitWithAck('leave:server', serverId);
}

export function joinDm(conversationId: string): Promise<void> {
  lastDmId = conversationId;
  return emitWithAck('join:dm', conversationId);
}

export function leaveDm(conversationId: string): Promise<void> {
  lastDmId = lastDmId === conversationId ? null : lastDmId;
  return emitWithAck('leave:dm', conversationId);
}

export function updateStatus(serverId: string, status: "online" | "busy" | "dnd") {
  return new Promise<void>((resolve, reject) => {
    if (!socket) return reject(new Error('Socket not connected'));
    const emit = () => {
      socket?.emit('status:update', serverId, status, (response: { success: boolean; error?: { message: string } }) => {
        if (response.success) resolve();
        else reject(new Error(response.error?.message || 'Failed to update status'));
      });
    };
    if (socket.connected) emit();
    else socket.once('connect', emit);
  });
}

export function startTyping(channelId: string) {
  socket?.emit('typing:start', channelId);
}

export function stopTyping(channelId: string) {
  socket?.emit('typing:stop', channelId);
}
