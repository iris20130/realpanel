'use client'

import { useEffect, useState } from 'react'
import { useThemeStore } from '@/stores/theme'

export function useResolvedTheme(): 'dark' | 'light' {
  const mode = useThemeStore((state) => state.mode)
  const [resolved, setResolved] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const update = () => {
      const isDark =
        mode === 'dark' ||
        (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      setResolved(isDark ? 'dark' : 'light')
    }

    update()
    if (mode !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [mode])

  return resolved
}
