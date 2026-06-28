import { DatabaseSync } from 'node:sqlite'

export function createDb(filename = 'konditorei.db') {
  const db = new DatabaseSync(filename)
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
  `)
  db.exec('PRAGMA foreign_keys = ON;')
  return db
}

export type Db = ReturnType<typeof createDb>
