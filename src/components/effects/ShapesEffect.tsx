'use client'

import { useEffect, useRef } from 'react'

const COLORS = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f7d794']

interface Shape {
  type: 0 | 1 | 2
  x: number
  y: number
  size: number
  vx: number
  vy: number
  rotation: number
  spin: number
  color: string
}

export function ShapesEffect({ dark }: { dark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = 0
    let height = 0
    let raf = 0
    let shapes: Shape[] = []
    const alpha = dark ? 0.22 : 0.14

    const build = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const count = width < 768 ? 10 : 18
      shapes = Array.from({ length: count }, () => ({
        type: Math.floor(Math.random() * 3) as 0 | 1 | 2,
        x: Math.random() * width,
        y: Math.random() * height,
        size: 24 + Math.random() * 76,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.006,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      }))
    }

    const drawShape = (shape: Shape) => {
      const half = shape.size / 2
      ctx.save()
      ctx.translate(shape.x, shape.y)
      ctx.rotate(shape.rotation)
      ctx.globalAlpha = alpha
      ctx.fillStyle = shape.color
      ctx.beginPath()
      if (shape.type === 0) {
        ctx.rect(-half, -half, shape.size, shape.size)
      } else if (shape.type === 1) {
        ctx.arc(0, 0, half, 0, Math.PI * 2)
      } else {
        ctx.moveTo(0, -half)
        ctx.lineTo(half, half)
        ctx.lineTo(-half, half)
        ctx.closePath()
      }
      ctx.fill()
      ctx.restore()
    }

    const tick = () => {
      ctx.clearRect(0, 0, width, height)
      for (const shape of shapes) {
        shape.x += shape.vx
        shape.y += shape.vy
        shape.rotation += shape.spin

        const margin = shape.size
        if (shape.x < -margin) shape.x = width + margin
        if (shape.x > width + margin) shape.x = -margin
        if (shape.y < -margin) shape.y = height + margin
        if (shape.y > height + margin) shape.y = -margin

        drawShape(shape)
      }
      raf = requestAnimationFrame(tick)
    }

    build()
    raf = requestAnimationFrame(tick)
    window.addEventListener('resize', build)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', build)
    }
  }, [dark])

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} data-effect="shapes" aria-hidden>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  )
}
