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

- `server:{serverId}`
- `channel:{channelId}`
- `dm:{conversationId}`

### Join/Leave Rules

- `join:server` checks server membership.
- `join:channel` checks channel existence and server membership.
- `join:dm` checks conversation participation.
- The server always re-validates access on send events.

---

## Client → Server Events

### Server/Channel

- `join:server(serverId)`
- `leave:server(serverId)`
- `join:channel(channelId)`
- `leave:channel(channelId)`
- `message:send({ channelId, content })`
- `typing:start(channelId)`
- `typing:stop(channelId)`

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
  content: string;
}
```

Notes:
- The server persists the message before broadcast.
- The server verifies that the sender is a participant even if the client did not join the DM room.

---

## Server → Client Events

### Direct Messages (DM)

#### `dm:new`

Broadcast when a new DM is sent.

Payload:
```ts
{
  id: string;
  conversationId: string;
  content: string;
  createdAt: string; // ISO 8601
  author: {
    id: string;
    username: string;
  };
}
```

Room: `dm:{conversationId}`

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

---

## REST API ↔ Socket Mapping

- `POST /channels/:id/messages` → `message:new`
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
