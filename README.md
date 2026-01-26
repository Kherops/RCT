# RTC - Real Time Chat Application

A Discord-like minimalist real-time chat application built with modern web technologies.

## Features

- **User Authentication**: JWT-based authentication with access and refresh tokens
- **Servers (Guilds)**: Create, join, and manage servers with invite codes
- **Channels**: Text channels within servers
- **Real-time Messaging**: Instant message delivery via WebSocket
- **Typing Indicators**: See when others are typing
- **Online Presence**: Track who's online in your servers
- **Role-based Permissions**: Owner, Admin, and Member roles with different capabilities

## Tech Stack

### Backend
- **Node.js** + **Express.js** - REST API server
- **Socket.IO** - Real-time WebSocket communication
- **MongoDB** - Database
- **MongoDB Node Driver** - Database client
- **JWT** - Authentication (access + refresh tokens)
- **Argon2** - Password hashing
- **Zod** - Request validation

### Frontend
- **Next.js 14** - React framework with App Router
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **Socket.IO Client** - Real-time communication
- **Lucide React** - Icons

## Project Structure

```
rtc-app/
├── apps/
│   ├── server/           # Express.js backend
│   │   └── src/
│   │       ├── config/       # Environment configuration
│   │       ├── domain/       # Types, policies, errors
│   │       ├── http/         # Routes and schemas
│   │       ├── middlewares/  # Auth, validation, error handling
│   │       ├── repositories/ # Database access layer
│   │       ├── services/     # Business logic
│   │       ├── socket/       # Socket.IO handlers
│   │       └── tests/        # Jest tests
│   └── web/              # Next.js frontend
│       └── src/
│           ├── app/          # Next.js pages
│           ├── components/   # React components
│           ├── lib/          # API client, socket, utilities
│           └── store/        # Zustand stores
├── docs/
│   └── SOCKET_SPECIFICATION.md  # WebSocket API documentation
├── docker-compose.yml    # MongoDB setup (optional)
└── package.json          # Monorepo root
```

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Docker and Docker Compose (optional for local MongoDB)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd rtc-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start MongoDB (optional if using local Docker)**
   ```bash
   docker-compose up -d
   ```

4. **Configure environment**
   ```bash
   cp apps/server/.env.example apps/server/.env
   # Edit .env with your settings
   ```

5. **Start development servers**
   ```bash
   # Terminal 1 - Backend
   npm run dev -w @rtc/server

   # Terminal 2 - Frontend
   npm run dev -w @rtc/web
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - WebSocket: ws://localhost:3001/ws

## Environment Variables

### Server (.env)

```env
DATABASE_URL="mongodb://localhost:27017/rtc_db"
MONGODB_DB="rtc_db"
JWT_ACCESS_SECRET="your-access-secret-min-32-chars"
JWT_REFRESH_SECRET="your-refresh-secret-min-32-chars"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
PORT=3001
CORS_ORIGIN="http://localhost:3000"
```

Notes:
- If your `DATABASE_URL` has no database name in the path (e.g. Atlas), set `MONGODB_DB`.
- Collections and indexes are created automatically on first connection.

## API Endpoints

### Authentication
- `POST /auth/signup` - Register new user
- `POST /auth/login` - Login
- `POST /auth/logout` - Logout (revoke refresh token)
- `POST /auth/refresh` - Refresh access token
- `GET /auth/me` - Get current user

### Servers
- `GET /servers` - List user's servers
- `POST /servers` - Create server
- `GET /servers/:id` - Get server details
- `PUT /servers/:id` - Update server
- `DELETE /servers/:id` - Delete server
- `POST /servers/:id/join` - Join server with invite code
- `DELETE /servers/:id/leave` - Leave server
- `GET /servers/:id/members` - List members
- `PUT /servers/:id/members/:userId` - Update member role
- `DELETE /servers/:id/members/:userId` - Kick member
- `POST /servers/:id/transfer` - Transfer ownership
- `POST /servers/:id/invites` - Create new invite

### Channels
- `GET /servers/:serverId/channels` - List channels
- `POST /servers/:serverId/channels` - Create channel
- `GET /channels/:id` - Get channel
- `PUT /channels/:id` - Update channel
- `DELETE /channels/:id` - Delete channel

### Messages
- `GET /channels/:channelId/messages` - Get messages (paginated)
- `POST /channels/:channelId/messages` - Send message
- `DELETE /messages/:id` - Delete message

## WebSocket Events

See [SOCKET_SPECIFICATION.md](./docs/SOCKET_SPECIFICATION.md) for detailed WebSocket documentation.

### Client → Server
- `join:server` / `leave:server`
- `join:channel` / `leave:channel`
- `message:send`
- `typing:start` / `typing:stop`

### Server → Client
- `message:new` / `message:deleted`
- `user:joined` / `user:left`
- `user:online` / `user:offline`
- `typing:start` / `typing:stop`
- `channel:created` / `channel:updated` / `channel:deleted`
- `member:role_updated`
- `server:updated`

## Role Permissions

| Action | Owner | Admin | Member |
|--------|-------|-------|--------|
| Update server | ✅ | ✅ | ❌ |
| Delete server | ✅ | ❌ | ❌ |
| Create channel | ✅ | ✅ | ❌ |
| Update channel | ✅ | ✅ | ❌ |
| Delete channel | ✅ | ✅ | ❌ |
| Kick member | ✅ | ✅* | ❌ |
| Update roles | ✅ | ❌ | ❌ |
| Send message | ✅ | ✅ | ✅ |
| Delete any message | ✅ | ✅ | ❌ |
| Delete own message | ✅ | ✅ | ✅ |

*Admins can only kick Members, not other Admins or the Owner.

## Testing

```bash
# Run all tests
npm test -w @rtc/server

# Run with coverage
npm run test:coverage -w @rtc/server
```

## License

MIT
