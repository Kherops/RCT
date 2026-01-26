# Socket.IO Specification Document

## Overview

This document describes the real-time WebSocket communication protocol for the RTC (Real Time Chat) application. The Socket.IO server is accessible at `/ws` path.

## Connection

### Endpoint
```
ws://localhost:3001/ws
```

### Authentication

Authentication is required for all socket connections. Provide the JWT access token in one of these ways:

1. **Auth object** (recommended):
```javascript
const socket = io('http://localhost:3001', {
  path: '/ws',
  auth: {
    token: 'your-jwt-access-token'
  }
});
```

2. **Authorization header**:
```javascript
const socket = io('http://localhost:3001', {
  path: '/ws',
  extraHeaders: {
    Authorization: 'Bearer your-jwt-access-token'
  }
});
```

### Connection Errors

| Error | Description |
|-------|-------------|
| `Authentication required` | No token provided |
| `Invalid token` | Token is invalid or expired |
| `User not found` | User associated with token doesn't exist |

---

## Rooms

The server uses Socket.IO rooms to manage message broadcasting:

| Room Pattern | Description | Example |
|--------------|-------------|---------|
| `server:{serverId}` | All users connected to a server | `server:clx123abc` |
| `channel:{channelId}` | All users viewing a channel | `channel:clx456def` |

### Join/Leave Rules

- A client **must** call `join:server` before considering a user "online" in that server.
- A client **should** call `leave:server` when navigating away from a server.
- A client **should** call `join:channel` only after `join:server` for the server that owns the channel.
- The server validates access on each join:
  - `join:server` checks server membership.
  - `join:channel` checks the channel exists and server membership.
- If the membership check fails, the server responds with `success: false` and an error code.

---

## Client → Server Events

### `join:server`

Join a server room to receive server-wide events (user online/offline, member updates).

**Payload**: `serverId: string`

**Callback Response**:
```typescript
{
  success: boolean;
  error?: { message: string; code: string; }
}
```

**Errors**:
- `FORBIDDEN` - Not a member of this server
- `INTERNAL_ERROR` - Server error

**Presence semantics**:

- The server emits `user:online` to the `server:{serverId}` room **only when the first active socket (tab/device) for that user joins the server room**.
- The server emits `user:offline` to the `server:{serverId}` room **only when the last active socket for that user leaves/disconnects**.
- This supports multi-tabs without flickering presence.

**Example**:
```javascript
socket.emit('join:server', 'server-id', (response) => {
  if (response.success) {
    console.log('Joined server room');
  }
});
```

---

### `leave:server`

Leave a server room.

**Payload**: `serverId: string`

**Callback Response**:
```typescript
{
  success: boolean;
  error?: { message: string; code: string; }
}
```

**Presence semantics**:

- `leave:server` decrements the user connection counter for the server.
- `user:offline` is broadcast only when the counter reaches `0`.

---

### `join:channel`

Join a channel room to receive messages and typing indicators.

**Payload**: `channelId: string`

**Callback Response**:
```typescript
{
  success: boolean;
  error?: { message: string; code: string; }
}
```

**Errors**:
- `NOT_FOUND` - Channel doesn't exist
- `FORBIDDEN` - Not a member of the server

---

### `leave:channel`

Leave a channel room.

**Payload**: `channelId: string`

**Callback Response**:
```typescript
{
  success: boolean;
  error?: { message: string; code: string; }
}
```

---

### `message:send`

Send a message to a channel.

**Payload**:
```typescript
{
  channelId: string;
  content: string;
}
```

**Callback Response**:
```typescript
{
  success: boolean;
  data?: {
    id: string;
    channelId: string;
    content: string;
    createdAt: string; // ISO 8601
    author: {
      id: string;
      username: string;
    }
  };
  error?: { message: string; code: string; }
}
```

**Example**:
```javascript
socket.emit('message:send', {
  channelId: 'channel-id',
  content: 'Hello, world!'
}, (response) => {
  if (response.success) {
    console.log('Message sent:', response.data);
  }
});
```

**Notes**:

- The message is persisted on the backend before broadcast.
- The server broadcasts `message:new` to `channel:{channelId}`.

---

### `typing:start`

Indicate that the user started typing in a channel.

**Payload**: `channelId: string`

**No callback** - Fire and forget

**Example**:
```javascript
socket.emit('typing:start', 'channel-id');
```

**Client throttle recommendation**:

- Emit `typing:start` at most once every ~1s while the user is typing.
- Emit `typing:stop` after ~2s of inactivity (debounce).

---

### `typing:stop`

Indicate that the user stopped typing.

**Payload**: `channelId: string`

**No callback** - Fire and forget

---

## Server → Client Events

### `message:new`

Broadcast when a new message is sent to a channel.

**Payload**:
```typescript
{
  id: string;
  channelId: string;
  content: string;
  createdAt: string; // ISO 8601
  author: {
    id: string;
    username: string;
  }
}
```

**Room**: `channel:{channelId}`

**When emitted**:

- After a successful REST delete (`DELETE /messages/:id`) or any authorized server-side deletion.

---

### `message:deleted`

Broadcast when a message is deleted.

**Payload**:
```typescript
{
  messageId: string;
  channelId: string;
}
```

**Room**: `channel:{channelId}`

---

### `user:joined`

Broadcast when a user joins a server (via invite).

**Payload**:
```typescript
{
  userId: string;
  username: string;
  serverId: string;
}
```

**Room**: `server:{serverId}`

**Multi-tabs**:

- Emitted only when the first socket for a `(userId, serverId)` becomes active (joins the server room).

---

### `user:left`

Broadcast when a user leaves a server.

**Payload**:
```typescript
{
  userId: string;
  username: string;
  serverId: string;
}
```

**Room**: `server:{serverId}`

---

### `user:online`

Broadcast when a user comes online (connects to server room).

**Payload**:
```typescript
{
  userId: string;
  serverId: string;
}
```

**Room**: `server:{serverId}`

---

### `user:offline`

Broadcast when a user goes offline (disconnects from server room).

**Payload**:
```typescript
{
  userId: string;
  serverId: string;
}
```

**Room**: `server:{serverId}`

---

### `typing:start`

Broadcast when a user starts typing.

**Payload**:
```typescript
{
  userId: string;
  username: string;
  channelId: string;
}
```

**Room**: `channel:{channelId}`

---

### `typing:stop`

Broadcast when a user stops typing.

**Payload**:
```typescript
{
  userId: string;
  channelId: string;
}
```

**Room**: `channel:{channelId}`

---

### `channel:created`

Broadcast when a new channel is created.

**Payload**:
```typescript
{
  id: string;
  serverId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
```

**Room**: `server:{serverId}`

---

### `channel:updated`

Broadcast when a channel is updated.

**Payload**:
```typescript
{
  id: string;
  serverId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
```

**Room**: `server:{serverId}`

---

### `channel:deleted`

Broadcast when a channel is deleted.

**Payload**:
```typescript
{
  channelId: string;
  serverId: string;
}
```

**Room**: `server:{serverId}`

---

### `member:role_updated`

Broadcast when a member's role is updated.

**Payload**:
```typescript
{
  userId: string;
  serverId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
}
```

**Room**: `server:{serverId}`

---

### `server:updated`

Broadcast when server details are updated.

**Payload**:
```typescript
{
  serverId: string;
  name: string;
}
```

**Room**: `server:{serverId}`

---

### `error`

Generic error event.

**Payload**:
```typescript
{
  message: string;
  code?: string;
}
```

---

## REST API ↔ Socket Mapping

| REST Endpoint | Socket Event Triggered |
|---------------|----------------------|
| `POST /channels/:id/messages` | `message:new` |
| `DELETE /messages/:id` | `message:deleted` |
| `POST /servers/:id/join` | `user:joined` |
| `DELETE /servers/:id/leave` | `user:left` |
| `POST /servers/:serverId/channels` | `channel:created` |
| `PUT /channels/:id` | `channel:updated` |
| `DELETE /channels/:id` | `channel:deleted` |
| `PUT /servers/:id/members/:userId` | `member:role_updated` |
| `PUT /servers/:id` | `server:updated` |

---

## Best Practices

### Client Implementation

1. **Join server room on server selection**:
```javascript
function selectServer(serverId) {
  socket.emit('join:server', serverId);
}
```

2. **Join channel room when viewing channel**:
```javascript
function selectChannel(channelId) {
  // Leave previous channel
  if (currentChannelId) {
    socket.emit('leave:channel', currentChannelId);
  }
  socket.emit('join:channel', channelId);
  currentChannelId = channelId;
}
```

3. **Implement typing indicator with debounce**:
```javascript
let typingTimeout;

function handleTyping(channelId) {
  socket.emit('typing:start', channelId);
  
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('typing:stop', channelId);
  }, 2000);
}
```

4. **Handle reconnection**:
```javascript
socket.on('connect', () => {
  // Rejoin rooms after reconnection
  if (currentServerId) {
    socket.emit('join:server', currentServerId);
  }
  if (currentChannelId) {
    socket.emit('join:channel', currentChannelId);
  }
});
```

---

## Example Flow (Login → Join Server → Join Channel → Send → Delete)

### 1) Login (REST)

```http
POST /auth/login
Content-Type: application/json

{ "email": "alice@example.com", "password": "password123" }
```

Response includes `accessToken`.

### 2) Connect Socket

```javascript
const socket = io('http://localhost:3001', {
  path: '/ws',
  auth: { token: accessToken },
});
```

### 3) Join server

```javascript
socket.emit('join:server', serverId, (res) => {
  if (!res.success) return console.error(res.error);
});
```

### 4) Join channel

```javascript
socket.emit('join:channel', channelId, (res) => {
  if (!res.success) return console.error(res.error);
});
```

### 5) Send message

```javascript
socket.emit('message:send', { channelId, content: 'Hello!' }, (res) => {
  if (!res.success) return console.error(res.error);
  // res.data contains the created message payload
});

socket.on('message:new', (payload) => {
  // Update UI when any user sends a message
});
```

### 6) Delete message (REST)

```http
DELETE /messages/{messageId}
Authorization: Bearer {accessToken}
```

Client receives:

```javascript
socket.on('message:deleted', ({ messageId, channelId }) => {
  // Remove message from UI
});
```

---

## Error Codes

| Code | HTTP Equivalent | Description |
|------|-----------------|-------------|
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Permission denied |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 422 | Invalid input |
| `INTERNAL_ERROR` | 500 | Server error |
