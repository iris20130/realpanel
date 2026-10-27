'use client'

import { useEffect, useState } from 'react'
import { ThreeBackground } from '@/components/three/ThreeBackground'
import { StarfieldEffect } from './StarfieldEffect'
import { ShapesEffect } from './ShapesEffect'
import { FireworksEffect } from './FireworksEffect'
import { useAuthStore } from '@/stores/auth'
import { useEffectStore } from '@/stores/effect'
import { useResolvedTheme } from '@/lib/useResolvedTheme'
import { randomEffectId, type EffectId } from '@/lib/effects'

// 同一次页面会话内保持同一效果，整页刷新才会重新随机
let sessionEffectId: EffectId | null = null

export function BackgroundEffect() {
  const userId = useAuthStore((state) => state.user?.id)
  const mode = useEffectStore((state) => state.mode)
  const fixedId = useEffectStore((state) => state.fixedId)
  const theme = useResolvedTheme()
  const [effectId, setEffectId] = useState<EffectId | null>(null)

  useEffect(() => {
    if (userId && mode === 'fixed') {
      sessionEffectId = fixedId
      setEffectId(fixedId)
    } else {
      sessionEffectId = randomEffectId(sessionEffectId)
      setEffectId(sessionEffectId)
    }
  }, [userId, mode, fixedId])

  if (!effectId) return null

  const dark = theme === 'dark'

  if (effectId === 'nebula') return <ThreeBackground />
  if (effectId === 'starfield') return <StarfieldEffect dark={dark} />
  if (effectId === 'shapes') return <ShapesEffect dark={dark} />
  return <FireworksEffect dark={dark} />
}
