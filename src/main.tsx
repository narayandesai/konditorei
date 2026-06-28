import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'
import { Player } from './components/Player.js'
import './index.css'

const slug = window.location.pathname.match(/^\/p\/([a-z0-9-]+)/)?.[1]

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {slug ? <Player slug={slug} /> : <App />}
  </StrictMode>
)
