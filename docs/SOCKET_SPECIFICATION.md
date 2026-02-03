# Socket.IO Specification Document

## Overview

This document describes the real-time WebSocket communication protocol for the RTC (Real Time Chat) application. The Socket.IO server is accessible at `/ws` path.

## Connection

### Endpoint
```text
ws://localhost:3001/ws
```

### Authentication

Authentication is required for all socket connections. Provide the JWT access token in one of these ways:

1. Auth object (recommended)
2. Authorization header

Connection errors:
- `Authentication required`
- `Invalid token`
- `User not found`

---

## Rooms

The server uses Socket.IO rooms to manage message broadcasting:

- `server:{serverId}` for server-level events (presence, channels, members).
- `channel:{channelId}` for channel message broadcasts.
- `dm:{conversationId}` for direct messages.
- `user:{userId}` for direct messages / DM creation to a specific user.

Notes:
- Typing events are broadcast to `server:{serverId}` and include `channelId`.
- `message:new` is emitted to `channel:{channelId}` when the message is sent over sockets.
- REST endpoints may emit to `server:{serverId}` (see mapping section).

### Scaling / Multi-instance

If the app runs across multiple instances behind a load balancer (for example on Render), Socket.IO rooms are **not** shared across instances by default. To avoid missed real-time events:

- Enable sticky sessions on the load balancer, or
- Use a shared adapter (e.g. Redis) so events are broadcast across instances.

### Join/Leave Rules

- `join:server` checks server membership.
- `join:dm` checks conversation participation.
- The server always re-validates access on send events.

---

## Client → Server Events

### Server/Channel

- `join:server(serverId, ack)`
- `leave:server(serverId, ack)`
- `message:send({ channelId, content?, gifUrl?, replyToMessageId? }, ack)`
- `typing:start(channelId)`
- `typing:stop(channelId)`

Ack response shape:
```ts
{ success: boolean; data?: unknown; error?: { message: string; code?: string } }
```

`join:server` success data:
```ts
{ onlineUserIds: string[] }
```

### Direct Messages (DM)

#### `join:dm`

Join a DM room.

Payload: `conversationId: string`

Errors:
- `FORBIDDEN` when not a participant
- `NOT_FOUND` when conversation doesn't exist

#### `leave:dm`

Leave a DM room.

Payload: `conversationId: string`

#### `dm:send`

Send a direct message.

Payload:
```ts
{
  conversationId: string;
  content?: string;
  gifUrl?: string;
  replyToMessageId?: string;
}
```

Notes:
- The server persists the message before broadcast.
- The server verifies that the sender is a participant even if the client did not join the DM room.
- Acknowledgements follow the same `SocketResponse` shape as `join:server`.

### Channel Rooms (Defined but not handled)

The socket types define `join:channel` / `leave:channel`, but there are no server handlers yet. Clients should not rely on these events until implemented.

---

## Server → Client Events

### Channel Messages

#### `message:new`

Payload:
```ts
{
  id: string;
  channelId: string;
  content: string;
  gifUrl?: string | null;
  replyTo?: ReplySummary | null;
  createdAt: string; // ISO 8601
  updatedAt?: string; // ISO 8601
  author: {
    id: string;
    username: string;
  };
}
```

Room: `channel:{channelId}` (socket send) or `server:{serverId}` (REST emission)

#### `message:updated`

Broadcast when a message is edited.

Payload:
```ts
{
  id: string;
  channelId: string;
  content: string;
  gifUrl?: string | null;
  replyTo?: ReplySummary | null;
  createdAt: string; // ISO 8601
  updatedAt?: string; // ISO 8601
  author: {
    id: string;
    username: string;
  };
}
```

Room: `server:{serverId}`

#### `message:deleted`

Payload:
```ts
{
  messageId: string;
  channelId: string;
}
```

Room: `server:{serverId}`

### Direct Messages (DM)

#### `dm:new`

Broadcast when a new DM is sent.

Payload:
```ts
{
  id: string;
  conversationId: string;
  content: string;
  gifUrl?: string | null;
  replyTo?: ReplySummary | null;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  author: {
    id: string;
    username: string;
  };
}
```

Room: `dm:{conversationId}` and `user:{userId}`

#### `dm:deleted`

Broadcast when a DM is deleted.

Payload:
```ts
{
  messageId: string;
  conversationId: string;
}
```

Room: `dm:{conversationId}`

#### `dm:created`

Broadcast when a DM conversation is created.

Payload:
```ts
{
  id: string;
  participantIds: string[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

Room: `user:{userId}`

### Presence / Members / Channels

#### `user:online` / `user:offline`

Payload:
```ts
{
  userId: string;
  serverId: string;
}
```

Room: `server:{serverId}`

#### `user:joined` / `user:left`

Payload:
```ts
{
  userId: string;
  username: string;
  serverId: string;
}
```

Room: `server:{serverId}`

#### `channel:created` / `channel:updated`

Payload:
```ts
{
  id: string;
  serverId: string;
  name: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

Room: `server:{serverId}`

#### `channel:deleted`

Payload:
```ts
{
  channelId: string;
  serverId: string;
}
```

Room: `server:{serverId}`

#### `member:role_updated`

Payload:
```ts
{
  userId: string;
  serverId: string;
  role: string;
}
```

Room: `server:{serverId}`

#### `server:updated`

Payload:
```ts
{
  serverId: string;
  name: string;
}
```

Room: `server:{serverId}`

### Reply Summary Payload

Used in message payloads when a reply exists.

```ts
{
  id: string;
  content: string;
  gifUrl?: string | null;
  createdAt: string; // ISO 8601
  author: { id: string; username: string } | null;
  deletedAt?: string | null;
}
```

---

## REST API ↔ Socket Mapping

- `POST /channels/:id/messages` → `message:new`
- `PATCH /messages/:id` → `message:updated`
- `DELETE /messages/:id` → `message:deleted`
- `POST /dm/conversations/:id/messages` → `dm:new`
- `DELETE /dm/messages/:id` → `dm:deleted`
- `POST /servers/:id/join` → `user:joined`
- `DELETE /servers/:id/leave` → `user:left`
- `POST /servers/:serverId/channels` → `channel:created`
- `PUT /channels/:id` → `channel:updated`
- `DELETE /channels/:id` → `channel:deleted`
- `PUT /servers/:id/members/:userId` → `member:role_updated`
- `PUT /servers/:id` → `server:updated`

---

## Example Flow (Login → Join → DM)

1. Login (REST) and get `accessToken`.
2. Connect socket with `auth.token = accessToken`.
3. Create or get DM via `POST /dm/conversations`.
4. `join:dm(conversationId)`.
5. `dm:send({ conversationId, content })`.
