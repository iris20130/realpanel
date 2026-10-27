import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_EFFECT, EFFECTS, type EffectId } from '@/lib/effects'

export type EffectMode = 'random' | 'fixed'

interface EffectState {
  mode: EffectMode
  fixedId: EffectId
  cycleEffect: () => void
}

export const useEffectStore = create<EffectState>()(
  persist(
    (set, get) => ({
      mode: 'random',
      fixedId: DEFAULT_EFFECT,
      cycleEffect: () => {
        const { mode, fixedId } = get()
        if (mode === 'random') {
          set({ mode: 'fixed', fixedId: EFFECTS[0].id })
          return
        }
        const index = EFFECTS.findIndex((effect) => effect.id === fixedId)
        if (index >= EFFECTS.length - 1) {
          set({ mode: 'random' })
        } else {
          set({ mode: 'fixed', fixedId: EFFECTS[index + 1].id })
        }
      },
    }),
    { name: 'nav-effect' }
  )
)
