# RTC Desktop

The desktop app packages the Next.js frontend inside Electron.
The backend stays remote and must already be deployed, for example on Render.

## Environment

Required frontend runtime variable:

```env
NEXT_PUBLIC_API_URL=https://your-render-api.example.com
```

Do not put `DATABASE_URL` or other backend secrets in Electron .

## Development

Run from the repository root:

```bash
NEXT_PUBLIC_API_URL="https://your-render-api.example.com" npm run dev:desktop
```

Electron waits for the local Next dev server on port `3000` and loads it in a desktop window.

## Packaging

### Linux

Run from the repository root:

```bash
NEXT_PUBLIC_API_URL="https://your-render-api.example.com" npm run dist:desktop
```

Output:

- `dist/desktop/RTC Desktop-1.0.0.AppImage`

### Windows

Build from a real Windows path such as `C:\dev\T-DEV-600-NCE_1`.
Do not build from `\\wsl.localhost\...`.

```powershell
npm install
$env:NEXT_PUBLIC_API_URL="https://your-render-api.example.com"
npm run dist:desktop:win
```

Output:

- `dist\desktop\RTC Desktop Setup 1.0.0.exe`
- `dist\desktop\win-unpacked\RTC Desktop.exe`

## Troubleshooting

### `Failed to fetch`

Check:

- `NEXT_PUBLIC_API_URL` points to the deployed backend
- Render is up and `GET /health` responds
- `CORS_ORIGIN` on the backend allows `http://127.0.0.1:3000` and `http://localhost:3000`

Example:

```env
CORS_ORIGIN=http://127.0.0.1:3000,http://localhost:3000
```

### `EADDRINUSE: 127.0.0.1:3000`

Another process is already using port `3000`.
Stop it before launching the desktop app.

### `Cannot find module 'next'`

Rebuild the desktop package after a clean delete of `dist/desktop/win-unpacked`.
