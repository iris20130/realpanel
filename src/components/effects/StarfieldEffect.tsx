'use client'

import { useEffect, useRef } from 'react'

export function StarfieldEffect({ dark }: { dark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = 0
    let height = 0
    let raf = 0
    let stars: { x: number; y: number; r: number; phase: number; speed: number }[] = []
    let shooting: { x: number; y: number; vx: number; vy: number; life: number } | null = null
    let nextShoot = performance.now() + 2200

    const build = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const count = Math.max(70, Math.min(220, Math.round((width * height) / 9000)))
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.6 + 0.4,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 1.4 + 0.5,
      }))
    }

    const draw = (now: number) => {
      const t = now / 1000
      ctx.clearRect(0, 0, width, height)

      const glow = ctx.createRadialGradient(
        width * 0.72,
        height * 0.18,
        0,
        width * 0.72,
        height * 0.18,
        Math.max(width, height) * 0.6
      )
      glow.addColorStop(0, dark ? 'rgba(99,102,241,0.16)' : 'rgba(139,92,246,0.10)')
      glow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, width, height)

      for (const star of stars) {
        const alpha =
          (dark ? 0.3 : 0.18) +
          (dark ? 0.6 : 0.4) * (0.5 + 0.5 * Math.sin(t * star.speed + star.phase))
        const x = star.x + Math.sin(t * 0.06 + star.phase) * 6
        ctx.beginPath()
        ctx.fillStyle = dark ? `rgba(214,222,255,${alpha})` : `rgba(99,102,241,${alpha})`
        ctx.arc(x, star.y, star.r, 0, Math.PI * 2)
        ctx.fill()
      }

      if (!shooting && now > nextShoot) {
        const startX = width * (0.15 + Math.random() * 0.7)
        shooting = {
          x: startX,
          y: height * (0.05 + Math.random() * 0.25),
          vx: 7 + Math.random() * 5,
          vy: 3 + Math.random() * 3,
          life: 0,
        }
      }

      if (shooting) {
        const s = shooting
        const gradient = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 10, s.y - s.vy * 10)
        gradient.addColorStop(0, dark ? 'rgba(255,255,255,0.9)' : 'rgba(99,102,241,0.75)')
        gradient.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.strokeStyle = gradient
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.moveTo(s.x, s.y)
        ctx.lineTo(s.x - s.vx * 10, s.y - s.vy * 10)
        ctx.stroke()

        s.x += s.vx
        s.y += s.vy
        s.life += 1
        if (s.life > 90 || s.x > width + 120 || s.y > height + 120) {
          shooting = null
          nextShoot = now + 5000 + Math.random() * 6000
        }
      }

      raf = requestAnimationFrame(draw)
    }

    build()
    raf = requestAnimationFrame(draw)
    window.addEventListener('resize', build)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', build)
    }
  }, [dark])

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} data-effect="starfield" aria-hidden>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  )
}
