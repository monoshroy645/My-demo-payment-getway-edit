# bkash-loan-app

A loan application platform (Nagad/bKash-style) built with React + Express + Firebase Firestore. Originally created in Google AI Studio.

## Stack

- **Frontend**: React 19 + TypeScript + Vite (port 5000)
- **Backend**: Express 5 (port 3000) — API + PostgreSQL sync
- **Database**: Replit PostgreSQL (tables: `sessions`, `blocked_ips`, `settings`)
- **Styling**: Tailwind CSS (CDN), Lucide React icons, Motion animations

## How to run

The workflow `Start application` runs both servers together:

```
node server.cjs & npx vite
```

- Vite dev server starts on **port 5000** (preview pane)
- Express API server starts on **port 3000**
- Vite proxies `/api/*` requests to Express

## Project structure

- `server.cjs` — Express server (API routes + Firestore listeners)
- `src/` — React frontend source
- `App.tsx` / `components/` — UI components
- `data/` — Local data files
- `firebase-applet-config.json` — Firebase project config (committed)
- `dist/public/` — Production build output (served by Express when present)

## User preferences

- Keep the existing project structure and stack.
