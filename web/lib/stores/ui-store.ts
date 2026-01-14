import { create } from 'zustand'
import type { ViewType } from '@/types'

interface UIState {
  // Selected item for details panel
  selectedItemId: string | null
  setSelectedItemId: (id: string | null) => void

  // Details panel open state
  isDetailsPanelOpen: boolean
  openDetailsPanel: (itemId: string) => void
  closeDetailsPanel: () => void

  // Current view
  currentView: ViewType
  setCurrentView: (view: ViewType) => void

  // Quick add focus state
  isQuickAddFocused: boolean
  setQuickAddFocused: (focused: boolean) => void

  // Expanded items in list view (for hierarchy)
  expandedItemIds: Set<string>
  toggleExpanded: (itemId: string) => void
  expandItem: (itemId: string) => void
  collapseItem: (itemId: string) => void

  // Editing state (for inline editing)
  editingItemId: string | null
  setEditingItemId: (id: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  // Selected item
  selectedItemId: null,
  setSelectedItemId: (id) => set({ selectedItemId: id }),

  // Details panel
  isDetailsPanelOpen: false,
  openDetailsPanel: (itemId) =>
    set({ selectedItemId: itemId, isDetailsPanelOpen: true }),
  closeDetailsPanel: () =>
    set({ isDetailsPanelOpen: false }),

  // Current view
  currentView: 'board',
  setCurrentView: (view) => set({ currentView: view }),

  // Quick add
  isQuickAddFocused: false,
  setQuickAddFocused: (focused) => set({ isQuickAddFocused: focused }),

  // Expanded items
  expandedItemIds: new Set<string>(),
  toggleExpanded: (itemId) =>
    set((state) => {
      const newSet = new Set(state.expandedItemIds)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return { expandedItemIds: newSet }
    }),
  expandItem: (itemId) =>
    set((state) => {
      const newSet = new Set(state.expandedItemIds)
      newSet.add(itemId)
      return { expandedItemIds: newSet }
    }),
  collapseItem: (itemId) =>
    set((state) => {
      const newSet = new Set(state.expandedItemIds)
      newSet.delete(itemId)
      return { expandedItemIds: newSet }
    }),

  // Editing state
  editingItemId: null,
  setEditingItemId: (id) => set({ editingItemId: id }),
}))
