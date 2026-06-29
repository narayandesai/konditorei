// server/app.ts
import express from 'express'
import type { Db } from './db.js'
import { usersRouter } from './routes/users.js'
import { songsRouter } from './routes/songs.js'
import { versionsRouter } from './routes/versions.js'
import { songPublicationsRouter, publicationsMutationRouter, publicPlayerRouter } from './routes/publications.js'
import { tutorialsRouter } from './routes/tutorials.js'

export function createApp(db: Db, tutorialsDir?: string) {
  const app = express()
  app.use(express.json())
  app.use('/api/users', usersRouter(db))
  app.use('/api/songs', songsRouter(db))
  app.use('/api/songs', versionsRouter(db))
  app.use('/api/songs', songPublicationsRouter(db))
  app.use('/api/publications', publicationsMutationRouter(db))
  app.use('/api', publicPlayerRouter(db))
  app.use('/api/tutorials', tutorialsRouter(db, tutorialsDir))
  return app
}
