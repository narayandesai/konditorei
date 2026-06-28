import express from 'express'
import { createServer as createViteServer } from 'vite'
import { createDb } from './db.js'
import { usersRouter } from './routes/users.js'
import { songsRouter } from './routes/songs.js'
import { versionsRouter } from './routes/versions.js'

const PORT = 3000
const isProd = process.env.NODE_ENV === 'production'

async function main() {
  const db = createDb()
  const app = express()
  app.use(express.json())

  app.use('/api/users', usersRouter(db))
  app.use('/api/songs', songsRouter(db))
  app.use('/api/songs', versionsRouter(db))

  if (isProd) {
    const { default: sirv } = await import('sirv')
    app.use(sirv('dist', { single: true }))
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  }

  app.listen(PORT, () => {
    console.log(`Konditorei running at http://localhost:${PORT}`)
  })
}

main()
