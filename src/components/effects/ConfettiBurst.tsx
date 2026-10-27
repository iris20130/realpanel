'use client'

import { useEffect, useRef } from 'react'

const COLORS = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f7d794', '#f78fb3', '#a29bfe', '#55efc4']

interface Piece {
  x: number
  y: number
  vx: number
  vy: number
  width: number
  height: number
  rotation: number
  spin: number
  color: string
  shape: 'rect' | 'circle'
  delay: number
}

const random = (min: number, max: number) => Math.random() * (max - min) + min

export function ConfettiBurst({ onDone }: { onDone?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const width = window.innerWidth
    const height = window.innerHeight
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const pieces: Piece[] = []

    const spawnBurst = (originX: number, direction: number) => {
      for (let i = 0; i < 70; i++) {
        pieces.push({
          x: originX + random(-30, 30),
          y: height + random(-16, 4),
          vx: direction * random(1.5, 8) + random(-1.5, 1.5),
          vy: random(-19, -11),
          width: random(6, 11),
          height: random(4, 8),
          rotation: random(0, Math.PI * 2),
          spin: random(-0.25, 0.25),
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          shape: Math.random() > 0.3 ? 'rect' : 'circle',
          delay: 0,
        })
      }
    }

    for (let i = 0; i < 55; i++) {
      pieces.push({
        x: random(0, width),
        y: random(-height * 0.4, -10),
        vx: random(-1.2, 1.2),
        vy: random(1.5, 3.8),
        width: random(6, 10),
        height: random(4, 7),
        rotation: random(0, Math.PI * 2),
        spin: random(-0.18, 0.18),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        shape: Math.random() > 0.3 ? 'rect' : 'circle',
        delay: random(0, 900),
      })
    }

    spawnBurst(width * 0.12, 1)
    spawnBurst(width * 0.88, -1)

    const start = performance.now()
    let raf = 0
    let finished = false

    const frame = (now: number) => {
      const elapsed = now - start
      ctx.clearRect(0, 0, width, height)

      for (const piece of pieces) {
        if (elapsed < piece.delay) continue
        const activeTime = elapsed - piece.delay

        piece.vy += 0.34
        piece.vx *= 0.994
        piece.vy *= 0.994
        piece.x += piece.vx + Math.sin((activeTime / 260) + piece.rotation) * 0.6
        piece.y += piece.vy
        piece.rotation += piece.spin

        const fade = Math.max(0, Math.min(1, (elapsed - 2300) / 700))
        ctx.save()
        ctx.globalAlpha = 1 - fade
        ctx.translate(piece.x, piece.y)
        ctx.rotate(piece.rotation)
        ctx.fillStyle = piece.color
        if (piece.shape === 'circle') {
          ctx.beginPath()
          ctx.arc(0, 0, piece.width / 2.4, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height)
        }
        ctx.restore()
      }

      if (elapsed < 3100) {
        raf = requestAnimationFrame(frame)
      } else if (!finished) {
        finished = true
        doneRef.current?.()
      }
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none z-[100]" data-celebration aria-hidden>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  )
}
