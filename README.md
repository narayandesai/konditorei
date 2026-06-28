# Konditorei

A live-coding environment for making music with [Strudel](https://strudel.cc). Write pattern code in the editor, hit Play, and hear it immediately through WebAudio. Songs are versioned so you can save snapshots, compare diffs, and revert.

## Features

- **Live coding** — evaluate Strudel patterns in real-time with WebAudio
- **Song management** — create, rename, and delete songs per user
- **Version history** — save snapshots of your code, view line-by-line diffs, and revert to any previous version
- **Oscilloscope** — real-time waveform visualizer while playing
- **Multi-user** — switch between users; each user has their own song library

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, CodeMirror 6, Strudel (`@strudel/webaudio`) |
| Backend | Express, Node.js built-in SQLite (`node:sqlite`) |
| Build | Vite (dev middleware in dev, `sirv` in production) |
| Language | TypeScript throughout |
| Tests | Vitest + Supertest |

## Getting started

Requires Node.js 22.5+ (uses the built-in `node:sqlite` module).

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The SQLite database (`konditorei.db`) is created automatically on first run.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start server with Vite dev middleware (HMR) |
| `npm run build` | Build the React app to `dist/` |
| `npm start` | Serve the built `dist/` in production mode |
| `npm test` | Run the test suite (Vitest) |

## Project layout

```
server/
  index.ts          entry point — starts Express + Vite (dev) or sirv (prod)
  app.ts            Express app factory
  db.ts             SQLite setup and schema
  diff.ts           line-by-line diff utility
  routes/
    users.ts        GET/POST /api/users
    songs.ts        GET/POST/PATCH/DELETE /api/songs
    versions.ts     GET/POST /api/songs/:songId/versions and revert/diff

src/
  App.tsx           root component and state wiring
  components/
    TopBar.tsx      user switcher, song selector, play/stop, version badge
    Editor.tsx      CodeMirror editor with Strudel highlighting
    VersionModal.tsx version history sidebar and diff viewer
    Visualizer.tsx  oscilloscope canvas
  hooks/
    useActiveUser.ts persisted user selection
    useSongs.ts     song list and active song
    useVersions.ts  version list, save, and revert
  lib/
    api.ts          typed fetch client for the REST API
    strudel.ts      thin wrapper around @strudel/webaudio repl
```

## API

All endpoints return JSON. `songId` and version numbers must be positive integers.

### Users
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/users` | — | `User[]` |
| POST | `/api/users` | `{ name }` | `User` (201) |

### Songs
| Method | Path | Body / Query | Response |
|---|---|---|---|
| GET | `/api/songs?userId=` | — | `Song[]` |
| POST | `/api/songs` | `{ userId, name }` | `Song` (201) |
| PATCH | `/api/songs/:id` | `{ name }` | `Song` |
| DELETE | `/api/songs/:id` | — | 204 |

### Versions
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/songs/:songId/versions` | — | `Version[]` |
| POST | `/api/songs/:songId/versions` | `{ code }` | `VersionWithCode` (201) |
| GET | `/api/songs/:songId/versions/:v` | — | `VersionWithCode` |
| GET | `/api/songs/:songId/versions/:v/diff` | — | `DiffLine[]` |
| POST | `/api/songs/:songId/revert/:v` | — | `VersionWithCode` (201) |

Revert creates a new version whose code matches version `v` — it never mutates history.

## Data model

```
users       id, name, created_at
songs       id, user_id → users, name, created_at
versions    id, song_id → songs, number, code, created_at
```

Foreign keys cascade on delete (deleting a user removes their songs; deleting a song removes its versions).
