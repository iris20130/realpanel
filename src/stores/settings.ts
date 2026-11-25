import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { NetworkMode } from '@/types'

// 基础网络模式（不含「全部显示」，全部显示单独记忆）
export type BaseNetworkMode = Exclude<NetworkMode, 'all'>

interface SettingsState {
  networkMode: BaseNetworkMode
  allDisplay: boolean
  // 记住上次状态；关闭后每次启动使用默认值
  rememberNetwork: boolean
  networkDefault: BaseNetworkMode
  rememberAllDisplay: boolean
  allDisplayDefault: boolean
  setNetworkMode: (mode: BaseNetworkMode) => void
  cycleNetworkMode: () => void
  setAllDisplay: (value: boolean) => void
  toggleAllDisplay: () => void
  setRememberNetwork: (value: boolean) => void
  setNetworkDefault: (mode: BaseNetworkMode) => void
  setRememberAllDisplay: (value: boolean) => void
  setAllDisplayDefault: (value: boolean) => void
}

const modeCycle: BaseNetworkMode[] = ['auto', 'intranet', 'internet']

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      networkMode: 'auto',
      allDisplay: false,
      rememberNetwork: true,
      networkDefault: 'auto',
      rememberAllDisplay: true,
      allDisplayDefault: false,

      setNetworkMode: (mode) => set({ networkMode: mode }),
      cycleNetworkMode: () => {
        const current = get().networkMode
        const next = modeCycle[(modeCycle.indexOf(current) + 1) % modeCycle.length]
        set({ networkMode: next })
      },
      setAllDisplay: (value) => set({ allDisplay: value }),
      toggleAllDisplay: () => set({ allDisplay: !get().allDisplay }),
      setRememberNetwork: (value) =>
        set(value ? { rememberNetwork: true } : { rememberNetwork: false, networkMode: get().networkDefault }),
      setNetworkDefault: (mode) =>
        set((state) => ({
          networkDefault: mode,
          ...(state.rememberNetwork ? {} : { networkMode: mode }),
        })),
      setRememberAllDisplay: (value) =>
        set(
          value
            ? { rememberAllDisplay: true }
            : { rememberAllDisplay: false, allDisplay: get().allDisplayDefault }
        ),
      setAllDisplayDefault: (value) =>
        set((state) => ({
          allDisplayDefault: value,
          ...(state.rememberAllDisplay ? {} : { allDisplay: value }),
        })),
    }),
    {
      name: 'nav-settings',
      version: 2,
      migrate: (persisted) => {
        const state = (persisted ?? {}) as Record<string, unknown>
        // 旧版把「全部显示」存在 networkMode 里，拆成独立开关
        if (state.networkMode === 'all') {
          state.networkMode = 'auto'
          state.allDisplay = true
        }
        return state as Pick<
          SettingsState,
          | 'networkMode'
          | 'allDisplay'
          | 'rememberNetwork'
          | 'networkDefault'
          | 'rememberAllDisplay'
          | 'allDisplayDefault'
        >
      },
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<SettingsState>) }
        if (!merged.rememberNetwork) merged.networkMode = merged.networkDefault
        if (!merged.rememberAllDisplay) merged.allDisplay = merged.allDisplayDefault
        return merged
      },
      partialize: (state) => ({
        networkMode: state.networkMode,
        allDisplay: state.allDisplay,
        rememberNetwork: state.rememberNetwork,
        networkDefault: state.networkDefault,
        rememberAllDisplay: state.rememberAllDisplay,
        allDisplayDefault: state.allDisplayDefault,
      }),
    }
  )
)
