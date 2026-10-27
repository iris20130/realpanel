'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { Branding } from '@/types'

const FALLBACK: Branding = {
  mode: 'logo',
  logoUrl: '/brand/realpanel.svg',
  text: 'realpanel 导航面板',
  faviconUrl: '/favicon.svg',
}

export function useBranding(): Branding {
  const [branding, setBranding] = useState<Branding>(FALLBACK)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      api
        .getBranding()
        .then((value) => {
          if (!cancelled) setBranding(value)
        })
        .catch(() => undefined)
    }

    load()
    window.addEventListener('branding-updated', load)
    return () => {
      cancelled = true
      window.removeEventListener('branding-updated', load)
    }
  }, [])

  return branding
}
