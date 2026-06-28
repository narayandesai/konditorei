# Konditorei — Design Spec

**Date:** 2026-06-27  
**Status:** Approved

## Overview

Konditorei is a fully local web application for composing music with [Strudel](https://strudel.cc). It provides a focused code editor, explicit version saving with diff/revert, and multi-user support — all running offline with no internet dependency.

---

## Architecture

A single Node.js process runs Express with Vite as middleware. In development, one command (`npm run dev`) starts everything on a single port. In production, `npm run build` compiles the React frontend into `dist/` and Express serves it statically.

Strudel is installed as npm packages (`@strudel/core`, `@strudel/webaudio`, etc.) and bundled by Vite — no CDN or internet dependency at runtime.

```
konditorei/
├── server/
│   ├── index.ts          # Express app, mounts Vite middleware in dev
│   ├── routes/           # API route handlers (users, songs, versions)
│   └── db.ts             # SQLite setup via node:sqlite (Node.js 24 built-in)
├── src/                  # React/Vite frontend
│   ├── main.tsx
│   ├── components/
│   └── lib/strudel.ts    # Strudel bootstrap
└── vite.config.ts
```

**Tech stack:** Node.js 24, Express, node:sqlite (built-in), React, Vite, TypeScript.

---

## Data Model

SQLite database with three tables:

```sql
users (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL
)

songs (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL
)

versions (
  id         INTEGER PRIMARY KEY,
  song_id    INTEGER NOT NULL REFERENCES songs(id),
  number     INTEGER NOT NULL,   -- v1, v2, v3... per song
  code       TEXT NOT NULL,
  created_at INTEGER NOT NULL
)
```

The editor always displays the latest version's code. Saving creates a new version row with an incremented number. Reverting creates a new version whose code is copied from the target version — history is append-only, nothing is deleted.

---

## UI

### Layout

Full-screen editor with a slim top bar. No persistent sidebar.

### Top Bar (left to right)

- **App name** — static label "KONDITOREI"
- **User switcher** — dropdown to switch active user; active user stored in localStorage
- **Song selector** — dropdown listing the active user's songs; option to create a new song
- **Version badge** — shows current version number and save time; click opens version history modal
- *(right-aligned)* **Visualizer picker** — dropdown to select the active Strudel visualizer (none, pianoroll, scope, spiral); resets to "none" on page load
- *(right-aligned)* **Save Version button** — explicitly saves current editor state as a new version
- *(right-aligned)* **Play / Stop toggle** — start and stop Strudel playback

### Editor

Full-screen CodeMirror editor below the top bar. Features:
- JavaScript syntax highlighting (Strudel is JavaScript-based)
- Active pattern location highlighting via `@strudel/codemirror` — the code fragment driving the current beat lights up during playback
- Inline error display for eval and scheduler errors

### Visualizer

When a visualizer is selected, a 160px panel appears below the editor; the editor shrinks to share vertical space. When set to "none" the panel is hidden and the editor takes full height.

- **Scope** — live waveform drawn on a canvas using superdough's built-in analyser node; shows a flat line when silent
- **Piano Roll / Spiral** — not yet implemented; panel renders a placeholder label

### Version History Modal

Opens when clicking the version badge. Contains:
- **Version list** (left panel) — v1, v2, v3... with timestamps; click to select
- **Diff view** (right panel) — line-level diff between the selected version and the one before it
- **Revert button** — creates a new version whose code matches the selected version

### Song Management

Songs are a flat list scoped to the active user. The song selector dropdown lists all songs plus a "+ New Song" option at the bottom — clicking it prompts for a name, creates the song, and switches to it. Each song row in the dropdown has two icon buttons: ✎ to rename (prompts for new name) and ✕ to delete (confirms before deleting).

---

## API

All endpoints served by Express under `/api`:

```
# Users
GET    /api/users                         list all users
POST   /api/users                         create user { name }

# Songs
GET    /api/songs?userId=                 list songs for a user
POST   /api/songs                         create song { userId, name }
PATCH  /api/songs/:id                     rename song { name }
DELETE /api/songs/:id                     delete song and all its versions (404 if not found)

# Versions
GET    /api/songs/:id/versions            list all versions (id, song_id, number, created_at; no code)
GET    /api/songs/:id/versions/:v         get a single version including code
POST   /api/songs/:id/versions            save new version { code } (404 if song not found)
GET    /api/songs/:id/versions/:v/diff    line-level diff between v-1 and v
POST   /api/songs/:id/revert/:v           create new version copied from version v
```

Diffs are computed server-side using an LCS (longest common subsequence) diff over code lines. No external diff library required.

---

## Out of Scope

- Authentication / passwords (users are a simple name-based switcher)
- Collaboration or sync between machines
- Audio export
- Song sharing
