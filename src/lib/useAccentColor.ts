'use client'

import { useEffect } from 'react'
import { usePrefsStore } from '@/stores/prefs'

const PROPS = [
  '--color-primary',
  '--color-primary-hover',
  '--shadow-glow',
  '--particle-color',
  '--glow-color-1',
  '--glow-color-2',
]

function parseHex(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(clean)) return null
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ]
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`
}

export function darken(hex: string, factor = 0.85): string {
  const rgb = parseHex(hex)
  return rgb ? toHex(rgb.map((v) => v * factor) as [number, number, number]) : hex
}

function rgba(hex: string, alpha: number): string {
  const rgb = parseHex(hex)
  return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})` : hex
}

// 侧边栏配色同时作为面板主色调：改写主题变量，切回默认时移除
export function useAccentColor() {
  const color = usePrefsStore((state) => state.sidebarColor)

  useEffect(() => {
    const root = document.documentElement
    const clear = () => PROPS.forEach((prop) => root.style.removeProperty(prop))
    if (!color) {
      clear()
      return
    }
    const hover = darken(color)
    root.style.setProperty('--color-primary', color)
    root.style.setProperty('--color-primary-hover', hover)
    root.style.setProperty('--shadow-glow', `0 0 20px ${rgba(color, 0.35)}`)
    root.style.setProperty('--particle-color', color)
    root.style.setProperty('--glow-color-1', hover)
    root.style.setProperty('--glow-color-2', color)
    return clear
  }, [color])
}

// 侧边栏底板：有色时给默认面板底色混入该色，无色时沿用主题默认
export function sidebarSurface(color: string): string | undefined {
  return color ? `color-mix(in srgb, ${color} 16%, var(--color-elevated))` : undefined
}
