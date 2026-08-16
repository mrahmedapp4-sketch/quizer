# Mr. Ahmed's Live Quiz

A real-time, interactive quiz application designed for classroom use. Teachers host live quizzes, students join and answer questions, and everyone can see scores in real-time.

## Tech Stack

- **Frontend**: React 18 + TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, TanStack Query, Wouter
- **Backend**: Express 5 + Node.js, WebSockets (ws), Passport.js (Google OAuth)
- **Build Tool**: Vite (frontend dev server integrated into Express)
- **Package Manager**: npm
- **Language**: TypeScript (both client and server)
- **Storage**: File-backed student accounts and points in `/data/students.json`, plus JSON session counters
- **ORM**: Drizzle ORM (configured for PostgreSQL but defaults to memory/file storage)

## Project Structure

```
/client       - React frontend (src/components, src/pages, src/hooks)
/server       - Express backend (index.ts, routes.ts, storage.ts, vite.ts)
/shared       - Shared TypeScript types and Zod schemas
/data         - Local JSON storage (counters.json, emails.json)
/script       - Build scripts
/attached_assets - Static assets
```

## Running the App

In development, Express serves everything on port 5000 — including the Vite dev server (integrated via `server/vite.ts`). There is no separate frontend server.

```bash
npm run dev    # starts Express + Vite on port 5000
npm run build  # builds frontend to dist/public, compiles server to dist/
npm start      # runs production build
```

## Workflow

- **Start application**: `npm run dev` → port 5000 (webview)

## Deployment

- **Target**: VM (always-running, needed for WebSocket support and in-memory state)
- **Build**: `npm run build`
- **Run**: `node dist/index.js`

### Railway

- **Build**: `npm install && npm run build` (Railway/Nixpacks detects this from `package.json`)
- **Start**: `node dist/index.js`
- **Health check**: `/api/health`
- **Required variable**: `SESSION_SECRET`
- **Optional variables**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL`

## Key Features

- Real-time quiz state via WebSockets
- Student/Teacher/Host roles with dedicated views
- Arabic UI localization
- Gamification: streaks, sound effects, leaderboard
- Google OAuth login for students
- Session management with memorystore

## Notes

- The app uses in-memory storage (not a real database) for quiz state
- Student accounts, grades, and points persist across restarts in `data/students.json`. A signed HttpOnly browser cookie keeps each device signed in for 30 days.
- Google OAuth requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars (optional for basic use)
- `SESSION_SECRET` env var should be set in production
