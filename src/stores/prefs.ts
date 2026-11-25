import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Network } from '@/types'

export type ViewMode = 'grid' | 'compact'
export type LayoutMode = 'top' | 'sidebar'

export interface RecentEntry {
  siteId: string
  groupId: string
  title: string
  network: Network
  url: string
  at: number
}

interface UsageStat {
  count: number
  lastAt: number
}

interface PrefsState {
  viewMode: ViewMode
  layoutMode: LayoutMode
  sidebarCategoryId: string
  sidebarColor: string
  wallpaperUrl: string
  autoSort: boolean
  searchEngineId: string
  customEngineName: string
  customEnginePrefix: string
  showRecent: boolean
  recentLimit: number
  recentIconSize: number
  recentFontSize: number
  recentFontColor: string
  usage: Record<string, UsageStat>
  recent: RecentEntry[]
  setViewMode: (mode: ViewMode) => void
  setLayoutMode: (mode: LayoutMode) => void
  setSidebarCategoryId: (id: string) => void
  setSidebarColor: (color: string) => void
  setWallpaperUrl: (url: string) => void
  setAutoSort: (value: boolean) => void
  setSearchEngine: (id: string) => void
  setCustomEngine: (name: string, prefix: string) => void
  setShowRecent: (value: boolean) => void
  setRecentLimit: (value: number) => void
  setRecentIconSize: (value: number) => void
  setRecentFontSize: (value: number) => void
  setRecentFontColor: (value: string) => void
  recordUse: (entry: Omit<RecentEntry, 'at'>) => void
  clearUsage: () => void
}

const MAX_RECENT = 30

// 全部为浏览器本地偏好：游客也会保存在自己的浏览器里
export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      viewMode: 'grid',
      layoutMode: 'top',
      sidebarCategoryId: 'all',
      sidebarColor: '',
      wallpaperUrl: '',
      autoSort: false,
      searchEngineId: 'baidu',
      customEngineName: '',
      customEnginePrefix: '',
      showRecent: true,
      recentLimit: 8,
      recentIconSize: 16,
      recentFontSize: 12,
      recentFontColor: '',
      usage: {},
      recent: [],

      setViewMode: (viewMode) => set({ viewMode }),
      setLayoutMode: (layoutMode) => set({ layoutMode }),
      setSidebarCategoryId: (sidebarCategoryId) => set({ sidebarCategoryId }),
      setSidebarColor: (sidebarColor) => set({ sidebarColor }),
      setWallpaperUrl: (wallpaperUrl) => set({ wallpaperUrl }),
      setAutoSort: (autoSort) => set({ autoSort }),
      setSearchEngine: (searchEngineId) => set({ searchEngineId }),
      setCustomEngine: (customEngineName, customEnginePrefix) =>
        set({ customEngineName, customEnginePrefix }),
      setShowRecent: (showRecent) => set({ showRecent }),
      setRecentLimit: (value) => set({ recentLimit: Math.min(20, Math.max(1, Math.round(value))) }),
      setRecentIconSize: (value) =>
        set({ recentIconSize: Math.min(32, Math.max(12, Math.round(value))) }),
      setRecentFontSize: (value) =>
        set({ recentFontSize: Math.min(20, Math.max(10, Math.round(value))) }),
      setRecentFontColor: (recentFontColor) => set({ recentFontColor }),

      recordUse: (entry) =>
        set((state) => {
          const prev = state.usage[entry.siteId]
          return {
            usage: {
              ...state.usage,
              [entry.siteId]: { count: (prev?.count ?? 0) + 1, lastAt: Date.now() },
            },
            recent: [
              { ...entry, at: Date.now() },
              ...state.recent.filter((item) => item.siteId !== entry.siteId),
            ].slice(0, MAX_RECENT),
          }
        }),

      clearUsage: () => set({ usage: {}, recent: [] }),
    }),
    {
      name: 'nav-prefs',
      version: 1,
      partialize: (state) => ({
        viewMode: state.viewMode,
        layoutMode: state.layoutMode,
        sidebarCategoryId: state.sidebarCategoryId,
        sidebarColor: state.sidebarColor,
        wallpaperUrl: state.wallpaperUrl,
        autoSort: state.autoSort,
        searchEngineId: state.searchEngineId,
        customEngineName: state.customEngineName,
        customEnginePrefix: state.customEnginePrefix,
        showRecent: state.showRecent,
        recentLimit: state.recentLimit,
        recentIconSize: state.recentIconSize,
        recentFontSize: state.recentFontSize,
        recentFontColor: state.recentFontColor,
        usage: state.usage,
        recent: state.recent,
      }),
    }
  )
)
