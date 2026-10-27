import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const GUEST_SELECTION_KEY = 'nav-nic-guest'
const GUEST_CUSTOM_KEY = 'nav-nic-guest-custom'

function readSession(key: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function writeSession(key: string, value: string[]) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(key, JSON.stringify(value))
}

interface NicState {
  guest: string[]
  byUser: Record<string, string[]>
  guestCustom: string[]
  customByUser: Record<string, string[]>
  setSelection: (userId: string | null, ips: string[]) => void
  addCustom: (userId: string | null, ip: string) => boolean
  removeCustom: (userId: string | null, ip: string) => void
}

// 登录用户按用户 ID 长期记住；访客只存在当前浏览器会话
export const useNicStore = create<NicState>()(
  persist(
    (set, get) => ({
      guest: [],
      byUser: {},
      guestCustom: [],
      customByUser: {},

      setSelection: (userId, ips) => {
        if (userId) {
          set((state) => ({ byUser: { ...state.byUser, [userId]: ips } }))
          return
        }
        writeSession(GUEST_SELECTION_KEY, ips)
        set({ guest: ips })
      },

      addCustom: (userId, ip) => {
        const value = ip.trim()
        if (!value) return false
        if (userId) {
          const list = get().customByUser[userId] ?? []
          if (list.includes(value)) return false
          set((state) => ({
            customByUser: { ...state.customByUser, [userId]: [...list, value] },
          }))
          return true
        }
        const list = get().guestCustom
        if (list.includes(value)) return false
        const next = [...list, value]
        writeSession(GUEST_CUSTOM_KEY, next)
        set({ guestCustom: next })
        return true
      },

      removeCustom: (userId, ip) => {
        if (userId) {
          const list = get().customByUser[userId] ?? []
          set((state) => ({
            customByUser: { ...state.customByUser, [userId]: list.filter((item) => item !== ip) },
          }))
          return
        }
        const next = get().guestCustom.filter((item) => item !== ip)
        writeSession(GUEST_CUSTOM_KEY, next)
        set({ guestCustom: next })
      },
    }),
    {
      name: 'nav-nic-selection',
      partialize: (state) => ({
        byUser: state.byUser,
        customByUser: state.customByUser,
      }),
    }
  )
)

if (typeof window !== 'undefined') {
  const selection = readSession(GUEST_SELECTION_KEY)
  const custom = readSession(GUEST_CUSTOM_KEY)
  if (selection.length > 0 || custom.length > 0) {
    useNicStore.setState({ guest: selection, guestCustom: custom })
  }
}
