import { useRef, useEffect } from 'react'
import type { Visualizer as VisualizerType } from './TopBar.js'

interface VisualizerProps {
  type: VisualizerType
  isPlaying: boolean
}

export function Visualizer({ type, isPlaying }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (type === 'none' || !canvasRef.current || !isPlaying) return
    // Strudel draw integration: check @strudel/draw or @strudel/pianoroll
    // for the canvas API once visualizer packages are available.
    // The canvas is wired up here and ready to receive draw callbacks.
  }, [type, isPlaying])

  if (type === 'none') return null

  return (
    <div style={{ height: 200, borderTop: '1px solid var(--border)', background: 'var(--bg-base)', flexShrink: 0, position: 'relative' }}>
      <div style={{ position: 'absolute', top: 8, left: 12, color: 'var(--text-muted)', fontSize: 11 }}>{type}</div>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
