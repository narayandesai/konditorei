import { useRef, useEffect, useLayoutEffect } from 'react'
import type { Visualizer as VisualizerType } from './TopBar.js'

// @ts-ignore — superdough ships no TS declarations
import { getAnalyzerData, analysers } from 'superdough'

interface VisualizerProps {
  type: VisualizerType
  isPlaying: boolean
}

const ACCENT = '#58a6ff'
const DIM = '#484f58'

export function Visualizer({ type, isPlaying }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const sync = () => {
      if (canvas.width !== canvas.offsetWidth) canvas.width = canvas.offsetWidth
      if (canvas.height !== canvas.offsetHeight) canvas.height = canvas.offsetHeight
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [type])

  useEffect(() => {
    const canvas = canvasRef.current
    if (type === 'none' || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function drawScope() {
      if (!canvas || !ctx) return
      // getAnalyzerData populates the Float32Array and returns it.
      // If no sound has played yet, analysers[1] is undefined — draw flat line.
      getAnalyzerData('time', 1)
      const analyser = analysers[1] as AnalyserNode | undefined

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.lineWidth = 2

      if (!analyser) {
        ctx.strokeStyle = DIM
        ctx.beginPath()
        const y = canvas.height / 2
        ctx.moveTo(0, y)
        ctx.lineTo(canvas.width, y)
        ctx.stroke()
      } else {
        const data = new Float32Array(analyser.frequencyBinCount)
        analyser.getFloatTimeDomainData(data)

        ctx.strokeStyle = ACCENT
        ctx.beginPath()
        const sliceWidth = canvas.width / data.length
        let x = 0
        for (let i = 0; i < data.length; i++) {
          const y = (0.5 + data[i] * 0.5) * canvas.height
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
          x += sliceWidth
        }
        ctx.stroke()
      }

      rafRef.current = requestAnimationFrame(drawScope)
    }

    drawScope()
    return () => cancelAnimationFrame(rafRef.current)
  }, [type, isPlaying])

  if (type === 'none') return null

  return (
    <div style={{ height: 160, borderTop: '1px solid var(--border)', background: 'var(--bg-base)', flexShrink: 0, position: 'relative' }}>
      <div style={{ position: 'absolute', top: 6, left: 10, color: 'var(--text-muted)', fontSize: 10, letterSpacing: '0.06em', zIndex: 1 }}>
        {type === 'scope' ? 'SCOPE' : type === 'pianoroll' ? 'PIANO ROLL' : 'SPIRAL'}
      </div>
      {type === 'scope' ? (
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 12 }}>
          {type} — needs @strudel/draw pattern hooks (not yet wired)
        </div>
      )}
    </div>
  )
}
