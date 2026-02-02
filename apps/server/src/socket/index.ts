import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import type { TypedServer } from "./types.js";
import { socketAuthMiddleware } from "./auth.js";
import { registerSocketHandlers, createSocketEmitters } from "./handlers.js";

let io: TypedServer | null = null;
let emitters: ReturnType<typeof createSocketEmitters> | null = null;

export function initializeSocket(
  httpServer: HttpServer,
  corsOrigin: string[] | boolean,
): TypedServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"],
      credentials: true,
    },
    path: "/ws",
    transports: ["websocket", "polling"],
  }) as TypedServer;

  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    console.log(
      `[Socket] User connected: ${socket.data.userId} (${socket.id})`,
    );

    socket.join(`user:${socket.data.userId}`);

    registerSocketHandlers(io!, socket);

    socket.on("disconnect", (reason) => {
      console.log(
        `[Socket] User disconnected: ${socket.data.userId} - ${reason}`,
      );
    });
  });

  emitters = createSocketEmitters(io);

  console.log("[Socket] Socket.IO server initialized");
  return io;
}

export function getIO(): TypedServer {
  if (!io) {
    throw new Error("Socket.IO not initialized");
  }
  return io;
}

export function getEmitters() {
  if (!emitters) {
    if (process.env.NODE_ENV === "test") {
      emitters = {
        emitUserLeft: () => {},
        emitUserJoined: () => {},
        emitServerUpdated: () => {},
        emitMemberRoleUpdated: () => {},
        emitMessageNew: () => {},
        emitMessageUpdated: () => {},
        emitMessageDeleted: () => {},
        emitDmNew: () => {},
        emitDmNewToUsers: () => {},
        emitDmDeleted: () => {},
        emitDmDeletedToUsers: () => {},
        emitDmCreated: () => {},
        emitChannelCreated: () => {},
        emitChannelUpdated: () => {},
        emitChannelDeleted: () => {},
        getOnlineUsers: () => [],
      } as ReturnType<typeof createSocketEmitters>;
    } else {
      throw new Error("Socket emitters not initialized");
    }
  }
  return emitters;
}

export * from "./types.js";
