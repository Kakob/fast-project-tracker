import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '@/lib/stores/ui-store'

const initialState = useUIStore.getState()

beforeEach(() => {
  useUIStore.setState(
    {
      ...initialState,
      selectedItemId: null,
      isDetailsPanelOpen: false,
      currentView: 'board',
      isQuickAddFocused: false,
      expandedItemIds: new Set<string>(),
      editingItemId: null,
      expandedProjectIds: new Set<string>(),
      focusedItemId: null,
      focusedProjectId: null,
      isShortcutsHelpOpen: false,
      activeTimerItemId: null,
      activeTimerStartedAt: null,
      timerElapsedSeconds: 0,
    },
    true,
  )
})

describe('ui-store', () => {
  describe('selected item', () => {
    it('setSelectedItemId updates the value', () => {
      useUIStore.getState().setSelectedItemId('item-1')
      expect(useUIStore.getState().selectedItemId).toBe('item-1')
    })

    it('setSelectedItemId can clear the value', () => {
      useUIStore.getState().setSelectedItemId('item-1')
      useUIStore.getState().setSelectedItemId(null)
      expect(useUIStore.getState().selectedItemId).toBeNull()
    })
  })

  describe('details panel', () => {
    it('openDetailsPanel sets selected item and opens panel', () => {
      useUIStore.getState().openDetailsPanel('item-7')

      const s = useUIStore.getState()
      expect(s.selectedItemId).toBe('item-7')
      expect(s.isDetailsPanelOpen).toBe(true)
    })

    it('closeDetailsPanel only closes the panel; selectedItemId is preserved', () => {
      useUIStore.getState().openDetailsPanel('item-7')
      useUIStore.getState().closeDetailsPanel()

      const s = useUIStore.getState()
      expect(s.isDetailsPanelOpen).toBe(false)
      expect(s.selectedItemId).toBe('item-7')
    })
  })

  describe('current view', () => {
    it('defaults to board', () => {
      expect(useUIStore.getState().currentView).toBe('board')
    })

    it('setCurrentView switches view', () => {
      useUIStore.getState().setCurrentView('list')
      expect(useUIStore.getState().currentView).toBe('list')

      useUIStore.getState().setCurrentView('calendar')
      expect(useUIStore.getState().currentView).toBe('calendar')
    })
  })

  describe('quick add focus', () => {
    it('setQuickAddFocused toggles the flag', () => {
      useUIStore.getState().setQuickAddFocused(true)
      expect(useUIStore.getState().isQuickAddFocused).toBe(true)

      useUIStore.getState().setQuickAddFocused(false)
      expect(useUIStore.getState().isQuickAddFocused).toBe(false)
    })
  })

  describe('expanded items', () => {
    it('toggleExpanded adds an id when missing', () => {
      useUIStore.getState().toggleExpanded('a')
      expect(useUIStore.getState().expandedItemIds.has('a')).toBe(true)
    })

    it('toggleExpanded removes an id when present', () => {
      useUIStore.getState().toggleExpanded('a')
      useUIStore.getState().toggleExpanded('a')
      expect(useUIStore.getState().expandedItemIds.has('a')).toBe(false)
    })

    it('expandItem is idempotent', () => {
      useUIStore.getState().expandItem('a')
      useUIStore.getState().expandItem('a')
      expect(useUIStore.getState().expandedItemIds.size).toBe(1)
    })

    it('collapseItem only removes the targeted id', () => {
      const store = useUIStore.getState()
      store.expandItem('a')
      store.expandItem('b')
      store.collapseItem('a')

      const s = useUIStore.getState()
      expect(s.expandedItemIds.has('a')).toBe(false)
      expect(s.expandedItemIds.has('b')).toBe(true)
    })

    it('toggleExpanded creates a new Set instance (immutability)', () => {
      const before = useUIStore.getState().expandedItemIds
      useUIStore.getState().toggleExpanded('a')
      const after = useUIStore.getState().expandedItemIds

      expect(after).not.toBe(before)
      expect(before.has('a')).toBe(false)
    })
  })

  describe('editing state', () => {
    it('setEditingItemId updates and clears', () => {
      useUIStore.getState().setEditingItemId('item-1')
      expect(useUIStore.getState().editingItemId).toBe('item-1')

      useUIStore.getState().setEditingItemId(null)
      expect(useUIStore.getState().editingItemId).toBeNull()
    })
  })

  describe('expanded projects', () => {
    it('toggleProjectExpanded adds and removes ids', () => {
      const store = useUIStore.getState()
      store.toggleProjectExpanded('p-1')
      expect(useUIStore.getState().expandedProjectIds.has('p-1')).toBe(true)

      store.toggleProjectExpanded('p-1')
      expect(useUIStore.getState().expandedProjectIds.has('p-1')).toBe(false)
    })

    it('expandProject and collapseProject are independent of expandedItemIds', () => {
      const store = useUIStore.getState()
      store.expandProject('p-1')
      store.expandItem('item-1')

      const s = useUIStore.getState()
      expect(s.expandedProjectIds.has('p-1')).toBe(true)
      expect(s.expandedProjectIds.has('item-1')).toBe(false)
      expect(s.expandedItemIds.has('item-1')).toBe(true)
      expect(s.expandedItemIds.has('p-1')).toBe(false)
    })
  })

  describe('focus state', () => {
    it('setFocusedItemId and setFocusedProjectId update independently', () => {
      const store = useUIStore.getState()
      store.setFocusedItemId('item-1')
      store.setFocusedProjectId('p-1')

      const s = useUIStore.getState()
      expect(s.focusedItemId).toBe('item-1')
      expect(s.focusedProjectId).toBe('p-1')
    })
  })

  describe('keyboard shortcuts help', () => {
    it('toggleShortcutsHelp flips the boolean', () => {
      expect(useUIStore.getState().isShortcutsHelpOpen).toBe(false)

      useUIStore.getState().toggleShortcutsHelp()
      expect(useUIStore.getState().isShortcutsHelpOpen).toBe(true)

      useUIStore.getState().toggleShortcutsHelp()
      expect(useUIStore.getState().isShortcutsHelpOpen).toBe(false)
    })
  })

  describe('active timer', () => {
    it('setActiveTimer stores item id and started_at', () => {
      useUIStore.getState().setActiveTimer('item-1', '2026-05-05T10:00:00Z')

      const s = useUIStore.getState()
      expect(s.activeTimerItemId).toBe('item-1')
      expect(s.activeTimerStartedAt).toBe('2026-05-05T10:00:00Z')
    })

    it('setTimerElapsed updates elapsed seconds', () => {
      useUIStore.getState().setTimerElapsed(42)
      expect(useUIStore.getState().timerElapsedSeconds).toBe(42)
    })

    it('clearActiveTimer resets all timer fields', () => {
      const store = useUIStore.getState()
      store.setActiveTimer('item-1', '2026-05-05T10:00:00Z')
      store.setTimerElapsed(120)
      store.clearActiveTimer()

      const s = useUIStore.getState()
      expect(s.activeTimerItemId).toBeNull()
      expect(s.activeTimerStartedAt).toBeNull()
      expect(s.timerElapsedSeconds).toBe(0)
    })
  })
})
