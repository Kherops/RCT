import type { TypedSocket } from './types.js';
import { authService } from '../services/auth.service.js';
import { userRepository } from '../repositories/user.repository.js';

export async function socketAuthMiddleware(
  socket: TypedSocket,
  next: (err?: Error) => void
) {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const payload = authService.verifyAccessToken(token);
    const user = await userRepository.findById(payload.userId);

    if (!user) {
      return next(new Error('User not found'));
    }

    socket.data.userId = user.id;
    socket.data.username = user.username;
    socket.data.joinedServers = new Set();
    socket.data.joinedChannels = new Set();

    next();
  } catch (error) {
    next(new Error('Invalid token'));
  }
}
