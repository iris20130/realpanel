'use client'

import { useEffect, useState } from 'react'
import { ConfettiBurst } from './ConfettiBurst'

export const CELEBRATE_EVENT = 'nav-celebrate'

export function celebrate() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(CELEBRATE_EVENT))
}

export function CelebrationLayer() {
  const [burstKey, setBurstKey] = useState(0)

  useEffect(() => {
    const handler = () => setBurstKey((key) => key + 1)
    window.addEventListener(CELEBRATE_EVENT, handler)
    return () => window.removeEventListener(CELEBRATE_EVENT, handler)
  }, [])

  if (!burstKey) return null

  return <ConfettiBurst key={burstKey} onDone={() => setBurstKey(0)} />
}
