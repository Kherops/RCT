import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

let socket: Socket | null = null;

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

export function joinServer(serverId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!socket) return reject(new Error('Socket not connected'));
    socket.emit('join:server', serverId, (response: { success: boolean; error?: { message: string } }) => {
      if (response.success) resolve();
      else reject(new Error(response.error?.message || 'Failed to join server'));
    });
  });
}

export function leaveServer(serverId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!socket) return reject(new Error('Socket not connected'));
    socket.emit('leave:server', serverId, (response: { success: boolean; error?: { message: string } }) => {
      if (response.success) resolve();
      else reject(new Error(response.error?.message || 'Failed to leave server'));
    });
  });
}

export function joinChannel(channelId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!socket) return reject(new Error('Socket not connected'));
    socket.emit('join:channel', channelId, (response: { success: boolean; error?: { message: string } }) => {
      if (response.success) resolve();
      else reject(new Error(response.error?.message || 'Failed to join channel'));
    });
  });
}

export function leaveChannel(channelId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!socket) return reject(new Error('Socket not connected'));
    socket.emit('leave:channel', channelId, (response: { success: boolean; error?: { message: string } }) => {
      if (response.success) resolve();
      else reject(new Error(response.error?.message || 'Failed to leave channel'));
    });
  });
}

export function startTyping(channelId: string) {
  socket?.emit('typing:start', channelId);
}

export function stopTyping(channelId: string) {
  socket?.emit('typing:stop', channelId);
}
