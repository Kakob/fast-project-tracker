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

  // Item whose title placeholder should be cleared on first focus
  // (used when creating a fresh task from the week view)
  autoClearTitleItemId: string | null
  setAutoClearTitleItemId: (id: string | null) => void

  // Expanded projects in projects view
  expandedProjectIds: Set<string>
  toggleProjectExpanded: (projectId: string) => void
  expandProject: (projectId: string) => void
  collapseProject: (projectId: string) => void

  // Focus state for keyboard navigation
  focusedItemId: string | null
  setFocusedItemId: (id: string | null) => void
  focusedProjectId: string | null
  setFocusedProjectId: (id: string | null) => void

  // Keyboard shortcuts help
  isShortcutsHelpOpen: boolean
  toggleShortcutsHelp: () => void

  // Active timer state (for ticking display)
  activeTimerItemId: string | null
  activeTimerStartedAt: string | null
  timerElapsedSeconds: number
  setActiveTimer: (itemId: string, startedAt: string) => void
  clearActiveTimer: () => void
  setTimerElapsed: (seconds: number) => void
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

  // Auto-clear title (one-shot)
  autoClearTitleItemId: null,
  setAutoClearTitleItemId: (id) => set({ autoClearTitleItemId: id }),

  // Expanded projects
  expandedProjectIds: new Set<string>(),
  toggleProjectExpanded: (projectId) =>
    set((state) => {
      const newSet = new Set(state.expandedProjectIds)
      if (newSet.has(projectId)) {
        newSet.delete(projectId)
      } else {
        newSet.add(projectId)
      }
      return { expandedProjectIds: newSet }
    }),
  expandProject: (projectId) =>
    set((state) => {
      const newSet = new Set(state.expandedProjectIds)
      newSet.add(projectId)
      return { expandedProjectIds: newSet }
    }),
  collapseProject: (projectId) =>
    set((state) => {
      const newSet = new Set(state.expandedProjectIds)
      newSet.delete(projectId)
      return { expandedProjectIds: newSet }
    }),

  // Focus state
  focusedItemId: null,
  setFocusedItemId: (id) => set({ focusedItemId: id }),
  focusedProjectId: null,
  setFocusedProjectId: (id) => set({ focusedProjectId: id }),

  // Keyboard shortcuts help
  isShortcutsHelpOpen: false,
  toggleShortcutsHelp: () => set((state) => ({ isShortcutsHelpOpen: !state.isShortcutsHelpOpen })),

  // Active timer
  activeTimerItemId: null,
  activeTimerStartedAt: null,
  timerElapsedSeconds: 0,
  setActiveTimer: (itemId, startedAt) =>
    set({ activeTimerItemId: itemId, activeTimerStartedAt: startedAt }),
  clearActiveTimer: () =>
    set({ activeTimerItemId: null, activeTimerStartedAt: null, timerElapsedSeconds: 0 }),
  setTimerElapsed: (seconds) => set({ timerElapsedSeconds: seconds }),
}))
