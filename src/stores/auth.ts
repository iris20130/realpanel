import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PublicUser } from '@/types'

interface AuthState {
  token: string | null
  user: PublicUser | null
  isLoggedIn: boolean
  login: (token: string, user: PublicUser) => void
  setUser: (user: PublicUser) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isLoggedIn: false,
      login: (token, user) => set({ token, user, isLoggedIn: true }),
      setUser: (user) => set({ user, isLoggedIn: true }),
      logout: () => set({ token: null, user: null, isLoggedIn: false }),
    }),
    {
      name: 'nav-auth',
    }
  )
)
