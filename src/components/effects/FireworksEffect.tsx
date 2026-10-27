'use client'

import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  hue: number
  size: number
}

interface Rocket {
  x: number
  y: number
  tx: number
  ty: number
  speed: number
  hue: number
  prevX: number
  prevY: number
}

const random = (min: number, max: number) => Math.random() * (max - min) + min

export function FireworksEffect({ dark }: { dark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = 0
    let height = 0
    let raf = 0
    let last = performance.now()
    let nextLaunch = last + 400
    let hue = random(0, 360)
    const rockets: Rocket[] = []
    let particles: Particle[] = []

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const launch = () => {
      rockets.push({
        x: width * random(0.35, 0.65),
        y: height + 10,
        tx: width * random(0.12, 0.88),
        ty: height * random(0.12, 0.5),
        speed: random(6, 9),
        hue: (hue + random(-20, 20) + 360) % 360,
        prevX: width * 0.5,
        prevY: height,
      })
    }

    const explode = (rocket: Rocket) => {
      const count = Math.round(random(32, 46))
      for (let i = 0; i < count; i++) {
        const angle = random(0, Math.PI * 2)
        const speed = random(1.4, 6.5)
        particles.push({
          x: rocket.tx,
          y: rocket.ty,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          maxLife: random(0.55, 1),
          hue: (rocket.hue + random(-18, 18) + 360) % 360,
          size: random(1.2, 2.8),
        })
      }
    }

    const frame = (now: number) => {
      const dt = Math.min(2.5, (now - last) / 16.667)
      last = now
      hue = (hue + 0.35 * dt) % 360

      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = `rgba(0,0,0,${dark ? 0.16 : 0.1})`
      ctx.fillRect(0, 0, width, height)

      ctx.globalCompositeOperation = 'lighter'

      for (let i = rockets.length - 1; i >= 0; i--) {
        const rocket = rockets[i]
        rocket.prevX = rocket.x
        rocket.prevY = rocket.y
        const dx = rocket.tx - rocket.x
        const dy = rocket.ty - rocket.y
        const dist = Math.hypot(dx, dy)
        if (dist < rocket.speed + 4) {
          explode(rocket)
          rockets.splice(i, 1)
          continue
        }
        rocket.x += (dx / dist) * rocket.speed * dt
        rocket.y += (dy / dist) * rocket.speed * dt
        ctx.strokeStyle = `hsla(${rocket.hue}, 100%, 72%, 0.9)`
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.moveTo(rocket.prevX, rocket.prevY)
        ctx.lineTo(rocket.x, rocket.y)
        ctx.stroke()
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.vx *= Math.pow(0.985, dt)
        p.vy = p.vy * Math.pow(0.985, dt) + 0.05 * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.life -= 0.012 * dt

        if (p.life <= 0) {
          particles.splice(i, 1)
          continue
        }

        ctx.beginPath()
        ctx.fillStyle = `hsla(${p.hue}, 100%, ${dark ? 68 : 56}%, ${p.life})`
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2)
        ctx.fill()
      }

      if (particles.length > 900) particles = particles.slice(-900)

      if (now > nextLaunch && rockets.length < 2) {
        launch()
        nextLaunch = now + random(900, 1700)
      }

      raf = requestAnimationFrame(frame)
    }

    resize()
    launch()
    raf = requestAnimationFrame(frame)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [dark])

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} data-effect="fireworks" aria-hidden>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  )
}
