import { createServer as createViteServer } from 'vite'
import { createDb } from './db.js'
import { createApp } from './app.js'

const PORT = 3000
const isProd = process.env.NODE_ENV === 'production'

async function main() {
  const db = createDb()
  const app = createApp(db)

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
