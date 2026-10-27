import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { NetworkMode } from '@/types'

interface SettingsState {
  networkMode: NetworkMode
  setNetworkMode: (mode: NetworkMode) => void
  cycleNetworkMode: () => void
}

const modeCycle: NetworkMode[] = ['auto', 'intranet', 'internet']

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      networkMode: 'auto',
      setNetworkMode: (mode) => set({ networkMode: mode }),
      cycleNetworkMode: () => {
        const current = get().networkMode
        const next = modeCycle[(modeCycle.indexOf(current) + 1) % modeCycle.length]
        set({ networkMode: next })
      },
    }),
    {
      name: 'nav-settings',
      partialize: (state) => ({ networkMode: state.networkMode }),
    }
  )
)
