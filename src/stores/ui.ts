import { create } from 'zustand'
import type { PublicUser } from '@/types'

interface UiState {
  editing: boolean
  viewOnly: boolean
  viewingUser: PublicUser | null
  setEditing: (editing: boolean) => void
  setViewOnly: (viewOnly: boolean) => void
  setViewingUser: (user: PublicUser | null) => void
  reset: () => void
}

export const useUiStore = create<UiState>((set) => ({
  editing: false,
  viewOnly: false,
  viewingUser: null,
  setEditing: (editing) => set({ editing }),
  setViewOnly: (viewOnly) => set({ viewOnly, editing: false }),
  setViewingUser: (viewingUser) => set({ viewingUser, editing: false }),
  reset: () => set({ editing: false, viewOnly: false, viewingUser: null }),
}))
