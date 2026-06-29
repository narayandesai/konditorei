import { DatabaseSync } from 'node:sqlite'

export function createDb(filename = process.env.DB_FILE ?? 'konditorei.db') {
  const db = new DatabaseSync(filename)
  db.exec('PRAGMA foreign_keys = ON;')
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
      number INTEGER NOT NULL,
      code TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS publications (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id    INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
      version_id INTEGER NOT NULL REFERENCES versions(id) ON DELETE RESTRICT,
      slug       TEXT NOT NULL UNIQUE,
      show_code  INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_publications_song_id ON publications(song_id);
    CREATE INDEX IF NOT EXISTS idx_publications_version_id ON publications(version_id);

    CREATE TABLE IF NOT EXISTS tutorials (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      description TEXT NOT NULL,
      source      TEXT NOT NULL DEFAULT 'uploaded',
      step_count  INTEGER NOT NULL,
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tutorial_steps (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      tutorial_id TEXT NOT NULL REFERENCES tutorials(id) ON DELETE CASCADE,
      position    INTEGER NOT NULL,
      title       TEXT NOT NULL,
      content     TEXT NOT NULL,
      code        TEXT,
      fitness     TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tutorial_steps_tutorial_id ON tutorial_steps(tutorial_id);
  `)
  return db
}

export type Db = ReturnType<typeof createDb>
